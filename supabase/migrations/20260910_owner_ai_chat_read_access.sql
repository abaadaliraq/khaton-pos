create or replace function public.equipment_role_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'storekeeper', 'accountant', 'owner');
$$;

drop policy if exists "categories role read" on public.menu_categories;
create policy "categories role read" on public.menu_categories
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'owner')
    or (
      public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'accountant')
      and is_active = true
    )
  );

drop policy if exists "menu items role read" on public.menu_items;
create policy "menu items role read" on public.menu_items
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'owner')
    or (
      public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'accountant')
      and is_available = true
      and coalesce(price, 0) > 0
      and exists (
        select 1
        from public.menu_categories category
        where category.id = menu_items.category_id
          and category.is_active = true
      )
    )
  );

drop policy if exists "orders role read" on public.orders;
create policy "orders role read" on public.orders
  for select to authenticated
  using (
    public.current_user_role() in ('captain', 'cashier', 'accountant', 'admin', 'owner')
    or (
      public.current_user_role() = 'kitchen'
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = orders.id
          and oi.preparation_station = 'kitchen'
          and oi.status <> 'cancelled'
      )
    )
    or (
      public.current_user_role() = 'barista'
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = orders.id
          and oi.preparation_station = 'barista'
          and oi.status <> 'cancelled'
      )
    )
  );

drop policy if exists "order items role read" on public.order_items;
create policy "order items role read" on public.order_items
  for select to authenticated
  using (
    public.current_user_role() in ('captain', 'cashier', 'accountant', 'admin', 'owner')
    or (public.current_user_role() = 'kitchen' and preparation_station = 'kitchen')
    or (public.current_user_role() = 'barista' and preparation_station = 'barista')
  );

drop policy if exists "table sessions role read" on public.table_sessions;
create policy "table sessions role read"
  on public.table_sessions
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'accountant', 'admin', 'owner'));

drop policy if exists "status events role read" on public.order_status_events;
create policy "status events role read" on public.order_status_events
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'accountant', 'admin', 'owner'));

drop policy if exists "payments cashier admin read" on public.payments;
create policy "payments cashier admin read" on public.payments
  for select to authenticated
  using (public.current_user_role() in ('cashier', 'accountant', 'admin', 'owner'));

revoke all on function public.equipment_role_can_read() from public;
grant execute on function public.equipment_role_can_read() to authenticated;
