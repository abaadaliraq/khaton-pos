-- Security correction for staff management after 20260720_khatoun_pos_staff_management.sql
-- Apply manually in Supabase SQL editor or via Supabase CLI when ready.

begin;

-- 1. Repair corrupted Arabic job titles only for staff rows linked to profiles
-- and only when the current value matches the previously corrupted seed labels.
update public.staff_members sm
set job_title = case p.role
    when 'captain' then 'كابتن'
    when 'cashier' then 'محاسب'
    when 'kitchen' then 'شيف'
    when 'admin' then 'مدير النظام'
    else sm.job_title
  end,
  updated_at = now()
from public.profiles p
where sm.profile_id = p.id
  and p.role in ('captain', 'cashier', 'kitchen', 'admin')
  and sm.job_title in ('?????', '???', '???? ??????', '????');

-- 2. Tighten RLS: active admin read only, self read remains, no direct client writes.
drop policy if exists "staff admin read" on public.staff_members;
create policy "staff admin read" on public.staff_members
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );

drop policy if exists "staff own read" on public.staff_members;
create policy "staff own read" on public.staff_members
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "staff admin insert" on public.staff_members;
drop policy if exists "staff admin update" on public.staff_members;

-- Ensure helper functions keep an explicit search_path.
create or replace function public.assert_active_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile public.profiles%rowtype;
begin
  select * into admin_profile from public.profiles where id = auth.uid();

  if not found or admin_profile.role <> 'admin' or admin_profile.status <> 'active' then
    raise exception 'Only active admin users can manage staff';
  end if;
end;
$$;

create or replace function public.update_staff_status(p_staff_id uuid, p_status text)
returns public.staff_members
language plpgsql
security definer
set search_path = public
as $$
declare
  old_staff public.staff_members%rowtype;
  updated_staff public.staff_members%rowtype;
begin
  perform public.assert_active_admin();
  if not public.is_valid_staff_status(p_status) then raise exception 'Invalid staff status'; end if;

  select * into old_staff from public.staff_members where id = p_staff_id for update;
  if not found then raise exception 'Staff member not found'; end if;

  update public.staff_members
  set status = p_status,
      has_system_access = case when p_status in ('inactive', 'terminated') then false else has_system_access end,
      updated_by = auth.uid()
  where id = p_staff_id
  returning * into updated_staff;

  if updated_staff.profile_id is not null then
    if p_status in ('inactive', 'terminated') then
      update public.profiles set status = 'inactive' where id = updated_staff.profile_id;
    elsif p_status = 'active' and updated_staff.has_system_access then
      update public.profiles set status = 'active' where id = updated_staff.profile_id;
    end if;
  end if;

  perform public.write_audit_log('update_staff_status', 'staff_members', p_staff_id, to_jsonb(old_staff), to_jsonb(updated_staff));
  return updated_staff;
end;
$$;

create or replace function public.update_staff_system_access(p_staff_id uuid, p_is_active boolean)
returns public.staff_members
language plpgsql
security definer
set search_path = public
as $$
declare
  old_staff public.staff_members%rowtype;
  updated_staff public.staff_members%rowtype;
begin
  perform public.assert_active_admin();
  select * into old_staff from public.staff_members where id = p_staff_id for update;
  if not found then raise exception 'Staff member not found'; end if;
  if old_staff.profile_id is null then raise exception 'Staff profile is not linked'; end if;

  if p_is_active and old_staff.status <> 'active' then
    raise exception 'System access can only be enabled for active staff';
  end if;

  update public.profiles
  set status = case when p_is_active then 'active' else 'inactive' end
  where id = old_staff.profile_id;

  update public.staff_members
  set has_system_access = p_is_active,
      updated_by = auth.uid()
  where id = p_staff_id
  returning * into updated_staff;

  perform public.write_audit_log('update_staff_system_access', 'staff_members', p_staff_id, to_jsonb(old_staff), to_jsonb(updated_staff));
  return updated_staff;
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
  if p_role not in ('captain', 'cashier', 'kitchen', 'admin') then raise exception 'Invalid system role'; end if;

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

revoke all on function public.create_staff_member(text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) from public;
revoke all on function public.update_staff_member(uuid, text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) from public;
revoke all on function public.update_staff_status(uuid, text) from public;
revoke all on function public.update_staff_system_access(uuid, boolean) from public;
revoke all on function public.link_staff_system_profile(uuid, uuid, text, text) from public;

grant execute on function public.create_staff_member(text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) to authenticated;
grant execute on function public.update_staff_member(uuid, text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) to authenticated;
grant execute on function public.update_staff_status(uuid, text) to authenticated;
grant execute on function public.update_staff_system_access(uuid, boolean) to authenticated;
grant execute on function public.link_staff_system_profile(uuid, uuid, text, text) to authenticated;

commit;
