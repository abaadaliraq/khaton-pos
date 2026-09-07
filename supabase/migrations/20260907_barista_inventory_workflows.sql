create or replace function public.requisition_destination_allowed(p_destination text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
begin
  if requester_role in ('admin', 'storekeeper') then
    return true;
  end if;

  if requester_role = 'kitchen' then
    return p_destination = 'kitchen';
  end if;

  if requester_role = 'barista' then
    return p_destination = 'barista';
  end if;

  return false;
end;
$$;

create or replace function public.get_inventory_requisition_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  payload jsonb;
begin
  if requester_role not in ('admin', 'storekeeper', 'kitchen', 'barista') then
    raise exception 'Only operational users can read requisition catalog';
  end if;

  select jsonb_build_object(
    'items', coalesce(jsonb_agg(distinct jsonb_build_object(
      'id', ii.id,
      'name_ar', ii.name_ar,
      'item_type', ii.item_type,
      'base_unit_id', ii.base_unit_id,
      'base_unit_code', bu.code,
      'base_unit_name_ar', bu.name_ar,
      'stock_on_hand', ii.stock_on_hand
    )) filter (where ii.id is not null), '[]'::jsonb),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', iu.id,
        'code', iu.code,
        'name_ar', iu.name_ar,
        'unit_family', iu.unit_family,
        'factor_to_base', iu.factor_to_base,
        'is_base_unit', iu.is_base_unit
      ) order by iu.sort_order), '[]'::jsonb)
      from public.inventory_units iu
    ),
    'conversions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', iic.id,
        'inventory_item_id', iic.inventory_item_id,
        'packaging_unit_name_ar', iic.packaging_unit_name_ar,
        'quantity_in_base_unit', iic.quantity_in_base_unit
      ) order by iic.packaging_unit_name_ar), '[]'::jsonb)
      from public.inventory_item_conversions iic
      where iic.is_active = true
    )
  )
  into payload
  from public.inventory_items ii
  join public.inventory_units bu on bu.id = ii.base_unit_id
  where ii.is_active = true;

  return coalesce(payload, jsonb_build_object('items', '[]'::jsonb, 'units', '[]'::jsonb, 'conversions', '[]'::jsonb));
end;
$$;

create or replace function public.create_inventory_requisition(
  p_destination text,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  created_requisition public.inventory_requisitions%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  target_unit public.inventory_units%rowtype;
  target_conversion public.inventory_item_conversions%rowtype;
  quantity_value numeric(18,3);
  quantity_base_value numeric(18,3);
  unit_id_value uuid;
  conversion_id_value uuid;
  unit_label_value text;
  item_count integer := 0;
begin
  if requester_role not in ('admin', 'storekeeper', 'kitchen', 'barista') then
    raise exception 'Only operational users can create inventory requisitions';
  end if;

  if not public.requisition_destination_allowed(p_destination) then
    raise exception 'This user cannot create a requisition for the selected destination';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory requisition must contain at least one item';
  end if;

  insert into public.inventory_requisitions (destination, note, requested_by)
  values (p_destination, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning * into created_requisition;

  for item_payload in select * from jsonb_array_elements(p_items) loop
    quantity_value := nullif(item_payload ->> 'quantity', '')::numeric;
    unit_id_value := nullif(item_payload ->> 'unit_id', '')::uuid;
    conversion_id_value := nullif(item_payload ->> 'conversion_id', '')::uuid;

    if quantity_value is null or quantity_value <= 0 then
      raise exception 'Requisition item quantity must be greater than zero';
    end if;

    select * into target_item
    from public.inventory_items
    where id = (item_payload ->> 'inventory_item_id')::uuid;

    if not found or not target_item.is_active then
      raise exception 'Inventory item is not available';
    end if;

    quantity_base_value := public.resolve_inventory_requisition_quantity(target_item.id, quantity_value, unit_id_value, conversion_id_value);

    if conversion_id_value is not null then
      select * into target_conversion
      from public.inventory_item_conversions
      where id = conversion_id_value
        and inventory_item_id = target_item.id
        and is_active = true;

      if not found then
        raise exception 'Inventory item conversion is not available';
      end if;

      unit_label_value := target_conversion.packaging_unit_name_ar;
    else
      select * into target_unit
      from public.inventory_units
      where id = unit_id_value;

      if not found then
        raise exception 'Inventory unit was not found';
      end if;

      unit_label_value := target_unit.name_ar;
    end if;

    insert into public.inventory_requisition_items (
      requisition_id,
      inventory_item_id,
      requested_quantity,
      requested_unit_id,
      requested_conversion_id,
      requested_unit_label,
      requested_quantity_base,
      notes
    ) values (
      created_requisition.id,
      target_item.id,
      quantity_value,
      unit_id_value,
      conversion_id_value,
      unit_label_value,
      quantity_base_value,
      nullif(btrim(coalesce(item_payload ->> 'notes', '')), '')
    );

    item_count := item_count + 1;
  end loop;

  perform public.write_audit_log(
    'requisition_created',
    'inventory_requisitions',
    created_requisition.id,
    null,
    jsonb_build_object('destination', created_requisition.destination, 'item_count', item_count)
  );

  return jsonb_build_object(
    'requisition_id', created_requisition.id,
    'request_number', created_requisition.request_number
  );
end;
$$;

create or replace function public.waste_destination_allowed(p_destination text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
begin
  if requester_role in ('admin', 'storekeeper') then
    return true;
  end if;

  if requester_role = 'kitchen' then
    return p_destination = 'kitchen';
  end if;

  if requester_role = 'barista' then
    return p_destination = 'barista';
  end if;

  return false;
end;
$$;

create or replace function public.get_inventory_waste_catalog(p_context text default 'warehouse')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  payload jsonb;
begin
  if p_context not in ('warehouse', 'issued_department') then
    raise exception 'Invalid waste context';
  end if;

  if p_context = 'warehouse' and requester_role not in ('admin', 'storekeeper') then
    raise exception 'Only inventory users can read warehouse waste catalog';
  end if;

  if p_context = 'issued_department' and requester_role not in ('admin', 'storekeeper', 'kitchen', 'barista') then
    raise exception 'Only operational users can read department waste catalog';
  end if;

  select jsonb_build_object(
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ii.id,
        'name_ar', ii.name_ar,
        'item_type', ii.item_type,
        'base_unit_id', ii.base_unit_id,
        'base_unit_code', bu.code,
        'base_unit_name_ar', bu.name_ar,
        'stock_on_hand', ii.stock_on_hand
      ) order by ii.name_ar), '[]'::jsonb)
      from public.inventory_items ii
      join public.inventory_units bu on bu.id = ii.base_unit_id
      where ii.is_active = true
    ),
    'issued_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'requisition_id', ir.id,
        'requisition_item_id', ri.id,
        'requisition_number', ir.request_number,
        'destination', ir.destination,
        'inventory_item_id', ii.id,
        'inventory_item_name_ar', ii.name_ar,
        'base_unit_id', ii.base_unit_id,
        'base_unit_code', bu.code,
        'base_unit_name_ar', bu.name_ar,
        'issued_quantity_base', ri.issued_quantity_base,
        'wasted_quantity_base', coalesce(waste_totals.wasted_quantity_base, 0),
        'remaining_waste_base', ri.issued_quantity_base - coalesce(waste_totals.wasted_quantity_base, 0)
      ) order by ir.issued_at desc nulls last, ir.request_number desc, ii.name_ar), '[]'::jsonb)
      from public.inventory_requisition_items ri
      join public.inventory_requisitions ir on ir.id = ri.requisition_id
      join public.inventory_items ii on ii.id = ri.inventory_item_id
      join public.inventory_units bu on bu.id = ii.base_unit_id
      left join (
        select wi.requisition_item_id, sum(wi.quantity_base) as wasted_quantity_base
        from public.inventory_waste_items wi
        join public.inventory_waste_reports wr on wr.id = wi.report_id
        where wr.context = 'issued_department'
          and wr.status = 'posted'
        group by wi.requisition_item_id
      ) waste_totals on waste_totals.requisition_item_id = ri.id
      where ir.status in ('issued', 'received')
        and ri.status in ('issued', 'received')
        and ri.issued_quantity_base is not null
        and (requester_role in ('admin', 'storekeeper') or public.waste_destination_allowed(ir.destination))
        and ri.issued_quantity_base - coalesce(waste_totals.wasted_quantity_base, 0) > 0
    ),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', iu.id,
        'code', iu.code,
        'name_ar', iu.name_ar,
        'unit_family', iu.unit_family,
        'factor_to_base', iu.factor_to_base,
        'is_base_unit', iu.is_base_unit
      ) order by iu.sort_order), '[]'::jsonb)
      from public.inventory_units iu
    ),
    'conversions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', iic.id,
        'inventory_item_id', iic.inventory_item_id,
        'packaging_unit_name_ar', iic.packaging_unit_name_ar,
        'quantity_in_base_unit', iic.quantity_in_base_unit
      ) order by iic.packaging_unit_name_ar), '[]'::jsonb)
      from public.inventory_item_conversions iic
      where iic.is_active = true
    )
  )
  into payload;

  return coalesce(payload, jsonb_build_object('items', '[]'::jsonb, 'issued_items', '[]'::jsonb, 'units', '[]'::jsonb, 'conversions', '[]'::jsonb));
end;
$$;

create or replace function public.record_inventory_waste(
  p_context text,
  p_destination text default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  created_report public.inventory_waste_reports%rowtype;
  created_item public.inventory_waste_items%rowtype;
  item_payload jsonb;
  target_item public.inventory_items%rowtype;
  target_requisition public.inventory_requisitions%rowtype;
  target_requisition_item public.inventory_requisition_items%rowtype;
  quantity_value numeric(18,3);
  unit_id_value uuid;
  conversion_id_value uuid;
  inventory_item_id_value uuid;
  requisition_id_value uuid;
  requisition_item_id_value uuid;
  reason_value text;
  quantity_payload jsonb;
  quantity_base_value numeric(18,3);
  quantity_before_value numeric(18,3);
  quantity_after_value numeric(18,3);
  previously_wasted_base numeric(18,3);
  remaining_waste_base numeric(18,3);
  item_count integer := 0;
begin
  if p_context not in ('warehouse', 'issued_department') then
    raise exception 'Invalid waste context';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Waste report must contain at least one item';
  end if;

  if p_context = 'warehouse' then
    if requester_role not in ('admin', 'storekeeper') then
      raise exception 'Only inventory users can post warehouse waste';
    end if;
    p_destination := null;
  else
    if requester_role not in ('admin', 'storekeeper', 'kitchen', 'barista') then
      raise exception 'Only operational users can post department waste';
    end if;

    if p_destination is null or not public.waste_destination_allowed(p_destination) then
      raise exception 'This user cannot post waste for this destination';
    end if;
  end if;

  insert into public.inventory_waste_reports (context, destination, note, posted_by)
  values (p_context, p_destination, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning * into created_report;

  for item_payload in select * from jsonb_array_elements(p_items)
  loop
    inventory_item_id_value := nullif(item_payload ->> 'inventory_item_id', '')::uuid;
    quantity_value := (item_payload ->> 'quantity')::numeric;
    unit_id_value := nullif(item_payload ->> 'unit_id', '')::uuid;
    conversion_id_value := nullif(item_payload ->> 'conversion_id', '')::uuid;
    requisition_id_value := nullif(item_payload ->> 'requisition_id', '')::uuid;
    requisition_item_id_value := nullif(item_payload ->> 'requisition_item_id', '')::uuid;
    reason_value := item_payload ->> 'reason';

    if reason_value not in ('expired', 'spoiled', 'damaged', 'contaminated', 'broken', 'preparation_error', 'overproduction', 'oil_disposal', 'other') then
      raise exception 'Invalid waste reason';
    end if;

    quantity_payload := public.resolve_inventory_waste_quantity(inventory_item_id_value, quantity_value, unit_id_value, conversion_id_value);
    quantity_base_value := (quantity_payload ->> 'quantity_base')::numeric;

    if p_context = 'warehouse' then
      if requisition_id_value is not null or requisition_item_id_value is not null then
        raise exception 'Warehouse waste cannot be linked to a department requisition';
      end if;

      select * into target_item
      from public.inventory_items
      where id = inventory_item_id_value
      for update;

      if not found or not target_item.is_active then
        raise exception 'Inventory item is not available';
      end if;

      quantity_before_value := target_item.stock_on_hand;
      quantity_after_value := quantity_before_value - quantity_base_value;

      if quantity_after_value < 0 then
        raise exception 'INSUFFICIENT_INVENTORY:%:%:%', target_item.name_ar, quantity_base_value, quantity_before_value;
      end if;

      insert into public.inventory_waste_items (
        report_id,
        inventory_item_id,
        quantity,
        unit_id,
        conversion_id,
        unit_label,
        quantity_base,
        reason,
        notes
      )
      values (
        created_report.id,
        inventory_item_id_value,
        quantity_value,
        unit_id_value,
        conversion_id_value,
        quantity_payload ->> 'unit_label',
        quantity_base_value,
        reason_value,
        nullif(btrim(coalesce(item_payload ->> 'notes', '')), '')
      )
      returning * into created_item;

      insert into public.inventory_movements (
        inventory_item_id,
        movement_type,
        quantity_delta,
        quantity_before,
        quantity_after,
        unit_cost,
        total_cost,
        source_type,
        source_id,
        inventory_waste_report_id,
        inventory_waste_item_id,
        notes,
        created_by
      )
      values (
        inventory_item_id_value,
        'waste',
        quantity_base_value * -1,
        quantity_before_value,
        quantity_after_value,
        target_item.average_cost,
        quantity_base_value * target_item.average_cost * -1,
        'inventory_waste',
        created_report.id,
        created_report.id,
        created_item.id,
        coalesce(nullif(btrim(coalesce(item_payload ->> 'notes', '')), ''), 'هدر / تلف'),
        auth.uid()
      );

      perform set_config('app.inventory_stock_write', 'on', true);

      update public.inventory_items
      set stock_on_hand = quantity_after_value
      where id = inventory_item_id_value;

      perform set_config('app.inventory_stock_write', '', true);
    else
      if requisition_id_value is null or requisition_item_id_value is null then
        raise exception 'Department waste must be linked to an issued requisition item';
      end if;

      select * into target_requisition_item
      from public.inventory_requisition_items
      where id = requisition_item_id_value
      for update;

      if not found then
        raise exception 'Inventory requisition item was not found';
      end if;

      select * into target_requisition
      from public.inventory_requisitions
      where id = requisition_id_value
        and id = target_requisition_item.requisition_id;

      if not found then
        raise exception 'Inventory requisition was not found';
      end if;

      if target_requisition.destination <> p_destination or not public.waste_destination_allowed(target_requisition.destination) then
        raise exception 'This user cannot post waste for this requisition destination';
      end if;

      if target_requisition.status not in ('issued', 'received') or target_requisition_item.status not in ('issued', 'received') then
        raise exception 'Department waste requires issued or received materials';
      end if;

      if target_requisition_item.inventory_item_id <> inventory_item_id_value then
        raise exception 'Waste item does not match the requisition item';
      end if;

      select coalesce(sum(wi.quantity_base), 0)
      into previously_wasted_base
      from public.inventory_waste_items wi
      join public.inventory_waste_reports wr on wr.id = wi.report_id
      where wi.requisition_item_id = requisition_item_id_value
        and wr.context = 'issued_department'
        and wr.status = 'posted';

      remaining_waste_base := coalesce(target_requisition_item.issued_quantity_base, 0) - previously_wasted_base;

      if quantity_base_value > remaining_waste_base then
        raise exception 'WASTE_EXCEEDS_ISSUED:%:%:%', inventory_item_id_value, quantity_base_value, remaining_waste_base;
      end if;

      insert into public.inventory_waste_items (
        report_id,
        inventory_item_id,
        quantity,
        unit_id,
        conversion_id,
        unit_label,
        quantity_base,
        reason,
        notes,
        requisition_id,
        requisition_item_id
      )
      values (
        created_report.id,
        inventory_item_id_value,
        quantity_value,
        unit_id_value,
        conversion_id_value,
        quantity_payload ->> 'unit_label',
        quantity_base_value,
        reason_value,
        nullif(btrim(coalesce(item_payload ->> 'notes', '')), ''),
        requisition_id_value,
        requisition_item_id_value
      );
    end if;

    item_count := item_count + 1;
  end loop;

  perform public.write_audit_log(
    'inventory_waste_posted',
    'inventory_waste_reports',
    created_report.id,
    null,
    jsonb_build_object(
      'report_id', created_report.id,
      'context', created_report.context,
      'destination', created_report.destination,
      'item_count', item_count
    )
  );

  return jsonb_build_object('waste_report_id', created_report.id, 'item_count', item_count);
end;
$$;

drop policy if exists "inventory requisitions role read" on public.inventory_requisitions;
create policy "inventory requisitions role read"
  on public.inventory_requisitions
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'owner')
    or requested_by = auth.uid()
    or public.requisition_destination_allowed(destination)
  );

drop policy if exists "inventory requisition items role read" on public.inventory_requisition_items;
create policy "inventory requisition items role read"
  on public.inventory_requisition_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inventory_requisitions ir
      where ir.id = inventory_requisition_items.requisition_id
        and (
          public.current_user_role() in ('admin', 'storekeeper', 'owner')
          or ir.requested_by = auth.uid()
          or public.requisition_destination_allowed(ir.destination)
        )
    )
  );

drop policy if exists "inventory units requisition read" on public.inventory_units;
create policy "inventory units requisition read"
  on public.inventory_units
  for select
  to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'kitchen', 'barista', 'owner'));

drop policy if exists "inventory items requisition read active" on public.inventory_items;
create policy "inventory items requisition read active"
  on public.inventory_items
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'owner')
    or (public.current_user_role() in ('kitchen', 'barista') and is_active = true)
  );

drop policy if exists "inventory item conversions requisition read active" on public.inventory_item_conversions;
create policy "inventory item conversions requisition read active"
  on public.inventory_item_conversions
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'owner')
    or (
      public.current_user_role() in ('kitchen', 'barista')
      and is_active = true
      and exists (
        select 1
        from public.inventory_items ii
        where ii.id = inventory_item_conversions.inventory_item_id
          and ii.is_active = true
      )
    )
  );

drop policy if exists "inventory waste reports role read" on public.inventory_waste_reports;
create policy "inventory waste reports role read"
  on public.inventory_waste_reports
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'storekeeper', 'accountant', 'owner')
    or (context = 'issued_department' and public.waste_destination_allowed(destination))
  );

drop policy if exists "inventory waste items role read" on public.inventory_waste_items;
create policy "inventory waste items role read"
  on public.inventory_waste_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inventory_waste_reports wr
      where wr.id = inventory_waste_items.report_id
        and (
          public.current_user_role() in ('admin', 'storekeeper', 'accountant', 'owner')
          or (wr.context = 'issued_department' and public.waste_destination_allowed(wr.destination))
        )
    )
  );

revoke all on function public.requisition_destination_allowed(text) from public;
revoke all on function public.get_inventory_requisition_catalog() from public;
revoke all on function public.create_inventory_requisition(text, text, jsonb) from public;
revoke all on function public.waste_destination_allowed(text) from public;
revoke all on function public.get_inventory_waste_catalog(text) from public;
revoke all on function public.record_inventory_waste(text, text, text, jsonb) from public;

grant execute on function public.requisition_destination_allowed(text) to authenticated;
grant execute on function public.get_inventory_requisition_catalog() to authenticated;
grant execute on function public.create_inventory_requisition(text, text, jsonb) to authenticated;
grant execute on function public.waste_destination_allowed(text) to authenticated;
grant execute on function public.get_inventory_waste_catalog(text) to authenticated;
grant execute on function public.record_inventory_waste(text, text, text, jsonb) to authenticated;
