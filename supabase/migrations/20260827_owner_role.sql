alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper', 'accountant', 'owner'));

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

  if requested_role not in ('captain', 'cashier', 'kitchen', 'admin', 'storekeeper', 'accountant', 'owner') then
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
