create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  constraint users_timezone_not_blank check (length(trim(timezone)) > 0)
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  daily_calorie_goal numeric check (daily_calorie_goal >= 0),
  daily_protein_goal numeric check (daily_protein_goal >= 0),
  daily_carbs_goal numeric check (daily_carbs_goal >= 0),
  daily_fat_goal numeric check (daily_fat_goal >= 0),
  monthly_spending_budget numeric check (monthly_spending_budget >= 0),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_timezone_not_blank check (length(trim(timezone)) > 0)
);

alter table public.users enable row level security;
alter table public.user_settings enable row level security;

create policy "Users can read their own profile" on public.users for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert their own profile" on public.users for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users can read their own settings" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own settings" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own settings" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name;

  insert into public.user_settings (user_id, timezone)
  values (new.id, 'Asia/Kolkata')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_auth_user();

insert into public.users (id, email, name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do nothing;

insert into public.user_settings (user_id, timezone)
select id, 'Asia/Kolkata'
from auth.users
on conflict (user_id) do nothing;
