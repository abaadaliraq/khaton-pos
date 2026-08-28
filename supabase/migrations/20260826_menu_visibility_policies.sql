drop policy if exists "categories authenticated read" on public.menu_categories;
drop policy if exists "categories role read" on public.menu_categories;
create policy "categories role read" on public.menu_categories
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
    or (
      public.current_user_role() in ('captain', 'cashier', 'kitchen', 'accountant')
      and is_active = true
    )
  );

drop policy if exists "menu items authenticated read" on public.menu_items;
drop policy if exists "menu items role read" on public.menu_items;
create policy "menu items role read" on public.menu_items
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper')
    or (
      public.current_user_role() in ('captain', 'cashier', 'kitchen', 'accountant')
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
