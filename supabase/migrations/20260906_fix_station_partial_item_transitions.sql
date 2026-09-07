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
  skipped_count integer := 0;
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

  if p_next_status = 'ready' and exists (
    select 1
    from public.order_items
    where order_id = p_order_id
      and preparation_station = p_station
      and status = 'submitted'
  ) then
    raise exception 'يجب بدء تحضير جميع الأصناف أولاً';
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
      if station_item.status = 'submitted' then
        perform public.consume_order_item_inventory(station_item.id);

        update public.order_items
        set status = 'preparing',
            started_at = coalesce(started_at, now())
        where id = station_item.id;

        insert into public.order_item_status_events (order_id, order_item_id, preparation_station, from_status, to_status, changed_by, notes)
        values (p_order_id, station_item.id, p_station, station_item.status, 'preparing', auth.uid(), 'Station item status update');

        changed_count := changed_count + 1;
      elsif station_item.status in ('preparing', 'ready') then
        skipped_count := skipped_count + 1;
      else
        raise exception 'Station item cannot start preparation from status %', station_item.status;
      end if;
    else
      if station_item.status = 'preparing' then
        update public.order_items
        set status = 'ready',
            ready_at = coalesce(ready_at, now())
        where id = station_item.id;

        insert into public.order_item_status_events (order_id, order_item_id, preparation_station, from_status, to_status, changed_by, notes)
        values (p_order_id, station_item.id, p_station, station_item.status, 'ready', auth.uid(), 'Station item status update');

        changed_count := changed_count + 1;
      elsif station_item.status = 'ready' then
        skipped_count := skipped_count + 1;
      elsif station_item.status = 'submitted' then
        raise exception 'يجب بدء تحضير جميع الأصناف أولاً';
      else
        raise exception 'Station item cannot be marked ready from status %', station_item.status;
      end if;
    end if;
  end loop;

  next_order_status := public.recalculate_order_preparation_status(p_order_id);

  perform public.write_audit_log(
    'update_station_order_items_status',
    'orders',
    p_order_id,
    jsonb_build_object('station', p_station),
    jsonb_build_object(
      'station',
      p_station,
      'item_status',
      p_next_status,
      'order_status',
      next_order_status,
      'changed_items',
      changed_count,
      'skipped_items',
      skipped_count
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'station', p_station,
    'item_status', p_next_status,
    'order_status', next_order_status,
    'changed_items', changed_count,
    'skipped_items', skipped_count
  );
end;
$$;

revoke all on function public.update_station_order_items_status(uuid, text, text) from public;
grant execute on function public.update_station_order_items_status(uuid, text, text) to authenticated;
