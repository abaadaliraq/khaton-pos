drop policy if exists "cash shifts role read" on public.cash_shifts;
create policy "cash shifts role read" on public.cash_shifts
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'accountant')
    or (
      public.current_user_role() = 'cashier'
      and cashier_id = auth.uid()
    )
  );

drop function if exists public.get_current_expected_cash();
drop function if exists public.open_cash_shift(numeric, text);
drop function if exists public.close_cash_shift(numeric, text);

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

create or replace function public.get_current_expected_cash(
  p_cashier_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_cashier_id uuid := coalesce(p_cashier_id, auth.uid());
  open_shift public.cash_shifts%rowtype;
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can view cash shifts';
  end if;

  if requester_role = 'cashier' and target_cashier_id <> auth.uid() then
    raise exception 'Cashiers can only view their own cash shifts';
  end if;

  select * into open_shift
  from public.cash_shifts
  where cashier_id = target_cashier_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return public.calculate_cash_shift_expected(open_shift.id, clock_timestamp());
end;
$$;

create or replace function public.open_cash_shift(
  p_opening_cash numeric,
  p_opening_note text default null,
  p_cashier_id uuid default null
)
returns public.cash_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_cashier public.profiles%rowtype;
  target_cashier_id uuid := coalesce(p_cashier_id, auth.uid());
  created_shift public.cash_shifts%rowtype;
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can open cash shifts';
  end if;

  if requester_role = 'cashier' and target_cashier_id <> auth.uid() then
    raise exception 'Cashiers can only open their own cash shifts';
  end if;

  select * into target_cashier
  from public.profiles
  where id = target_cashier_id
    and role = 'cashier'
    and status = 'active';

  if not found then
    raise exception 'Target cashier was not found or is not active';
  end if;

  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'Opening cash cannot be negative';
  end if;

  if exists (
    select 1
    from public.cash_shifts
    where cashier_id = target_cashier_id
      and status = 'open'
  ) then
    raise exception 'Cashier already has an open cash shift';
  end if;

  insert into public.cash_shifts (
    cashier_id,
    business_date,
    opened_at,
    opening_cash,
    opening_note,
    opened_by
  ) values (
    target_cashier_id,
    (clock_timestamp() at time zone 'Asia/Baghdad')::date,
    clock_timestamp(),
    p_opening_cash,
    nullif(btrim(coalesce(p_opening_note, '')), ''),
    auth.uid()
  ) returning * into created_shift;

  perform public.write_audit_log(
    'cash_shift_opened',
    'cash_shifts',
    created_shift.id,
    null,
    jsonb_build_object(
      'shift_id', created_shift.id,
      'cashier_id', created_shift.cashier_id,
      'business_date', created_shift.business_date,
      'opening_cash', created_shift.opening_cash,
      'opened_at', created_shift.opened_at,
      'opened_by', created_shift.opened_by
    )
  );

  return created_shift;
end;
$$;

create or replace function public.close_cash_shift(
  p_counted_cash numeric,
  p_closing_note text default null,
  p_cashier_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_cashier_id uuid := coalesce(p_cashier_id, auth.uid());
  open_shift public.cash_shifts%rowtype;
  closed_shift public.cash_shifts%rowtype;
  cutoff_at timestamptz;
  expected_breakdown jsonb;
  expected_cash numeric(18,4);
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can close cash shifts';
  end if;

  if requester_role = 'cashier' and target_cashier_id <> auth.uid() then
    raise exception 'Cashiers can only close their own cash shifts';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Counted cash cannot be negative';
  end if;

  select * into open_shift
  from public.cash_shifts
  where cashier_id = target_cashier_id
    and status = 'open'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No open cash shift was found for this cashier';
  end if;

  lock table public.payments in share mode;
  lock table public.expenses in share mode;
  lock table public.purchase_payments in share mode;
  lock table public.cash_movements in share mode;

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
      'closed_by', closed_shift.closed_by,
      'breakdown', expected_breakdown
    )
  );

  return jsonb_build_object(
    'shift', to_jsonb(closed_shift),
    'expected', expected_breakdown
  );
end;
$$;

revoke all on function public.get_current_expected_cash(uuid) from public;
revoke all on function public.open_cash_shift(numeric, text, uuid) from public;
revoke all on function public.close_cash_shift(numeric, text, uuid) from public;

grant execute on function public.get_current_expected_cash(uuid) to authenticated;
grant execute on function public.open_cash_shift(numeric, text, uuid) to authenticated;
grant execute on function public.close_cash_shift(numeric, text, uuid) to authenticated;
