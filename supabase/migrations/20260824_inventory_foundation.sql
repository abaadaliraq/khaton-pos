create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  unit_family text not null check (unit_family in ('weight', 'volume', 'count')),
  factor_to_base numeric(18,6) not null check (factor_to_base > 0),
  is_base_unit boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.inventory_units (code, name_ar, name_en, unit_family, factor_to_base, is_base_unit, sort_order)
values
  ('g', 'غرام', 'Gram', 'weight', 1, true, 10),
  ('kg', 'كغم', 'Kilogram', 'weight', 1000, false, 20),
  ('ml', 'مل', 'Milliliter', 'volume', 1, true, 30),
  ('l', 'لتر', 'Liter', 'volume', 1000, false, 40),
  ('piece', 'قطعة', 'Piece', 'count', 1, true, 50),
  ('pack', 'علبة', 'Pack', 'count', 1, false, 60),
  ('bottle', 'قنينة', 'Bottle', 'count', 1, false, 70)
on conflict (code) do update
set name_ar = excluded.name_ar,
    name_en = excluded.name_en,
    unit_family = excluded.unit_family,
    factor_to_base = excluded.factor_to_base,
    is_base_unit = excluded.is_base_unit,
    sort_order = excluded.sort_order;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  base_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  stock_on_hand numeric(18,3) not null default 0 check (stock_on_hand >= 0),
  minimum_stock numeric(18,3) not null default 0 check (minimum_stock >= 0),
  average_cost numeric(18,4) not null default 0 check (average_cost >= 0),
  last_purchase_cost numeric(18,4) not null default 0 check (last_purchase_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_items_name_ar_unique on public.inventory_items (name_ar);
create index if not exists inventory_items_base_unit_id_idx on public.inventory_items (base_unit_id);
create index if not exists inventory_items_active_idx on public.inventory_items (is_active);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening_balance', 'adjustment_in', 'adjustment_out', 'purchase', 'consumption', 'waste', 'return')),
  quantity_delta numeric(18,3) not null check (quantity_delta <> 0),
  quantity_before numeric(18,3) not null check (quantity_before >= 0),
  quantity_after numeric(18,3) not null check (quantity_after >= 0),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  total_cost numeric(18,4) not null default 0,
  source_type text,
  source_id uuid,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_item_id_idx on public.inventory_movements (inventory_item_id);
create index if not exists inventory_movements_type_idx on public.inventory_movements (movement_type);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements (created_at desc);
create unique index if not exists one_opening_balance_per_inventory_item_idx
  on public.inventory_movements (inventory_item_id)
  where movement_type = 'opening_balance';

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  yield_quantity numeric(18,3) not null default 1 check (yield_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_active_recipe_per_menu_item_idx
  on public.recipes (menu_item_id)
  where is_active;
create unique index if not exists recipes_menu_item_version_unique on public.recipes (menu_item_id, version);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_id uuid not null references public.inventory_units(id) on delete restrict,
  waste_percent numeric(8,4) not null default 0 check (waste_percent >= 0 and waste_percent < 100),
  created_at timestamptz not null default now()
);

create unique index if not exists recipe_items_recipe_inventory_unique on public.recipe_items (recipe_id, inventory_item_id);
create index if not exists recipe_items_recipe_id_idx on public.recipe_items (recipe_id);
create index if not exists recipe_items_inventory_item_id_idx on public.recipe_items (inventory_item_id);

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create or replace function public.require_inventory_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admin can manage inventory';
  end if;
end;
$$;

create or replace function public.convert_inventory_quantity(
  p_quantity numeric,
  p_from_unit_id uuid,
  p_to_unit_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_unit public.inventory_units%rowtype;
  to_unit public.inventory_units%rowtype;
begin
  if p_quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  select * into from_unit from public.inventory_units where id = p_from_unit_id;
  select * into to_unit from public.inventory_units where id = p_to_unit_id;

  if from_unit.id is null or to_unit.id is null then
    raise exception 'Inventory unit was not found';
  end if;

  if from_unit.unit_family <> to_unit.unit_family then
    raise exception 'Cannot convert between incompatible inventory units';
  end if;

  return round((p_quantity * from_unit.factor_to_base) / to_unit.factor_to_base, 3);
end;
$$;

create or replace function public.validate_inventory_item_base_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_unit public.inventory_units%rowtype;
begin
  select * into target_unit from public.inventory_units where id = new.base_unit_id;

  if target_unit.id is null or not target_unit.is_base_unit then
    raise exception 'Inventory item base unit must be a base unit';
  end if;

  if tg_op = 'UPDATE' and new.base_unit_id is distinct from old.base_unit_id then
    if exists (select 1 from public.inventory_movements where inventory_item_id = old.id) then
      raise exception 'Cannot change base unit after inventory movements exist';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_inventory_item_base_unit_trigger on public.inventory_items;
create trigger validate_inventory_item_base_unit_trigger before insert or update on public.inventory_items
  for each row execute function public.validate_inventory_item_base_unit();

create or replace function public.prevent_inventory_stock_direct_update()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT'
    and new.stock_on_hand <> 0
    and coalesce(current_setting('app.inventory_stock_write', true), '') <> 'on' then
    raise exception 'Inventory stock can only be initialized through inventory movement functions';
  end if;

  if tg_op = 'UPDATE'
    and new.stock_on_hand is distinct from old.stock_on_hand
    and coalesce(current_setting('app.inventory_stock_write', true), '') <> 'on' then
    raise exception 'Inventory stock can only be changed through inventory movement functions';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_inventory_stock_direct_update_trigger on public.inventory_items;
create trigger prevent_inventory_stock_direct_update_trigger before insert or update on public.inventory_items
  for each row execute function public.prevent_inventory_stock_direct_update();

create or replace function public.validate_recipe_item_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.inventory_items%rowtype;
begin
  select * into target_item from public.inventory_items where id = new.inventory_item_id;

  if target_item.id is null then
    raise exception 'Inventory item was not found';
  end if;

  perform public.convert_inventory_quantity(new.quantity, new.unit_id, target_item.base_unit_id);
  return new;
end;
$$;

drop trigger if exists validate_recipe_item_unit_trigger on public.recipe_items;
create trigger validate_recipe_item_unit_trigger before insert or update on public.recipe_items
  for each row execute function public.validate_recipe_item_unit();

create or replace function public.set_inventory_opening_balance(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_unit_id uuid,
  p_unit_cost numeric default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.inventory_items%rowtype;
  quantity_base numeric(18,3);
  quantity_before numeric(18,3);
  quantity_after numeric(18,3);
begin
  perform public.require_inventory_admin();

  if p_quantity <= 0 then
    raise exception 'Opening balance quantity must be greater than zero';
  end if;

  if coalesce(p_unit_cost, 0) < 0 then
    raise exception 'Unit cost cannot be negative';
  end if;

  select * into target_item from public.inventory_items where id = p_inventory_item_id for update;

  if target_item.id is null then
    raise exception 'Inventory item was not found';
  end if;

  if exists (
    select 1 from public.inventory_movements
    where inventory_item_id = p_inventory_item_id
      and movement_type = 'opening_balance'
  ) then
    raise exception 'Opening balance already exists for this inventory item';
  end if;

  quantity_base := public.convert_inventory_quantity(p_quantity, p_unit_id, target_item.base_unit_id);
  quantity_before := target_item.stock_on_hand;
  quantity_after := quantity_before + quantity_base;

  insert into public.inventory_movements (
    inventory_item_id,
    movement_type,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    total_cost,
    source_type,
    notes,
    created_by
  )
  values (
    p_inventory_item_id,
    'opening_balance',
    quantity_base,
    quantity_before,
    quantity_after,
    coalesce(p_unit_cost, 0),
    quantity_base * coalesce(p_unit_cost, 0),
    'opening_balance',
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  );

  perform set_config('app.inventory_stock_write', 'on', true);

  update public.inventory_items
  set stock_on_hand = quantity_after,
      average_cost = coalesce(p_unit_cost, 0),
      last_purchase_cost = coalesce(p_unit_cost, 0)
  where id = p_inventory_item_id
  returning * into target_item;

  perform set_config('app.inventory_stock_write', '', true);

  return jsonb_build_object(
    'inventory_item_id', target_item.id,
    'stock_on_hand', target_item.stock_on_hand
  );
end;
$$;

create or replace function public.adjust_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity_delta numeric,
  p_unit_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item public.inventory_items%rowtype;
  quantity_base numeric(18,3);
  quantity_before numeric(18,3);
  quantity_after numeric(18,3);
  next_type text;
begin
  perform public.require_inventory_admin();

  if p_quantity_delta = 0 then
    raise exception 'Adjustment quantity cannot be zero';
  end if;

  if nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'Adjustment reason is required';
  end if;

  select * into target_item from public.inventory_items where id = p_inventory_item_id for update;

  if target_item.id is null then
    raise exception 'Inventory item was not found';
  end if;

  quantity_base := public.convert_inventory_quantity(abs(p_quantity_delta), p_unit_id, target_item.base_unit_id);
  if p_quantity_delta < 0 then
    quantity_base := quantity_base * -1;
  end if;

  quantity_before := target_item.stock_on_hand;
  quantity_after := quantity_before + quantity_base;

  if quantity_after < 0 then
    raise exception 'Inventory stock cannot become negative';
  end if;

  next_type := case when quantity_base > 0 then 'adjustment_in' else 'adjustment_out' end;

  insert into public.inventory_movements (
    inventory_item_id,
    movement_type,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    total_cost,
    source_type,
    notes,
    created_by
  )
  values (
    p_inventory_item_id,
    next_type,
    quantity_base,
    quantity_before,
    quantity_after,
    target_item.average_cost,
    quantity_base * target_item.average_cost,
    'manual_adjustment',
    btrim(p_notes),
    auth.uid()
  );

  perform set_config('app.inventory_stock_write', 'on', true);

  update public.inventory_items
  set stock_on_hand = quantity_after
  where id = p_inventory_item_id
  returning * into target_item;

  perform set_config('app.inventory_stock_write', '', true);

  return jsonb_build_object(
    'inventory_item_id', target_item.id,
    'stock_on_hand', target_item.stock_on_hand,
    'quantity_delta', quantity_base
  );
end;
$$;

create or replace function public.get_recipe_cost_preview(p_recipe_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  payload jsonb;
begin
  if requester_role <> 'admin' then
    raise exception 'Only admin can read recipe costs';
  end if;

  select jsonb_build_object(
    'recipe_id', r.id,
    'menu_item_id', r.menu_item_id,
    'estimated_cost', coalesce(sum(
      public.convert_inventory_quantity(ri.quantity * (1 + (ri.waste_percent / 100)), ri.unit_id, ii.base_unit_id)
      * ii.average_cost
    ), 0)
  )
  into payload
  from public.recipes r
  left join public.recipe_items ri on ri.recipe_id = r.id
  left join public.inventory_items ii on ii.id = ri.inventory_item_id
  where r.id = p_recipe_id
  group by r.id, r.menu_item_id;

  return coalesce(payload, jsonb_build_object('recipe_id', p_recipe_id, 'estimated_cost', 0));
end;
$$;

alter table public.inventory_units enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

drop policy if exists "inventory units admin read" on public.inventory_units;
create policy "inventory units admin read" on public.inventory_units
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "inventory items admin read" on public.inventory_items;
create policy "inventory items admin read" on public.inventory_items
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "inventory items admin insert" on public.inventory_items;
create policy "inventory items admin insert" on public.inventory_items
  for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "inventory items admin update" on public.inventory_items;
create policy "inventory items admin update" on public.inventory_items
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "inventory movements admin read" on public.inventory_movements;
create policy "inventory movements admin read" on public.inventory_movements
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "recipes admin read" on public.recipes;
create policy "recipes admin read" on public.recipes
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "recipes admin insert" on public.recipes;
create policy "recipes admin insert" on public.recipes
  for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "recipes admin update" on public.recipes;
create policy "recipes admin update" on public.recipes
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "recipe items admin read" on public.recipe_items;
create policy "recipe items admin read" on public.recipe_items
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "recipe items admin insert" on public.recipe_items;
create policy "recipe items admin insert" on public.recipe_items
  for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "recipe items admin update" on public.recipe_items;
create policy "recipe items admin update" on public.recipe_items
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "recipe items admin delete" on public.recipe_items;
create policy "recipe items admin delete" on public.recipe_items
  for delete
  to authenticated
  using (public.current_user_role() = 'admin');

grant select on public.inventory_units to authenticated;
grant select, insert, update on public.inventory_items to authenticated;
grant select on public.inventory_movements to authenticated;
grant select, insert, update on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_items to authenticated;

revoke all on function public.require_inventory_admin() from public;
revoke all on function public.convert_inventory_quantity(numeric, uuid, uuid) from public;
revoke all on function public.set_inventory_opening_balance(uuid, numeric, uuid, numeric, text) from public;
revoke all on function public.adjust_inventory_stock(uuid, numeric, uuid, text) from public;
revoke all on function public.get_recipe_cost_preview(uuid) from public;

grant execute on function public.set_inventory_opening_balance(uuid, numeric, uuid, numeric, text) to authenticated;
grant execute on function public.adjust_inventory_stock(uuid, numeric, uuid, text) to authenticated;
grant execute on function public.get_recipe_cost_preview(uuid) to authenticated;
