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
  current_business_date date := ((clock_timestamp() at time zone 'Asia/Baghdad')::date);
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

  if open_shift.business_date <> current_business_date then
    raise exception 'STALE_CASH_SHIFT_MUST_CLOSE';
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

revoke all on function public.create_cash_movement_for_source(text, text, numeric, text, uuid, text) from public;
revoke all on function public.calculate_cash_shift_expected(uuid, timestamptz) from public;

grant execute on function public.calculate_cash_shift_expected(uuid, timestamptz) to authenticated;
