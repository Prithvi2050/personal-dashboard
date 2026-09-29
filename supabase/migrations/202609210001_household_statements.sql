-- Statement ingestion is separate from Sprint 10 synthetic transactions.
create table public.spending_households(id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id), created_at timestamptz not null default now());
create table public.spending_members(user_id uuid primary key references public.users(id), household_id uuid not null references public.spending_households(id), display_name text not null, role text not null check(role in ('owner','member')));
create table public.spending_invites(household_id uuid primary key references public.spending_households(id), email text not null check(length(email) between 3 and 254), expires_at timestamptz not null default now()+interval '7 days');
create table public.spending_accounts(
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.spending_households(id), owner_id uuid not null references public.users(id),
 label text not null check(length(trim(label)) between 1 and 60), format text not null check(format in ('sbi-bank','sbi-card','axis-card')),
 last_four text not null default '' check(last_four ~ '^([0-9]{4})?$'), created_at timestamptz not null default now(), unique(household_id,label)
);
create table public.statement_drafts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id),household_id uuid not null references public.spending_households(id),files jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',confirmed_at timestamptz);
create table public.statement_imports(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.spending_households(id),account_id uuid not null references public.spending_accounts(id),file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),period_start date,period_end date,imported_by uuid not null references public.users(id),created_at timestamptz not null default now(),unique(account_id,file_hash));
create table public.statement_entries(
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.spending_households(id),account_id uuid not null references public.spending_accounts(id),import_id uuid not null references public.statement_imports(id),
 source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),date date not null check(date between '2000-01-01' and '2100-12-31'),
 merchant text not null check(length(trim(merchant)) between 1 and 160),amount bigint not null check(amount between 1 and 99999999999),direction text not null check(direction in ('debit','credit')),
 kind text not null check(kind in ('expense','emi','fee','emi_interest_included','refund','income','transfer','card_payment','financed_purchase')),
 category text not null check(category in ('Dining','Grocery','Shopping','Transport','Bills','Entertainment','Health','Travel','Household','Other')),
 original jsonb not null,revision integer not null default 0,created_at timestamptz not null default now(),unique(account_id,source_key),
 check((kind in ('expense','emi','fee','financed_purchase','emi_interest_included') and direction='debit') or (kind in ('refund','income') and direction='credit') or kind in ('transfer','card_payment'))
);
create index statement_entries_fingerprint on public.statement_entries(account_id,fingerprint);
create index statement_entries_date on public.statement_entries(household_id,date);
create table public.statement_entry_corrections(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.spending_households(id),entry_id uuid not null references public.statement_entries(id),changed_by uuid not null references public.users(id),before_values jsonb not null,after_values jsonb not null,created_at timestamptz not null default now());

create function public.my_spending_household() returns uuid language sql stable security definer set search_path='' as $$ select household_id from public.spending_members where user_id=auth.uid() $$;
create function public.my_verified_spending_email() returns text language sql stable security definer set search_path='' as $$ select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null $$;
alter table public.spending_households enable row level security;
alter table public.spending_members enable row level security;
alter table public.spending_invites enable row level security;
alter table public.spending_accounts enable row level security;
alter table public.statement_drafts enable row level security;
alter table public.statement_imports enable row level security;
alter table public.statement_entries enable row level security;
alter table public.statement_entry_corrections enable row level security;
create policy household_read on public.spending_households for select to authenticated using(id=public.my_spending_household());
create policy member_read on public.spending_members for select to authenticated using(household_id=public.my_spending_household());
create policy invite_read on public.spending_invites for select to authenticated using((household_id=public.my_spending_household() or email=public.my_verified_spending_email()) and expires_at>now());
create policy account_read on public.spending_accounts for select to authenticated using(household_id=public.my_spending_household());
create policy draft_read on public.statement_drafts for select to authenticated using(user_id=auth.uid() and household_id=public.my_spending_household() and expires_at>now());
create policy import_read on public.statement_imports for select to authenticated using(household_id=public.my_spending_household());
create policy entry_read on public.statement_entries for select to authenticated using(household_id=public.my_spending_household());
create policy correction_read on public.statement_entry_corrections for select to authenticated using(household_id=public.my_spending_household());
revoke all on public.statement_entry_corrections from anon,authenticated;
grant select on public.statement_entry_corrections to authenticated;
revoke all on public.spending_households,public.spending_members,public.spending_invites,public.spending_accounts,public.statement_drafts,public.statement_imports,public.statement_entries from anon,authenticated;
grant select on public.spending_households,public.spending_members,public.spending_invites,public.spending_accounts,public.statement_drafts,public.statement_imports,public.statement_entries to authenticated;

create function public.manage_spending_household(p_operation text,p_value text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid:=public.my_spending_household(); target uuid; owner_uid uuid;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 perform 1 from public.users where id=uid for update;
 hid:=public.my_spending_household();
 if p_operation='create' then
  if hid is not null then raise exception 'Already in a household'; end if;
  insert into public.spending_households(owner_id) values(uid) returning id into hid;
  insert into public.spending_members values(uid,hid,coalesce((select nullif(name,'') from public.users where id=uid),'Household owner'),'owner');
 elsif p_operation='accept' then
  if hid is not null then raise exception 'Already in a household'; end if;
  select household_id into hid from public.spending_invites where household_id=p_value::uuid and email=public.my_verified_spending_email() and expires_at>now();
  if hid is null then raise exception 'Invitation unavailable'; end if;
  perform 1 from public.spending_households where id=hid for update;
  -- Recheck after obtaining the household lock (revocation/capacity races).
  if not exists(select 1 from public.spending_invites where household_id=hid and email=public.my_verified_spending_email() and expires_at>now()) or (select count(*) from public.spending_members where household_id=hid)>=2 then raise exception 'Invitation unavailable'; end if;
  insert into public.spending_members values(uid,hid,coalesce((select nullif(name,'') from public.users where id=uid),'Household member'),'member');
  delete from public.spending_invites where household_id=hid;
 else
  select owner_id into owner_uid from public.spending_households where id=hid for update;
  if hid is null then raise exception 'Create or join a household first'; end if;
  if p_operation='leave' then
   if owner_uid=uid then raise exception 'Owner cannot leave; remove the member to stop sharing'; end if;
   delete from public.statement_drafts where user_id=uid;
   delete from public.spending_members where user_id=uid;
  else
   if owner_uid<>uid then raise exception 'Only the household owner can manage invitations'; end if;
   if p_operation='invite' then
    if p_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_value)>254 or lower(p_value)=public.my_verified_spending_email() then raise exception 'Use your partner''s sign-in email'; end if;
    if (select count(*) from public.spending_members where household_id=hid)>=2 then raise exception 'Household is full'; end if;
    insert into public.spending_invites(household_id,email) values(hid,lower(trim(p_value))) on conflict(household_id) do update set email=excluded.email,expires_at=now()+interval '7 days';
   elsif p_operation='revoke' then delete from public.spending_invites where household_id=hid;
   elsif p_operation='remove' then
    target:=p_value::uuid;
    if target=uid then raise exception 'Cannot remove owner'; end if;
    delete from public.statement_drafts where user_id=target and household_id=hid;
    delete from public.spending_members where user_id=target and household_id=hid;
   else raise exception 'Unknown household operation'; end if;
  end if;
 end if;
 return hid;
end $$;
create function public.add_spending_account(p_label text,p_format text,p_last_four text,p_owner uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare hid uuid:=public.my_spending_household(); result uuid;
begin
 if hid is null then raise exception 'Household required'; end if;
 perform 1 from public.spending_households where id=hid for update;
 if public.my_spending_household() is distinct from hid then raise exception 'Household access changed'; end if;
 if not exists(select 1 from public.spending_members where household_id=hid and user_id=p_owner) then raise exception 'Owner must be a household member'; end if;
 if (select count(*) from public.spending_accounts where household_id=hid)>=20 then raise exception 'Account limit reached'; end if;
 insert into public.spending_accounts(household_id,owner_id,label,format,last_four) values(hid,p_owner,trim(p_label),p_format,p_last_four) returning id into result; return result;
end $$;
create function public.stage_statement_files(p_files jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare hid uuid:=public.my_spending_household(); result uuid; f jsonb; r jsonb; total integer:=0;
begin
 if hid is null then raise exception 'Household required'; end if;
 perform 1 from public.users where id=auth.uid() for update;
 if public.my_spending_household() is distinct from hid then raise exception 'Household access changed'; end if;
 -- Expired review metadata is purged on the next staging operation; PDFs are never stored.
 delete from public.statement_drafts where expires_at<=now() or (user_id=auth.uid() and confirmed_at is not null);
 if (select count(*) from public.statement_drafts where user_id=auth.uid())>=5 then raise exception 'Discard an existing draft before uploading more'; end if;
 if p_files is null or jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 5 or octet_length(p_files::text)>1000000 then raise exception 'Invalid file batch'; end if;
 for f in select value from jsonb_array_elements(p_files) loop
  if coalesce(f->>'format','') not in ('sbi-bank','sbi-card','axis-card') or coalesce(f->>'hash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(f->'rows') is distinct from 'array' then raise exception 'Invalid statement'; end if;
  total:=total+jsonb_array_length(f->'rows');
  for r in select value from jsonb_array_elements(f->'rows') loop
   if coalesce(r->>'key','') !~ '^[a-f0-9]{64}$' or coalesce(r->>'fingerprint','') !~ '^[a-f0-9]{64}$' or coalesce(r->>'amount','') !~ '^[0-9]+$' or (r->>'amount')::bigint not between 1 and 99999999999 or coalesce(r->>'direction','') not in ('debit','credit') or length(coalesce(r->>'merchant','')) not between 1 and 160 or (r->>'date') is null or (r->>'date')::date not between '2000-01-01' and '2100-12-31' then raise exception 'Invalid transaction'; end if;
  end loop;
 end loop;
 if total not between 1 and 1000 then raise exception 'Use a batch of 1 to 1000 transactions'; end if;
 insert into public.statement_drafts(user_id,household_id,files) values(auth.uid(),hid,p_files) returning id into result; return result;
end $$;
create function public.discard_statement_draft(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin delete from public.statement_drafts where id=p_id and user_id=auth.uid(); end $$;

create function public.confirm_statement_draft(p_id uuid,p_choices jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare d public.statement_drafts; hid uuid:=public.my_spending_household(); choice jsonb; edit jsonb; f jsonb; r jsonb; acc public.spending_accounts; iid uuid; added integer:=0; changed integer; fi integer; ri integer;
begin
 if hid is null then raise exception 'Household required'; end if;
 -- Serialize household confirmations so potential duplicate checks cannot race.
 perform 1 from public.spending_households where id=hid for update;
 if public.my_spending_household() is distinct from hid then raise exception 'Household access changed'; end if;
 select * into d from public.statement_drafts where id=p_id and user_id=auth.uid() and household_id=hid for update;
 if not found or d.expires_at<=now() then raise exception 'Draft expired or unavailable'; end if;
 if d.confirmed_at is not null then return 0; end if;
 if p_choices is null or jsonb_typeof(p_choices)<>'array' or jsonb_array_length(p_choices)<>jsonb_array_length(d.files) or octet_length(p_choices::text)>1000000 then raise exception 'Review every file'; end if;
 if (select count(distinct value->>'file') from jsonb_array_elements(p_choices))<>jsonb_array_length(p_choices) then raise exception 'Repeated file choice'; end if;
 for choice in select value from jsonb_array_elements(p_choices) loop
  fi:=(choice->>'file')::integer;
  if fi is null or fi<0 or fi>=jsonb_array_length(d.files) then raise exception 'Invalid file index'; end if;
  f:=d.files->fi;
  select * into acc from public.spending_accounts where id=(choice->>'account')::uuid and household_id=hid and format=f->>'format';
  if not found then raise exception 'Choose a matching household account'; end if;
  if jsonb_typeof(choice->'rows') is distinct from 'array' or jsonb_array_length(choice->'rows')<>jsonb_array_length(f->'rows') then raise exception 'Review every transaction'; end if;
  if (select count(distinct value->>'index') from jsonb_array_elements(choice->'rows'))<>jsonb_array_length(choice->'rows') then raise exception 'Repeated row choice'; end if;
  insert into public.statement_imports(household_id,account_id,file_hash,period_start,period_end,imported_by) values(hid,acc.id,f->>'hash',(f->>'start')::date,(f->>'end')::date,auth.uid()) on conflict(account_id,file_hash) do nothing returning id into iid;
  if iid is null then continue; end if; -- A confirmed file never overwrites prior review.
  for edit in select value from jsonb_array_elements(choice->'rows') loop
   ri:=(edit->>'index')::integer;
   if ri is null or ri<0 or ri>=jsonb_array_length(f->'rows') then raise exception 'Invalid row index'; end if;
   if coalesce((edit->>'include')::boolean,false)=false then continue; end if;
   r:=f->'rows'->ri;
   if exists(select 1 from public.statement_entries where account_id=acc.id and fingerprint=r->>'fingerprint') and not coalesce((edit->>'keepDuplicate')::boolean,false) then raise exception 'Possible duplicate requires explicit review or exclusion'; end if;
   insert into public.statement_entries(household_id,account_id,import_id,source_key,fingerprint,date,merchant,amount,direction,kind,category,original)
   values(hid,acc.id,iid,r->>'key',r->>'fingerprint',(r->>'date')::date,trim(edit->>'merchant'),(r->>'amount')::bigint,r->>'direction',edit->>'kind',edit->>'category',r)
   on conflict(account_id,source_key) do nothing;
   get diagnostics changed=row_count; added:=added+changed;
  end loop;
 end loop;
 update public.statement_drafts set confirmed_at=now(),files='[]'::jsonb where id=p_id;
 return added;
end $$;
revoke all on function public.my_spending_household(),public.my_verified_spending_email(),public.manage_spending_household(text,text),public.add_spending_account(text,text,text,uuid),public.stage_statement_files(jsonb),public.discard_statement_draft(uuid),public.confirm_statement_draft(uuid,jsonb) from public,anon;
grant execute on function public.my_spending_household(),public.my_verified_spending_email(),public.manage_spending_household(text,text),public.add_spending_account(text,text,text,uuid),public.stage_statement_files(jsonb),public.discard_statement_draft(uuid),public.confirm_statement_draft(uuid,jsonb) to authenticated;

create function public.correct_statement_entry(p_id uuid,p_revision integer,p_merchant text,p_kind text,p_category text) returns void language plpgsql security definer set search_path='' as $$
declare hid uuid:=public.my_spending_household(); before_row public.statement_entries; after_row public.statement_entries;
begin
 if hid is null then raise exception 'Household required'; end if;
 perform 1 from public.spending_households where id=hid for update;
 if public.my_spending_household() is distinct from hid then raise exception 'Household access changed'; end if;
 select * into before_row from public.statement_entries where id=p_id and household_id=hid for update;
 if not found then raise exception 'Transaction unavailable'; end if;
 if p_revision is null or before_row.revision<>p_revision then raise exception 'Stale revision; refresh before editing'; end if;
 update public.statement_entries set merchant=trim(p_merchant),kind=p_kind,category=p_category,revision=revision+1 where id=p_id returning * into after_row;
 insert into public.statement_entry_corrections(household_id,entry_id,changed_by,before_values,after_values) values(hid,p_id,auth.uid(),jsonb_build_object('merchant',before_row.merchant,'kind',before_row.kind,'category',before_row.category,'revision',before_row.revision),jsonb_build_object('merchant',after_row.merchant,'kind',after_row.kind,'category',after_row.category,'revision',after_row.revision));
end $$;
revoke all on function public.correct_statement_entry(uuid,integer,text,text,text) from public,anon;
grant execute on function public.correct_statement_entry(uuid,integer,text,text,text) to authenticated;
