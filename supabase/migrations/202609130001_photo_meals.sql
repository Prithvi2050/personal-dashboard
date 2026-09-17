begin;
create table public.photo_drafts (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  photo_path text not null check (photo_path = user_id::text || '/' || id::text || '.jpg'),
  model text not null check (length(model) between 1 and 100),
  result jsonb check (result is null or (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 20000)),
  reference_ids uuid[] not null default '{}',
  meal_id uuid,
  created_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key(meal_id,user_id) references public.meals(id,user_id),
  check(status <> 'ready' or result is not null)
);
create index photo_drafts_owner_time on public.photo_drafts(user_id,created_at);
alter table public.photo_drafts enable row level security;
create policy photo_drafts_read on public.photo_drafts for select to authenticated using(user_id=(select auth.uid()));
create policy photo_drafts_finish on public.photo_drafts for update to authenticated
  using(user_id=(select auth.uid()) and status='processing')
  with check(user_id=(select auth.uid()) and status in ('ready','failed'));
revoke all on public.photo_drafts from public,anon,authenticated;
grant select on public.photo_drafts to authenticated;
grant update(status,result) on public.photo_drafts to authenticated;
alter table public.meals add column photo_path text, add column photo_draft_id uuid;
alter table public.meals add constraint meals_photo_owner foreign key(photo_draft_id,user_id) references public.photo_drafts(id,user_id);
alter table public.meal_items add column ai_detection jsonb;

create function public.claim_photo_analysis(p_id uuid,p_model text,p_references uuid[])
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_id is null or p_model is null or length(p_model) not between 1 and 100 or p_references is null or cardinality(p_references)>3 then raise exception 'Invalid analysis request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  if exists(select 1 from public.photo_drafts where id=p_id and user_id=owner_id) then return false; end if;
  if (select count(*) from public.photo_drafts where user_id=owner_id and created_at>now()-interval '24 hours')>=20 then raise exception 'Daily analysis limit reached'; end if;
  if exists(select 1 from unnest(p_references) ref where not exists(select 1 from public.utensils where id=ref and user_id=owner_id)) then raise exception 'Reference unavailable'; end if;
  insert into public.photo_drafts(id,user_id,photo_path,model,reference_ids) values(p_id,owner_id,owner_id::text||'/'||p_id::text||'.jpg',p_model,p_references);
  return true;
end; $$;
revoke all on function public.claim_photo_analysis(uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.claim_photo_analysis(uuid,text,uuid[]) to authenticated;

create function public.save_photo_meal(p_draft_id uuid,p_meal_type text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); draft public.photo_drafts%rowtype; item jsonb; detection jsonb; item_index integer:=0; source_index integer; saved_id uuid;
begin
  if owner_id is null then raise exception 'Sign in required'; end if;
  select * into draft from public.photo_drafts where id=p_draft_id and user_id=owner_id for update;
  if not found or draft.status<>'ready' then raise exception 'Analysis unavailable'; end if;
  if draft.meal_id is not null then return draft.meal_id; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid review'; end if;
  if jsonb_array_length(p_items) not between 1 and 20 or octet_length(p_items::text)>12000 then raise exception 'Invalid review'; end if;
  if exists(select 1 from public.meals where user_id=owner_id and request_id=p_draft_id) then raise exception 'Request already used'; end if;
  -- A photo path must correspond to an actual private upload, not arbitrary URL text.
  if not exists(select 1 from storage.objects where bucket_id='meal-images' and name=draft.photo_path) then raise exception 'Photo unavailable'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if item->'reviewed' is distinct from 'true'::jsonb then raise exception 'Confirm each food and portion'; end if;
    if item->>'source_index' is not null then
      if jsonb_typeof(item->'source_index')<>'number' or (item->>'source_index')::numeric<>trunc((item->>'source_index')::numeric) then raise exception 'Invalid detection'; end if;
      source_index:=(item->>'source_index')::integer;
      if source_index<0 or source_index>=jsonb_array_length(draft.result->'items') then raise exception 'Invalid detection'; end if;
    end if;
  end loop;
  saved_id:=public.save_quick_meal(p_draft_id,p_meal_type,p_items);
  update public.meals set photo_path=draft.photo_path,photo_draft_id=draft.id,meal_time=draft.created_at where id=saved_id and user_id=owner_id;
  for item in select value from jsonb_array_elements(p_items) loop
    item_index:=item_index+1;
    detection:=case when item->>'source_index' is null then null else draft.result->'items'->((item->>'source_index')::integer) end;
    update public.meal_items set ai_detection=detection where meal_id=saved_id and user_id=owner_id and position=item_index;
  end loop;
  update public.photo_drafts set meal_id=saved_id where id=draft.id and user_id=owner_id;
  return saved_id;
end; $$;
revoke all on function public.save_photo_meal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_photo_meal(uuid,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meal-images','meal-images',false,3145728,array['image/jpeg']);
create policy meal_images_read on storage.objects for select to authenticated
using(bucket_id='meal-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy meal_images_insert on storage.objects for insert to authenticated
with check(bucket_id='meal-images' and exists(select 1 from public.photo_drafts where user_id=(select auth.uid()) and status='processing' and photo_path=name));
-- No client deletion or overwriting of retained meal photos. Failed upload cleanup
-- and long-term retention are manual administrative operations in this sprint.
commit;
