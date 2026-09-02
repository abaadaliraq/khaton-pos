begin;

do $$
declare
  close_paid_table_definition text;
  prevent_closed_order_mutation_definition text;
begin
  if to_regclass('public.table_sessions') is not null then
    raise exception 'table sessions migration already applied';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'table_session_id'
  ) then
    raise exception 'table sessions migration already applied';
  end if;

  if to_regprocedure('public.mark_order_awaiting_payment_by_captain(uuid)') is null then
    raise exception 'Missing dependency: 20260901_captain_marks_orders_awaiting_payment.sql';
  end if;

  if to_regprocedure('public.close_paid_table(uuid)') is null then
    raise exception 'Missing dependency: 20260901_release_paid_tables.sql';
  end if;

  if to_regprocedure('public.prevent_closed_order_mutation()') is null then
    raise exception 'Missing dependency: prevent_closed_order_mutation';
  end if;

  if to_regprocedure('public.record_order_payment(uuid,jsonb)') is null then
    raise exception 'Missing dependency: record_order_payment(uuid,jsonb)';
  end if;

  select lower(pg_get_functiondef(to_regprocedure('public.close_paid_table(uuid)')))
  into close_paid_table_definition;

  if close_paid_table_definition not like '%captain%'
    or close_paid_table_definition not like '%cashier%'
    or close_paid_table_definition not like '%admin%' then
    raise exception 'Missing dependency: 20260901_release_paid_tables.sql must be applied before table sessions';
  end if;

  select lower(pg_get_functiondef(to_regprocedure('public.prevent_closed_order_mutation()')))
  into prevent_closed_order_mutation_definition;

  if prevent_closed_order_mutation_definition not like '%old.closed_at is null%'
    or prevent_closed_order_mutation_definition not like '%new.closed_at is not null%' then
    raise exception 'Missing dependency: 20260901_allow_paid_order_close_timestamp.sql must be applied before table sessions';
  end if;
end;
$$;

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  captain_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.table_sessions enable row level security;

create policy "table sessions role read"
  on public.table_sessions
  for select
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'admin'));

create unique index one_active_table_session_per_table_idx
  on public.table_sessions (table_id)
  where status = 'active';

alter table public.orders
  add column table_session_id uuid references public.table_sessions(id) on delete restrict,
  add column round_no integer;

with candidate_sessions as (
  select
    rt.id as table_id,
    candidate.captain_id,
    candidate.opened_at
  from public.restaurant_tables rt
  join lateral (
    (
      select
        o.captain_id,
        min(o.opened_at) over () as opened_at,
        1 as priority
      from public.orders o
      where o.table_id = rt.id
        and o.table_session_id is null
        and o.status in ('submitted', 'preparing', 'ready', 'awaiting_payment')
      order by o.opened_at, o.order_number, o.id
      limit 1
    )
    union all
    (
      select
        o.captain_id,
        o.opened_at,
        2 as priority
      from public.orders o
      where o.table_id = rt.id
        and o.table_session_id is null
        and o.status = 'paid'
        and o.closed_at is null
        and not exists (
          select 1
          from public.orders open_order
          where open_order.table_id = rt.id
            and open_order.table_session_id is null
            and open_order.status in ('submitted', 'preparing', 'ready', 'awaiting_payment')
        )
      order by o.opened_at desc, o.order_number desc, o.id desc
      limit 1
    )
    order by priority, opened_at
    limit 1
  ) candidate on true
  where rt.status = 'occupied'
)
insert into public.table_sessions (table_id, captain_id, status, opened_at)
select table_id, captain_id, 'active', opened_at
from candidate_sessions;

with ranked_open_orders as (
  select
    o.id,
    ts.id as table_session_id,
    row_number() over (partition by ts.id order by o.opened_at, o.order_number, o.id)::integer as round_no
  from public.orders o
  join public.table_sessions ts on ts.table_id = o.table_id and ts.status = 'active'
  where o.table_session_id is null
    and o.status in ('submitted', 'preparing', 'ready', 'awaiting_payment')
)
update public.orders o
set table_session_id = ranked_open_orders.table_session_id,
    round_no = ranked_open_orders.round_no
from ranked_open_orders
where o.id = ranked_open_orders.id;

create unique index orders_table_session_round_no_idx
  on public.orders (table_session_id, round_no)
  where table_session_id is not null;

drop index if exists public.one_open_order_per_table_idx;

create or replace function public.create_restaurant_order(
  p_table_id uuid,
  p_items jsonb,
  p_guest_count integer default null,
  p_general_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_table public.restaurant_tables%rowtype;
  active_session public.table_sessions%rowtype;
  created_order public.orders%rowtype;
  item_payload jsonb;
  menu_item public.menu_items%rowtype;
  item_quantity integer;
  item_notes text;
  running_subtotal numeric(12,0) := 0;
  next_round integer;
begin
  if requester_role not in ('captain', 'cashier', 'admin') then
    raise exception 'Only captain, cashier, or admin can create orders';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  select * into target_table
  from public.restaurant_tables
  where id = p_table_id
  for update;

  if not found or not target_table.is_active then
    raise exception 'Table is not available';
  end if;

  select * into active_session
  from public.table_sessions
  where table_id = p_table_id
    and status = 'active'
  for update;

  if not found then
    if requester_role not in ('captain', 'admin') then
      raise exception 'Only captain or admin can open a new table session';
    end if;

    if target_table.status <> 'available' then
      raise exception 'Table already has an open session';
    end if;

    insert into public.table_sessions (table_id, captain_id)
    values (p_table_id, auth.uid())
    returning * into active_session;

    update public.restaurant_tables
    set status = 'occupied'
    where id = p_table_id;
  else
    if target_table.status <> 'occupied' then
      raise exception 'Additional orders require an occupied table';
    end if;

    if requester_role = 'captain' and active_session.captain_id <> auth.uid() then
      raise exception 'Captains can only add orders to their own tables';
    end if;
  end if;

  select coalesce(max(round_no), 0) + 1 into next_round
  from public.orders
  where table_session_id = active_session.id;

  insert into public.orders (table_id, table_session_id, round_no, captain_id, status, guest_count, general_notes, submitted_at)
  values (p_table_id, active_session.id, next_round, active_session.captain_id, 'submitted', p_guest_count, nullif(btrim(p_general_notes), ''), now())
  returning * into created_order;

  for item_payload in select * from jsonb_array_elements(p_items)
  loop
    item_quantity := coalesce((item_payload ->> 'quantity')::integer, 0);
    item_notes := nullif(btrim(coalesce(item_payload ->> 'notes', '')), '');

    if item_quantity <= 0 then
      raise exception 'Invalid item quantity';
    end if;

    select * into menu_item
    from public.menu_items
    where id = (item_payload ->> 'menu_item_id')::uuid
    for share;

    if not found or not menu_item.is_available or menu_item.price is null then
      raise exception 'Menu item is not available';
    end if;

    running_subtotal := running_subtotal + (menu_item.price * item_quantity);

    insert into public.order_items (
      order_id,
      menu_item_id,
      item_name_snapshot,
      unit_price,
      quantity,
      notes,
      preparation_station,
      status
    )
    values (
      created_order.id,
      menu_item.id,
      menu_item.name_ar,
      menu_item.price,
      item_quantity,
      item_notes,
      menu_item.preparation_station,
      'submitted'
    );
  end loop;

  update public.orders
  set subtotal = running_subtotal,
      total = running_subtotal + service_charge
  where id = created_order.id
  returning * into created_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (created_order.id, null, 'submitted', auth.uid(), case when next_round > 1 then 'Additional order submitted' else 'Order submitted' end);

  perform public.write_audit_log('create_order', 'orders', created_order.id, null, to_jsonb(created_order));

  return jsonb_build_object(
    'order_id', created_order.id,
    'order_number', created_order.order_number,
    'table_session_id', created_order.table_session_id,
    'round_no', created_order.round_no,
    'total', created_order.total
  );
end;
$$;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  current_order public.orders%rowtype;
  payment_payload jsonb;
  payment_method text;
  payment_amount numeric(12,0);
  payment_reference text;
  payment_total numeric(12,0) := 0;
begin
  if requester_role not in ('cashier', 'admin') then
    raise exception 'Only cashier or admin can record payments';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order was not found';
  end if;

  if current_order.table_session_id is not null then
    raise exception 'Session orders must be paid through record_table_payment';
  end if;

  if current_order.status <> 'awaiting_payment' then
    raise exception 'Only orders awaiting payment can be paid';
  end if;

  if exists (
    select 1
    from public.payments p
    where p.order_id = p_order_id
      and p.status = 'completed'
  ) then
    raise exception 'Order already has a completed payment';
  end if;

  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Payment must contain at least one payment entry';
  end if;

  for payment_payload in select * from jsonb_array_elements(p_payments)
  loop
    payment_method := payment_payload ->> 'method';
    payment_amount := coalesce((payment_payload ->> 'amount')::numeric, 0);
    payment_reference := nullif(btrim(coalesce(payment_payload ->> 'reference', '')), '');

    if payment_method not in ('cash', 'card', 'transfer') or payment_amount <= 0 then
      raise exception 'Invalid payment payload';
    end if;

    payment_total := payment_total + payment_amount;

    insert into public.payments (order_id, cashier_id, method, amount, reference)
    values (p_order_id, auth.uid(), payment_method, payment_amount, payment_reference);
  end loop;

  if payment_total <> current_order.total then
    raise exception 'Payment total must equal order total';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = now()
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, 'awaiting_payment', 'paid', auth.uid(), 'Payment completed');

  perform public.write_audit_log('record_payment', 'orders', p_order_id, null, to_jsonb(current_order));

  return jsonb_build_object('order_id', p_order_id, 'paid_amount', payment_total, 'status', current_order.status);
end;
$$;

revoke all on function public.record_order_payment(uuid, jsonb) from public;
grant execute on function public.record_order_payment(uuid, jsonb) to authenticated;

create or replace function public.record_table_payment(
  p_table_session_id uuid,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  active_session public.table_sessions%rowtype;
  current_order public.orders%rowtype;
  payment_total numeric(12,0);
  payable_total numeric(12,0);
  order_remaining numeric(12,0);
  payment_entry record;
  allocation numeric(12,0);
  paid_count integer := 0;
begin
  if requester_role not in ('cashier', 'admin') then
    raise exception 'Only cashier or admin can record table payments';
  end if;

  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Payment must contain at least one payment entry';
  end if;

  select * into active_session
  from public.table_sessions
  where id = p_table_session_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active table session was not found';
  end if;

  if exists (
    select 1
    from public.orders o
    where o.table_session_id = p_table_session_id
      and o.status in ('submitted', 'preparing', 'ready')
  ) then
    raise exception 'Table has orders that are not ready for payment';
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.table_session_id = p_table_session_id
      and o.status = 'awaiting_payment'
  ) then
    raise exception 'Table has no orders awaiting payment';
  end if;

  create temporary table table_payment_entries (
    ord integer primary key,
    method text not null,
    remaining numeric(12,0) not null,
    reference text
  ) on commit drop;

  insert into table_payment_entries (ord, method, remaining, reference)
  select
    entry.ord::integer,
    entry.payload ->> 'method',
    coalesce((entry.payload ->> 'amount')::numeric, 0),
    nullif(btrim(coalesce(entry.payload ->> 'reference', '')), '')
  from jsonb_array_elements(p_payments) with ordinality as entry(payload, ord);

  if exists (
    select 1
    from table_payment_entries
    where method not in ('cash', 'card', 'transfer')
      or remaining <= 0
  ) then
    raise exception 'Invalid payment payload';
  end if;

  select coalesce(sum(remaining), 0) into payment_total
  from table_payment_entries;

  select coalesce(sum(o.total - coalesce(paid.amount, 0)), 0) into payable_total
  from public.orders o
  left join lateral (
    select coalesce(sum(p.amount), 0) as amount
    from public.payments p
    where p.order_id = o.id
      and p.status = 'completed'
  ) paid on true
  where o.table_session_id = p_table_session_id
    and o.status = 'awaiting_payment';

  if payment_total <> payable_total then
    raise exception 'Payment total must equal table session remaining amount';
  end if;

  for current_order in
    select *
    from public.orders
    where table_session_id = p_table_session_id
      and status = 'awaiting_payment'
    order by round_no, id
    for update
  loop
    select current_order.total - coalesce(sum(p.amount), 0) into order_remaining
    from public.payments p
    where p.order_id = current_order.id
      and p.status = 'completed';

    order_remaining := coalesce(order_remaining, current_order.total);

    while order_remaining > 0 loop
      select * into payment_entry
      from table_payment_entries
      where remaining > 0
      order by ord
      limit 1;

      if not found then
        raise exception 'Could not allocate payment across table session orders';
      end if;

      allocation := least(order_remaining, payment_entry.remaining);

      insert into public.payments (order_id, cashier_id, method, amount, reference)
      values (current_order.id, auth.uid(), payment_entry.method, allocation, payment_entry.reference);

      update table_payment_entries
      set remaining = remaining - allocation
      where ord = payment_entry.ord;

      order_remaining := order_remaining - allocation;
    end loop;

    update public.orders
    set status = 'paid',
        paid_at = now()
    where id = current_order.id
    returning * into current_order;

    insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
    values (current_order.id, 'awaiting_payment', 'paid', auth.uid(), 'Table session payment completed');

    paid_count := paid_count + 1;
  end loop;

  if exists (
    select 1
    from table_payment_entries
    where remaining <> 0
  ) then
    raise exception 'Payment allocation mismatch';
  end if;

  perform public.write_audit_log(
    'record_table_payment',
    'table_sessions',
    p_table_session_id,
    null,
    jsonb_build_object('paid_orders', paid_count, 'paid_amount', payment_total)
  );

  return jsonb_build_object('table_session_id', p_table_session_id, 'paid_orders', paid_count, 'paid_amount', payment_total);
end;
$$;

revoke all on function public.record_table_payment(uuid, jsonb) from public;
grant execute on function public.record_table_payment(uuid, jsonb) to authenticated;

create or replace function public.get_kitchen_order_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('kitchen', 'admin') then
    raise exception 'Only kitchen or admin can view kitchen queue';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'round_no', o.round_no,
          'table_id', rt.table_number,
          'captain_name', p.full_name,
          'status', o.status,
          'received_at', o.submitted_at,
          'items', coalesce(items.items, '[]'::jsonb)
        )
        order by o.submitted_at asc
      )
      from public.orders o
      join public.restaurant_tables rt on rt.id = o.table_id
      join public.profiles p on p.id = o.captain_id
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'name', oi.item_name_snapshot,
            'quantity', oi.quantity,
            'note', oi.notes
          )
          order by oi.created_at
        ) as items
        from public.order_items oi
        where oi.order_id = o.id
          and oi.status <> 'cancelled'
      ) items on true
      where o.table_session_id is not null
        and o.status in ('submitted', 'preparing', 'ready')
    ),
    '[]'::jsonb
  );
end;
$$;

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
  active_session public.table_sessions%rowtype;
  close_timestamp timestamptz := now();
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

  if current_order.table_session_id is not null then
    select * into active_session
    from public.table_sessions
    where id = current_order.table_session_id
      and status = 'active'
    for update;
  else
    select * into active_session
    from public.table_sessions
    where table_id = current_order.table_id
      and status = 'active'
    for update;
  end if;

  if found and requester_role = 'captain' and active_session.captain_id <> auth.uid() then
    raise exception 'Captains can only release their own tables';
  end if;

  if active_session.id is null and requester_role = 'captain' and current_order.captain_id <> auth.uid() then
    raise exception 'Captains can only release their own tables';
  end if;

  select * into current_table
  from public.restaurant_tables
  where id = current_order.table_id
  for update;

  if not found or current_table.status <> 'occupied' then
    raise exception 'Only occupied tables can be released';
  end if;

  if active_session.id is not null then
    if active_session.table_id <> current_order.table_id then
      raise exception 'Active table session does not match the paid order table';
    end if;

    if exists (
      select 1
      from public.orders o
      where o.table_session_id = active_session.id
        and o.status in ('submitted', 'preparing', 'ready', 'awaiting_payment')
    ) then
      raise exception 'Table session has unfinished orders and cannot be released';
    end if;
  end if;

  if exists (
    select 1
    from public.orders o
    where o.table_id = current_order.table_id
      and o.status in ('submitted', 'preparing', 'ready', 'awaiting_payment')
      and (
        active_session.id is null
        or o.table_session_id is distinct from active_session.id
      )
  ) then
    raise exception 'Table has unfinished legacy orders and cannot be released';
  end if;

  update public.orders
  set closed_at = close_timestamp
  where (
      (active_session.id is not null and table_session_id = active_session.id)
      or id = current_order.id
    )
    and status = 'paid'
    and closed_at is null;

  if active_session.id is not null then
    update public.table_sessions
    set status = 'closed',
        closed_at = coalesce(closed_at, close_timestamp)
    where id = active_session.id
    returning * into active_session;
  end if;

  update public.restaurant_tables
  set status = 'available'
  where id = current_order.table_id;

  perform public.write_audit_log(
    'close_paid_table',
    case when active_session.id is not null then 'table_sessions' else 'orders' end,
    coalesce(active_session.id, current_order.id),
    null,
    case when active_session.id is not null then to_jsonb(active_session) else to_jsonb(current_order) end
  );

  return jsonb_build_object(
    'table_session_id', active_session.id,
    'table_id', current_order.table_id,
    'closed_at', coalesce(active_session.closed_at, close_timestamp)
  );
end;
$$;

revoke all on function public.close_paid_table(uuid) from public;
grant execute on function public.close_paid_table(uuid) to authenticated;

commit;
