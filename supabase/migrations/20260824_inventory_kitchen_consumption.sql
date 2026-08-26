alter table public.menu_items
  add column if not exists inventory_tracking_enabled boolean not null default false;

alter table public.inventory_movements
  add column if not exists recipe_id uuid references public.recipes(id) on delete set null;

create index if not exists inventory_movements_recipe_id_idx on public.inventory_movements (recipe_id);
create unique index if not exists inventory_consumption_order_item_material_unique
  on public.inventory_movements (order_item_id, inventory_item_id, movement_type)
  where movement_type = 'consumption' and order_item_id is not null;

create or replace function public.validate_menu_item_inventory_tracking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.inventory_tracking_enabled then
    if not exists (
      select 1
      from public.recipes r
      join public.recipe_items ri on ri.recipe_id = r.id
      where r.menu_item_id = new.id
        and r.is_active = true
    ) then
      raise exception 'يجب إعداد وصفة للصنف قبل تفعيل خصم المخزون.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_menu_item_inventory_tracking_trigger on public.menu_items;
create trigger validate_menu_item_inventory_tracking_trigger before insert or update on public.menu_items
  for each row execute function public.validate_menu_item_inventory_tracking();

create or replace function public.consume_order_inventory(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_order public.orders%rowtype;
  invalid_item_name text;
  missing_components_item_name text;
  required_row record;
  consumption_row record;
  target_item public.inventory_items%rowtype;
  quantity_before numeric(18,3);
  quantity_after numeric(18,3);
  inserted_count integer := 0;
begin
  if requester_role not in ('kitchen', 'admin') then
    raise exception 'Only kitchen or admin can consume inventory';
  end if;

  select * into target_order
  from public.orders
  where id = p_order_id
  for update;

  if target_order.id is null then
    raise exception 'Order was not found';
  end if;

  select oi.item_name_snapshot into invalid_item_name
  from public.order_items oi
  join public.menu_items mi on mi.id = oi.menu_item_id
  left join public.recipes r on r.menu_item_id = mi.id and r.is_active = true
  where oi.order_id = p_order_id
    and oi.status <> 'cancelled'
    and mi.inventory_tracking_enabled = true
    and r.id is null
  limit 1;

  if invalid_item_name is not null then
    raise exception 'INVENTORY_RECIPE_MISSING:%', invalid_item_name;
  end if;

  select oi.item_name_snapshot into missing_components_item_name
  from public.order_items oi
  join public.menu_items mi on mi.id = oi.menu_item_id
  join public.recipes r on r.menu_item_id = mi.id and r.is_active = true
  where oi.order_id = p_order_id
    and oi.status <> 'cancelled'
    and mi.inventory_tracking_enabled = true
    and not exists (select 1 from public.recipe_items ri where ri.recipe_id = r.id)
  limit 1;

  if missing_components_item_name is not null then
    raise exception 'INVENTORY_RECIPE_EMPTY:%', missing_components_item_name;
  end if;

  for required_row in
    select
      ii.id as inventory_item_id,
      ii.name_ar,
      iu.code as unit_code,
      sum(public.convert_inventory_quantity(
        (ri.quantity / r.yield_quantity) * oi.quantity * (1 + (ri.waste_percent / 100)),
        ri.unit_id,
        ii.base_unit_id
      ))::numeric(18,3) as required_quantity
    from public.order_items oi
    join public.menu_items mi on mi.id = oi.menu_item_id
    join public.recipes r on r.menu_item_id = mi.id and r.is_active = true
    join public.recipe_items ri on ri.recipe_id = r.id
    join public.inventory_items ii on ii.id = ri.inventory_item_id
    join public.inventory_units iu on iu.id = ii.base_unit_id
    where oi.order_id = p_order_id
      and oi.status <> 'cancelled'
      and mi.inventory_tracking_enabled = true
    group by ii.id, ii.name_ar, iu.code
    order by ii.id
  loop
    select * into target_item
    from public.inventory_items
    where id = required_row.inventory_item_id
    for update;

    if target_item.stock_on_hand < required_row.required_quantity then
      raise exception 'INSUFFICIENT_INVENTORY:%:%:%:%',
        required_row.name_ar,
        required_row.required_quantity,
        target_item.stock_on_hand,
        required_row.unit_code;
    end if;
  end loop;

  for consumption_row in
    select
      oi.id as order_item_id,
      oi.order_id,
      ii.id as inventory_item_id,
      ii.average_cost,
      r.id as recipe_id,
      public.convert_inventory_quantity(
        (ri.quantity / r.yield_quantity) * oi.quantity * (1 + (ri.waste_percent / 100)),
        ri.unit_id,
        ii.base_unit_id
      )::numeric(18,3) as consumed_quantity
    from public.order_items oi
    join public.menu_items mi on mi.id = oi.menu_item_id
    join public.recipes r on r.menu_item_id = mi.id and r.is_active = true
    join public.recipe_items ri on ri.recipe_id = r.id
    join public.inventory_items ii on ii.id = ri.inventory_item_id
    where oi.order_id = p_order_id
      and oi.status <> 'cancelled'
      and mi.inventory_tracking_enabled = true
    order by ii.id, oi.id
  loop
    if exists (
      select 1
      from public.inventory_movements im
      where im.order_item_id = consumption_row.order_item_id
        and im.inventory_item_id = consumption_row.inventory_item_id
        and im.movement_type = 'consumption'
    ) then
      continue;
    end if;

    select * into target_item
    from public.inventory_items
    where id = consumption_row.inventory_item_id
    for update;

    quantity_before := target_item.stock_on_hand;
    quantity_after := quantity_before - consumption_row.consumed_quantity;

    if quantity_after < 0 then
      raise exception 'INSUFFICIENT_INVENTORY:%:%:%:%',
        target_item.name_ar,
        consumption_row.consumed_quantity,
        quantity_before,
        (select code from public.inventory_units where id = target_item.base_unit_id);
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
      order_id,
      order_item_id,
      recipe_id,
      notes,
      created_by
    )
    values (
      consumption_row.inventory_item_id,
      'consumption',
      consumption_row.consumed_quantity * -1,
      quantity_before,
      quantity_after,
      consumption_row.average_cost,
      consumption_row.consumed_quantity * consumption_row.average_cost,
      'kitchen_order',
      consumption_row.order_item_id,
      consumption_row.order_id,
      consumption_row.order_item_id,
      consumption_row.recipe_id,
      'استهلاك طلب مطبخ',
      auth.uid()
    );

    perform set_config('app.inventory_stock_write', 'on', true);

    update public.inventory_items
    set stock_on_hand = quantity_after
    where id = consumption_row.inventory_item_id;

    perform set_config('app.inventory_stock_write', '', true);
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('order_id', p_order_id, 'movements_created', inserted_count);
end;
$$;

create or replace function public.update_kitchen_order_status(
  p_order_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  current_order public.orders%rowtype;
  previous_status text;
begin
  if requester_role not in ('kitchen', 'admin') then
    raise exception 'Only kitchen or admin can update kitchen orders';
  end if;

  if p_next_status not in ('submitted', 'preparing', 'ready', 'served') then
    raise exception 'Invalid kitchen status';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status in ('paid', 'cancelled') then
    raise exception 'Order cannot be updated';
  end if;

  previous_status := current_order.status;

  if p_next_status = 'preparing' and previous_status = 'submitted' then
    perform public.consume_order_inventory(p_order_id);
  end if;

  update public.order_items
  set status = p_next_status,
      started_at = case when p_next_status = 'preparing' and started_at is null then now() else started_at end,
      ready_at = case when p_next_status = 'ready' and ready_at is null then now() else ready_at end,
      served_at = case when p_next_status = 'served' and served_at is null then now() else served_at end
  where order_id = p_order_id
    and status <> 'cancelled';

  update public.orders
  set status = case when p_next_status = 'served' then 'awaiting_payment' else p_next_status end,
      served_at = case when p_next_status = 'served' and served_at is null then now() else served_at end
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, previous_status, current_order.status, auth.uid(), 'Kitchen status update');

  perform public.write_audit_log('update_kitchen_status', 'orders', p_order_id, jsonb_build_object('status', previous_status), jsonb_build_object('status', current_order.status));

  return jsonb_build_object('order_id', current_order.id, 'status', current_order.status);
end;
$$;

revoke all on function public.consume_order_inventory(uuid) from public;
grant execute on function public.consume_order_inventory(uuid) to authenticated;
