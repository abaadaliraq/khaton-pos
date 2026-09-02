drop policy if exists "payments cashier admin read" on public.payments;
create policy "payments cashier accountant admin read" on public.payments
  for select to authenticated
  using (public.current_user_role() in ('cashier', 'accountant', 'admin'));

drop policy if exists "orders role read" on public.orders;
create policy "orders role read" on public.orders
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'accountant', 'admin'));

drop policy if exists "table sessions role read" on public.table_sessions;
create policy "table sessions role read"
  on public.table_sessions
  for select to authenticated
  using (public.current_user_role() in ('captain', 'cashier', 'kitchen', 'accountant', 'admin'));
