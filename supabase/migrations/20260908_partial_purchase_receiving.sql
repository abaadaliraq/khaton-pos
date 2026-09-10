alter table public.purchase_request_items
  add column if not exists received_quantity numeric(18,3) not null default 0;

update public.purchase_request_items pri
set received_quantity = least(
  pri.quantity,
  coalesce(
    (
      select sum(pi.quantity)::numeric(18,3)
      from public.purchases p
      join public.purchase_items pi on pi.purchase_id = p.id
      where p.purchase_request_id = pri.purchase_request_id
        and pi.inventory_item_id = pri.inventory_item_id
        and pi.unit_id = pri.unit_id
    ),
    case when pr.status = 'received' then pri.quantity else 0 end
  )
)
from public.purchase_requests pr
where pr.id = pri.purchase_request_id;

alter table public.purchase_request_items
  drop constraint if exists purchase_request_items_received_quantity_check;

alter table public.purchase_request_items
  add constraint purchase_request_items_received_quantity_check
  check (received_quantity >= 0 and received_quantity <= quantity);

alter table public.purchase_requests
  drop constraint if exists purchase_requests_status_check;

alter table public.purchase_requests
  add constraint purchase_requests_status_check
  check (status in ('pending', 'approved', 'partially_received', 'rejected', 'received', 'cancelled'));

drop index if exists public.purchases_purchase_request_unique;

create index if not exists purchases_purchase_request_id_idx
  on public.purchases(purchase_request_id)
  where purchase_request_id is not null;

create index if not exists purchase_request_items_receiving_idx
  on public.purchase_request_items(purchase_request_id, inventory_item_id, unit_id);

update public.purchase_requests pr
set status = case
    when exists (
      select 1
      from public.purchase_request_items pri
      where pri.purchase_request_id = pr.id
        and pri.received_quantity > 0
    )
    and exists (
      select 1
      from public.purchase_request_items pri
      where pri.purchase_request_id = pr.id
        and pri.received_quantity < pri.quantity
    ) then 'partially_received'
    when exists (
      select 1
      from public.purchase_request_items pri
      where pri.purchase_request_id = pr.id
        and pri.received_quantity > 0
    )
    and not exists (
      select 1
      from public.purchase_request_items pri
      where pri.purchase_request_id = pr.id
        and pri.received_quantity < pri.quantity
    ) then 'received'
    else pr.status
  end
where pr.status in ('approved', 'received');

create or replace function public.create_inventory_purchase(
  p_client_request_id uuid,
  p_supplier_id uuid,
  p_supplier_invoice_number text default null,
  p_supplier_invoice_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_purchase_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_supplier public.suppliers%rowtype;
  target_request public.purchase_requests%rowtype;
  created_purchase public.purchases%rowtype;
  existing_purchase public.purchases%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  target_request_item public.purchase_request_items%rowtype;
  requested_unit_id uuid;
  quantity_value numeric(18,3);
  unit_price_value numeric(18,4);
  line_total_value numeric(18,4);
  quantity_base_value numeric(18,3);
  unit_cost_base_value numeric(18,4);
  quantity_before_value numeric(18,3);
  quantity_after_value numeric(18,3);
  new_average_cost numeric(18,4);
  remaining_value numeric(18,3);
  running_total numeric(18,4) := 0;
  item_count integer := 0;
  batch_received_quantity numeric(18,3) := 0;
  batch_remaining_before numeric(18,3) := 0;
  request_completed boolean := false;
  next_request_status text;
  audit_action text;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only storekeeper or admin users can receive purchases';
  end if;

  if p_client_request_id is null then
    raise exception 'Purchase client request id is required';
  end if;

  select * into existing_purchase
  from public.purchases
  where client_request_id = p_client_request_id;

  if found then
    return jsonb_build_object('purchase_id', existing_purchase.id, 'duplicate', true);
  end if;

  if p_purchase_request_id is not null then
    select * into target_request
    from public.purchase_requests
    where id = p_purchase_request_id
    for update;

    if not found then
      raise exception 'Purchase request was not found';
    end if;

    if target_request.status not in ('approved', 'partially_received') then
      raise exception 'Only approved or partially received purchase requests can be received';
    end if;
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
    purchase_request_id,
    supplier_id,
    supplier_invoice_number,
    supplier_invoice_date,
    payment_status,
    notes,
    created_by
  ) values (
    p_client_request_id,
    p_purchase_request_id,
    p_supplier_id,
    nullif(btrim(coalesce(p_supplier_invoice_number, '')), ''),
    p_supplier_invoice_date,
    'unpaid',
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) returning * into created_purchase;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    quantity_value := nullif(item_payload ->> 'quantity', '')::numeric;
    unit_price_value := nullif(item_payload ->> 'unit_price', '')::numeric;
    requested_unit_id := (item_payload ->> 'unit_id')::uuid;

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

    if p_purchase_request_id is not null then
      select * into target_request_item
      from public.purchase_request_items
      where purchase_request_id = p_purchase_request_id
        and inventory_item_id = target_item.id
        and unit_id = requested_unit_id
      for update;

      if not found then
        raise exception 'Received item does not match the purchase request';
      end if;

      remaining_value := target_request_item.quantity - target_request_item.received_quantity;
      if remaining_value <= 0 then
        raise exception 'Purchase request item is already fully received';
      end if;

      if quantity_value > remaining_value then
        raise exception 'Received quantity exceeds remaining purchase request quantity';
      end if;

      update public.purchase_request_items
      set received_quantity = received_quantity + quantity_value
      where id = target_request_item.id;

      batch_received_quantity := batch_received_quantity + quantity_value;
      batch_remaining_before := batch_remaining_before + remaining_value;
    end if;

    quantity_base_value := public.convert_inventory_quantity(quantity_value, requested_unit_id, target_item.base_unit_id);
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
      requested_unit_id,
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
      'استلام مشتريات #' || created_purchase.purchase_number,
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

  if p_purchase_request_id is not null then
    select not exists (
      select 1
      from public.purchase_request_items
      where purchase_request_id = p_purchase_request_id
        and received_quantity < quantity
    ) into request_completed;

    next_request_status := case when request_completed then 'received' else 'partially_received' end;

    update public.purchase_requests
    set status = next_request_status,
        received_by = auth.uid(),
        received_at = now()
    where id = p_purchase_request_id
    returning * into target_request;
  end if;

  audit_action := case
    when p_purchase_request_id is not null and request_completed then 'اكتمال الاستلام'
    when p_purchase_request_id is not null then 'استلام جزئي'
    else 'استلام مشتريات'
  end;

  perform public.write_audit_log(
    audit_action,
    'purchases',
    created_purchase.id,
    null,
    jsonb_build_object(
      'purchase_request_id', created_purchase.purchase_request_id,
      'supplier_id', created_purchase.supplier_id,
      'total_amount', created_purchase.total_amount,
      'payment_status', created_purchase.payment_status,
      'item_count', item_count,
      'received_quantity', batch_received_quantity,
      'remaining_before_receipt', batch_remaining_before,
      'summary_ar', case
        when p_purchase_request_id is not null and request_completed then 'اكتمال الاستلام — ' || batch_received_quantity || ' من ' || batch_remaining_before
        when p_purchase_request_id is not null then 'استلام جزئي — ' || batch_received_quantity || ' من ' || batch_remaining_before
        else 'استلام مشتريات'
      end
    )
  );

  return jsonb_build_object('purchase_id', created_purchase.id, 'duplicate', false);
end;
$$;

revoke all on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb, uuid) from public;
grant execute on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb, uuid) to authenticated;
