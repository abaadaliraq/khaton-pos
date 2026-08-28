create or replace function public.get_admin_sales_report(
  p_period_from date,
  p_period_to date,
  p_today date default ((now() at time zone 'Asia/Baghdad')::date)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $report$
declare
  requester_role text := public.current_user_role();
  period_start date := least(p_period_from, p_period_to);
  period_end date := greatest(p_period_from, p_period_to);
  today_date date := coalesce(p_today, (now() at time zone 'Asia/Baghdad')::date);
  days_count integer;
  previous_start date;
  previous_end date;
  week_start date;
  previous_week_start date;
  previous_week_end date;
  month_start date;
  previous_month_start date;
  previous_month_end date;
  payload jsonb;
begin
  if requester_role not in ('admin', 'owner') then
    raise exception 'Only admin or owner can read sales reports';
  end if;

  days_count := period_end - period_start + 1;
  previous_end := period_start - 1;
  previous_start := previous_end - (days_count - 1);

  week_start := today_date - (((extract(dow from today_date)::integer + 1) % 7));
  previous_week_start := week_start - 7;
  previous_week_end := today_date - 7;

  month_start := date_trunc('month', today_date)::date;
  previous_month_start := (month_start - interval '1 month')::date;
  previous_month_end := least(previous_month_start + (today_date - month_start), month_start - 1);

  with periods(period_key, starts_on, ends_on) as (
    values
      ('selected', period_start, period_end),
      ('previous', previous_start, previous_end),
      ('week', week_start, today_date),
      ('previous_week', previous_week_start, previous_week_end),
      ('month', month_start, today_date),
      ('previous_month', previous_month_start, previous_month_end)
  ),
  period_payments as (
    select
      periods.period_key,
      p.order_id,
      p.method,
      p.amount,
      (p.created_at at time zone 'Asia/Baghdad')::date as paid_on
    from periods
    join public.payments p
      on (p.created_at at time zone 'Asia/Baghdad')::date between periods.starts_on and periods.ends_on
    join public.orders o on o.id = p.order_id
    where p.status = 'completed'
      and o.status <> 'cancelled'
  ),
  period_orders as (
    select distinct period_key, order_id
    from period_payments
  ),
  revenue_by_period as (
    select period_key, coalesce(sum(amount), 0)::numeric(12,0) as revenue
    from period_payments
    group by period_key
  ),
  order_count_by_period as (
    select period_key, count(*)::integer as order_count
    from period_orders
    group by period_key
  ),
  meals_by_period as (
    select po.period_key, coalesce(sum(oi.quantity), 0)::integer as meal_count
    from period_orders po
    join public.order_items oi on oi.order_id = po.order_id
    where oi.status <> 'cancelled'
    group by po.period_key
  ),
  summaries as (
    select
      periods.period_key,
      jsonb_build_object(
        'revenue', coalesce(revenue_by_period.revenue, 0),
        'orderCount', coalesce(order_count_by_period.order_count, 0),
        'mealCount', coalesce(meals_by_period.meal_count, 0),
        'averageOrderValue', case
          when coalesce(order_count_by_period.order_count, 0) = 0 then 0
          else round(coalesce(revenue_by_period.revenue, 0) / order_count_by_period.order_count)
        end
      ) as summary
    from periods
    left join revenue_by_period on revenue_by_period.period_key = periods.period_key
    left join order_count_by_period on order_count_by_period.period_key = periods.period_key
    left join meals_by_period on meals_by_period.period_key = periods.period_key
  ),
  selected_paid_orders as (
    select distinct order_id
    from period_payments
    where period_key = 'selected'
  ),
  selected_item_sales as (
    select
      oi.menu_item_id,
      coalesce(mi.name_ar, oi.item_name_snapshot) as item_name,
      sum(oi.quantity)::integer as quantity,
      sum(oi.quantity * oi.unit_price)::numeric(12,0) as sales
    from selected_paid_orders po
    join public.order_items oi on oi.order_id = po.order_id
    join public.menu_items mi on mi.id = oi.menu_item_id
    where oi.status <> 'cancelled'
      and mi.is_available = true
    group by oi.menu_item_id, coalesce(mi.name_ar, oi.item_name_snapshot)
    having sum(oi.quantity) > 0
  ),
  selected_daily as (
    select day::date as day
    from generate_series(period_start, period_end, interval '1 day') as day
  ),
  week_daily as (
    select day::date as day
    from generate_series(week_start, today_date, interval '1 day') as day
  ),
  month_daily as (
    select day::date as day
    from generate_series(month_start, today_date, interval '1 day') as day
  ),
  daily_revenue as (
    select period_key, paid_on, sum(amount)::numeric(12,0) as revenue
    from period_payments
    where period_key in ('selected', 'week', 'month')
    group by period_key, paid_on
  ),
  payment_methods as (
    select method, sum(amount)::numeric(12,0) as revenue
    from period_payments
    where period_key = 'selected'
    group by method
  ),
  order_statuses as (
    select status, count(*)::integer as count
    from public.orders
    where (coalesce(submitted_at, created_at) at time zone 'Asia/Baghdad')::date = today_date
    group by status
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', period_start, 'to', period_end),
    'summary', (select summary from summaries where period_key = 'selected'),
    'previousSummary', (select summary from summaries where period_key = 'previous'),
    'week', jsonb_build_object(
      'from', week_start,
      'to', today_date,
      'summary', (select summary from summaries where period_key = 'week'),
      'previousSummary', (select summary from summaries where period_key = 'previous_week'),
      'dailyRevenue', coalesce((
        select jsonb_agg(jsonb_build_object('date', wd.day, 'revenue', coalesce(dr.revenue, 0)) order by wd.day)
        from week_daily wd
        left join daily_revenue dr on dr.period_key = 'week' and dr.paid_on = wd.day
      ), '[]'::jsonb)
    ),
    'month', jsonb_build_object(
      'from', month_start,
      'to', today_date,
      'summary', (select summary from summaries where period_key = 'month'),
      'previousSummary', (select summary from summaries where period_key = 'previous_month'),
      'dailyRevenue', coalesce((
        select jsonb_agg(jsonb_build_object('date', md.day, 'revenue', coalesce(dr.revenue, 0)) order by md.day)
        from month_daily md
        left join daily_revenue dr on dr.period_key = 'month' and dr.paid_on = md.day
      ), '[]'::jsonb)
    ),
    'dailyRevenue', coalesce((
      select jsonb_agg(jsonb_build_object('date', sd.day, 'revenue', coalesce(dr.revenue, 0)) order by sd.day)
      from selected_daily sd
      left join daily_revenue dr on dr.period_key = 'selected' and dr.paid_on = sd.day
    ), '[]'::jsonb),
    'topItems', coalesce((
      select jsonb_agg(jsonb_build_object('name', item_name, 'quantity', quantity, 'sales', sales) order by quantity desc, sales desc, item_name)
      from (select * from selected_item_sales order by quantity desc, sales desc, item_name limit 10) top_rows
    ), '[]'::jsonb),
    'leastItems', coalesce((
      select jsonb_agg(jsonb_build_object('name', item_name, 'quantity', quantity, 'sales', sales) order by quantity asc, sales asc, item_name)
      from (select * from selected_item_sales order by quantity asc, sales asc, item_name limit 10) least_rows
    ), '[]'::jsonb),
    'paymentMethods', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'revenue', revenue) order by method)
      from payment_methods
    ), '[]'::jsonb),
    'orderStatusCounts', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', count) order by status)
      from order_statuses
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$report$;

-- Owner dashboard read-only access.
-- Sales stay behind get_admin_sales_report, so this migration does not add direct Owner SELECT on payments/orders/order_items.

drop policy if exists "profiles owner dashboard read" on public.profiles;
create policy "profiles owner dashboard read" on public.profiles
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "expenses owner read" on public.expenses;
create policy "expenses owner read" on public.expenses
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "purchases owner read" on public.purchases;
create policy "purchases owner read" on public.purchases
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "purchase items owner read" on public.purchase_items;
create policy "purchase items owner read" on public.purchase_items
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "purchase requests owner read" on public.purchase_requests;
create policy "purchase requests owner read" on public.purchase_requests
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "purchase request items owner read" on public.purchase_request_items;
create policy "purchase request items owner read" on public.purchase_request_items
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "purchase payments owner read" on public.purchase_payments;
create policy "purchase payments owner read" on public.purchase_payments
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "suppliers owner read" on public.suppliers;
create policy "suppliers owner read" on public.suppliers
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "inventory units owner read" on public.inventory_units;
create policy "inventory units owner read" on public.inventory_units
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "inventory items owner read" on public.inventory_items;
create policy "inventory items owner read" on public.inventory_items
  for select to authenticated
  using (public.current_user_role() = 'owner');

drop policy if exists "audit logs owner read" on public.audit_logs;
create policy "audit logs owner read" on public.audit_logs
  for select to authenticated
  using (public.current_user_role() = 'owner');
