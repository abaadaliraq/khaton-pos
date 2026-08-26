alter table public.expenses
  alter column expense_date set default ((now() at time zone 'Asia/Baghdad')::date);

create or replace function public.set_expense_system_fields()
returns trigger
language plpgsql
as $$
begin
  new.expense_date := ((now() at time zone 'Asia/Baghdad')::date);
  new.created_at := now();
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_expense_system_fields_trigger on public.expenses;
create trigger set_expense_system_fields_trigger before insert on public.expenses
  for each row execute function public.set_expense_system_fields();

create or replace function public.prevent_expense_system_fields_update()
returns trigger
language plpgsql
as $$
begin
  if new.expense_number is distinct from old.expense_number
    or new.expense_date is distinct from old.expense_date
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Expense system fields cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_expense_system_fields_update_trigger on public.expenses;
create trigger prevent_expense_system_fields_update_trigger before update on public.expenses
  for each row execute function public.prevent_expense_system_fields_update();

drop policy if exists "expenses admin insert" on public.expenses;
create policy "expenses admin insert" on public.expenses
  for insert to authenticated
  with check (
    public.current_user_role() = 'admin'
    and expense_date = ((now() at time zone 'Asia/Baghdad')::date)
    and created_by = auth.uid()
  );

drop function if exists public.create_expense(numeric, text, date, text, text, text, text);

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

revoke all on function public.create_expense(numeric, text, text, text, text, text) from public;
grant execute on function public.create_expense(numeric, text, text, text, text, text) to authenticated;
grant select on public.expenses to authenticated;
