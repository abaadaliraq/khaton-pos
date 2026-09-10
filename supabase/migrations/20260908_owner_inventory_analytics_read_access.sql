create or replace function public.get_inventory_analytics(
  p_start_date date,
  p_end_date date,
  p_item_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  current_start timestamptz;
  current_end timestamptz;
  previous_start timestamptz;
  previous_end timestamptz;
  period_days integer;
  current_dish_quantity numeric(18,3);
  previous_dish_quantity numeric(18,3);
  payload jsonb;
begin
  if requester_role not in ('admin', 'owner', 'storekeeper', 'accountant') then
    raise exception 'Only management users can read inventory analytics';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid analytics date range';
  end if;

  if p_item_type is not null and p_item_type not in ('food_recipe', 'food_indirect', 'packaging', 'cleaning', 'operational_consumable') then
    raise exception 'Invalid inventory item type';
  end if;

  period_days := greatest(1, (p_end_date - p_start_date + 1));
  current_start := p_start_date::timestamp at time zone 'Asia/Baghdad';
  current_end := (p_end_date + 1)::timestamp at time zone 'Asia/Baghdad';
  previous_end := current_start;
  previous_start := (p_start_date - period_days)::timestamp at time zone 'Asia/Baghdad';

  select coalesce(sum(oi.quantity), 0)
  into current_dish_quantity
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status in ('preparing', 'ready', 'awaiting_payment', 'paid')
    and oi.status <> 'cancelled'
    and coalesce(oi.started_at, o.submitted_at, o.opened_at, o.created_at) >= current_start
    and coalesce(oi.started_at, o.submitted_at, o.opened_at, o.created_at) < current_end;

  select coalesce(sum(oi.quantity), 0)
  into previous_dish_quantity
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status in ('preparing', 'ready', 'awaiting_payment', 'paid')
    and oi.status <> 'cancelled'
    and coalesce(oi.started_at, o.submitted_at, o.opened_at, o.created_at) >= previous_start
    and coalesce(oi.started_at, o.submitted_at, o.opened_at, o.created_at) < previous_end;

  with item_base as (
    select
      ii.id,
      ii.name_ar,
      ii.item_type,
      ii.stock_on_hand,
      ii.minimum_stock,
      ii.average_cost,
      ii.last_purchase_cost,
      ii.is_active,
      bu.code as base_unit_code,
      bu.name_ar as base_unit_name
    from public.inventory_items ii
    join public.inventory_units bu on bu.id = ii.base_unit_id
    where p_item_type is null or ii.item_type = p_item_type
  ),
  purchase_current as (
    select
      pi.inventory_item_id,
      sum(pi.quantity_base)::numeric(18,3) as purchased_quantity,
      count(distinct pi.purchase_id)::integer as purchase_count,
      sum(pi.line_total)::numeric(18,4) as purchase_total,
      case when sum(pi.quantity_base) > 0 then round(sum(pi.line_total) / sum(pi.quantity_base), 4) else 0 end as average_unit_cost,
      min(pi.unit_cost_base)::numeric(18,4) as min_unit_cost,
      max(pi.unit_cost_base)::numeric(18,4) as max_unit_cost,
      count(distinct p.supplier_id)::integer as supplier_count
    from public.purchase_items pi
    join public.purchases p on p.id = pi.purchase_id
    where p.created_at >= current_start
      and p.created_at < current_end
    group by pi.inventory_item_id
  ),
  purchase_previous as (
    select
      pi.inventory_item_id,
      sum(pi.line_total)::numeric(18,4) as purchase_total
    from public.purchase_items pi
    join public.purchases p on p.id = pi.purchase_id
    where p.created_at >= previous_start
      and p.created_at < previous_end
    group by pi.inventory_item_id
  ),
  last_purchase as (
    select distinct on (pi.inventory_item_id)
      pi.inventory_item_id,
      pi.unit_cost_base,
      p.created_at,
      s.name as supplier_name
    from public.purchase_items pi
    join public.purchases p on p.id = pi.purchase_id
    join public.suppliers s on s.id = p.supplier_id
    order by pi.inventory_item_id, p.created_at desc, pi.id desc
  ),
  issue_events as (
    select
      ri.inventory_item_id,
      ir.id as requisition_id,
      ir.request_number,
      ir.destination,
      ir.issued_at,
      ri.issued_quantity_base
    from public.inventory_requisition_items ri
    join public.inventory_requisitions ir on ir.id = ri.requisition_id
    where ir.status in ('issued', 'received')
      and ri.status in ('issued', 'received')
      and ri.issued_quantity_base is not null
  ),
  issue_current as (
    select
      inventory_item_id,
      sum(issued_quantity_base)::numeric(18,3) as issued_quantity,
      count(*)::integer as issue_count,
      avg(issued_quantity_base)::numeric(18,3) as average_issue_quantity,
      max(issued_quantity_base)::numeric(18,3) as max_issue_quantity,
      max(issued_at) as last_issue_at
    from issue_events
    where issued_at >= current_start
      and issued_at < current_end
    group by inventory_item_id
  ),
  issue_previous as (
    select
      inventory_item_id,
      sum(issued_quantity_base)::numeric(18,3) as issued_quantity
    from issue_events
    where issued_at >= previous_start
      and issued_at < previous_end
    group by inventory_item_id
  ),
  issue_gap as (
    select
      inventory_item_id,
      avg(extract(epoch from (issued_at - previous_issued_at)) / 86400)::numeric(18,3) as average_days_between_issues
    from (
      select
        inventory_item_id,
        issued_at,
        lag(issued_at) over (partition by inventory_item_id order by issued_at) as previous_issued_at
      from issue_events
      where issued_at >= current_start
        and issued_at < current_end
    ) ordered_issues
    where previous_issued_at is not null
    group by inventory_item_id
  ),
  department_current as (
    select
      inventory_item_id,
      jsonb_object_agg(destination, issued_quantity order by destination) as destinations
    from (
      select
        inventory_item_id,
        destination,
        sum(issued_quantity_base)::numeric(18,3) as issued_quantity
      from issue_events
      where issued_at >= current_start
        and issued_at < current_end
      group by inventory_item_id, destination
    ) destination_totals
    group by inventory_item_id
  ),
  waste_current as (
    select
      wi.inventory_item_id,
      sum(wi.quantity_base) filter (where wr.context = 'warehouse')::numeric(18,3) as warehouse_waste_quantity,
      sum(wi.quantity_base) filter (where wr.context = 'issued_department')::numeric(18,3) as department_waste_quantity,
      sum(wi.quantity_base)::numeric(18,3) as total_waste_quantity,
      count(*)::integer as waste_count
    from public.inventory_waste_items wi
    join public.inventory_waste_reports wr on wr.id = wi.report_id
    where wr.status = 'posted'
      and wr.posted_at >= current_start
      and wr.posted_at < current_end
    group by wi.inventory_item_id
  ),
  waste_previous as (
    select
      wi.inventory_item_id,
      sum(wi.quantity_base)::numeric(18,3) as total_waste_quantity,
      sum(wi.quantity_base) filter (where wr.context = 'issued_department')::numeric(18,3) as department_waste_quantity
    from public.inventory_waste_items wi
    join public.inventory_waste_reports wr on wr.id = wi.report_id
    where wr.status = 'posted'
      and wr.posted_at >= previous_start
      and wr.posted_at < previous_end
    group by wi.inventory_item_id
  ),
  waste_reason as (
    select distinct on (inventory_item_id)
      inventory_item_id,
      reason,
      reason_count
    from (
      select
        wi.inventory_item_id,
        wi.reason,
        count(*)::integer as reason_count
      from public.inventory_waste_items wi
      join public.inventory_waste_reports wr on wr.id = wi.report_id
      where wr.status = 'posted'
        and wr.posted_at >= current_start
        and wr.posted_at < current_end
      group by wi.inventory_item_id, wi.reason
    ) reasons
    order by inventory_item_id, reason_count desc, reason
  ),
  waste_destination as (
    select distinct on (inventory_item_id)
      inventory_item_id,
      destination,
      destination_count
    from (
      select
        wi.inventory_item_id,
        wr.destination,
        count(*)::integer as destination_count
      from public.inventory_waste_items wi
      join public.inventory_waste_reports wr on wr.id = wi.report_id
      where wr.status = 'posted'
        and wr.context = 'issued_department'
        and wr.posted_at >= current_start
        and wr.posted_at < current_end
      group by wi.inventory_item_id, wr.destination
    ) destinations
    order by inventory_item_id, destination_count desc, destination
  ),
  consumption_current as (
    select
      inventory_item_id,
      abs(sum(quantity_delta))::numeric(18,3) as recipe_consumption_quantity,
      count(*)::integer as recipe_consumption_count
    from public.inventory_movements
    where movement_type = 'consumption'
      and created_at >= current_start
      and created_at < current_end
    group by inventory_item_id
  ),
  timeline as (
    select inventory_item_id, jsonb_agg(event_payload order by event_at desc) as events
    from (
      select
        pi.inventory_item_id,
        p.created_at as event_at,
        jsonb_build_object(
          'date', p.created_at,
          'type', 'purchase',
          'label', 'شراء',
          'quantity_base', pi.quantity_base,
          'unit_cost', pi.unit_cost_base,
          'supplier_name', s.name,
          'reference', 'PUR-' || lpad(p.purchase_number::text, 4, '0')
        ) as event_payload
      from public.purchase_items pi
      join public.purchases p on p.id = pi.purchase_id
      join public.suppliers s on s.id = p.supplier_id
      where p.created_at >= current_start and p.created_at < current_end
      union all
      select
        ie.inventory_item_id,
        ie.issued_at as event_at,
        jsonb_build_object(
          'date', ie.issued_at,
          'type', 'stock_issue',
          'label', 'صرف للقسم',
          'quantity_base', ie.issued_quantity_base * -1,
          'destination', ie.destination,
          'reference', 'REQ-' || lpad(ie.request_number::text, 4, '0')
        ) as event_payload
      from issue_events ie
      where ie.issued_at >= current_start and ie.issued_at < current_end
      union all
      select
        wi.inventory_item_id,
        wr.posted_at as event_at,
        jsonb_build_object(
          'date', wr.posted_at,
          'type', case when wr.context = 'warehouse' then 'warehouse_waste' else 'department_waste' end,
          'label', case when wr.context = 'warehouse' then 'هدر المخزن' else 'هدر بعد الصرف' end,
          'quantity_base', case when wr.context = 'warehouse' then wi.quantity_base * -1 else wi.quantity_base end,
          'context', wr.context,
          'destination', wr.destination,
          'reason', wi.reason,
          'reference', 'WST-' || lpad(wr.report_number::text, 4, '0')
        ) as event_payload
      from public.inventory_waste_items wi
      join public.inventory_waste_reports wr on wr.id = wi.report_id
      where wr.status = 'posted' and wr.posted_at >= current_start and wr.posted_at < current_end
      union all
      select
        im.inventory_item_id,
        im.created_at as event_at,
        jsonb_build_object(
          'date', im.created_at,
          'type', 'recipe_consumption',
          'label', 'استهلاك وصفة',
          'quantity_base', im.quantity_delta,
          'reference', case when o.order_number is null then null else '#' || o.order_number::text end
        ) as event_payload
      from public.inventory_movements im
      left join public.orders o on o.id = im.order_id
      where im.movement_type = 'consumption'
        and im.created_at >= current_start and im.created_at < current_end
    ) raw_events
    group by inventory_item_id
  ),
  purchase_history as (
    select inventory_item_id, jsonb_agg(history_payload order by purchased_at desc) as history
    from (
      select
        pi.inventory_item_id,
        p.created_at as purchased_at,
        jsonb_build_object(
          'date', p.created_at,
          'supplier_name', s.name,
          'quantity', pi.quantity,
          'quantity_base', pi.quantity_base,
          'unit_price', pi.unit_price,
          'unit_cost_base', pi.unit_cost_base,
          'line_total', pi.line_total,
          'reference', 'PUR-' || lpad(p.purchase_number::text, 4, '0')
        ) as history_payload
      from public.purchase_items pi
      join public.purchases p on p.id = pi.purchase_id
      join public.suppliers s on s.id = p.supplier_id
      where p.created_at >= current_start and p.created_at < current_end
    ) raw_history
    group by inventory_item_id
  ),
  metrics as (
    select
      ib.*,
      coalesce(pc.purchased_quantity, 0) as purchased_quantity,
      coalesce(pc.purchase_count, 0) as purchase_count,
      coalesce(pc.purchase_total, 0) as purchase_total,
      coalesce(pc.average_unit_cost, 0) as purchase_average_unit_cost,
      coalesce(pc.min_unit_cost, 0) as purchase_min_unit_cost,
      coalesce(pc.max_unit_cost, 0) as purchase_max_unit_cost,
      coalesce(pc.supplier_count, 0) as supplier_count,
      lp.unit_cost_base as last_purchase_unit_cost,
      lp.supplier_name as last_supplier_name,
      lp.created_at as last_purchase_at,
      coalesce(ic.issued_quantity, 0) as issued_quantity,
      coalesce(ic.issue_count, 0) as issue_count,
      coalesce(ic.average_issue_quantity, 0) as average_issue_quantity,
      coalesce(ic.max_issue_quantity, 0) as max_issue_quantity,
      ic.last_issue_at,
      ig.average_days_between_issues,
      coalesce(wc.warehouse_waste_quantity, 0) as warehouse_waste_quantity,
      coalesce(wc.department_waste_quantity, 0) as department_waste_quantity,
      coalesce(wc.total_waste_quantity, 0) as total_waste_quantity,
      coalesce(wc.waste_count, 0) as waste_count,
      wr.reason as top_waste_reason,
      wd.destination as top_waste_destination,
      coalesce(cc.recipe_consumption_quantity, 0) as recipe_consumption_quantity,
      coalesce(cc.recipe_consumption_count, 0) as recipe_consumption_count,
      coalesce(pp.purchase_total, 0) as previous_purchase_total,
      coalesce(ip.issued_quantity, 0) as previous_issued_quantity,
      coalesce(wp.total_waste_quantity, 0) as previous_total_waste_quantity,
      coalesce(wp.department_waste_quantity, 0) as previous_department_waste_quantity,
      coalesce(dc.destinations, '{}'::jsonb) as department_breakdown,
      coalesce(tl.events, '[]'::jsonb) as timeline_events,
      coalesce(ph.history, '[]'::jsonb) as purchase_history
    from item_base ib
    left join purchase_current pc on pc.inventory_item_id = ib.id
    left join purchase_previous pp on pp.inventory_item_id = ib.id
    left join last_purchase lp on lp.inventory_item_id = ib.id
    left join issue_current ic on ic.inventory_item_id = ib.id
    left join issue_previous ip on ip.inventory_item_id = ib.id
    left join issue_gap ig on ig.inventory_item_id = ib.id
    left join department_current dc on dc.inventory_item_id = ib.id
    left join waste_current wc on wc.inventory_item_id = ib.id
    left join waste_previous wp on wp.inventory_item_id = ib.id
    left join waste_reason wr on wr.inventory_item_id = ib.id
    left join waste_destination wd on wd.inventory_item_id = ib.id
    left join consumption_current cc on cc.inventory_item_id = ib.id
    left join timeline tl on tl.inventory_item_id = ib.id
    left join purchase_history ph on ph.inventory_item_id = ib.id
  )
  select jsonb_build_object(
    'range', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'period_days', period_days,
      'previous_start_date', (p_start_date - period_days),
      'previous_end_date', (p_start_date - 1),
      'timezone', 'Asia/Baghdad'
    ),
    'overview', jsonb_build_object(
      'inventory_value', coalesce(sum(stock_on_hand * average_cost), 0),
      'follow_up_count', coalesce(count(*) filter (where is_active and stock_on_hand <= minimum_stock), 0),
      'issue_cost_estimate', coalesce(sum(issued_quantity * average_cost), 0),
      'actual_waste_quantity_events', coalesce(sum(case when total_waste_quantity > 0 then 1 else 0 end), 0),
      'dish_quantity', current_dish_quantity,
      'previous_dish_quantity', previous_dish_quantity
    ),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name_ar', name_ar,
      'item_type', item_type,
      'is_active', is_active,
      'base_unit_code', base_unit_code,
      'base_unit_name', base_unit_name,
      'stock_on_hand', stock_on_hand,
      'minimum_stock', minimum_stock,
      'average_cost', average_cost,
      'last_purchase_cost', last_purchase_cost,
      'purchases', jsonb_build_object(
        'quantity', purchased_quantity,
        'count', purchase_count,
        'total', purchase_total,
        'average_unit_cost', purchase_average_unit_cost,
        'last_unit_cost', coalesce(last_purchase_unit_cost, last_purchase_cost),
        'min_unit_cost', purchase_min_unit_cost,
        'max_unit_cost', purchase_max_unit_cost,
        'last_supplier_name', last_supplier_name,
        'last_purchase_at', last_purchase_at,
        'supplier_count', supplier_count,
        'history', purchase_history
      ),
      'issues', jsonb_build_object(
        'quantity', issued_quantity,
        'count', issue_count,
        'average_quantity', average_issue_quantity,
        'max_quantity', max_issue_quantity,
        'last_issue_at', last_issue_at,
        'average_days_between', average_days_between_issues,
        'department_breakdown', department_breakdown
      ),
      'waste', jsonb_build_object(
        'warehouse_quantity', warehouse_waste_quantity,
        'department_quantity', department_waste_quantity,
        'total_quantity', total_waste_quantity,
        'count', waste_count,
        'top_reason', top_waste_reason,
        'top_destination', top_waste_destination,
        'ratio_department_to_issued', case when issued_quantity > 0 then round((department_waste_quantity / issued_quantity) * 100, 2) else null end
      ),
      'recipe_consumption', jsonb_build_object(
        'quantity', recipe_consumption_quantity,
        'count', recipe_consumption_count
      ),
      'operations', jsonb_build_object(
        'daily_issue_rate', case when period_days > 0 then round(issued_quantity / period_days, 3) else null end,
        'coverage_days', case when issued_quantity > 0 and period_days > 0 then round(stock_on_hand / (issued_quantity / period_days), 1) else null end,
        'issue_per_100_dishes', case when current_dish_quantity > 0 then round((issued_quantity / current_dish_quantity) * 100, 3) else null end,
        'previous_issue_per_100_dishes', case when previous_dish_quantity > 0 then round((previous_issued_quantity / previous_dish_quantity) * 100, 3) else null end
      ),
      'comparison', jsonb_build_object(
        'issue_quantity_percent', case when previous_issued_quantity > 0 then round(((issued_quantity - previous_issued_quantity) / previous_issued_quantity) * 100, 2) else null end,
        'waste_quantity_percent', case when previous_total_waste_quantity > 0 then round(((total_waste_quantity - previous_total_waste_quantity) / previous_total_waste_quantity) * 100, 2) else null end,
        'purchase_cost_percent', case when previous_purchase_total > 0 then round(((purchase_total - previous_purchase_total) / previous_purchase_total) * 100, 2) else null end,
        'issue_per_100_dishes_percent', case
          when previous_dish_quantity > 0 and previous_issued_quantity > 0 and current_dish_quantity > 0
          then round(((((issued_quantity / current_dish_quantity) * 100) - ((previous_issued_quantity / previous_dish_quantity) * 100)) / ((previous_issued_quantity / previous_dish_quantity) * 100)) * 100, 2)
          else null
        end
      ),
      'timeline', timeline_events
    ) order by name_ar), '[]'::jsonb)
  )
  into payload
  from metrics;

  return coalesce(payload, jsonb_build_object(
    'range', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'period_days', period_days, 'timezone', 'Asia/Baghdad'),
    'overview', jsonb_build_object('inventory_value', 0, 'follow_up_count', 0, 'issue_cost_estimate', 0, 'actual_waste_quantity_events', 0, 'dish_quantity', current_dish_quantity, 'previous_dish_quantity', previous_dish_quantity),
    'items', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_inventory_analytics(date, date, text) from public;
grant execute on function public.get_inventory_analytics(date, date, text) to authenticated;

