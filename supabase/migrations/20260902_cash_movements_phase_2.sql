create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.cash_shifts(id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  movement_type text not null check (movement_type in ('customer_payment', 'expense', 'supplier_payment', 'manual_cash_in', 'manual_cash_out')),
  event_type text not null default 'original' check (event_type in ('original', 'reversal', 'refund')),
  amount numeric(18,4) not null check (amount > 0),
  source_type text not null check (source_type in ('payment', 'expense', 'purchase_payment', 'manual')),
  source_id uuid,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete restrict,
  constraint cash_movements_source_required_check check (
    (source_type = 'manual' and source_id is null)
    or
    (source_type <> 'manual' and source_id is not null)
  ),
  constraint cash_movements_manual_type_check check (
    (source_type = 'manual' and movement_type in ('manual_cash_in', 'manual_cash_out'))
    or
    (source_type <> 'manual' and movement_type in ('customer_payment', 'expense', 'supplier_payment'))
  ),
  constraint cash_movements_direction_type_check check (
    (direction = 'in' and movement_type in ('customer_payment', 'manual_cash_in'))
    or
    (direction = 'out' and movement_type in ('expense', 'supplier_payment', 'manual_cash_out'))
  ),
  constraint cash_movements_void_check check (
    (voided_at is null and voided_by is null)
    or
    (voided_at is not null and voided_by is not null)
  )
);

create index if not exists cash_movements_shift_id_created_at_idx
  on public.cash_movements(shift_id, created_at desc);

create index if not exists cash_movements_source_idx
  on public.cash_movements(source_type, source_id)
  where source_id is not null;

create unique index if not exists cash_movements_original_source_unique_idx
  on public.cash_movements(source_type, source_id, movement_type, event_type)
  where source_id is not null
    and event_type = 'original'
    and voided_at is null;

create or replace function public.ensure_cash_movement_insert_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shift public.cash_shifts%rowtype;
begin
  select * into target_shift
  from public.cash_shifts
  where id = new.shift_id
  for share;

  if not found then
    raise exception 'Cash shift was not found';
  end if;

  if target_shift.status <> 'open' then
    raise exception 'Cash movement cannot be added to a closed cash shift';
  end if;

  if new.voided_at is not null or new.voided_by is not null then
    raise exception 'Cash movements cannot be inserted as voided';
  end if;

  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists ensure_cash_movement_insert_allowed_trigger on public.cash_movements;
create trigger ensure_cash_movement_insert_allowed_trigger
  before insert on public.cash_movements
  for each row execute function public.ensure_cash_movement_insert_allowed();

create or replace function public.prevent_cash_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Cash movements cannot be deleted';
  end if;

  raise exception 'Cash movements cannot be modified directly';
end;
$$;

drop trigger if exists prevent_cash_movement_mutation_trigger on public.cash_movements;
create trigger prevent_cash_movement_mutation_trigger
  before update or delete on public.cash_movements
  for each row execute function public.prevent_cash_movement_mutation();

alter table public.cash_movements enable row level security;

drop policy if exists "cash movements finance read" on public.cash_movements;
create policy "cash movements finance read" on public.cash_movements
  for select to authenticated
  using (
    public.current_user_role() in ('accountant', 'admin')
    or (
      public.current_user_role() = 'cashier'
      and created_by = auth.uid()
    )
  );

revoke all on public.cash_movements from anon;
revoke all on public.cash_movements from authenticated;
grant select on public.cash_movements to authenticated;

create or replace function public.create_cash_movement_for_source(
  p_direction text,
  p_movement_type text,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_description text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  open_shift public.cash_shifts%rowtype;
  created_movement public.cash_movements%rowtype;
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can record cash movements';
  end if;

  if p_direction not in ('in', 'out') then
    raise exception 'Invalid cash movement direction';
  end if;

  if p_movement_type not in ('customer_payment', 'expense', 'supplier_payment', 'manual_cash_in', 'manual_cash_out') then
    raise exception 'Invalid cash movement type';
  end if;

  if p_source_type not in ('payment', 'expense', 'purchase_payment', 'manual') then
    raise exception 'Invalid cash movement source type';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Cash movement amount must be positive';
  end if;

  select * into open_shift
  from public.cash_shifts
  where cashier_id = auth.uid()
    and status = 'open'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'CASH_SHIFT_REQUIRED';
  end if;

  insert into public.cash_movements (
    shift_id,
    direction,
    movement_type,
    event_type,
    amount,
    source_type,
    source_id,
    description,
    created_by
  ) values (
    open_shift.id,
    p_direction,
    p_movement_type,
    'original',
    p_amount,
    p_source_type,
    p_source_id,
    nullif(btrim(coalesce(p_description, '')), ''),
    auth.uid()
  )
  returning * into created_movement;

  return created_movement;
end;
$$;

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
  cash_expenses numeric(18,4) := 0;
  cash_supplier_payments numeric(18,4) := 0;
  expected_cash numeric(18,4) := 0;
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can view cash shifts';
  end if;

  select * into target_shift
  from public.cash_shifts
  where id = p_shift_id;

  if not found then
    raise exception 'Cash shift was not found';
  end if;

  if requester_role <> 'admin' and target_shift.cashier_id <> auth.uid() then
    raise exception 'Users can only view their own cash shifts';
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

  expected_cash := target_shift.opening_cash + cash_sales - cash_expenses - cash_supplier_payments;

  return jsonb_build_object(
    'shiftId', target_shift.id,
    'businessDate', target_shift.business_date,
    'openedAt', target_shift.opened_at,
    'cutoffAt', cutoff_at,
    'openingCash', target_shift.opening_cash,
    'cashSales', cash_sales,
    'cashExpenses', cash_expenses,
    'cashSupplierPayments', cash_supplier_payments,
    'expectedCash', expected_cash,
    'sources', jsonb_build_object(
      'cashSalesAvailable', true,
      'cashExpensesAvailable', true,
      'cashSupplierPaymentsAvailable', true
    )
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
  created_payment public.payments%rowtype;
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
    values (p_order_id, auth.uid(), payment_method, payment_amount, payment_reference)
    returning * into created_payment;

    if payment_method = 'cash' then
      perform public.create_cash_movement_for_source(
        'in',
        'customer_payment',
        created_payment.amount,
        'payment',
        created_payment.id,
        'Customer cash payment'
      );
    end if;
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
      values (current_order.id, auth.uid(), payment_entry.method, allocation, payment_entry.reference)
      returning * into created_payment;

      if payment_entry.method = 'cash' then
        perform public.create_cash_movement_for_source(
          'in',
          'customer_payment',
          created_payment.amount,
          'payment',
          created_payment.id,
          'Customer cash payment'
        );
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

create or replace function public.create_expense(
  p_amount numeric,
  p_category text,
  p_payment_method text,
  p_receipt_number text default null,
  p_description text default null,
  p_notes text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  created_expense public.expenses%rowtype;
begin
  if requester_role not in ('admin', 'accountant') then
    raise exception 'Only admin or accountant users can manage expenses';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be positive';
  end if;

  if p_category not in ('electricity', 'water', 'internet', 'generator', 'maintenance', 'cleaning', 'transport', 'marketing', 'external_services', 'other') then
    raise exception 'Invalid expense category';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Invalid expense payment method';
  end if;

  if nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'Expense description is required';
  end if;

  insert into public.expenses (
    amount,
    category,
    payment_method,
    receipt_number,
    description,
    notes,
    created_by
  ) values (
    p_amount,
    p_category,
    p_payment_method,
    nullif(btrim(coalesce(p_receipt_number, '')), ''),
    btrim(p_description),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) returning * into created_expense;

  if p_payment_method = 'cash' then
    perform public.create_cash_movement_for_source(
      'out',
      'expense',
      created_expense.amount,
      'expense',
      created_expense.id,
      created_expense.description
    );
  end if;

  perform public.write_audit_log(
    'إضافة مصروف',
    'expenses',
    created_expense.id,
    null,
    jsonb_build_object(
      'amount', created_expense.amount,
      'category', created_expense.category,
      'expense_date', created_expense.expense_date
    )
  );

  return created_expense;
end;
$$;

create or replace function public.pay_purchase(
  p_purchase_id uuid,
  p_payment_method text,
  p_reference_number text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  old_purchase public.purchases%rowtype;
  updated_purchase public.purchases%rowtype;
  created_payment public.purchase_payments%rowtype;
begin
  if requester_role not in ('admin', 'accountant') then
    raise exception 'Only accountant or admin users can pay supplier invoices';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Invalid payment method';
  end if;

  select * into old_purchase
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'Purchase was not found';
  end if;

  if old_purchase.payment_status = 'paid' then
    raise exception 'Purchase is already paid';
  end if;

  if old_purchase.total_amount <= 0 then
    raise exception 'Purchase total amount must be positive';
  end if;

  insert into public.purchase_payments (
    purchase_id,
    amount,
    payment_method,
    reference_number,
    notes,
    paid_by
  ) values (
    old_purchase.id,
    old_purchase.total_amount,
    p_payment_method,
    nullif(btrim(coalesce(p_reference_number, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) returning * into created_payment;

  if p_payment_method = 'cash' then
    perform public.create_cash_movement_for_source(
      'out',
      'supplier_payment',
      created_payment.amount,
      'purchase_payment',
      created_payment.id,
      'Supplier cash payment'
    );
  end if;

  update public.purchases
  set payment_status = 'paid'
  where id = old_purchase.id
  returning * into updated_purchase;

  perform public.write_audit_log(
    'دفع المورد',
    'purchase_payments',
    created_payment.id,
    to_jsonb(old_purchase),
    jsonb_build_object(
      'purchase_id', updated_purchase.id,
      'payment_status', updated_purchase.payment_status,
      'amount', created_payment.amount,
      'payment_method', created_payment.payment_method
    )
  );

  return jsonb_build_object('payment_id', created_payment.id, 'purchase_id', updated_purchase.id);
end;
$$;

create or replace function public.close_cash_shift(
  p_counted_cash numeric,
  p_closing_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  open_shift public.cash_shifts%rowtype;
  closed_shift public.cash_shifts%rowtype;
  cutoff_at timestamptz;
  expected_breakdown jsonb;
  expected_cash numeric(18,4);
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can close cash shifts';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Counted cash cannot be negative';
  end if;

  select * into open_shift
  from public.cash_shifts
  where cashier_id = auth.uid()
    and status = 'open'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No open cash shift was found';
  end if;

  cutoff_at := clock_timestamp();
  expected_breakdown := public.calculate_cash_shift_expected(open_shift.id, cutoff_at);
  expected_cash := (expected_breakdown ->> 'expectedCash')::numeric;

  update public.cash_shifts
  set status = 'closed',
      closed_at = cutoff_at,
      counted_cash = p_counted_cash,
      expected_cash_snapshot = expected_cash,
      cash_difference = p_counted_cash - expected_cash,
      closed_by = auth.uid(),
      closing_note = nullif(btrim(coalesce(p_closing_note, '')), '')
  where id = open_shift.id
  returning * into closed_shift;

  perform public.write_audit_log(
    'cash_shift_closed',
    'cash_shifts',
    closed_shift.id,
    to_jsonb(open_shift),
    jsonb_build_object(
      'shift_id', closed_shift.id,
      'cashier_id', closed_shift.cashier_id,
      'expected_cash', closed_shift.expected_cash_snapshot,
      'counted_cash', closed_shift.counted_cash,
      'cash_difference', closed_shift.cash_difference,
      'closed_at', closed_shift.closed_at,
      'breakdown', expected_breakdown
    )
  );

  return jsonb_build_object(
    'shift', to_jsonb(closed_shift),
    'expected', expected_breakdown
  );
end;
$$;

insert into public.cash_movements (
  shift_id,
  direction,
  movement_type,
  event_type,
  amount,
  source_type,
  source_id,
  description,
  created_by,
  created_at
)
select
  cs.id,
  'in',
  'customer_payment',
  'original',
  p.amount,
  'payment',
  p.id,
  'Backfilled customer cash payment for current open shift',
  p.cashier_id,
  p.created_at
from public.cash_shifts cs
join public.payments p on p.cashier_id = cs.cashier_id
where cs.status = 'open'
  and p.method = 'cash'
  and p.status = 'completed'
  and p.created_at >= cs.opened_at
on conflict do nothing;

insert into public.cash_movements (
  shift_id,
  direction,
  movement_type,
  event_type,
  amount,
  source_type,
  source_id,
  description,
  created_by,
  created_at
)
select
  cs.id,
  'out',
  'expense',
  'original',
  e.amount,
  'expense',
  e.id,
  e.description,
  e.created_by,
  e.created_at
from public.cash_shifts cs
join public.expenses e on e.created_by = cs.cashier_id
where cs.status = 'open'
  and e.payment_method = 'cash'
  and e.created_at >= cs.opened_at
on conflict do nothing;

insert into public.cash_movements (
  shift_id,
  direction,
  movement_type,
  event_type,
  amount,
  source_type,
  source_id,
  description,
  created_by,
  created_at
)
select
  cs.id,
  'out',
  'supplier_payment',
  'original',
  pp.amount,
  'purchase_payment',
  pp.id,
  'Backfilled supplier cash payment for current open shift',
  pp.paid_by,
  pp.created_at
from public.cash_shifts cs
join public.purchase_payments pp on pp.paid_by = cs.cashier_id
where cs.status = 'open'
  and pp.payment_method = 'cash'
  and pp.created_at >= cs.opened_at
on conflict do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'cash_movements'
    ) then
      alter publication supabase_realtime add table public.cash_movements;
    end if;
  end if;
end;
$$;

revoke all on function public.create_cash_movement_for_source(text, text, numeric, text, uuid, text) from public;
revoke all on function public.ensure_cash_movement_insert_allowed() from public;
revoke all on function public.prevent_cash_movement_mutation() from public;
revoke all on function public.calculate_cash_shift_expected(uuid, timestamptz) from public;
revoke all on function public.record_order_payment(uuid, jsonb) from public;
revoke all on function public.record_table_payment(uuid, jsonb) from public;
revoke all on function public.create_expense(numeric, text, text, text, text, text) from public;
revoke all on function public.pay_purchase(uuid, text, text, text) from public;
revoke all on function public.close_cash_shift(numeric, text) from public;

grant execute on function public.calculate_cash_shift_expected(uuid, timestamptz) to authenticated;
grant execute on function public.record_order_payment(uuid, jsonb) to authenticated;
grant execute on function public.record_table_payment(uuid, jsonb) to authenticated;
grant execute on function public.create_expense(numeric, text, text, text, text, text) to authenticated;
grant execute on function public.pay_purchase(uuid, text, text, text) to authenticated;
grant execute on function public.close_cash_shift(numeric, text) to authenticated;
