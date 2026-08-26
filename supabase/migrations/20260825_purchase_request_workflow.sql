alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper', 'accountant'));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_username text := nullif(btrim(metadata ->> 'username'), '');
  requested_name text := nullif(btrim(metadata ->> 'full_name'), '');
  requested_role text := metadata ->> 'role';
begin
  if requested_username is null or requested_name is null then
    raise exception 'Missing required user metadata: username and full_name';
  end if;

  if requested_role not in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper', 'accountant') then
    raise exception 'Invalid user role: %', requested_role;
  end if;

  insert into public.profiles (id, username, full_name, role)
  values (new.id, requested_username, requested_name, requested_role)
  on conflict (id) do update
    set username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.link_staff_system_profile(
  p_staff_id uuid,
  p_profile_id uuid,
  p_username text,
  p_role text
)
returns public.staff_members
language plpgsql
security definer
set search_path = public
as $$
declare
  old_staff public.staff_members%rowtype;
  updated_staff public.staff_members%rowtype;
  target_profile public.profiles%rowtype;
begin
  perform public.assert_active_admin();

  select * into old_staff from public.staff_members where id = p_staff_id for update;
  if not found then raise exception 'Staff member not found'; end if;
  if old_staff.status <> 'active' then raise exception 'Staff member must be active'; end if;
  if old_staff.profile_id is not null then raise exception 'Staff member already has a linked profile'; end if;
  if old_staff.has_system_access then raise exception 'Staff member already has system access'; end if;

  select * into target_profile from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'Profile not found'; end if;
  if target_profile.username <> btrim(lower(p_username)) then raise exception 'Profile username does not match'; end if;
  if target_profile.role <> p_role then raise exception 'Profile role does not match'; end if;
  if p_role not in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper', 'accountant') then raise exception 'Invalid system role'; end if;

  if exists (
    select 1 from public.staff_members
    where profile_id = p_profile_id
      and id <> p_staff_id
  ) then
    raise exception 'Profile is already linked to another staff member';
  end if;

  update public.staff_members
  set profile_id = p_profile_id,
      has_system_access = true,
      updated_by = auth.uid()
  where id = p_staff_id
  returning * into updated_staff;

  update public.profiles set status = 'active' where id = p_profile_id;

  perform public.write_audit_log(
    'link_staff_system_profile',
    'staff_members',
    p_staff_id,
    to_jsonb(old_staff),
    to_jsonb(updated_staff)
  );

  return updated_staff;
end;
$$;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'received', 'cancelled')),
  notes text,
  decision_notes text,
  requested_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  received_by uuid references public.profiles(id) on delete restrict,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_id uuid not null references public.inventory_units(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.purchases
  add column if not exists purchase_request_id uuid references public.purchase_requests(id) on delete restrict,
  add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid'));

create unique index if not exists purchases_purchase_request_unique
  on public.purchases(purchase_request_id)
  where purchase_request_id is not null;

create index if not exists purchase_requests_status_idx on public.purchase_requests(status);
create index if not exists purchase_requests_created_at_idx on public.purchase_requests(created_at desc);
create index if not exists purchase_request_items_request_id_idx on public.purchase_request_items(purchase_request_id);
create index if not exists purchases_payment_status_idx on public.purchases(payment_status);

create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  amount numeric(18,4) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer')),
  reference_number text,
  notes text,
  paid_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists purchase_payments_purchase_id_unique on public.purchase_payments(purchase_id);
create index if not exists purchase_payments_created_at_idx on public.purchase_payments(created_at desc);

drop trigger if exists set_purchase_requests_updated_at on public.purchase_requests;
create trigger set_purchase_requests_updated_at before update on public.purchase_requests
  for each row execute function public.set_updated_at();

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.purchase_payments enable row level security;

drop policy if exists "profiles finance workflow read" on public.profiles;
create policy "profiles finance workflow read" on public.profiles
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant'));

drop policy if exists "purchase requests workflow read" on public.purchase_requests;
create policy "purchase requests workflow read" on public.purchase_requests
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant'));

drop policy if exists "purchase request items workflow read" on public.purchase_request_items;
create policy "purchase request items workflow read" on public.purchase_request_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant'));

drop policy if exists "purchase payments workflow read" on public.purchase_payments;
create policy "purchase payments workflow read" on public.purchase_payments
  for select to authenticated
  using (public.current_user_role() in ('admin', 'accountant'));

drop policy if exists "suppliers workflow read" on public.suppliers;
create policy "suppliers workflow read" on public.suppliers
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant'));

drop policy if exists "suppliers workflow insert" on public.suppliers;
create policy "suppliers workflow insert" on public.suppliers
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "purchases workflow read" on public.purchases;
create policy "purchases workflow read" on public.purchases
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant'));

drop policy if exists "purchase items workflow read" on public.purchase_items;
create policy "purchase items workflow read" on public.purchase_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant'));

drop policy if exists "expenses accountant read" on public.expenses;
create policy "expenses accountant read" on public.expenses
  for select to authenticated
  using (public.current_user_role() in ('admin', 'accountant'));

drop policy if exists "expenses accountant insert" on public.expenses;
create policy "expenses accountant insert" on public.expenses
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin', 'accountant')
    and expense_date = ((now() at time zone 'Asia/Baghdad')::date)
    and created_by = auth.uid()
  );

create or replace function public.create_purchase_request(
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  created_request public.purchase_requests%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  quantity_value numeric(18,3);
  item_count integer := 0;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only storekeeper or admin users can create purchase requests';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase request must contain at least one item';
  end if;

  insert into public.purchase_requests (notes, requested_by)
  values (nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  returning * into created_request;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    quantity_value := nullif(item_payload ->> 'quantity', '')::numeric;

    if quantity_value is null or quantity_value <= 0 then
      raise exception 'Purchase request item quantity must be greater than zero';
    end if;

    select * into target_item
    from public.inventory_items
    where id = (item_payload ->> 'inventory_item_id')::uuid;

    if not found or not target_item.is_active then
      raise exception 'Inventory item is not available';
    end if;

    perform public.convert_inventory_quantity(quantity_value, (item_payload ->> 'unit_id')::uuid, target_item.base_unit_id);

    insert into public.purchase_request_items (
      purchase_request_id,
      inventory_item_id,
      quantity,
      unit_id,
      notes
    ) values (
      created_request.id,
      target_item.id,
      quantity_value,
      (item_payload ->> 'unit_id')::uuid,
      nullif(btrim(coalesce(item_payload ->> 'notes', '')), '')
    );

    item_count := item_count + 1;
  end loop;

  perform public.write_audit_log(
    'إنشاء طلب شراء',
    'purchase_requests',
    created_request.id,
    null,
    jsonb_build_object('status', created_request.status, 'item_count', item_count)
  );

  return jsonb_build_object('purchase_request_id', created_request.id);
end;
$$;

create or replace function public.decide_purchase_request(
  p_purchase_request_id uuid,
  p_decision text,
  p_decision_notes text default null
)
returns public.purchase_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  old_request public.purchase_requests%rowtype;
  updated_request public.purchase_requests%rowtype;
  next_status text;
begin
  if requester_role not in ('admin', 'accountant') then
    raise exception 'Only accountant or admin users can approve purchase requests';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid purchase request decision';
  end if;

  select * into old_request
  from public.purchase_requests
  where id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'Purchase request was not found';
  end if;

  if old_request.status <> 'pending' then
    raise exception 'Only pending purchase requests can be decided';
  end if;

  next_status := p_decision;

  update public.purchase_requests
  set status = next_status,
      decision_notes = nullif(btrim(coalesce(p_decision_notes, '')), ''),
      decided_by = auth.uid(),
      decided_at = now()
  where id = p_purchase_request_id
  returning * into updated_request;

  perform public.write_audit_log(
    case when next_status = 'approved' then 'الموافقة على طلب شراء' else 'رفض طلب شراء' end,
    'purchase_requests',
    updated_request.id,
    to_jsonb(old_request),
    to_jsonb(updated_request)
  );

  return updated_request;
end;
$$;

drop function if exists public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb);

create or replace function public.create_inventory_purchase(
  p_client_request_id uuid,
  p_supplier_id uuid,
  p_supplier_invoice_number text default null,
  p_supplier_invoice_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_purchase_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_supplier public.suppliers%rowtype;
  target_request public.purchase_requests%rowtype;
  created_purchase public.purchases%rowtype;
  existing_purchase public.purchases%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  quantity_value numeric(18,3);
  unit_price_value numeric(18,4);
  line_total_value numeric(18,4);
  quantity_base_value numeric(18,3);
  unit_cost_base_value numeric(18,4);
  quantity_before_value numeric(18,3);
  quantity_after_value numeric(18,3);
  new_average_cost numeric(18,4);
  running_total numeric(18,4) := 0;
  item_count integer := 0;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only storekeeper or admin users can receive purchases';
  end if;

  if p_client_request_id is null then
    raise exception 'Purchase client request id is required';
  end if;

  select * into existing_purchase
  from public.purchases
  where client_request_id = p_client_request_id;

  if found then
    return jsonb_build_object('purchase_id', existing_purchase.id, 'duplicate', true);
  end if;

  if p_purchase_request_id is not null then
    select * into target_request
    from public.purchase_requests
    where id = p_purchase_request_id
    for update;

    if not found then
      raise exception 'Purchase request was not found';
    end if;

    if target_request.status <> 'approved' then
      raise exception 'Only approved purchase requests can be received';
    end if;

    if exists (select 1 from public.purchases where purchase_request_id = p_purchase_request_id) then
      raise exception 'Purchase request was already received';
    end if;
  end if;

  select * into target_supplier
  from public.suppliers
  where id = p_supplier_id
  for update;

  if not found or not target_supplier.is_active then
    raise exception 'Supplier is not available';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase must contain at least one item';
  end if;

  insert into public.purchases (
    client_request_id,
    purchase_request_id,
    supplier_id,
    supplier_invoice_number,
    supplier_invoice_date,
    payment_status,
    notes,
    created_by
  ) values (
    p_client_request_id,
    p_purchase_request_id,
    p_supplier_id,
    nullif(btrim(coalesce(p_supplier_invoice_number, '')), ''),
    p_supplier_invoice_date,
    'unpaid',
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) returning * into created_purchase;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    quantity_value := nullif(item_payload ->> 'quantity', '')::numeric;
    unit_price_value := nullif(item_payload ->> 'unit_price', '')::numeric;

    if quantity_value is null or quantity_value <= 0 then
      raise exception 'Purchase item quantity must be greater than zero';
    end if;

    if unit_price_value is null or unit_price_value < 0 then
      raise exception 'Purchase item unit price cannot be negative';
    end if;

    select * into target_item
    from public.inventory_items
    where id = (item_payload ->> 'inventory_item_id')::uuid
    for update;

    if not found or not target_item.is_active then
      raise exception 'Inventory item is not available';
    end if;

    quantity_base_value := public.convert_inventory_quantity(quantity_value, (item_payload ->> 'unit_id')::uuid, target_item.base_unit_id);
    if quantity_base_value <= 0 then
      raise exception 'Converted purchase quantity must be greater than zero';
    end if;

    line_total_value := round(quantity_value * unit_price_value, 4);
    unit_cost_base_value := round(line_total_value / quantity_base_value, 4);
    quantity_before_value := target_item.stock_on_hand;
    quantity_after_value := quantity_before_value + quantity_base_value;

    if quantity_after_value <= 0 then
      new_average_cost := unit_cost_base_value;
    else
      new_average_cost := round(((quantity_before_value * target_item.average_cost) + line_total_value) / quantity_after_value, 4);
    end if;

    insert into public.purchase_items (
      purchase_id,
      inventory_item_id,
      quantity,
      unit_id,
      unit_price,
      line_total,
      quantity_base,
      unit_cost_base
    ) values (
      created_purchase.id,
      target_item.id,
      quantity_value,
      (item_payload ->> 'unit_id')::uuid,
      unit_price_value,
      line_total_value,
      quantity_base_value,
      unit_cost_base_value
    );

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity_delta,
      quantity_before,
      quantity_after,
      unit_cost,
      total_cost,
      source_type,
      source_id,
      notes,
      created_by
    ) values (
      target_item.id,
      'purchase',
      quantity_base_value,
      quantity_before_value,
      quantity_after_value,
      unit_cost_base_value,
      line_total_value,
      'purchase',
      created_purchase.id,
      'استلام مشتريات #' || created_purchase.purchase_number,
      auth.uid()
    );

    perform set_config('app.inventory_stock_write', 'on', true);

    update public.inventory_items
    set stock_on_hand = quantity_after_value,
        average_cost = new_average_cost,
        last_purchase_cost = unit_cost_base_value
    where id = target_item.id;

    perform set_config('app.inventory_stock_write', '', true);

    running_total := running_total + line_total_value;
    item_count := item_count + 1;
  end loop;

  update public.purchases
  set total_amount = running_total
  where id = created_purchase.id
  returning * into created_purchase;

  if p_purchase_request_id is not null then
    update public.purchase_requests
    set status = 'received',
        received_by = auth.uid(),
        received_at = now()
    where id = p_purchase_request_id
    returning * into target_request;
  end if;

  perform public.write_audit_log(
    'استلام مشتريات',
    'purchases',
    created_purchase.id,
    null,
    jsonb_build_object(
      'purchase_request_id', created_purchase.purchase_request_id,
      'supplier_id', created_purchase.supplier_id,
      'total_amount', created_purchase.total_amount,
      'payment_status', created_purchase.payment_status,
      'item_count', item_count
    )
  );

  return jsonb_build_object('purchase_id', created_purchase.id, 'duplicate', false);
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

revoke all on function public.create_purchase_request(text, jsonb) from public;
revoke all on function public.decide_purchase_request(uuid, text, text) from public;
revoke all on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb, uuid) from public;
revoke all on function public.pay_purchase(uuid, text, text, text) from public;

grant execute on function public.create_purchase_request(text, jsonb) to authenticated;
grant execute on function public.decide_purchase_request(uuid, text, text) to authenticated;
grant execute on function public.create_inventory_purchase(uuid, uuid, text, date, text, jsonb, uuid) to authenticated;
grant execute on function public.pay_purchase(uuid, text, text, text) to authenticated;

grant select on public.purchase_requests to authenticated;
grant select on public.purchase_request_items to authenticated;
grant select on public.purchase_payments to authenticated;
grant select, insert, update on public.suppliers to authenticated;
grant select on public.purchases to authenticated;
grant select on public.purchase_items to authenticated;
