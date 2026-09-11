create table if not exists public.payment_tips (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  table_session_id uuid references public.table_sessions(id) on delete restrict,
  cash_shift_id uuid references public.cash_shifts(id) on delete restrict,
  amount numeric(18,4) not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'transfer')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_tips_payment_unique unique (payment_id)
);

create index if not exists payment_tips_created_at_idx
  on public.payment_tips(created_at desc);

create index if not exists payment_tips_cash_shift_created_at_idx
  on public.payment_tips(cash_shift_id, created_at desc)
  where cash_shift_id is not null;

alter table public.payment_tips enable row level security;

drop policy if exists "payment tips role read" on public.payment_tips;
create policy "payment tips role read" on public.payment_tips
  for select to authenticated
  using (public.current_user_role() in ('cashier', 'accountant', 'admin', 'owner'));

revoke all on public.payment_tips from anon;
revoke all on public.payment_tips from authenticated;
grant select on public.payment_tips to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.payment_tips;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

create or replace function public.calculate_cash_shift_expected(
  p_shift_id uuid,
  p_cutoff_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_shift public.cash_shifts%rowtype;
  cutoff_at timestamptz := coalesce(p_cutoff_at, clock_timestamp());
  cash_sales numeric(18,4) := 0;
  cash_tips numeric(18,4) := 0;
  cash_expenses numeric(18,4) := 0;
  cash_supplier_payments numeric(18,4) := 0;
  expected_cash numeric(18,4) := 0;
begin
  if requester_role not in ('cashier', 'accountant', 'admin', 'owner') then
    raise exception 'Only cashier, accountant, admin, or owner users can view cash shifts';
  end if;

  select * into target_shift
  from public.cash_shifts
  where id = p_shift_id;

  if not found then
    raise exception 'Cash shift was not found';
  end if;

  if requester_role = 'cashier' and target_shift.cashier_id <> auth.uid() then
    raise exception 'Cashiers can only view their own cash shifts';
  end if;

  if cutoff_at < target_shift.opened_at then
    raise exception 'Cash shift cutoff cannot be before opening time';
  end if;

  select coalesce(sum(amount), 0) into cash_sales
  from public.cash_movements
  where shift_id = target_shift.id
    and direction = 'in'
    and movement_type = 'customer_payment'
    and event_type = 'original'
    and voided_at is null
    and created_at <= cutoff_at;

  select coalesce(sum(amount), 0) into cash_tips
  from public.payment_tips
  where cash_shift_id = target_shift.id
    and method = 'cash'
    and created_at <= cutoff_at;

  select coalesce(sum(amount), 0) into cash_expenses
  from public.cash_movements
  where shift_id = target_shift.id
    and direction = 'out'
    and movement_type = 'expense'
    and event_type = 'original'
    and voided_at is null
    and created_at <= cutoff_at;

  select coalesce(sum(amount), 0) into cash_supplier_payments
  from public.cash_movements
  where shift_id = target_shift.id
    and direction = 'out'
    and movement_type = 'supplier_payment'
    and event_type = 'original'
    and voided_at is null
    and created_at <= cutoff_at;

  expected_cash := target_shift.opening_cash + cash_sales + cash_tips - cash_expenses - cash_supplier_payments;

  return jsonb_build_object(
    'shiftId', target_shift.id,
    'businessDate', target_shift.business_date,
    'openedAt', target_shift.opened_at,
    'cutoffAt', cutoff_at,
    'openingCash', target_shift.opening_cash,
    'cashSales', cash_sales,
    'cashTips', cash_tips,
    'cashExpenses', cash_expenses,
    'cashSupplierPayments', cash_supplier_payments,
    'expectedCash', expected_cash,
    'sources', jsonb_build_object(
      'cashSalesAvailable', true,
      'cashTipsAvailable', true,
      'cashExpensesAvailable', true,
      'cashSupplierPaymentsAvailable', true
    )
  );
end;
$$;

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
  created_payment public.payments%rowtype;
  created_movement public.cash_movements%rowtype;
  payment_total numeric(12,0);
  tip_total numeric(18,4);
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
    tip_amount numeric(18,4) not null default 0,
    reference text
  ) on commit drop;

  insert into table_payment_entries (ord, method, remaining, tip_amount, reference)
  select
    entry.ord::integer,
    entry.payload ->> 'method',
    coalesce((entry.payload ->> 'amount')::numeric, 0),
    coalesce((entry.payload ->> 'tip_amount')::numeric, (entry.payload ->> 'tipAmount')::numeric, 0),
    nullif(btrim(coalesce(entry.payload ->> 'reference', '')), '')
  from jsonb_array_elements(p_payments) with ordinality as entry(payload, ord);

  if exists (
    select 1
    from table_payment_entries
    where method not in ('cash', 'card', 'transfer')
      or remaining <= 0
      or tip_amount < 0
  ) then
    raise exception 'Invalid payment payload';
  end if;

  select coalesce(sum(remaining), 0), coalesce(sum(tip_amount), 0) into payment_total, tip_total
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
      values (current_order.id, auth.uid(), payment_entry.method, allocation, payment_entry.reference)
      returning * into created_payment;

      if payment_entry.method = 'cash' then
        created_movement := public.create_cash_movement_for_source(
          'in',
          'customer_payment',
          created_payment.amount,
          'payment',
          created_payment.id,
          'Customer cash payment'
        );
      else
        created_movement := null;
      end if;

      if payment_entry.tip_amount > 0 then
        insert into public.payment_tips (
          payment_id,
          order_id,
          table_session_id,
          cash_shift_id,
          amount,
          method,
          created_by
        ) values (
          created_payment.id,
          current_order.id,
          p_table_session_id,
          case when payment_entry.method = 'cash' then created_movement.shift_id else null end,
          payment_entry.tip_amount,
          payment_entry.method,
          auth.uid()
        );

        update table_payment_entries
        set tip_amount = 0
        where ord = payment_entry.ord;
      end if;

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
      or tip_amount <> 0
  ) then
    raise exception 'Payment allocation mismatch';
  end if;

  perform public.write_audit_log(
    'record_table_payment',
    'table_sessions',
    p_table_session_id,
    null,
    jsonb_build_object('paid_orders', paid_count, 'paid_amount', payment_total, 'tip_amount', tip_total)
  );

  return jsonb_build_object('table_session_id', p_table_session_id, 'paid_orders', paid_count, 'paid_amount', payment_total, 'tip_amount', tip_total);
end;
$$;

revoke all on function public.calculate_cash_shift_expected(uuid, timestamptz) from public;
revoke all on function public.record_table_payment(uuid, jsonb) from public;
grant execute on function public.calculate_cash_shift_expected(uuid, timestamptz) to authenticated;
grant execute on function public.record_table_payment(uuid, jsonb) to authenticated;
