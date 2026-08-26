create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number bigint generated always as identity unique,
  amount numeric(12,0) not null check (amount > 0),
  category text not null check (category in ('electricity', 'water', 'internet', 'generator', 'maintenance', 'cleaning', 'transport', 'marketing', 'external_services', 'other')),
  expense_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer')),
  receipt_number text,
  description text not null check (length(btrim(description)) > 0),
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists expenses_expense_date_idx on public.expenses(expense_date);
create index if not exists expenses_category_idx on public.expenses(category);
create index if not exists expenses_created_by_idx on public.expenses(created_by);

alter table public.expenses enable row level security;

drop policy if exists "expenses admin read" on public.expenses;
create policy "expenses admin read" on public.expenses
  for select to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "expenses admin insert" on public.expenses;
create policy "expenses admin insert" on public.expenses
  for insert to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "expenses admin update" on public.expenses;
create policy "expenses admin update" on public.expenses
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create or replace function public.create_expense(
  p_amount numeric,
  p_category text,
  p_expense_date date,
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
  created_expense public.expenses%rowtype;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admin users can manage expenses';
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

  if p_expense_date is null then
    raise exception 'Expense date is required';
  end if;

  if nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'Expense description is required';
  end if;

  insert into public.expenses (
    amount,
    category,
    expense_date,
    payment_method,
    receipt_number,
    description,
    notes,
    created_by
  ) values (
    p_amount,
    p_category,
    p_expense_date,
    p_payment_method,
    nullif(btrim(coalesce(p_receipt_number, '')), ''),
    btrim(p_description),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) returning * into created_expense;

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

revoke all on function public.create_expense(numeric, text, date, text, text, text, text) from public;
grant execute on function public.create_expense(numeric, text, date, text, text, text, text) to authenticated;
