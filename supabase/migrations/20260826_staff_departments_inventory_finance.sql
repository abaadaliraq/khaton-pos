alter table public.staff_members
  drop constraint if exists staff_members_department_check;

alter table public.staff_members
  add constraint staff_members_department_check
  check (department in ('service', 'cashier', 'kitchen', 'management', 'cleaning', 'barista', 'shisha', 'inventory', 'finance', 'other'));

create or replace function public.is_valid_staff_department(value text)
returns boolean
language sql
immutable
as $$ select value in ('service', 'cashier', 'kitchen', 'management', 'cleaning', 'barista', 'shisha', 'inventory', 'finance', 'other') $$;
