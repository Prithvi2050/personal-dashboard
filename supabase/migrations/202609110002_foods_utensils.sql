begin;
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  serving_basis text not null check (serving_basis in ('g','ml','piece')),
  serving_quantity numeric not null check (serving_quantity between 0.01 and 1000000),
  calories numeric not null check (calories between 0 and 1000000),
  protein numeric not null check (protein between 0 and 1000000),
  carbs numeric not null check (carbs between 0 and 1000000),
  fat numeric not null check (fat between 0 and 1000000),
  source text not null check (length(trim(source)) between 1 and 240),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.utensils (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  type text not null check (type in ('bowl','plate','cup','glass','spoon','other')),
  capacity_ml numeric check (capacity_ml between 0.01 and 1000000),
  diameter_cm numeric check (diameter_cm between 0.01 and 1000000),
  height_cm numeric check (height_cm between 0.01 and 1000000),
  reference_image_path text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (reference_image_path is null or (split_part(reference_image_path, '/', 1) = user_id::text and reference_image_path not like '%..%'))
);
create table public.utensil_food_profiles (
  user_id uuid not null references public.users(id) on delete cascade,
  utensil_id uuid not null,
  food_id uuid not null,
  full_serving_grams numeric not null check (full_serving_grams between 0.01 and 1000000),
  primary key (utensil_id, food_id),
  foreign key (utensil_id, user_id) references public.utensils(id, user_id) on delete cascade,
  foreign key (food_id, user_id) references public.foods(id, user_id) on delete cascade
);
create index foods_owner on public.foods(user_id);
create index utensils_owner on public.utensils(user_id);
create index calibration_owner on public.utensil_food_profiles(user_id);
alter table public.foods enable row level security;
alter table public.utensils enable row level security;
alter table public.utensil_food_profiles enable row level security;
create policy foods_select on public.foods for select to authenticated using (user_id = (select auth.uid()));
create policy foods_insert on public.foods for insert to authenticated with check (user_id = (select auth.uid()));
create policy foods_update on public.foods for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy utensils_select on public.utensils for select to authenticated using (user_id = (select auth.uid()));
create policy utensils_insert on public.utensils for insert to authenticated with check (user_id = (select auth.uid()));
create policy utensils_update on public.utensils for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy calibration_select on public.utensil_food_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy calibration_insert on public.utensil_food_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy calibration_update on public.utensil_food_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.foods, public.utensils, public.utensil_food_profiles from anon;
grant select, insert, update on public.foods, public.utensils, public.utensil_food_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('utensil-images', 'utensil-images', false, 3145728, array['image/jpeg','image/png','image/webp']);
create policy utensil_images_read on storage.objects for select to authenticated
using (bucket_id = 'utensil-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy utensil_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'utensil-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy utensil_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'utensil-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
