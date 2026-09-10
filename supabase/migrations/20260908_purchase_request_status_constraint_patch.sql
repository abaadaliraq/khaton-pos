alter table public.purchase_requests
  drop constraint if exists purchase_requests_status_check;

alter table public.purchase_requests
  add constraint purchase_requests_status_check
  check (status in (
    'pending',
    'decision_in_progress',
    'partially_approved',
    'approved',
    'rejected',
    'partially_received',
    'received',
    'cancelled'
  ));

create or replace function public.purchase_request_decision_status(p_purchase_request_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when count(*) = 0 then 'pending'
    when bool_and(decision_status = 'pending') then 'pending'
    when bool_and(decision_status = 'approved') then 'approved'
    when bool_and(decision_status = 'rejected') then 'rejected'
    when bool_or(decision_status = 'pending') then 'decision_in_progress'
    else 'partially_approved'
  end
  from public.purchase_request_items
  where purchase_request_id = p_purchase_request_id;
$$;

revoke all on function public.purchase_request_decision_status(uuid) from public;
grant execute on function public.purchase_request_decision_status(uuid) to authenticated;
