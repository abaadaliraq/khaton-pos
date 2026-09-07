create table if not exists public.order_item_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  preparation_station text not null check (preparation_station in ('kitchen', 'barista', 'drinks', 'shisha')),
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists order_item_status_events_order_id_idx on public.order_item_status_events(order_id);
create index if not exists order_item_status_events_item_id_idx on public.order_item_status_events(order_item_id);
create index if not exists order_item_status_events_station_idx on public.order_item_status_events(preparation_station);

alter table public.order_item_status_events enable row level security;

drop policy if exists "order item status events role read" on public.order_item_status_events;
create policy "order item status events role read" on public.order_item_status_events
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'admin'));

drop policy if exists "order item status events admin manage" on public.order_item_status_events;
create policy "order item status events admin manage" on public.order_item_status_events
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

update public.order_items oi
set preparation_station = mi.preparation_station
from public.menu_items mi
where oi.menu_item_id = mi.id
  and oi.preparation_station is null
  and oi.status not in ('served', 'cancelled');

update public.order_items
set status = 'submitted'
where status is null
  and order_id in (
    select id
    from public.orders
    where status in ('submitted', 'preparing', 'ready')
  );

create or replace function public.station_allowed_for_current_user(p_station text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
begin
  if p_station not in ('kitchen', 'barista', 'drinks', 'shisha') then
    return false;
  end if;

  if requester_role = 'admin' then
    return true;
  end if;

  if requester_role = 'kitchen' and p_station = 'kitchen' then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.recalculate_order_preparation_status(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  previous_status text;
  next_status text;
  active_item_count integer;
begin
  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if current_order.id is null then
    raise exception 'Order was not found';
  end if;

  if current_order.status not in ('submitted', 'preparing', 'ready') then
    return current_order.status;
  end if;

  select count(*) into active_item_count
  from public.order_items
  where order_id = p_order_id
    and status <> 'cancelled';

  if active_item_count = 0 then
    return current_order.status;
  end if;

  if not exists (
    select 1
    from public.order_items
    where order_id = p_order_id
      and status <> 'cancelled'
      and status <> 'ready'
  ) then
    next_status := 'ready';
  elsif exists (
    select 1
    from public.order_items
    where order_id = p_order_id
      and status <> 'cancelled'
      and status in ('preparing', 'ready')
  ) then
    next_status := 'preparing';
  else
    next_status := 'submitted';
  end if;

  previous_status := current_order.status;

  if previous_status is distinct from next_status then
    update public.orders
    set status = next_status
    where id = p_order_id
    returning * into current_order;

    insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
    values (p_order_id, previous_status, next_status, auth.uid(), 'Preparation station aggregate recalculation');

    perform public.write_audit_log(
      'recalculate_order_preparation_status',
      'orders',
      p_order_id,
      jsonb_build_object('status', previous_status),
      jsonb_build_object('status', next_status)
    );
  end if;

  return next_status;
end;
$$;

create or replace function public.consume_order_item_inventory(p_order_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_order public.orders%rowtype;
  target_order_item public.order_items%rowtype;
  target_menu_item public.menu_items%rowtype;
  invalid_item_name text;
  missing_components_item_name text;
  required_row record;
  consumption_row record;
  target_item public.inventory_items%rowtype;
  quantity_before numeric(18,3);
  quantity_after numeric(18,3);
  row_inserted integer;
  inserted_count integer := 0;
begin
  select * into target_order_item
  from public.order_items
  where id = p_order_item_id;

  if target_order_item.id is null then
    raise exception 'Order item was not found';
  end if;

  if not public.station_allowed_for_current_user(target_order_item.preparation_station) then
    raise exception 'Station is not allowed for current user';
  end if;

  select * into target_order
  from public.orders
  where id = target_order_item.order_id
  for update;

  if target_order.id is null or target_order.status in ('paid', 'cancelled', 'awaiting_payment') then
    raise exception 'Order item cannot consume inventory';
  end if;

  select * into target_order_item
  from public.order_items
  where id = p_order_item_id
  for update;

  if target_order_item.status = 'cancelled' then
    return jsonb_build_object('order_item_id', p_order_item_id, 'movements_created', 0);
  end if;

  select * into target_menu_item
  from public.menu_items
  where id = target_order_item.menu_item_id;

  if target_menu_item.id is null or target_menu_item.inventory_tracking_enabled = false then
    return jsonb_build_object('order_item_id', p_order_item_id, 'movements_created', 0);
  end if;

  if not exists (
    select 1
    from public.recipes r
    where r.menu_item_id = target_menu_item.id
      and r.is_active = true
  ) then
    invalid_item_name := target_order_item.item_name_snapshot;
  end if;

  if invalid_item_name is not null then
    raise exception 'INVENTORY_RECIPE_MISSING:%', invalid_item_name;
  end if;

  select target_order_item.item_name_snapshot into missing_components_item_name
  from public.recipes r
  where r.menu_item_id = target_menu_item.id
    and r.is_active = true
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
        (ri.quantity / r.yield_quantity) * target_order_item.quantity * (1 + (ri.waste_percent / 100)),
        ri.unit_id,
        ii.base_unit_id
      ))::numeric(18,3) as required_quantity
    from public.recipes r
    join public.recipe_items ri on ri.recipe_id = r.id
    join public.inventory_items ii on ii.id = ri.inventory_item_id
    join public.inventory_units iu on iu.id = ii.base_unit_id
    where r.menu_item_id = target_menu_item.id
      and r.is_active = true
      and not exists (
        select 1
        from public.inventory_movements im
        where im.order_item_id = target_order_item.id
          and im.inventory_item_id = ii.id
          and im.movement_type = 'consumption'
      )
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
      target_order_item.id as order_item_id,
      target_order_item.order_id,
      ii.id as inventory_item_id,
      ii.average_cost,
      ii.name_ar,
      r.id as recipe_id,
      public.convert_inventory_quantity(
        (ri.quantity / r.yield_quantity) * target_order_item.quantity * (1 + (ri.waste_percent / 100)),
        ri.unit_id,
        ii.base_unit_id
      )::numeric(18,3) as consumed_quantity
    from public.recipes r
    join public.recipe_items ri on ri.recipe_id = r.id
    join public.inventory_items ii on ii.id = ri.inventory_item_id
    where r.menu_item_id = target_menu_item.id
      and r.is_active = true
    order by ii.id
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
      'station_order_item',
      consumption_row.order_item_id,
      consumption_row.order_id,
      consumption_row.order_item_id,
      consumption_row.recipe_id,
      'استهلاك وصفة بند طلب حسب محطة التحضير',
      auth.uid()
    )
    on conflict do nothing;

    get diagnostics row_inserted = row_count;

    if row_inserted = 1 then
      perform set_config('app.inventory_stock_write', 'on', true);

      update public.inventory_items
      set stock_on_hand = quantity_after
      where id = consumption_row.inventory_item_id;

      perform set_config('app.inventory_stock_write', '', true);
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return jsonb_build_object('order_item_id', p_order_item_id, 'movements_created', inserted_count);
end;
$$;

create or replace function public.get_station_order_queue(p_station text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.station_allowed_for_current_user(p_station) then
    raise exception 'Station is not allowed for current user';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', station_orders.order_id,
          'order_number', station_orders.order_number,
          'round_no', station_orders.round_no,
          'table_id', station_orders.table_number,
          'captain_name', station_orders.captain_name,
          'order_status', station_orders.order_status,
          'status', station_orders.station_status,
          'received_at', station_orders.received_at,
          'started_at', station_orders.started_at,
          'ready_at', station_orders.ready_at,
          'general_notes', station_orders.general_notes,
          'has_other_station_pending', station_orders.has_other_station_pending,
          'items', station_orders.items
        )
        order by station_orders.received_at asc
      )
      from (
        select
          o.id as order_id,
          o.order_number,
          o.round_no,
          rt.table_number,
          p.full_name as captain_name,
          o.status as order_status,
          o.submitted_at as received_at,
          min(oi.started_at) filter (where oi.preparation_station = p_station) as started_at,
          max(oi.ready_at) filter (where oi.preparation_station = p_station) as ready_at,
          o.general_notes,
          case
            when bool_and(oi.status = 'ready') then 'ready'
            when bool_or(oi.status in ('preparing', 'ready')) then 'preparing'
            else 'submitted'
          end as station_status,
          exists (
            select 1
            from public.order_items other_items
            where other_items.order_id = o.id
              and other_items.status <> 'cancelled'
              and other_items.preparation_station <> p_station
              and other_items.status <> 'ready'
          ) as has_other_station_pending,
          jsonb_agg(
            jsonb_build_object(
              'id', oi.id,
              'menu_item_id', oi.menu_item_id,
              'name', oi.item_name_snapshot,
              'quantity', oi.quantity,
              'note', oi.notes,
              'status', oi.status,
              'preparation_station', oi.preparation_station,
              'sent_at', oi.sent_at,
              'started_at', oi.started_at,
              'ready_at', oi.ready_at
            )
            order by oi.created_at
          ) as items
        from public.orders o
        join public.restaurant_tables rt on rt.id = o.table_id
        join public.profiles p on p.id = o.captain_id
        join public.order_items oi on oi.order_id = o.id
          and oi.preparation_station = p_station
          and oi.status in ('submitted', 'preparing', 'ready')
        where o.table_session_id is not null
          and o.status in ('submitted', 'preparing', 'ready')
        group by o.id, o.order_number, o.round_no, rt.table_number, p.full_name, o.status, o.submitted_at, o.general_notes
      ) station_orders
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.order_has_station_items(
  p_order_id uuid,
  p_station text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.station_allowed_for_current_user(p_station) then
    raise exception 'Station is not allowed for current user';
  end if;

  return exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.order_id = p_order_id
      and oi.preparation_station = p_station
      and oi.status <> 'cancelled'
      and o.status in ('submitted', 'preparing', 'ready')
  );
end;
$$;

create or replace function public.update_station_order_items_status(
  p_order_id uuid,
  p_station text,
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
  station_item record;
  changed_count integer := 0;
  next_order_status text;
begin
  if requester_role is null then
    raise exception 'Authentication is required';
  end if;

  if not public.station_allowed_for_current_user(p_station) then
    raise exception 'Station is not allowed for current user';
  end if;

  if p_next_status not in ('preparing', 'ready') then
    raise exception 'Invalid station status';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if current_order.id is null or current_order.status in ('paid', 'cancelled', 'awaiting_payment') then
    raise exception 'Order cannot be updated';
  end if;

  if not exists (
    select 1
    from public.order_items
    where order_id = p_order_id
      and preparation_station = p_station
      and status <> 'cancelled'
  ) then
    raise exception 'No order items found for station';
  end if;

  for station_item in
    select *
    from public.order_items
    where order_id = p_order_id
      and preparation_station = p_station
      and status <> 'cancelled'
    order by id
    for update
  loop
    if p_next_status = 'preparing' then
      if station_item.status not in ('submitted', 'preparing') then
        raise exception 'Station items must be submitted before preparation can start';
      end if;

      if station_item.status = 'submitted' then
        perform public.consume_order_item_inventory(station_item.id);

        update public.order_items
        set status = 'preparing',
            started_at = coalesce(started_at, now())
        where id = station_item.id;

        insert into public.order_item_status_events (order_id, order_item_id, preparation_station, from_status, to_status, changed_by, notes)
        values (p_order_id, station_item.id, p_station, station_item.status, 'preparing', auth.uid(), 'Station item status update');

        changed_count := changed_count + 1;
      end if;
    else
      if station_item.status not in ('preparing', 'ready') then
        raise exception 'Station items must be preparing before they can be marked ready';
      end if;

      if station_item.status = 'preparing' then
        update public.order_items
        set status = 'ready',
            ready_at = coalesce(ready_at, now())
        where id = station_item.id;

        insert into public.order_item_status_events (order_id, order_item_id, preparation_station, from_status, to_status, changed_by, notes)
        values (p_order_id, station_item.id, p_station, station_item.status, 'ready', auth.uid(), 'Station item status update');

        changed_count := changed_count + 1;
      end if;
    end if;
  end loop;

  next_order_status := public.recalculate_order_preparation_status(p_order_id);

  perform public.write_audit_log(
    'update_station_order_items_status',
    'orders',
    p_order_id,
    jsonb_build_object('station', p_station),
    jsonb_build_object('station', p_station, 'item_status', p_next_status, 'order_status', next_order_status, 'changed_items', changed_count)
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'station', p_station,
    'item_status', p_next_status,
    'order_status', next_order_status,
    'changed_items', changed_count
  );
end;
$$;

create or replace function public.get_kitchen_order_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.get_station_order_queue('kitchen');
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
begin
  return public.update_station_order_items_status(p_order_id, 'kitchen', p_next_status);
end;
$$;

revoke all on function public.station_allowed_for_current_user(text) from public;
revoke all on function public.recalculate_order_preparation_status(uuid) from public;
revoke all on function public.consume_order_item_inventory(uuid) from public;
revoke all on function public.get_station_order_queue(text) from public;
revoke all on function public.order_has_station_items(uuid, text) from public;
revoke all on function public.update_station_order_items_status(uuid, text, text) from public;
revoke all on function public.get_kitchen_order_queue() from public;
revoke all on function public.update_kitchen_order_status(uuid, text) from public;

grant execute on function public.station_allowed_for_current_user(text) to authenticated;
grant execute on function public.recalculate_order_preparation_status(uuid) to authenticated;
grant execute on function public.consume_order_item_inventory(uuid) to authenticated;
grant execute on function public.get_station_order_queue(text) to authenticated;
grant execute on function public.order_has_station_items(uuid, text) to authenticated;
grant execute on function public.update_station_order_items_status(uuid, text, text) to authenticated;
grant execute on function public.get_kitchen_order_queue() to authenticated;
grant execute on function public.update_kitchen_order_status(uuid, text) to authenticated;
