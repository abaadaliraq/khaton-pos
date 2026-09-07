create table if not exists public.inventory_requisitions (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  destination text not null check (destination in ('kitchen', 'barista', 'bar', 'service', 'cleaning', 'management', 'other')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'issued', 'received', 'rejected', 'cancelled')),
  note text,
  rejection_reason text,
  requested_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  issued_by uuid references public.profiles(id) on delete restrict,
  issued_at timestamptz,
  received_by uuid references public.profiles(id) on delete restrict,
  received_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete restrict,
  rejected_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.inventory_requisitions(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  requested_quantity numeric(18,3) not null check (requested_quantity > 0),
  requested_unit_id uuid references public.inventory_units(id) on delete restrict,
  requested_conversion_id uuid references public.inventory_item_conversions(id) on delete restrict,
  requested_unit_label text not null check (length(btrim(requested_unit_label)) > 0),
  requested_quantity_base numeric(18,3) not null check (requested_quantity_base > 0),
  approved_quantity_base numeric(18,3) check (approved_quantity_base is null or approved_quantity_base > 0),
  issued_quantity_base numeric(18,3) check (issued_quantity_base is null or issued_quantity_base > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'issued', 'received')),
  notes text,
  created_at timestamptz not null default now(),
  constraint inventory_requisition_items_requested_unit_check
    check (
      (requested_unit_id is not null and requested_conversion_id is null)
      or (requested_unit_id is null and requested_conversion_id is not null)
    )
);

create index if not exists inventory_requisitions_status_idx on public.inventory_requisitions(status);
create index if not exists inventory_requisitions_destination_idx on public.inventory_requisitions(destination);
create index if not exists inventory_requisitions_requested_at_idx on public.inventory_requisitions(requested_at desc);
create index if not exists inventory_requisition_items_requisition_id_idx on public.inventory_requisition_items(requisition_id);
create index if not exists inventory_requisition_items_inventory_item_id_idx on public.inventory_requisition_items(inventory_item_id);

drop trigger if exists set_inventory_requisitions_updated_at on public.inventory_requisitions;
create trigger set_inventory_requisitions_updated_at before update on public.inventory_requisitions
  for each row execute function public.set_updated_at();

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in ('opening_balance', 'adjustment_in', 'adjustment_out', 'purchase', 'consumption', 'waste', 'return', 'stock_issue'));

alter table public.inventory_movements
  add column if not exists inventory_requisition_id uuid references public.inventory_requisitions(id) on delete set null,
  add column if not exists inventory_requisition_item_id uuid references public.inventory_requisition_items(id) on delete set null;

create index if not exists inventory_movements_requisition_id_idx on public.inventory_movements(inventory_requisition_id);
create index if not exists inventory_movements_requisition_item_id_idx on public.inventory_movements(inventory_requisition_item_id);

create or replace function public.requisition_destination_allowed(p_destination text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
begin
  if requester_role in ('admin', 'storekeeper') then
    return true;
  end if;

  return requester_role = 'kitchen' and p_destination = 'kitchen';
end;
$$;

create or replace function public.get_inventory_requisition_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  payload jsonb;
begin
  if requester_role not in ('admin', 'storekeeper', 'kitchen') then
    raise exception 'Only operational users can read requisition catalog';
  end if;

  select jsonb_build_object(
    'items', coalesce(jsonb_agg(distinct jsonb_build_object(
      'id', ii.id,
      'name_ar', ii.name_ar,
      'item_type', ii.item_type,
      'base_unit_id', ii.base_unit_id,
      'base_unit_code', bu.code,
      'base_unit_name_ar', bu.name_ar,
      'stock_on_hand', ii.stock_on_hand
    )) filter (where ii.id is not null), '[]'::jsonb),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', iu.id,
        'code', iu.code,
        'name_ar', iu.name_ar,
        'unit_family', iu.unit_family,
        'factor_to_base', iu.factor_to_base,
        'is_base_unit', iu.is_base_unit
      ) order by iu.sort_order), '[]'::jsonb)
      from public.inventory_units iu
    ),
    'conversions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', iic.id,
        'inventory_item_id', iic.inventory_item_id,
        'packaging_unit_name_ar', iic.packaging_unit_name_ar,
        'quantity_in_base_unit', iic.quantity_in_base_unit
      ) order by iic.packaging_unit_name_ar), '[]'::jsonb)
      from public.inventory_item_conversions iic
      where iic.is_active = true
    )
  )
  into payload
  from public.inventory_items ii
  join public.inventory_units bu on bu.id = ii.base_unit_id
  where ii.is_active = true;

  return coalesce(payload, jsonb_build_object('items', '[]'::jsonb, 'units', '[]'::jsonb, 'conversions', '[]'::jsonb));
end;
$$;

create or replace function public.resolve_inventory_requisition_quantity(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_unit_id uuid default null,
  p_conversion_id uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_item public.inventory_items%rowtype;
  target_conversion public.inventory_item_conversions%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Requisition quantity must be greater than zero';
  end if;

  if (p_unit_id is null and p_conversion_id is null)
    or (p_unit_id is not null and p_conversion_id is not null) then
    raise exception 'Choose either a generic unit or an item packaging unit';
  end if;

  select * into target_item
  from public.inventory_items
  where id = p_inventory_item_id;

  if not found or not target_item.is_active then
    raise exception 'Inventory item is not available';
  end if;

  if p_conversion_id is not null then
    select * into target_conversion
    from public.inventory_item_conversions
    where id = p_conversion_id
      and inventory_item_id = p_inventory_item_id
      and is_active = true;

    if not found then
      raise exception 'Inventory item conversion is not available';
    end if;

    return round(p_quantity * target_conversion.quantity_in_base_unit, 3);
  end if;

  return public.convert_inventory_quantity(p_quantity, p_unit_id, target_item.base_unit_id);
end;
$$;

create or replace function public.create_inventory_requisition(
  p_destination text,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  created_requisition public.inventory_requisitions%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  target_unit public.inventory_units%rowtype;
  target_conversion public.inventory_item_conversions%rowtype;
  quantity_value numeric(18,3);
  quantity_base_value numeric(18,3);
  unit_id_value uuid;
  conversion_id_value uuid;
  unit_label_value text;
  item_count integer := 0;
begin
  if requester_role not in ('admin', 'storekeeper', 'kitchen') then
    raise exception 'Only operational users can create inventory requisitions';
  end if;

  if not public.requisition_destination_allowed(p_destination) then
    raise exception 'This user cannot create a requisition for the selected destination';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory requisition must contain at least one item';
  end if;

  insert into public.inventory_requisitions (destination, note, requested_by)
  values (p_destination, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning * into created_requisition;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    quantity_value := nullif(item_payload ->> 'quantity', '')::numeric;
    unit_id_value := nullif(item_payload ->> 'unit_id', '')::uuid;
    conversion_id_value := nullif(item_payload ->> 'conversion_id', '')::uuid;

    if quantity_value is null or quantity_value <= 0 then
      raise exception 'Requisition item quantity must be greater than zero';
    end if;

    select * into target_item
    from public.inventory_items
    where id = (item_payload ->> 'inventory_item_id')::uuid;

    if not found or not target_item.is_active then
      raise exception 'Inventory item is not available';
    end if;

    quantity_base_value := public.resolve_inventory_requisition_quantity(target_item.id, quantity_value, unit_id_value, conversion_id_value);

    if conversion_id_value is not null then
      select * into target_conversion
      from public.inventory_item_conversions
      where id = conversion_id_value
        and inventory_item_id = target_item.id
        and is_active = true;
      unit_label_value := target_conversion.packaging_unit_name_ar;
    else
      select * into target_unit
      from public.inventory_units
      where id = unit_id_value;
      unit_label_value := target_unit.name_ar;
    end if;

    insert into public.inventory_requisition_items (
      requisition_id,
      inventory_item_id,
      requested_quantity,
      requested_unit_id,
      requested_conversion_id,
      requested_unit_label,
      requested_quantity_base,
      notes
    ) values (
      created_requisition.id,
      target_item.id,
      quantity_value,
      unit_id_value,
      conversion_id_value,
      unit_label_value,
      quantity_base_value,
      nullif(btrim(coalesce(item_payload ->> 'notes', '')), '')
    );

    item_count := item_count + 1;
  end loop;

  perform public.write_audit_log(
    'requisition_created',
    'inventory_requisitions',
    created_requisition.id,
    null,
    jsonb_build_object('destination', created_requisition.destination, 'item_count', item_count)
  );

  return jsonb_build_object(
    'requisition_id', created_requisition.id,
    'request_number', created_requisition.request_number
  );
end;
$$;

create or replace function public.approve_inventory_requisition(
  p_requisition_id uuid,
  p_items jsonb default '[]'::jsonb
)
returns public.inventory_requisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_requisition public.inventory_requisitions%rowtype;
  updated_requisition public.inventory_requisitions%rowtype;
  item_payload jsonb;
  target_item public.inventory_requisition_items%rowtype;
  approved_quantity_value numeric(18,3);
  rejected_value boolean;
  approved_count integer := 0;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can approve requisitions';
  end if;

  select * into target_requisition
  from public.inventory_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'Inventory requisition was not found';
  end if;

  if target_requisition.status <> 'pending' then
    raise exception 'Only pending requisitions can be approved';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Approval must contain at least one item';
  end if;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    rejected_value := coalesce((item_payload ->> 'rejected')::boolean, false);
    approved_quantity_value := nullif(item_payload ->> 'approved_quantity_base', '')::numeric;

    select * into target_item
    from public.inventory_requisition_items
    where id = (item_payload ->> 'item_id')::uuid
      and requisition_id = p_requisition_id
    for update;

    if not found then
      raise exception 'Inventory requisition item was not found';
    end if;

    if rejected_value then
      update public.inventory_requisition_items
      set status = 'rejected',
          approved_quantity_base = null,
          issued_quantity_base = null
      where id = target_item.id;
    else
      if approved_quantity_value is null or approved_quantity_value <= 0 then
        raise exception 'Approved quantity must be greater than zero';
      end if;

      if approved_quantity_value > target_item.requested_quantity_base then
        raise exception 'Approved quantity cannot exceed requested quantity';
      end if;

      update public.inventory_requisition_items
      set status = 'approved',
          approved_quantity_base = approved_quantity_value,
          issued_quantity_base = null
      where id = target_item.id;

      approved_count := approved_count + 1;
    end if;
  end loop;

  if exists (
    select 1
    from public.inventory_requisition_items
    where requisition_id = p_requisition_id
      and status = 'pending'
  ) then
    raise exception 'Approval must decide every requisition item';
  end if;

  if approved_count = 0 then
    update public.inventory_requisitions
    set status = 'rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = 'تم رفض جميع مواد الطلب'
    where id = p_requisition_id
    returning * into updated_requisition;
  else
    update public.inventory_requisitions
    set status = 'approved',
        approved_by = auth.uid(),
        approved_at = now()
    where id = p_requisition_id
    returning * into updated_requisition;
  end if;

  perform public.write_audit_log(
    case when approved_count = 0 then 'requisition_rejected' else 'requisition_approved' end,
    'inventory_requisitions',
    updated_requisition.id,
    to_jsonb(target_requisition),
    to_jsonb(updated_requisition)
  );

  return updated_requisition;
end;
$$;

create or replace function public.reject_inventory_requisition(
  p_requisition_id uuid,
  p_rejection_reason text
)
returns public.inventory_requisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_requisition public.inventory_requisitions%rowtype;
  updated_requisition public.inventory_requisitions%rowtype;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can reject requisitions';
  end if;

  if nullif(btrim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'Rejection reason is required';
  end if;

  select * into target_requisition
  from public.inventory_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'Inventory requisition was not found';
  end if;

  if target_requisition.status not in ('pending', 'approved') then
    raise exception 'Only pending or approved requisitions can be rejected';
  end if;

  update public.inventory_requisition_items
  set status = 'rejected',
      approved_quantity_base = null,
      issued_quantity_base = null
  where requisition_id = p_requisition_id
    and status in ('pending', 'approved');

  update public.inventory_requisitions
  set status = 'rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = btrim(p_rejection_reason)
  where id = p_requisition_id
  returning * into updated_requisition;

  perform public.write_audit_log('requisition_rejected', 'inventory_requisitions', updated_requisition.id, to_jsonb(target_requisition), to_jsonb(updated_requisition));

  return updated_requisition;
end;
$$;

create or replace function public.cancel_inventory_requisition(p_requisition_id uuid)
returns public.inventory_requisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_requisition public.inventory_requisitions%rowtype;
  updated_requisition public.inventory_requisitions%rowtype;
begin
  select * into target_requisition
  from public.inventory_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'Inventory requisition was not found';
  end if;

  if requester_role not in ('admin', 'storekeeper') and target_requisition.requested_by <> auth.uid() then
    raise exception 'Only the requester or inventory users can cancel this requisition';
  end if;

  if target_requisition.status not in ('pending', 'approved') then
    raise exception 'Only pending or approved requisitions can be cancelled';
  end if;

  update public.inventory_requisition_items
  set status = 'rejected'
  where requisition_id = p_requisition_id
    and status in ('pending', 'approved');

  update public.inventory_requisitions
  set status = 'cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now()
  where id = p_requisition_id
  returning * into updated_requisition;

  perform public.write_audit_log('requisition_cancelled', 'inventory_requisitions', updated_requisition.id, to_jsonb(target_requisition), to_jsonb(updated_requisition));

  return updated_requisition;
end;
$$;

create or replace function public.issue_inventory_requisition(p_requisition_id uuid)
returns public.inventory_requisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_requisition public.inventory_requisitions%rowtype;
  updated_requisition public.inventory_requisitions%rowtype;
  requisition_item record;
  target_item public.inventory_items%rowtype;
  quantity_before_value numeric(18,3);
  quantity_after_value numeric(18,3);
  issued_count integer := 0;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can issue requisitions';
  end if;

  select * into target_requisition
  from public.inventory_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'Inventory requisition was not found';
  end if;

  if target_requisition.status <> 'approved' then
    raise exception 'Only approved requisitions can be issued';
  end if;

  for requisition_item in
    select ri.*, ii.name_ar
    from public.inventory_requisition_items ri
    join public.inventory_items ii on ii.id = ri.inventory_item_id
    where ri.requisition_id = p_requisition_id
      and ri.status = 'approved'
      and ri.approved_quantity_base is not null
    order by ri.created_at, ri.id
  loop
    select * into target_item
    from public.inventory_items
    where id = requisition_item.inventory_item_id
    for update;

    if not found or not target_item.is_active then
      raise exception 'Inventory item is not available';
    end if;

    quantity_before_value := target_item.stock_on_hand;
    quantity_after_value := quantity_before_value - requisition_item.approved_quantity_base;

    if quantity_after_value < 0 then
      raise exception 'INSUFFICIENT_INVENTORY:%:%:%', target_item.name_ar, requisition_item.approved_quantity_base, quantity_before_value;
    end if;

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
      inventory_requisition_id,
      inventory_requisition_item_id,
      notes,
      created_by
    ) values (
      target_item.id,
      'stock_issue',
      requisition_item.approved_quantity_base * -1,
      quantity_before_value,
      quantity_after_value,
      target_item.average_cost,
      requisition_item.approved_quantity_base * target_item.average_cost * -1,
      'inventory_requisition',
      target_requisition.id,
      target_requisition.id,
      requisition_item.id,
      'صرف مواد داخلي REQ-' || lpad(target_requisition.request_number::text, 4, '0'),
      auth.uid()
    );

    perform set_config('app.inventory_stock_write', 'on', true);

    update public.inventory_items
    set stock_on_hand = quantity_after_value
    where id = target_item.id;

    perform set_config('app.inventory_stock_write', '', true);

    update public.inventory_requisition_items
    set status = 'issued',
        issued_quantity_base = requisition_item.approved_quantity_base
    where id = requisition_item.id;

    issued_count := issued_count + 1;
  end loop;

  if issued_count = 0 then
    raise exception 'Requisition has no approved items to issue';
  end if;

  update public.inventory_requisitions
  set status = 'issued',
      issued_by = auth.uid(),
      issued_at = now()
  where id = p_requisition_id
  returning * into updated_requisition;

  perform public.write_audit_log('requisition_issued', 'inventory_requisitions', updated_requisition.id, to_jsonb(target_requisition), to_jsonb(updated_requisition));

  return updated_requisition;
end;
$$;

create or replace function public.confirm_inventory_requisition_receipt(p_requisition_id uuid)
returns public.inventory_requisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_requisition public.inventory_requisitions%rowtype;
  updated_requisition public.inventory_requisitions%rowtype;
begin
  select * into target_requisition
  from public.inventory_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'Inventory requisition was not found';
  end if;

  if target_requisition.status <> 'issued' then
    raise exception 'Only issued requisitions can be received';
  end if;

  if requester_role not in ('admin', 'storekeeper') and not public.requisition_destination_allowed(target_requisition.destination) then
    raise exception 'This user cannot confirm receipt for this requisition';
  end if;

  update public.inventory_requisition_items
  set status = 'received'
  where requisition_id = p_requisition_id
    and status = 'issued';

  update public.inventory_requisitions
  set status = 'received',
      received_by = auth.uid(),
      received_at = now()
  where id = p_requisition_id
  returning * into updated_requisition;

  perform public.write_audit_log('requisition_received', 'inventory_requisitions', updated_requisition.id, to_jsonb(target_requisition), to_jsonb(updated_requisition));

  return updated_requisition;
end;
$$;

alter table public.inventory_requisitions enable row level security;
alter table public.inventory_requisition_items enable row level security;

drop policy if exists "inventory requisitions role read" on public.inventory_requisitions;
create policy "inventory requisitions role read"
  on public.inventory_requisitions
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
    or requested_by = auth.uid()
    or public.requisition_destination_allowed(destination)
  );

drop policy if exists "inventory requisition items role read" on public.inventory_requisition_items;
create policy "inventory requisition items role read"
  on public.inventory_requisition_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inventory_requisitions ir
      where ir.id = inventory_requisition_items.requisition_id
        and (
          public.current_user_role() in ('admin', 'storekeeper')
          or ir.requested_by = auth.uid()
          or public.requisition_destination_allowed(ir.destination)
        )
    )
  );

drop policy if exists "inventory units requisition read" on public.inventory_units;
create policy "inventory units requisition read"
  on public.inventory_units
  for select
  to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'kitchen'));

drop policy if exists "inventory items requisition read active" on public.inventory_items;
create policy "inventory items requisition read active"
  on public.inventory_items
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
    or (public.current_user_role() = 'kitchen' and is_active = true)
  );

drop policy if exists "inventory item conversions requisition read active" on public.inventory_item_conversions;
create policy "inventory item conversions requisition read active"
  on public.inventory_item_conversions
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
    or (
      public.current_user_role() = 'kitchen'
      and is_active = true
      and exists (
        select 1
        from public.inventory_items ii
        where ii.id = inventory_item_conversions.inventory_item_id
          and ii.is_active = true
      )
    )
  );

grant select on public.inventory_requisitions to authenticated;
grant select on public.inventory_requisition_items to authenticated;

revoke all on function public.requisition_destination_allowed(text) from public;
revoke all on function public.get_inventory_requisition_catalog() from public;
revoke all on function public.resolve_inventory_requisition_quantity(uuid, numeric, uuid, uuid) from public;
revoke all on function public.create_inventory_requisition(text, text, jsonb) from public;
revoke all on function public.approve_inventory_requisition(uuid, jsonb) from public;
revoke all on function public.reject_inventory_requisition(uuid, text) from public;
revoke all on function public.cancel_inventory_requisition(uuid) from public;
revoke all on function public.issue_inventory_requisition(uuid) from public;
revoke all on function public.confirm_inventory_requisition_receipt(uuid) from public;

grant execute on function public.requisition_destination_allowed(text) to authenticated;
grant execute on function public.get_inventory_requisition_catalog() to authenticated;
grant execute on function public.create_inventory_requisition(text, text, jsonb) to authenticated;
grant execute on function public.approve_inventory_requisition(uuid, jsonb) to authenticated;
grant execute on function public.reject_inventory_requisition(uuid, text) to authenticated;
grant execute on function public.cancel_inventory_requisition(uuid) to authenticated;
grant execute on function public.issue_inventory_requisition(uuid) to authenticated;
grant execute on function public.confirm_inventory_requisition_receipt(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'inventory_requisitions'
    ) then
      alter publication supabase_realtime add table public.inventory_requisitions;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'inventory_requisition_items'
    ) then
      alter publication supabase_realtime add table public.inventory_requisition_items;
    end if;
  end if;
end $$;
