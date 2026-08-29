-- Owner read-only access to staff records for the owner staff dashboard.

drop policy if exists "staff owner read" on public.staff_members;
create policy "staff owner read" on public.staff_members
  for select to authenticated
  using (public.current_user_role() = 'owner');

grant select on public.staff_members to authenticated;
