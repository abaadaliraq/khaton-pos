create table if not exists public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  business_date date not null default ((now() at time zone 'Asia/Baghdad')::date),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(18,4) not null check (opening_cash >= 0),
  counted_cash numeric(18,4) check (counted_cash is null or counted_cash >= 0),
  expected_cash_snapshot numeric(18,4),
  cash_difference numeric(18,4),
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_note text,
  closing_note text,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  closed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint cash_shifts_closed_state_check check (
    (
      status = 'open'
      and closed_at is null
      and counted_cash is null
      and expected_cash_snapshot is null
      and cash_difference is null
      and closed_by is null
    )
    or
    (
      status = 'closed'
      and closed_at is not null
      and counted_cash is not null
      and expected_cash_snapshot is not null
      and cash_difference is not null
      and closed_by is not null
    )
  )
);

create index if not exists cash_shifts_cashier_id_idx on public.cash_shifts(cashier_id);
create index if not exists cash_shifts_business_date_idx on public.cash_shifts(business_date);
create index if not exists cash_shifts_opened_at_idx on public.cash_shifts(opened_at desc);

create unique index if not exists cash_shifts_one_open_per_cashier_idx
  on public.cash_shifts(cashier_id)
  where status = 'open';

create or replace function public.prevent_cash_shift_direct_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Cash shifts cannot be deleted';
  end if;

  if old.status = 'closed' then
    raise exception 'Closed cash shifts cannot be modified';
  end if;

  if old.status = 'open' and new.status = 'closed' then
    if new.id = old.id
      and new.cashier_id = old.cashier_id
      and new.business_date = old.business_date
      and new.opened_at = old.opened_at
      and new.opening_cash = old.opening_cash
      and new.opening_note is not distinct from old.opening_note
      and new.opened_by = old.opened_by
      and new.created_at = old.created_at
      and old.closed_at is null
      and old.counted_cash is null
      and old.expected_cash_snapshot is null
      and old.cash_difference is null
      and old.closed_by is null
      and new.closed_at is not null
      and new.counted_cash is not null
      and new.expected_cash_snapshot is not null
      and new.cash_difference is not null
      and new.closed_by is not null
    then
      return new;
    end if;

    raise exception 'Cash shifts can only be closed through the approved workflow';
  end if;

  raise exception 'Cash shifts can only be changed through the approved workflow';
end;
$$;

drop trigger if exists prevent_cash_shift_direct_mutation_trigger on public.cash_shifts;
create trigger prevent_cash_shift_direct_mutation_trigger
  before update or delete on public.cash_shifts
  for each row execute function public.prevent_cash_shift_direct_mutation();

alter table public.cash_shifts enable row level security;

drop policy if exists "cash shifts role read" on public.cash_shifts;
create policy "cash shifts role read" on public.cash_shifts
  for select to authenticated
  using (
    public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('cashier', 'accountant')
      and cashier_id = auth.uid()
    )
  );

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
  from public.payments
  where method = 'cash'
    and status = 'completed'
    and created_at >= target_shift.opened_at
    and created_at <= cutoff_at;

  select coalesce(sum(amount), 0) into cash_expenses
  from public.expenses
  where payment_method = 'cash'
    and created_at >= target_shift.opened_at
    and created_at <= cutoff_at;

  select coalesce(sum(amount), 0) into cash_supplier_payments
  from public.purchase_payments
  where payment_method = 'cash'
    and created_at >= target_shift.opened_at
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

create or replace function public.get_current_expected_cash()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  open_shift public.cash_shifts%rowtype;
begin
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can view cash shifts';
  end if;

  select * into open_shift
  from public.cash_shifts
  where cashier_id = auth.uid()
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
  p_opening_note text default null
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
  if requester_role not in ('cashier', 'accountant', 'admin') then
    raise exception 'Only cashier, accountant, or admin users can open cash shifts';
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
    raise exception 'User already has an open cash shift';
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
    'cash_shift_opened',
    'cash_shifts',
    created_shift.id,
    null,
    jsonb_build_object(
      'shift_id', created_shift.id,
      'cashier_id', created_shift.cashier_id,
      'business_date', created_shift.business_date,
      'opening_cash', created_shift.opening_cash,
      'opened_at', created_shift.opened_at
    )
  );

  return created_shift;
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

  lock table public.payments in share mode;
  lock table public.expenses in share mode;
  lock table public.purchase_payments in share mode;

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

revoke all on function public.calculate_cash_shift_expected(uuid, timestamptz) from public;
revoke all on function public.get_current_expected_cash() from public;
revoke all on function public.open_cash_shift(numeric, text) from public;
revoke all on function public.close_cash_shift(numeric, text) from public;

grant execute on function public.calculate_cash_shift_expected(uuid, timestamptz) to authenticated;
grant execute on function public.get_current_expected_cash() to authenticated;
grant execute on function public.open_cash_shift(numeric, text) to authenticated;
grant execute on function public.close_cash_shift(numeric, text) to authenticated;

grant select on public.cash_shifts to authenticated;
