create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  role text not null check (role in ('captain', 'cashier', 'kitchen', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null unique check (table_number > 0),
  name text,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'available' check (status in ('available', 'occupied', 'cleaning')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists menu_categories_name_ar_unique on public.menu_categories (name_ar);
create unique index if not exists menu_categories_name_en_unique on public.menu_categories (name_en) where name_en is not null;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name_ar text not null,
  name_en text,
  description_ar text,
  price numeric(12,0) check (price is null or price >= 0),
  preparation_station text not null default 'kitchen' check (preparation_station in ('kitchen', 'barista', 'drinks', 'shisha')),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists menu_items_category_name_ar_unique on public.menu_items (category_id, name_ar);
create index if not exists menu_items_category_id_idx on public.menu_items (category_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  captain_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'preparing', 'ready', 'served', 'awaiting_payment', 'paid', 'cancelled')),
  guest_count integer check (guest_count is null or guest_count > 0),
  general_notes text,
  subtotal numeric(12,0) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12,0) not null default 0 check (discount_amount >= 0),
  service_charge numeric(12,0) not null default 0 check (service_charge >= 0),
  total numeric(12,0) not null default 0 check (total >= 0),
  opened_at timestamptz not null default now(),
  submitted_at timestamptz,
  served_at timestamptz,
  paid_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_open_order_per_table_idx
  on public.orders (table_id)
  where status not in ('paid', 'cancelled');
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_table_id_idx on public.orders (table_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  item_name_snapshot text not null,
  unit_price numeric(12,0) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  notes text,
  preparation_station text not null check (preparation_station in ('kitchen', 'barista', 'drinks', 'shisha')),
  status text not null default 'submitted' check (status in ('submitted', 'preparing', 'ready', 'served', 'cancelled')),
  sent_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_status_idx on public.order_items (status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  method text not null check (method in ('cash', 'card', 'transfer')),
  amount numeric(12,0) not null check (amount > 0),
  reference text,
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_at timestamptz not null default now()
);

create index if not exists payments_order_id_idx on public.payments (order_id);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_id_idx on public.order_status_events (order_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);

do $$
declare
  table_names text[] := array[
    'restaurant_tables',
    'menu_categories',
    'menu_items',
    'orders',
    'order_items',
    'payments',
    'order_status_events'
  ];
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array table_names loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_closed_order_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('paid', 'cancelled') then
    if old.status = 'paid'
      and new.status = old.status
      and new.closed_at is not distinct from coalesce(old.closed_at, new.closed_at)
      and new.id = old.id
      and new.order_number = old.order_number
      and new.table_id = old.table_id
      and new.captain_id = old.captain_id
      and new.guest_count is not distinct from old.guest_count
      and new.general_notes is not distinct from old.general_notes
      and new.subtotal = old.subtotal
      and new.discount_amount = old.discount_amount
      and new.service_charge = old.service_charge
      and new.total = old.total
      and new.opened_at = old.opened_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.served_at is not distinct from old.served_at
      and new.paid_at is not distinct from old.paid_at
      and new.created_at = old.created_at
    then
      return new;
    end if;

    raise exception 'Paid or cancelled orders cannot be modified';
  end if;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_restaurant_tables_updated_at on public.restaurant_tables;
create trigger set_restaurant_tables_updated_at before update on public.restaurant_tables
  for each row execute function public.set_updated_at();

drop trigger if exists set_menu_categories_updated_at on public.menu_categories;
create trigger set_menu_categories_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();

drop trigger if exists set_menu_items_updated_at on public.menu_items;
create trigger set_menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists prevent_closed_order_mutation on public.orders;
create trigger prevent_closed_order_mutation before update on public.orders
  for each row execute function public.prevent_closed_order_mutation();

drop trigger if exists set_order_items_updated_at on public.order_items;
create trigger set_order_items_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.status = 'active'
  limit 1;
$$;

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

  if requested_role not in ('captain', 'cashier', 'kitchen', 'admin') then
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_events enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles admin manage" on public.profiles
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "tables authenticated read" on public.restaurant_tables;
create policy "tables authenticated read" on public.restaurant_tables
  for select to authenticated
  using (public.current_user_role() is not null);

drop policy if exists "tables admin manage" on public.restaurant_tables;
create policy "tables admin manage" on public.restaurant_tables
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "categories authenticated read" on public.menu_categories;
create policy "categories authenticated read" on public.menu_categories
  for select to authenticated
  using (public.current_user_role() is not null);

drop policy if exists "categories admin manage" on public.menu_categories;
create policy "categories admin manage" on public.menu_categories
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "menu items authenticated read" on public.menu_items;
create policy "menu items authenticated read" on public.menu_items
  for select to authenticated
  using (public.current_user_role() is not null);

drop policy if exists "menu items admin manage" on public.menu_items;
create policy "menu items admin manage" on public.menu_items
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "orders role read" on public.orders;
create policy "orders role read" on public.orders
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'admin'));

drop policy if exists "orders captain create" on public.orders;
drop policy if exists "orders operational update" on public.orders;
drop policy if exists "orders admin manage" on public.orders;
create policy "orders admin manage" on public.orders
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "order items role read" on public.order_items;
create policy "order items role read" on public.order_items
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'admin'));

drop policy if exists "order items captain create" on public.order_items;
drop policy if exists "order items operational update" on public.order_items;
drop policy if exists "order items admin manage" on public.order_items;
create policy "order items admin manage" on public.order_items
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "payments cashier admin read" on public.payments;
create policy "payments cashier admin read" on public.payments
  for select to authenticated
  using (public.current_user_role() in ('cashier', 'admin'));

drop policy if exists "payments cashier admin create" on public.payments;
drop policy if exists "payments admin manage" on public.payments;
create policy "payments admin manage" on public.payments
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "status events role read" on public.order_status_events;
create policy "status events role read" on public.order_status_events
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'admin'));

drop policy if exists "status events role create" on public.order_status_events;
drop policy if exists "status events admin manage" on public.order_status_events;
create policy "status events admin manage" on public.order_status_events
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "audit logs admin read" on public.audit_logs;
create policy "audit logs admin read" on public.audit_logs
  for select to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "audit logs admin create" on public.audit_logs;
create policy "audit logs admin create" on public.audit_logs
  for insert to authenticated
  with check (public.current_user_role() = 'admin');

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_data jsonb default null,
  p_new_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_data, p_new_data);
end;
$$;

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
  created_order public.orders%rowtype;
  item_payload jsonb;
  menu_item public.menu_items%rowtype;
  item_quantity integer;
  item_notes text;
  running_subtotal numeric(12,0) := 0;
begin
  if requester_role not in ('captain', 'admin') then
    raise exception 'Only captain or admin can create orders';
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

  if target_table.status <> 'available' then
    raise exception 'Table already has an open order';
  end if;

  insert into public.orders (table_id, captain_id, status, guest_count, general_notes, submitted_at)
  values (p_table_id, auth.uid(), 'submitted', p_guest_count, nullif(btrim(p_general_notes), ''), now())
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
      total = greatest(running_subtotal - discount_amount + service_charge, 0)
  where id = created_order.id
  returning * into created_order;

  update public.restaurant_tables
  set status = 'occupied'
  where id = p_table_id;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (created_order.id, null, 'submitted', auth.uid(), 'Order submitted');

  perform public.write_audit_log('create_order', 'orders', created_order.id, null, to_jsonb(created_order));

  return jsonb_build_object('order_id', created_order.id, 'order_number', created_order.order_number, 'total', created_order.total);
end;
$$;

create or replace function public.get_kitchen_order_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  payload jsonb;
begin
  if requester_role not in ('kitchen', 'admin') then
    raise exception 'Only kitchen or admin can read kitchen orders';
  end if;

  select coalesce(jsonb_agg(order_payload order by order_received_at), '[]'::jsonb)
  into payload
  from (
    select
      coalesce(o.submitted_at, o.created_at) as order_received_at,
      jsonb_build_object(
        'id', o.id,
        'table_id', t.table_number,
        'captain_name', p.full_name,
        'status', o.status,
        'received_at', coalesce(o.submitted_at, o.created_at),
        'items', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'name', oi.item_name_snapshot,
                'quantity', oi.quantity,
                'note', oi.notes
              )
              order by oi.created_at
            )
            from public.order_items oi
            where oi.order_id = o.id
              and oi.status <> 'cancelled'
          ),
          '[]'::jsonb
        )
      ) as order_payload
    from public.orders o
    join public.restaurant_tables t on t.id = o.table_id
    join public.profiles p on p.id = o.captain_id
    where o.status in ('submitted', 'preparing', 'ready', 'served', 'awaiting_payment')
  ) kitchen_orders;

  return payload;
end;
$$;

create or replace function public.update_kitchen_order_status(
  p_order_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  current_order public.orders%rowtype;
  previous_status text;
begin
  if requester_role not in ('kitchen', 'admin') then
    raise exception 'Only kitchen or admin can update kitchen orders';
  end if;

  if p_next_status not in ('submitted', 'preparing', 'ready', 'served') then
    raise exception 'Invalid kitchen status';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status in ('paid', 'cancelled') then
    raise exception 'Order cannot be updated';
  end if;

  previous_status := current_order.status;

  update public.order_items
  set status = p_next_status,
      started_at = case when p_next_status = 'preparing' and started_at is null then now() else started_at end,
      ready_at = case when p_next_status = 'ready' and ready_at is null then now() else ready_at end,
      served_at = case when p_next_status = 'served' and served_at is null then now() else served_at end
  where order_id = p_order_id
    and status <> 'cancelled';

  update public.orders
  set status = case when p_next_status = 'served' then 'awaiting_payment' else p_next_status end,
      served_at = case when p_next_status = 'served' and served_at is null then now() else served_at end
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, previous_status, current_order.status, auth.uid(), 'Kitchen status update');

  perform public.write_audit_log('update_kitchen_status', 'orders', p_order_id, jsonb_build_object('status', previous_status), jsonb_build_object('status', current_order.status));

  return jsonb_build_object('order_id', current_order.id, 'status', current_order.status);
end;
$$;

create or replace function public.apply_order_discount(
  p_order_id uuid,
  p_discount_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  current_order public.orders%rowtype;
  old_order jsonb;
begin
  if requester_role not in ('cashier', 'admin') then
    raise exception 'Only cashier or admin can apply discounts';
  end if;

  if p_discount_amount < 0 then
    raise exception 'Discount must be positive';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Discount reason is required';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status in ('paid', 'cancelled') then
    raise exception 'Order cannot be discounted';
  end if;

  if p_discount_amount > current_order.subtotal then
    raise exception 'Discount cannot exceed subtotal';
  end if;

  old_order := to_jsonb(current_order);

  update public.orders
  set discount_amount = p_discount_amount,
      total = greatest(subtotal - p_discount_amount + service_charge, 0)
  where id = p_order_id
  returning * into current_order;

  perform public.write_audit_log('apply_discount', 'orders', p_order_id, old_order, jsonb_build_object('order', current_order, 'reason', p_reason));

  return jsonb_build_object('order_id', current_order.id, 'discount_amount', current_order.discount_amount, 'total', current_order.total);
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
  paid_amount numeric(12,0);
  payment_total numeric(12,0) := 0;
begin
  if requester_role not in ('cashier', 'admin') then
    raise exception 'Only cashier or admin can record payments';
  end if;

  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Payment list is required';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status in ('paid', 'cancelled') then
    raise exception 'Order cannot be paid';
  end if;

  if current_order.status <> 'awaiting_payment' then
    raise exception 'Order must be awaiting payment before payment can be recorded';
  end if;

  select coalesce(sum(amount), 0) into paid_amount
  from public.payments
  where order_id = p_order_id
    and status = 'completed';

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

  if payment_total <> (current_order.total - paid_amount) then
    raise exception 'Payment total must equal remaining amount';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = now()
  where id = p_order_id
  returning * into current_order;

  insert into public.order_status_events (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, 'awaiting_payment', 'paid', auth.uid(), 'Payment completed');

  perform public.write_audit_log('record_payment', 'orders', p_order_id, null, jsonb_build_object('payments_total', payment_total));

  return jsonb_build_object('order_id', current_order.id, 'status', current_order.status, 'paid_amount', payment_total);
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
begin
  if requester_role not in ('cashier', 'admin') then
    raise exception 'Only cashier or admin can close paid tables';
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.status <> 'paid' then
    raise exception 'Only paid orders can be closed';
  end if;

  update public.orders
  set closed_at = coalesce(closed_at, now())
  where id = p_order_id
  returning * into current_order;

  update public.restaurant_tables
  set status = 'available'
  where id = current_order.table_id;

  perform public.write_audit_log('close_paid_table', 'orders', p_order_id, null, to_jsonb(current_order));

  return jsonb_build_object('order_id', current_order.id, 'table_id', current_order.table_id, 'closed_at', current_order.closed_at);
end;
$$;
