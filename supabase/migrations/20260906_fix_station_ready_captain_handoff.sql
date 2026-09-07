do $$
begin
  if to_regprocedure('public.recalculate_order_preparation_status(uuid)') is null then
    raise exception 'Missing dependency: 20260906_preparation_station_order_items.sql';
  end if;
end;
$$;

-- Phase 2 currently has a Kitchen station and a Barista station. These
-- existing beverage menu items were previously tagged as "drinks", which leaves
-- their open order items invisible to both station screens. Keep "drinks"
-- available for future stations by migrating only the known current beverage
-- items that belong to the Barista workflow.
with barista_beverage_items(name_ar, category_name_en) as (
  values
    ('ليمونادة بالنعناع', 'cold-drinks'),
    ('زبيب مثلج', 'cold-drinks'),
    ('لبن عيران', 'cold-drinks'),
    ('آيس لاتيه', 'cold-drinks'),
    ('كركديه مثلج', 'cold-drinks'),
    ('آيس أمريكانو', 'cold-drinks'),
    ('سبانش لاتيه بارد', 'cold-drinks'),
    ('كراميل آيس لاتيه', 'cold-drinks'),
    ('فرابتشينو', 'cold-drinks'),
    ('موكا بارد', 'cold-drinks'),
    ('عصير برتقال', 'cold-drinks'),
    ('عصير رمان', 'cold-drinks'),
    ('عصير موز', 'cold-drinks'),
    ('عصير كوكتيل', 'cold-drinks'),
    ('موهيتو كلاسيك', 'mojito'),
    ('موهيتو فراولة', 'mojito'),
    ('موهيتو باشن فروت', 'mojito'),
    ('موهيتو رمان', 'mojito'),
    ('موهيتو بلو بيري', 'mojito'),
    ('موهيتو خاتون', 'mojito'),
    ('كجرات حار / بارد', 'herbal-drinks'),
    ('ينسون بالعسل', 'herbal-drinks'),
    ('شاي نومي حامض عراقي', 'herbal-drinks'),
    ('شاي نعناع أخضر طازج', 'herbal-drinks'),
    ('شاي بابونج', 'herbal-drinks')
),
affected_menu_items as (
  update public.menu_items mi
  set preparation_station = 'barista'
  from public.menu_categories mc, barista_beverage_items target_item
  where mc.id = mi.category_id
    and mi.preparation_station = 'drinks'
    and mi.name_ar = target_item.name_ar
    and mc.name_en = target_item.category_name_en
  returning mi.id
),
affected_orders as (
  update public.order_items oi
  set preparation_station = 'barista'
  from public.orders o, affected_menu_items ami
  where o.id = oi.order_id
    and oi.menu_item_id = ami.id
    and oi.preparation_station = 'drinks'
    and oi.status not in ('served', 'cancelled')
    and o.status in ('submitted', 'preparing', 'ready')
  returning oi.order_id
),
distinct_affected_orders as (
  select distinct order_id
  from affected_orders
)
select public.recalculate_order_preparation_status(order_id)
from distinct_affected_orders;
