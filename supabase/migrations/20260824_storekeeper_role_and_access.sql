alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper'));

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

  if requested_role not in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper') then
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

create or replace function public.require_inventory_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can manage inventory';
  end if;
end;
$$;

create or replace function public.get_recipe_cost_preview(p_recipe_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  payload jsonb;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can read recipe costs';
  end if;

  select jsonb_build_object(
    'recipe_id', r.id,
    'menu_item_id', r.menu_item_id,
    'estimated_cost', coalesce(sum(
      public.convert_inventory_quantity(ri.quantity * (1 + (ri.waste_percent / 100)), ri.unit_id, ii.base_unit_id)
      * ii.average_cost
    ), 0)
  )
  into payload
  from public.recipes r
  left join public.recipe_items ri on ri.recipe_id = r.id
  left join public.inventory_items ii on ii.id = ri.inventory_item_id
  where r.id = p_recipe_id
  group by r.id, r.menu_item_id;

  return coalesce(payload, jsonb_build_object('recipe_id', p_recipe_id, 'estimated_cost', 0));
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
  if p_role not in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper') then raise exception 'Invalid system role'; end if;

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

create or replace function public.set_menu_item_inventory_tracking(
  p_menu_item_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  target_item public.menu_items%rowtype;
begin
  if requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can update inventory tracking';
  end if;

  select * into target_item
  from public.menu_items
  where id = p_menu_item_id
  for update;

  if not found then
    raise exception 'Menu item was not found';
  end if;

  if p_enabled and not exists (
    select 1
    from public.recipes r
    join public.recipe_items ri on ri.recipe_id = r.id
    where r.menu_item_id = p_menu_item_id
      and r.is_active = true
  ) then
    raise exception 'يجب إعداد وصفة للصنف قبل تفعيل خصم المخزون.';
  end if;

  update public.menu_items
  set inventory_tracking_enabled = p_enabled
  where id = p_menu_item_id
  returning * into target_item;

  perform public.write_audit_log(
    'set_menu_item_inventory_tracking',
    'menu_items',
    p_menu_item_id,
    jsonb_build_object('inventory_tracking_enabled', not p_enabled),
    jsonb_build_object('inventory_tracking_enabled', p_enabled)
  );

  return jsonb_build_object(
    'menu_item_id', target_item.id,
    'inventory_tracking_enabled', target_item.inventory_tracking_enabled
  );
end;
$$;

drop policy if exists "inventory units admin read" on public.inventory_units;
create policy "inventory units admin read" on public.inventory_units
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "inventory items admin read" on public.inventory_items;
create policy "inventory items admin read" on public.inventory_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "inventory items admin insert" on public.inventory_items;
create policy "inventory items admin insert" on public.inventory_items
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "inventory items admin update" on public.inventory_items;
create policy "inventory items admin update" on public.inventory_items
  for update to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'))
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "inventory movements admin read" on public.inventory_movements;
create policy "inventory movements admin read" on public.inventory_movements
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipes admin read" on public.recipes;
create policy "recipes admin read" on public.recipes
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipes admin insert" on public.recipes;
create policy "recipes admin insert" on public.recipes
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipes admin update" on public.recipes;
create policy "recipes admin update" on public.recipes
  for update to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'))
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipe items admin read" on public.recipe_items;
create policy "recipe items admin read" on public.recipe_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipe items admin insert" on public.recipe_items;
create policy "recipe items admin insert" on public.recipe_items
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipe items admin update" on public.recipe_items;
create policy "recipe items admin update" on public.recipe_items
  for update to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'))
  with check (public.current_user_role() in ('admin', 'storekeeper'));

drop policy if exists "recipe items admin delete" on public.recipe_items;
create policy "recipe items admin delete" on public.recipe_items
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper'));

revoke all on function public.set_menu_item_inventory_tracking(uuid, boolean) from public;
grant execute on function public.set_menu_item_inventory_tracking(uuid, boolean) to authenticated;
