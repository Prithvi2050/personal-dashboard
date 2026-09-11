-- Apply once after 202609100001_create_users.sql. Existing goals are preserved.
begin;

alter table public.user_settings add column if not exists onboarding_completed_at timestamptz;

-- Invoker security preserves the caller's RLS. Both timezone writes are atomic.
create or replace function public.save_user_settings(
  p_calories numeric, p_protein numeric, p_carbs numeric, p_fat numeric,
  p_budget numeric, p_timezone text
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_calories is null or p_calories not between 0.01 and 1000000000
    or p_protein is null or p_protein not between 0.01 and 1000000000
    or p_budget is null or p_budget not between 0 and 1000000000
    or (p_carbs is not null and p_carbs not between 0 and 1000000000)
    or (p_fat is not null and p_fat not between 0 and 1000000000)
  then raise exception 'Invalid goal or budget' using errcode = '22023'; end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
  then raise exception 'Invalid timezone' using errcode = '22023'; end if;

  update public.users set timezone = p_timezone where id = caller;
  if not found then raise exception 'Profile is missing'; end if;

  update public.user_settings set
    daily_calorie_goal = p_calories, daily_protein_goal = p_protein,
    daily_carbs_goal = p_carbs, daily_fat_goal = p_fat,
    monthly_spending_budget = p_budget, timezone = p_timezone,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()), updated_at = now()
  where user_id = caller;
  if not found then raise exception 'Settings are missing'; end if;
end;
$$;

revoke all on function public.save_user_settings(numeric, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.save_user_settings(numeric, numeric, numeric, numeric, numeric, text) to authenticated;

commit;
