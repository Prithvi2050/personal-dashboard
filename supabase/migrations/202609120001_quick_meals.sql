begin;
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  meal_type text not null check (meal_type in ('Breakfast','Lunch','Snack','Dinner','Other')),
  meal_time timestamptz not null default now(),
  total_calories numeric not null default 0 check (total_calories >= 0),
  total_protein numeric not null default 0 check (total_protein >= 0),
  total_carbs numeric not null default 0 check (total_carbs >= 0),
  total_fat numeric not null default 0 check (total_fat >= 0),
  created_at timestamptz not null default now(),
  unique(user_id, request_id), unique(id, user_id)
);
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  meal_id uuid not null,
  food_id uuid not null,
  utensil_id uuid,
  food_name text not null,
  source text not null,
  serving_basis text not null check (serving_basis in ('g','ml','piece')),
  serving_quantity numeric not null check (serving_quantity > 0),
  quantity numeric not null check (quantity > 0 and quantity <= 10000),
  portion_fraction numeric check (portion_fraction in (0.25,0.5,0.75,1)),
  utensil_name text,
  full_serving_grams numeric,
  calories numeric not null check (calories >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  fat numeric not null check (fat >= 0),
  user_confirmed boolean not null default true,
  position integer not null check (position between 1 and 20),
  created_at timestamptz not null default now(),
  foreign key (meal_id, user_id) references public.meals(id, user_id) on delete cascade,
  foreign key (food_id, user_id) references public.foods(id, user_id),
  foreign key (utensil_id, user_id) references public.utensils(id, user_id),
  unique(meal_id, position)
);
create index meals_owner_time on public.meals(user_id, meal_time);
create index meal_items_owner_meal on public.meal_items(user_id, meal_id);
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
create policy meals_read_own on public.meals for select to authenticated using (user_id = (select auth.uid()));
create policy meal_items_read_own on public.meal_items for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.meals, public.meal_items from public, anon, authenticated;
grant select on public.meals, public.meal_items to authenticated;

-- The only write entry point: calculate from owned database records, not browser
-- totals. Definer is necessary because direct table writes are intentionally denied.
create function public.save_quick_meal(p_request_id uuid, p_meal_type text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  meal_id_value uuid;
  item jsonb;
  food public.foods%rowtype;
  utensil public.utensils%rowtype;
  weight numeric;
  qty numeric;
  fraction numeric;
  factor numeric;
  item_position integer := 0;
begin
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_request_id is null or p_meal_type is null or p_meal_type not in ('Breakfast','Lunch','Snack','Dinner','Other') then raise exception 'Invalid meal'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid items'; end if;
  if jsonb_array_length(p_items) not between 1 and 20 or octet_length(p_items::text) > 12000 then raise exception 'Invalid items'; end if;
  -- A concurrent duplicate waits on the unique constraint and returns the first
  -- committed meal. Failed requests roll back both the header and every item.
  insert into public.meals(user_id, request_id, meal_type)
    values(owner_id, p_request_id, p_meal_type)
    on conflict (user_id, request_id) do nothing returning id into meal_id_value;
  if meal_id_value is null then
    select id into meal_id_value from public.meals where user_id = owner_id and request_id = p_request_id;
    return meal_id_value;
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    item_position := item_position + 1;
    if jsonb_typeof(item) <> 'object' then raise exception 'Invalid item'; end if;
    select * into food from public.foods where id = (item->>'food_id')::uuid and user_id = owner_id for share;
    if not found then raise exception 'Food unavailable'; end if;
    weight := null; fraction := null; utensil := null;
    if item->>'utensil_id' is not null then
      if food.serving_basis <> 'g' or item->>'quantity' is not null then raise exception 'Invalid calibrated portion'; end if;
      if jsonb_typeof(item->'fraction') is distinct from 'number' then raise exception 'Invalid fraction'; end if;
      fraction := (item->>'fraction')::numeric;
      if fraction not in (0.25,0.5,0.75,1) then raise exception 'Invalid fraction'; end if;
      select * into utensil from public.utensils where id = (item->>'utensil_id')::uuid and user_id = owner_id for share;
      if not found then raise exception 'Utensil unavailable'; end if;
      select full_serving_grams into weight from public.utensil_food_profiles
        where user_id = owner_id and food_id = food.id and utensil_id = utensil.id for share;
      if not found then raise exception 'Calibration unavailable'; end if;
      qty := weight * fraction;
    else
      if item->>'fraction' is not null or jsonb_typeof(item->'quantity') is distinct from 'number' then raise exception 'Invalid quantity'; end if;
      qty := (item->>'quantity')::numeric;
      if qty <> round(qty, 2) then raise exception 'Invalid quantity precision'; end if;
    end if;
    if qty is null or qty <= 0 or qty > 10000 then raise exception 'Invalid quantity'; end if;
    factor := qty / food.serving_quantity;
    insert into public.meal_items(user_id, meal_id, food_id, utensil_id, food_name, source,
      serving_basis, serving_quantity, quantity, portion_fraction, utensil_name, full_serving_grams,
      calories, protein, carbs, fat, position)
    values(owner_id, meal_id_value, food.id, utensil.id, food.name, food.source,
      food.serving_basis, food.serving_quantity, qty, fraction, utensil.name, weight,
      round(food.calories * factor, 1), round(food.protein * factor, 1), round(food.carbs * factor, 1), round(food.fat * factor, 1), item_position);
  end loop;
  update public.meals set
    total_calories = totals.c, total_protein = totals.p, total_carbs = totals.cb, total_fat = totals.f
  from (select sum(calories) c, sum(protein) p, sum(carbs) cb, sum(fat) f from public.meal_items where meal_id = meal_id_value and user_id = owner_id) totals
  where id = meal_id_value and user_id = owner_id;
  return meal_id_value;
end;
$$;
revoke all on function public.save_quick_meal(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_quick_meal(uuid, text, jsonb) to authenticated;
commit;
