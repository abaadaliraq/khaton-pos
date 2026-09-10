create or replace function public.cash_shift_is_operational(
  p_opened_at timestamptz,
  p_business_date date
)
returns boolean
language sql
volatile
set search_path = public
as $$
  select
    p_business_date = ((clock_timestamp() at time zone 'Asia/Baghdad')::date)
    or clock_timestamp() < p_opened_at + interval '15 hours';
$$;

create or replace function public.cash_shift_close_remaining(p_opened_at timestamptz)
returns text
language sql
volatile
set search_path = public
as $$
  select case
    when p_opened_at + interval '15 hours' <= clock_timestamp() then '0 دقيقة'
    else
      concat(
        floor(extract(epoch from (p_opened_at + interval '15 hours' - clock_timestamp())) / 3600)::int,
        ' ساعة و',
        floor(mod(extract(epoch from (p_opened_at + interval '15 hours' - clock_timestamp())), 3600) / 60)::int,
        ' دقيقة'
      )
  end;
$$;

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
  if requester_role not in ('cashier', 'admin') then
    raise exception 'Only cashier or admin users can record register cash movements';
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

  if not public.cash_shift_is_operational(open_shift.opened_at, open_shift.business_date) then
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
  created_shift public.cash_shifts%rowtype;
begin
  if requester_role <> 'cashier' then
    raise exception 'Only cashiers can open their own cash shifts';
  end if;

  if p_cashier_id is not null and p_cashier_id <> auth.uid() then
    raise exception 'Cashiers can only open their own cash shifts';
  end if;

  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'Opening cash cannot be negative';
  end if;

  if exists (
    select 1
    from public.cash_shifts
    where cashier_id = auth.uid()
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
    auth.uid(),
    (clock_timestamp() at time zone 'Asia/Baghdad')::date,
    clock_timestamp(),
    p_opening_cash,
    nullif(btrim(coalesce(p_opening_note, '')), ''),
    auth.uid()
  ) returning * into created_shift;

  perform public.write_audit_log(
    'فتح وردية',
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
  open_shift public.cash_shifts%rowtype;
  closed_shift public.cash_shifts%rowtype;
  cutoff_at timestamptz;
  expected_breakdown jsonb;
  expected_cash numeric(18,4);
  remaining_time text;
begin
  if requester_role <> 'cashier' then
    raise exception 'Only cashiers can close their own cash shifts';
  end if;

  if p_cashier_id is not null and p_cashier_id <> auth.uid() then
    raise exception 'Cashiers can only close their own cash shifts';
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
    raise exception 'No open cash shift was found for this cashier';
  end if;

  if clock_timestamp() < open_shift.opened_at + interval '15 hours' then
    remaining_time := public.cash_shift_close_remaining(open_shift.opened_at);
    raise exception 'لا يمكن إغلاق الوردية قبل إكمال 15 ساعة. الوقت المتبقي: %', remaining_time;
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
    'إغلاق وردية',
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

create or replace function public.emergency_close_cash_shift(
  p_shift_id uuid,
  p_counted_cash numeric,
  p_reason text
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
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if requester_role not in ('admin', 'owner') then
    raise exception 'Only admin or owner users can emergency close cash shifts';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Counted cash cannot be negative';
  end if;

  if clean_reason is null then
    raise exception 'Emergency close reason is required';
  end if;

  select * into open_shift
  from public.cash_shifts
  where id = p_shift_id
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open cash shift was not found';
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
      closing_note = clean_reason
  where id = open_shift.id
  returning * into closed_shift;

  perform public.write_audit_log(
    'إغلاق استثنائي للوردية — السبب: ' || clean_reason,
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
      'emergency_reason', clean_reason,
      'breakdown', expected_breakdown
    )
  );

  return jsonb_build_object(
    'shift', to_jsonb(closed_shift),
    'expected', expected_breakdown
  );
end;
$$;

create or replace function public.pay_purchase(
  p_purchase_id uuid,
  p_payment_method text,
  p_reference_number text default null,
  p_notes text default null,
  p_cash_shift_id uuid default null
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
  target_shift public.cash_shifts%rowtype;
  matching_shift_count integer := 0;
  stale_shift_count integer := 0;
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

  if p_payment_method = 'cash' then
    if p_cash_shift_id is not null then
      select * into target_shift
      from public.cash_shifts
      where id = p_cash_shift_id
      for update;

      if not found or target_shift.status <> 'open' then
        raise exception 'CASH_SHIFT_REQUIRED';
      end if;

      if not public.cash_shift_is_operational(target_shift.opened_at, target_shift.business_date) then
        raise exception 'STALE_CASH_SHIFT_MUST_CLOSE';
      end if;
    else
      select count(*) into matching_shift_count
      from public.cash_shifts
      where status = 'open'
        and public.cash_shift_is_operational(opened_at, business_date);

      if matching_shift_count = 0 then
        select count(*) into stale_shift_count
        from public.cash_shifts
        where status = 'open';

        if stale_shift_count > 0 then
          raise exception 'STALE_CASH_SHIFT_MUST_CLOSE';
        end if;

        raise exception 'CASH_SHIFT_REQUIRED';
      end if;

      if matching_shift_count > 1 then
        raise exception 'MULTIPLE_OPEN_CASH_SHIFTS_SELECT_REQUIRED';
      end if;

      select * into target_shift
      from public.cash_shifts
      where status = 'open'
        and public.cash_shift_is_operational(opened_at, business_date)
      for update;
    end if;
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
      target_shift.id,
      'out',
      'supplier_payment',
      'original',
      created_payment.amount,
      'purchase_payment',
      created_payment.id,
      'Supplier cash payment',
      auth.uid()
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
      'payment_method', created_payment.payment_method,
      'cash_shift_id', case when p_payment_method = 'cash' then target_shift.id else null end
    )
  );

  return jsonb_build_object(
    'payment_id', created_payment.id,
    'purchase_id', updated_purchase.id,
    'cash_shift_id', case when p_payment_method = 'cash' then target_shift.id else null end
  );
end;
$$;

revoke all on function public.cash_shift_is_operational(timestamptz, date) from public;
revoke all on function public.cash_shift_close_remaining(timestamptz) from public;
revoke all on function public.create_cash_movement_for_source(text, text, numeric, text, uuid, text) from public;
revoke all on function public.open_cash_shift(numeric, text, uuid) from public;
revoke all on function public.close_cash_shift(numeric, text, uuid) from public;
revoke all on function public.emergency_close_cash_shift(uuid, numeric, text) from public;
revoke all on function public.pay_purchase(uuid, text, text, text) from public;
revoke all on function public.pay_purchase(uuid, text, text, text, uuid) from public;

grant execute on function public.cash_shift_is_operational(timestamptz, date) to authenticated;
grant execute on function public.cash_shift_close_remaining(timestamptz) to authenticated;
grant execute on function public.open_cash_shift(numeric, text, uuid) to authenticated;
grant execute on function public.close_cash_shift(numeric, text, uuid) to authenticated;
grant execute on function public.emergency_close_cash_shift(uuid, numeric, text) to authenticated;
grant execute on function public.pay_purchase(uuid, text, text, text, uuid) to authenticated;
