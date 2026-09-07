create sequence if not exists public.equipment_asset_code_seq
  as integer
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create table if not exists public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique default ('EQ-' || lpad(nextval('public.equipment_asset_code_seq')::text, 4, '0')),
  name_ar text not null,
  name_en text,
  category text not null check (category in ('refrigeration', 'cooking', 'coffee', 'beverage', 'ventilation', 'electrical', 'cleaning_equipment', 'pos_it', 'other')),
  brand text,
  model text,
  serial_number text,
  location text not null check (location in ('kitchen', 'bar', 'barista', 'warehouse', 'dining_hall', 'management', 'outdoor', 'other')),
  status text not null default 'operational' check (status in ('operational', 'needs_maintenance', 'under_maintenance', 'out_of_service', 'retired')),
  purchase_date date,
  purchase_cost numeric(12,0) check (purchase_cost is null or purchase_cost >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  warranty_start_date date,
  warranty_expiry_date date,
  installation_date date,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_assets_category_idx on public.equipment_assets (category);
create index if not exists equipment_assets_location_idx on public.equipment_assets (location);
create index if not exists equipment_assets_status_idx on public.equipment_assets (status);
create index if not exists equipment_assets_next_lookup_idx on public.equipment_assets (is_active, status);
create unique index if not exists equipment_assets_serial_number_unique_idx
  on public.equipment_assets (serial_number)
  where serial_number is not null and btrim(serial_number) <> '';

create table if not exists public.equipment_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment_assets(id) on delete restrict,
  maintenance_type text not null check (maintenance_type in ('preventive', 'corrective', 'breakdown', 'inspection', 'cleaning_service', 'installation', 'other')),
  status text not null default 'reported' check (status in ('reported', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  reported_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  problem_description text,
  work_performed text,
  technician_name text,
  service_provider text,
  cost numeric(12,0) not null default 0 check (cost >= 0),
  invoice_reference text,
  next_maintenance_date date,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_maintenance_completion_data_check check (
    status <> 'completed'
    or completed_at is not null
  )
);

create index if not exists equipment_maintenance_equipment_idx on public.equipment_maintenance_records (equipment_id, reported_at desc);
create index if not exists equipment_maintenance_status_idx on public.equipment_maintenance_records (status);
create index if not exists equipment_maintenance_next_date_idx on public.equipment_maintenance_records (next_maintenance_date);

drop trigger if exists set_equipment_assets_updated_at on public.equipment_assets;
create trigger set_equipment_assets_updated_at before update on public.equipment_assets
  for each row execute function public.set_updated_at();

drop trigger if exists set_equipment_maintenance_records_updated_at on public.equipment_maintenance_records;
create trigger set_equipment_maintenance_records_updated_at before update on public.equipment_maintenance_records
  for each row execute function public.set_updated_at();

create or replace function public.equipment_role_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'storekeeper');
$$;

create or replace function public.equipment_role_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'storekeeper', 'accountant');
$$;

create or replace function public.create_equipment_asset(
  p_name_ar text,
  p_category text,
  p_location text,
  p_brand text default null,
  p_model text default null,
  p_serial_number text default null,
  p_purchase_date date default null,
  p_purchase_cost numeric default null,
  p_supplier_id uuid default null,
  p_warranty_expiry_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_asset public.equipment_assets%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  if nullif(btrim(coalesce(p_name_ar, '')), '') is null then
    raise exception 'Equipment name is required';
  end if;

  insert into public.equipment_assets (
    name_ar,
    category,
    location,
    brand,
    model,
    serial_number,
    purchase_date,
    purchase_cost,
    supplier_id,
    warranty_expiry_date,
    notes,
    created_by
  )
  values (
    btrim(p_name_ar),
    p_category,
    p_location,
    nullif(btrim(coalesce(p_brand, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
    nullif(btrim(coalesce(p_serial_number, '')), ''),
    p_purchase_date,
    p_purchase_cost,
    p_supplier_id,
    p_warranty_expiry_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning * into created_asset;

  perform public.write_audit_log('equipment_created', 'equipment_assets', created_asset.id, null, to_jsonb(created_asset));

  return created_asset.id;
end;
$$;

create or replace function public.update_equipment_asset(
  p_equipment_id uuid,
  p_name_ar text,
  p_category text,
  p_location text,
  p_status text,
  p_brand text default null,
  p_model text default null,
  p_serial_number text default null,
  p_purchase_date date default null,
  p_purchase_cost numeric default null,
  p_supplier_id uuid default null,
  p_warranty_expiry_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  old_asset public.equipment_assets%rowtype;
  updated_asset public.equipment_assets%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  select * into old_asset from public.equipment_assets where id = p_equipment_id for update;
  if old_asset.id is null then
    raise exception 'Equipment asset was not found';
  end if;

  update public.equipment_assets
  set name_ar = btrim(p_name_ar),
      category = p_category,
      location = p_location,
      status = p_status,
      brand = nullif(btrim(coalesce(p_brand, '')), ''),
      model = nullif(btrim(coalesce(p_model, '')), ''),
      serial_number = nullif(btrim(coalesce(p_serial_number, '')), ''),
      purchase_date = p_purchase_date,
      purchase_cost = p_purchase_cost,
      supplier_id = p_supplier_id,
      warranty_expiry_date = p_warranty_expiry_date,
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      is_active = (p_status <> 'retired')
  where id = p_equipment_id
  returning * into updated_asset;

  perform public.write_audit_log('equipment_updated', 'equipment_assets', updated_asset.id, to_jsonb(old_asset), to_jsonb(updated_asset));

  if updated_asset.status is distinct from old_asset.status then
    perform public.write_audit_log(
      'equipment_status_changed',
      'equipment_assets',
      updated_asset.id,
      jsonb_build_object('status', old_asset.status),
      jsonb_build_object('status', updated_asset.status)
    );
  end if;

  return updated_asset.id;
end;
$$;

create or replace function public.report_equipment_breakdown(
  p_equipment_id uuid,
  p_problem_description text,
  p_reported_at timestamptz default now(),
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  old_asset public.equipment_assets%rowtype;
  updated_asset public.equipment_assets%rowtype;
  created_record public.equipment_maintenance_records%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  if nullif(btrim(coalesce(p_problem_description, '')), '') is null then
    raise exception 'Problem description is required';
  end if;

  select * into old_asset from public.equipment_assets where id = p_equipment_id for update;
  if old_asset.id is null then
    raise exception 'Equipment asset was not found';
  end if;

  insert into public.equipment_maintenance_records (
    equipment_id,
    maintenance_type,
    status,
    reported_at,
    problem_description,
    notes,
    created_by
  )
  values (
    p_equipment_id,
    'breakdown',
    'reported',
    coalesce(p_reported_at, now()),
    btrim(p_problem_description),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning * into created_record;

  if old_asset.status <> 'under_maintenance' then
    update public.equipment_assets
    set status = 'needs_maintenance'
    where id = p_equipment_id
    returning * into updated_asset;
  else
    updated_asset := old_asset;
  end if;

  perform public.write_audit_log('maintenance_reported', 'equipment_maintenance_records', created_record.id, null, to_jsonb(created_record));
  if updated_asset.status is distinct from old_asset.status then
    perform public.write_audit_log('equipment_status_changed', 'equipment_assets', updated_asset.id, jsonb_build_object('status', old_asset.status), jsonb_build_object('status', updated_asset.status));
  end if;

  return created_record.id;
end;
$$;

create or replace function public.create_equipment_maintenance_record(
  p_equipment_id uuid,
  p_maintenance_type text,
  p_status text default 'reported',
  p_reported_at timestamptz default now(),
  p_problem_description text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.equipment_maintenance_records%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  if p_status not in ('reported', 'scheduled') then
    raise exception 'New maintenance record must be reported or scheduled';
  end if;

  insert into public.equipment_maintenance_records (
    equipment_id,
    maintenance_type,
    status,
    reported_at,
    problem_description,
    notes,
    created_by
  )
  values (
    p_equipment_id,
    p_maintenance_type,
    p_status,
    coalesce(p_reported_at, now()),
    nullif(btrim(coalesce(p_problem_description, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning * into created_record;

  perform public.write_audit_log('maintenance_reported', 'equipment_maintenance_records', created_record.id, null, to_jsonb(created_record));

  return created_record.id;
end;
$$;

create or replace function public.start_equipment_maintenance(p_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_record public.equipment_maintenance_records%rowtype;
  old_asset public.equipment_assets%rowtype;
  updated_asset public.equipment_assets%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  select * into target_record from public.equipment_maintenance_records where id = p_record_id for update;
  if target_record.id is null then
    raise exception 'Maintenance record was not found';
  end if;
  if target_record.status not in ('reported', 'scheduled') then
    raise exception 'Only reported or scheduled maintenance can be started';
  end if;

  select * into old_asset from public.equipment_assets where id = target_record.equipment_id for update;

  update public.equipment_maintenance_records
  set status = 'in_progress',
      started_at = now()
  where id = p_record_id
  returning * into target_record;

  update public.equipment_assets
  set status = 'under_maintenance'
  where id = target_record.equipment_id
  returning * into updated_asset;

  perform public.write_audit_log('maintenance_started', 'equipment_maintenance_records', target_record.id, null, to_jsonb(target_record));
  if updated_asset.status is distinct from old_asset.status then
    perform public.write_audit_log('equipment_status_changed', 'equipment_assets', updated_asset.id, jsonb_build_object('status', old_asset.status), jsonb_build_object('status', updated_asset.status));
  end if;

  return target_record.id;
end;
$$;

create or replace function public.complete_equipment_maintenance(
  p_record_id uuid,
  p_work_performed text,
  p_cost numeric default 0,
  p_completed_at timestamptz default now(),
  p_technician_name text default null,
  p_service_provider text default null,
  p_invoice_reference text default null,
  p_next_maintenance_date date default null,
  p_equipment_status text default 'operational',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_record public.equipment_maintenance_records%rowtype;
  old_asset public.equipment_assets%rowtype;
  updated_asset public.equipment_assets%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  if p_equipment_status not in ('operational', 'needs_maintenance', 'under_maintenance', 'out_of_service', 'retired') then
    raise exception 'Invalid equipment status';
  end if;

  select * into target_record from public.equipment_maintenance_records where id = p_record_id for update;
  if target_record.id is null then
    raise exception 'Maintenance record was not found';
  end if;
  if target_record.status = 'completed' then
    raise exception 'Maintenance record is already completed';
  end if;
  if target_record.status = 'cancelled' then
    raise exception 'Cancelled maintenance cannot be completed';
  end if;

  select * into old_asset from public.equipment_assets where id = target_record.equipment_id for update;

  update public.equipment_maintenance_records
  set status = 'completed',
      completed_at = coalesce(p_completed_at, now()),
      work_performed = nullif(btrim(coalesce(p_work_performed, '')), ''),
      cost = coalesce(p_cost, 0),
      technician_name = nullif(btrim(coalesce(p_technician_name, '')), ''),
      service_provider = nullif(btrim(coalesce(p_service_provider, '')), ''),
      invoice_reference = nullif(btrim(coalesce(p_invoice_reference, '')), ''),
      next_maintenance_date = p_next_maintenance_date,
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes)
  where id = p_record_id
  returning * into target_record;

  update public.equipment_assets
  set status = p_equipment_status,
      is_active = (p_equipment_status <> 'retired')
  where id = target_record.equipment_id
  returning * into updated_asset;

  perform public.write_audit_log('maintenance_completed', 'equipment_maintenance_records', target_record.id, null, to_jsonb(target_record));
  if updated_asset.status is distinct from old_asset.status then
    perform public.write_audit_log('equipment_status_changed', 'equipment_assets', updated_asset.id, jsonb_build_object('status', old_asset.status), jsonb_build_object('status', updated_asset.status));
  end if;

  return target_record.id;
end;
$$;

create or replace function public.retire_equipment_asset(p_equipment_id uuid, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  old_asset public.equipment_assets%rowtype;
  updated_asset public.equipment_assets%rowtype;
begin
  if not public.equipment_role_can_manage() then
    raise exception 'Only admin or storekeeper can manage equipment';
  end if;

  select * into old_asset from public.equipment_assets where id = p_equipment_id for update;
  if old_asset.id is null then
    raise exception 'Equipment asset was not found';
  end if;

  update public.equipment_assets
  set status = 'retired',
      is_active = false,
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes)
  where id = p_equipment_id
  returning * into updated_asset;

  perform public.write_audit_log('equipment_status_changed', 'equipment_assets', updated_asset.id, jsonb_build_object('status', old_asset.status), jsonb_build_object('status', updated_asset.status));

  return updated_asset.id;
end;
$$;

alter table public.equipment_assets enable row level security;
alter table public.equipment_maintenance_records enable row level security;

drop policy if exists "equipment assets read" on public.equipment_assets;
create policy "equipment assets read" on public.equipment_assets
  for select
  to authenticated
  using (public.equipment_role_can_read());

drop policy if exists "equipment assets insert" on public.equipment_assets;
create policy "equipment assets insert" on public.equipment_assets
  for insert
  to authenticated
  with check (public.equipment_role_can_manage());

drop policy if exists "equipment assets update" on public.equipment_assets;
create policy "equipment assets update" on public.equipment_assets
  for update
  to authenticated
  using (public.equipment_role_can_manage())
  with check (public.equipment_role_can_manage());

drop policy if exists "equipment maintenance read" on public.equipment_maintenance_records;
create policy "equipment maintenance read" on public.equipment_maintenance_records
  for select
  to authenticated
  using (public.equipment_role_can_read());

drop policy if exists "equipment maintenance insert" on public.equipment_maintenance_records;
create policy "equipment maintenance insert" on public.equipment_maintenance_records
  for insert
  to authenticated
  with check (public.equipment_role_can_manage());

drop policy if exists "equipment maintenance update" on public.equipment_maintenance_records;
create policy "equipment maintenance update" on public.equipment_maintenance_records
  for update
  to authenticated
  using (public.equipment_role_can_manage())
  with check (public.equipment_role_can_manage());

do $$
declare
  table_names text[] := array['equipment_assets', 'equipment_maintenance_records'];
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

revoke all on sequence public.equipment_asset_code_seq from public;
revoke all on public.equipment_assets from public;
revoke all on public.equipment_maintenance_records from public;

grant select on public.equipment_assets to authenticated;
grant select on public.equipment_maintenance_records to authenticated;

revoke all on function public.equipment_role_can_manage() from public;
revoke all on function public.equipment_role_can_read() from public;
revoke all on function public.create_equipment_asset(text, text, text, text, text, text, date, numeric, uuid, date, text) from public;
revoke all on function public.update_equipment_asset(uuid, text, text, text, text, text, text, text, date, numeric, uuid, date, text) from public;
revoke all on function public.report_equipment_breakdown(uuid, text, timestamptz, text) from public;
revoke all on function public.create_equipment_maintenance_record(uuid, text, text, timestamptz, text, text) from public;
revoke all on function public.start_equipment_maintenance(uuid) from public;
revoke all on function public.complete_equipment_maintenance(uuid, text, numeric, timestamptz, text, text, text, date, text, text) from public;
revoke all on function public.retire_equipment_asset(uuid, text) from public;

grant execute on function public.equipment_role_can_manage() to authenticated;
grant execute on function public.equipment_role_can_read() to authenticated;
grant execute on function public.create_equipment_asset(text, text, text, text, text, text, date, numeric, uuid, date, text) to authenticated;
grant execute on function public.update_equipment_asset(uuid, text, text, text, text, text, text, text, date, numeric, uuid, date, text) to authenticated;
grant execute on function public.report_equipment_breakdown(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.create_equipment_maintenance_record(uuid, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.start_equipment_maintenance(uuid) to authenticated;
grant execute on function public.complete_equipment_maintenance(uuid, text, numeric, timestamptz, text, text, text, date, text, text) to authenticated;
grant execute on function public.retire_equipment_asset(uuid, text) to authenticated;
