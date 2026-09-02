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

  if p_next_status not in ('preparing', 'ready') then
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

  if p_next_status = 'preparing' and previous_status <> 'submitted' then
    raise exception 'Order must be submitted before preparation can start';
  end if;

  if p_next_status = 'ready' and previous_status <> 'preparing' then
    raise exception 'Order must be preparing before it can be marked ready';
  end if;

  if p_next_status = 'preparing' then
    perform public.consume_order_inventory(p_order_id);
  end if;

  update public.order_items
  set status = p_next_status,
      started_at = case when p_next_status = 'preparing' and started_at is null then now() else started_at end,
      ready_at = case when p_next_status = 'ready' and ready_at is null then now() else ready_at end
  where order_id = p_order_id
    and status <> 'cancelled';

  update public.orders
  set status = p_next_status
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, previous_status, current_order.status, auth.uid(), 'Kitchen status update');

  perform public.write_audit_log(
    'update_kitchen_status',
    'orders',
    p_order_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', current_order.status)
  );

  return jsonb_build_object('order_id', current_order.id, 'status', current_order.status);
end;
$$;

create or replace function public.mark_order_awaiting_payment_by_captain(
  p_order_id uuid
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
  if requester_role not in ('captain', 'admin') then
    raise exception 'Only captain or admin can mark orders awaiting payment';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status in ('paid', 'cancelled') then
    raise exception 'Order cannot be marked awaiting payment';
  end if;

  if current_order.status <> 'ready' then
    raise exception 'Order must be ready before it can be marked awaiting payment';
  end if;

  if requester_role = 'captain' and current_order.captain_id <> auth.uid() then
    raise exception 'Captains can only confirm their own orders';
  end if;

  previous_status := current_order.status;

  update public.orders
  set status = 'awaiting_payment',
      served_at = case when served_at is null then now() else served_at end
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, previous_status, current_order.status, auth.uid(), 'Captain marked order awaiting payment');

  perform public.write_audit_log(
    'mark_order_awaiting_payment',
    'orders',
    p_order_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', current_order.status)
  );

  return jsonb_build_object('order_id', current_order.id, 'status', current_order.status);
end;
$$;

revoke all on function public.mark_order_awaiting_payment_by_captain(uuid) from public;
grant execute on function public.mark_order_awaiting_payment_by_captain(uuid) to authenticated;
