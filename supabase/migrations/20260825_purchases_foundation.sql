create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_name_unique on public.suppliers (name);
create index if not exists suppliers_active_idx on public.suppliers(is_active);

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number bigint generated always as identity unique,
  client_request_id uuid not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_invoice_number text,
  supplier_invoice_date date,
  total_amount numeric(18,4) not null default 0 check (total_amount >= 0),
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists purchases_supplier_id_idx on public.purchases(supplier_id);
create index if not exists purchases_created_at_idx on public.purchases(created_at desc);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_id uuid not null references public.inventory_units(id) on delete restrict,
  unit_price numeric(18,4) not null check (unit_price >= 0),
  line_total numeric(18,4) not null check (line_total >= 0),
  quantity_base numeric(18,3) not null check (quantity_base > 0),
  unit_cost_base numeric(18,4) not null check (unit_cost_base >= 0),
  created_at timestamptz not null default now()
);

create index if not exists purchase_items_purchase_id_idx on public.purchase_items(purchase_id);
create index if not exists purchase_items_inventory_item_id_idx on public.purchase_items(inventory_item_id);

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

drop policy if exists "suppliers admin read" on public.suppliers;
create policy "suppliers admin read" on public.suppliers
  for select to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "suppliers admin insert" on public.suppliers;
create policy "suppliers admin insert" on public.suppliers
  for insert to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "suppliers admin update" on public.suppliers;
create policy "suppliers admin update" on public.suppliers
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "purchases admin read" on public.purchases;
create policy "purchases admin read" on public.purchases
  for select to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "purchase items admin read" on public.purchase_items;
create policy "purchase items admin read" on public.purchase_items
  for select to authenticated
  using (public.current_user_role() = 'admin');

create or replace function public.create_inventory_purchase(
  p_client_request_id uuid,
  p_supplier_id uuid,
  p_supplier_invoice_number text default null,
  p_supplier_invoice_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_supplier public.suppliers%rowtype;
  created_purchase public.purchases%rowtype;
  existing_purchase public.purchases%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  quantity_value numeric(18,3);
  unit_price_value numeric(18,4);
  line_total_value numeric(18,4);
  quantity_base_value numeric(18,3);
  unit_cost_base_value numeric(18,4);
  quantity_before_value numeric(18,3);
  quantity_after_value numeric(18,3);
  new_average_cost numeric(18,4);
  running_total numeric(18,4) := 0;
  item_count integer := 0;
begin
  if requester_role <> 'admin' then
    raise exception 'Only admin users can manage purchases';
  end if;

  if p_client_request_id is null then
    raise exception 'Purchase request id is required';
  end if;

  select * into existing_purchase
  from public.purchases
  where client_request_id = p_client_request_id;

  if found then
    return jsonb_build_object('purchase_id', existing_purchase.id, 'duplicate', true);
  end if;

  select * into target_supplier
  from public.suppliers
  where id = p_supplier_id
  for update;

  if not found or not target_supplier.is_active then
    raise exception 'Supplier is not available';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase must contain at least one item';
  end if;

  insert into public.purchases (
    client_request_id,
    supplier_id,
    supplier_invoice_number,
    supplier_invoice_date,
    notes,
    created_by
  ) values (
    p_client_request_id,
    p_supplier_id,
    nullif(btrim(coalesce(p_supplier_invoice_number, '')), ''),
    p_supplier_invoice_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) returning * into created_purchase;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    quantity_value := nullif(item_payload ->> 'quantity', '')::numeric;
    unit_price_value := nullif(item_payload ->> 'unit_price', '')::numeric;

    if quantity_value is null or quantity_value <= 0 then
      raise exception 'Purchase item quantity must be greater than zero';
    end if;

    if unit_price_value is null or unit_price_value < 0 then
      raise exception 'Purchase item unit price cannot be negative';
    end if;

    select * into target_item
    from public.inventory_items
    where id = (item_payload ->> 'inventory_item_id')::uuid
    for update;

    if not found or not target_item.is_active then
      raise exception 'Inventory item is not available';
    end if;

    quantity_base_value := public.convert_inventory_quantity(quantity_value, (item_payload ->> 'unit_id')::uuid, target_item.base_unit_id);
    if quantity_base_value <= 0 then
      raise exception 'Converted purchase quantity must be greater than zero';
    end if;

    line_total_value := round(quantity_value * unit_price_value, 4);
    unit_cost_base_value := round(line_total_value / quantity_base_value, 4);
    quantity_before_value := target_item.stock_on_hand;
    quantity_after_value := quantity_before_value + quantity_base_value;

    if quantity_after_value <= 0 then
      new_average_cost := unit_cost_base_value;
    else
      new_average_cost := round(((quantity_before_value * target_item.average_cost) + line_total_value) / quantity_after_value, 4);
    end if;

    insert into public.purchase_items (
      purchase_id,
      inventory_item_id,
      quantity,
      unit_id,
      unit_price,
      line_total,
      quantity_base,
      unit_cost_base
    ) values (
      created_purchase.id,
      target_item.id,
      quantity_value,
      (item_payload ->> 'unit_id')::uuid,
      unit_price_value,
      line_total_value,
      quantity_base_value,
      unit_cost_base_value
    );

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity_delta,
      quantity_before,
      quantity_after,
      unit_cost,
      total_cost,
      source_type,
      source_id,
      notes,
      created_by
    ) values (
      target_item.id,
      'purchase',
      quantity_base_value,
      quantity_before_value,
      quantity_after_value,
      unit_cost_base_value,
      line_total_value,
      'purchase',
      created_purchase.id,
      'فاتورة شراء #' || created_purchase.purchase_number,
      auth.uid()
    );

    perform set_config('app.inventory_stock_write', 'on', true);

    update public.inventory_items
    set stock_on_hand = quantity_after_value,
        average_cost = new_average_cost,
        last_purchase_cost = unit_cost_base_value
    where id = target_item.id;

    perform set_config('app.inventory_stock_write', '', true);

    running_total := running_total + line_total_value;
    item_count := item_count + 1;
  end loop;

  update public.purchases
  set total_amount = running_total
  where id = created_purchase.id
  returning * into created_purchase;

  perform public.write_audit_log(
    'إضافة فاتورة شراء',
    'purchases',
    created_purchase.id,
    null,
    jsonb_build_object(
      'supplier_id', created_purchase.supplier_id,
      'total_amount', created_purchase.total_amount,
      'item_count', item_count
    )
  );

  return jsonb_build_object('purchase_id', created_purchase.id, 'duplicate', false);
end;
$$;

revoke all on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb) from public;
grant execute on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb) to authenticated;

grant select, insert, update on public.suppliers to authenticated;
grant select on public.purchases to authenticated;
grant select on public.purchase_items to authenticated;
