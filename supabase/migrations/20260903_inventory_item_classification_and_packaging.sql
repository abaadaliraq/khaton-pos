alter table public.inventory_items
  add column if not exists item_type text;

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check;

alter table public.inventory_items
  add constraint inventory_items_item_type_check
  check (item_type in ('food_recipe', 'food_indirect', 'packaging', 'cleaning', 'operational_consumable'));

update public.inventory_items
set item_type = 'food_recipe'
where item_type is null
  and exists (
    select 1
    from public.recipe_items
    where recipe_items.inventory_item_id = inventory_items.id
  );

update public.inventory_items
set item_type = 'operational_consumable'
where item_type is null;

alter table public.inventory_items
  alter column item_type set default 'operational_consumable',
  alter column item_type set not null;

create index if not exists inventory_items_item_type_idx
  on public.inventory_items(item_type);

create table if not exists public.inventory_item_conversions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  packaging_unit_name_ar text not null check (length(btrim(packaging_unit_name_ar)) > 0),
  packaging_unit_name_en text,
  quantity_in_base_unit numeric(18,3) not null check (quantity_in_base_unit > 0),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_item_conversions_item_id_idx
  on public.inventory_item_conversions(inventory_item_id);

create unique index if not exists inventory_item_conversions_active_name_unique
  on public.inventory_item_conversions(inventory_item_id, lower(btrim(packaging_unit_name_ar)))
  where is_active;

drop trigger if exists set_inventory_item_conversions_updated_at on public.inventory_item_conversions;
create trigger set_inventory_item_conversions_updated_at before update on public.inventory_item_conversions
  for each row execute function public.set_updated_at();

create or replace function public.set_inventory_item_conversion_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_inventory_item_conversions_updated_by on public.inventory_item_conversions;
create trigger set_inventory_item_conversions_updated_by before update on public.inventory_item_conversions
  for each row execute function public.set_inventory_item_conversion_updated_by();

alter table public.inventory_item_conversions enable row level security;

drop policy if exists "inventory item conversions inventory read" on public.inventory_item_conversions;
create policy "inventory item conversions inventory read"
  on public.inventory_item_conversions
  for select
  to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "inventory item conversions inventory insert" on public.inventory_item_conversions;
create policy "inventory item conversions inventory insert"
  on public.inventory_item_conversions
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "inventory item conversions inventory update" on public.inventory_item_conversions;
create policy "inventory item conversions inventory update"
  on public.inventory_item_conversions
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'))
  with check (public.current_user_role() in ('admin', 'storekeeper'));

grant select, insert, update on public.inventory_item_conversions to authenticated;

revoke all on function public.set_inventory_item_conversion_updated_by() from public;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'inventory_item_conversions'
    ) then
      alter publication supabase_realtime add table public.inventory_item_conversions;
    end if;
  end if;
end $$;
