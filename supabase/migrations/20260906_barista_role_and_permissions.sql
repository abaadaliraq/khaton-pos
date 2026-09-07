alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('captain', 'cashier', 'kitchen', 'barista', 'admin', 'storekeeper', 'accountant', 'owner'));

create or replace function public.station_allowed_for_current_user(p_station text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
begin
  if p_station not in ('kitchen', 'barista', 'drinks', 'shisha') then
    return false;
  end if;

  if requester_role = 'admin' then
    return p_station in ('kitchen', 'barista');
  end if;

  if requester_role = 'kitchen' and p_station = 'kitchen' then
    return true;
  end if;

  if requester_role = 'barista' and p_station = 'barista' then
    return true;
  end if;

  return false;
end;
$$;

drop policy if exists "orders role read" on public.orders;
create policy "orders role read" on public.orders
  for select to authenticated
  using (
    public.current_user_role() in ('captain', 'cashier', 'accountant', 'admin')
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
    public.current_user_role() in ('captain', 'cashier', 'accountant', 'admin')
    or (public.current_user_role() = 'kitchen' and preparation_station = 'kitchen')
    or (public.current_user_role() = 'barista' and preparation_station = 'barista')
  );

drop policy if exists "table sessions role read" on public.table_sessions;
create policy "table sessions role read"
  on public.table_sessions
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'accountant', 'admin'));

drop policy if exists "status events role read" on public.order_status_events;
create policy "status events role read" on public.order_status_events
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'admin'));

drop policy if exists "order item status events role read" on public.order_item_status_events;
create policy "order item status events role read" on public.order_item_status_events
  for select to authenticated
  using (
    public.current_user_role() in ('captain', 'cashier', 'admin')
    or (public.current_user_role() = 'kitchen' and preparation_station = 'kitchen')
    or (public.current_user_role() = 'barista' and preparation_station = 'barista')
  );

grant select on public.order_item_status_events to authenticated;

drop policy if exists "menu categories operational read" on public.menu_categories;
drop policy if exists "categories role read" on public.menu_categories;
create policy "categories role read" on public.menu_categories
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
    or (
      public.current_user_role() in ('captain', 'cashier', 'kitchen', 'barista', 'accountant')
      and is_active = true
    )
  );

drop policy if exists "menu items operational read" on public.menu_items;
drop policy if exists "menu items role read" on public.menu_items;
create policy "menu items role read" on public.menu_items
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
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

revoke all on function public.station_allowed_for_current_user(text) from public;
grant execute on function public.station_allowed_for_current_user(text) to authenticated;
