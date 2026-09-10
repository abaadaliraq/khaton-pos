alter table public.purchase_request_items
  add column if not exists decision_status text not null default 'pending',
  add column if not exists decision_by uuid references public.profiles(id) on delete restrict,
  add column if not exists decision_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.purchase_request_items
  drop constraint if exists purchase_request_items_decision_status_check;

alter table public.purchase_request_items
  add constraint purchase_request_items_decision_status_check
  check (decision_status in ('pending', 'approved', 'rejected'));

alter table public.purchase_requests
  drop constraint if exists purchase_requests_status_check;

alter table public.purchase_requests
  add constraint purchase_requests_status_check
  check (status in (
    'pending',
    'decision_in_progress',
    'partially_approved',
    'approved',
    'partially_received',
    'rejected',
    'received',
    'cancelled'
  ));

update public.purchase_request_items pri
set decision_status = case
    when pr.status in ('approved', 'partially_received', 'received') then 'approved'
    when pr.status = 'rejected' then 'rejected'
    else pri.decision_status
  end,
  decision_by = case
    when pr.status in ('approved', 'partially_received', 'received', 'rejected') then pr.decided_by
    else pri.decision_by
  end,
  decision_at = case
    when pr.status in ('approved', 'partially_received', 'received', 'rejected') then pr.decided_at
    else pri.decision_at
  end,
  rejection_reason = case
    when pr.status = 'rejected' then coalesce(pr.rejection_reason, pr.decision_notes)
    else pri.rejection_reason
  end
from public.purchase_requests pr
where pr.id = pri.purchase_request_id;

create or replace function public.purchase_request_decision_status(p_purchase_request_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when count(*) = 0 then 'pending'
    when bool_and(decision_status = 'pending') then 'pending'
    when bool_and(decision_status = 'approved') then 'approved'
    when bool_and(decision_status = 'rejected') then 'rejected'
    when bool_or(decision_status = 'pending') then 'decision_in_progress'
    else 'partially_approved'
  end
  from public.purchase_request_items
  where purchase_request_id = p_purchase_request_id;
$$;

create or replace function public.decide_purchase_request_item(
  p_purchase_request_item_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.purchase_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_item public.purchase_request_items%rowtype;
  target_request public.purchase_requests%rowtype;
  updated_request public.purchase_requests%rowtype;
  item_name text;
  request_code text;
  clean_reason text := nullif(btrim(coalesce(p_rejection_reason, '')), '');
  next_status text;
begin
  if requester_role <> 'admin' then
    raise exception 'Only admin users can decide purchase request items';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid purchase request item decision';
  end if;

  if p_decision = 'rejected' and clean_reason is null then
    raise exception 'Rejection reason is required';
  end if;

  select * into target_item
  from public.purchase_request_items
  where id = p_purchase_request_item_id
  for update;

  if not found then
    raise exception 'Purchase request item was not found';
  end if;

  select * into target_request
  from public.purchase_requests
  where id = target_item.purchase_request_id
  for update;

  if not found then
    raise exception 'Purchase request was not found';
  end if;

  if target_request.status not in ('pending', 'decision_in_progress', 'partially_approved', 'approved', 'rejected') then
    raise exception 'Purchase request items cannot be decided after receiving starts';
  end if;

  if target_item.received_quantity > 0 then
    raise exception 'Received purchase request items cannot be changed';
  end if;

  update public.purchase_request_items
  set decision_status = p_decision,
      decision_by = auth.uid(),
      decision_at = now(),
      rejection_reason = case when p_decision = 'rejected' then clean_reason else null end
  where id = target_item.id
  returning * into target_item;

  next_status := public.purchase_request_decision_status(target_request.id);

  update public.purchase_requests
  set status = next_status,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_notes = case
        when next_status = 'approved' then 'تمت الموافقة على كل مواد الطلب'
        when next_status = 'rejected' then 'تم رفض كل مواد الطلب'
        when next_status = 'partially_approved' then 'تمت الموافقة على بعض مواد الطلب'
        when next_status = 'decision_in_progress' then 'بانتظار استكمال قرار مواد الطلب'
        else null
      end,
      rejection_reason = case when next_status = 'rejected' then clean_reason else null end
  where id = target_request.id
  returning * into updated_request;

  select coalesce(ii.name_ar, 'مادة غير معروفة') into item_name
  from public.inventory_items ii
  where ii.id = target_item.inventory_item_id;

  request_code := 'PR-' || lpad(updated_request.request_number::text, 6, '0');

  perform public.write_audit_log(
    case
      when p_decision = 'approved' then 'تمت الموافقة على ' || item_name || ' ضمن ' || request_code
      else 'تم رفض ' || item_name || ' — السبب: ' || clean_reason
    end,
    'purchase_request_items',
    target_item.id,
    to_jsonb(target_request),
    jsonb_build_object(
      'purchase_request_id', updated_request.id,
      'request_number', updated_request.request_number,
      'request_code', request_code,
      'inventory_item_id', target_item.inventory_item_id,
      'item_name', item_name,
      'decision_status', target_item.decision_status,
      'rejection_reason', target_item.rejection_reason,
      'request_status', updated_request.status
    )
  );

  return updated_request;
end;
$$;

create or replace function public.prevent_unapproved_purchase_request_item_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_request_id uuid;
begin
  select purchase_request_id into linked_request_id
  from public.purchases
  where id = new.purchase_id;

  if linked_request_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.purchase_request_items pri
    where pri.purchase_request_id = linked_request_id
      and pri.inventory_item_id = new.inventory_item_id
      and pri.unit_id = new.unit_id
      and pri.decision_status = 'approved'
  ) then
    raise exception 'Only approved purchase request items can be received';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unapproved_purchase_request_item_receipt on public.purchase_items;
create trigger prevent_unapproved_purchase_request_item_receipt
  before insert on public.purchase_items
  for each row execute function public.prevent_unapproved_purchase_request_item_receipt();

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

    if target_request.status not in ('approved', 'partially_approved', 'partially_received') then
      raise exception 'Only approved purchase request items can be received';
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
        and decision_status = 'approved'
      for update;

      if not found then
        raise exception 'Received item does not match an approved purchase request item';
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
        and decision_status = 'approved'
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

drop policy if exists "inventory units requisition read" on public.inventory_units;
create policy "inventory units requisition read"
  on public.inventory_units
  for select
  to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'kitchen', 'barista', 'accountant', 'owner'));

drop policy if exists "inventory items requisition read active" on public.inventory_items;
create policy "inventory items requisition read active"
  on public.inventory_items
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'accountant', 'owner')
    or (public.current_user_role() in ('kitchen', 'barista') and is_active = true)
  );

revoke all on function public.purchase_request_decision_status(uuid) from public;
revoke all on function public.decide_purchase_request_item(uuid, text, text) from public;
revoke all on function public.prevent_unapproved_purchase_request_item_receipt() from public;
revoke all on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb, uuid) from public;

grant execute on function public.purchase_request_decision_status(uuid) to authenticated;
grant execute on function public.decide_purchase_request_item(uuid, text, text) to authenticated;
grant execute on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb, uuid) to authenticated;
