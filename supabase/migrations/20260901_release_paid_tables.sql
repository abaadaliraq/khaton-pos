create or replace function public.close_paid_table(
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
  current_table public.restaurant_tables%rowtype;
  blocking_order public.orders%rowtype;
begin
  if requester_role not in ('captain', 'cashier', 'admin') then
    raise exception 'Only captain, cashier, or admin can close paid tables';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status <> 'paid' then
    raise exception 'Only paid orders can be closed';
  end if;

  if requester_role = 'captain' and current_order.captain_id <> auth.uid() then
    raise exception 'Captains can only release their own tables';
  end if;

  select * into current_table
  from public.restaurant_tables
  where id = current_order.table_id
  for update;

  if not found or current_table.status <> 'occupied' then
    raise exception 'Only occupied tables can be released';
  end if;

  select * into blocking_order
  from public.orders
  where table_id = current_order.table_id
    and id <> current_order.id
    and status in ('submitted', 'preparing', 'ready', 'awaiting_payment')
  order by opened_at desc
  limit 1
  for update;

  if found then
    raise exception 'Table has an unfinished order and cannot be released';
  end if;

  if exists (
    select 1
    from public.orders newer_order
    where newer_order.table_id = current_order.table_id
      and newer_order.id <> current_order.id
      and newer_order.opened_at > current_order.opened_at
      and newer_order.status not in ('cancelled')
  ) then
    raise exception 'A newer table cycle exists for this table';
  end if;

  update public.orders
  set closed_at = coalesce(closed_at, now())
  where id = p_order_id
  returning * into current_order;

  update public.restaurant_tables
  set status = 'available'
  where id = current_order.table_id;

  perform public.write_audit_log('close_paid_table', 'orders', p_order_id, null, to_jsonb(current_order));

  return jsonb_build_object('order_id', current_order.id, 'table_id', current_order.table_id, 'closed_at', current_order.closed_at);
end;
$$;

revoke all on function public.close_paid_table(uuid) from public;
grant execute on function public.close_paid_table(uuid) to authenticated;
