alter table public.purchase_requests
  add column if not exists rejection_reason text;

create index if not exists purchase_requests_pending_decision_idx
  on public.purchase_requests(created_at desc)
  where status = 'pending';

create or replace function public.decide_purchase_request(
  p_purchase_request_id uuid,
  p_decision text,
  p_decision_notes text default null
)
returns public.purchase_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text := public.current_user_role();
  old_request public.purchase_requests%rowtype;
  updated_request public.purchase_requests%rowtype;
  clean_note text := nullif(btrim(coalesce(p_decision_notes, '')), '');
begin
  if requester_role <> 'admin' then
    raise exception 'Only admin users can approve or reject purchase requests';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid purchase request decision';
  end if;

  if p_decision = 'rejected' and clean_note is null then
    raise exception 'Rejection reason is required';
  end if;

  select * into old_request
  from public.purchase_requests
  where id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'Purchase request was not found';
  end if;

  if old_request.status <> 'pending' then
    raise exception 'Only pending purchase requests can be decided';
  end if;

  update public.purchase_requests
  set status = p_decision,
      decision_notes = clean_note,
      rejection_reason = case when p_decision = 'rejected' then clean_note else null end,
      decided_by = auth.uid(),
      decided_at = now()
  where id = p_purchase_request_id
  returning * into updated_request;

  perform public.write_audit_log(
    case when p_decision = 'approved' then 'الموافقة على طلب شراء' else 'رفض طلب شراء' end,
    'purchase_requests',
    updated_request.id,
    to_jsonb(old_request),
    jsonb_build_object(
      'request_number', updated_request.request_number,
      'status', updated_request.status,
      'decision_by', updated_request.decided_by,
      'decision_at', updated_request.decided_at,
      'decision_notes', updated_request.decision_notes,
      'rejection_reason', updated_request.rejection_reason
    )
  );

  return updated_request;
end;
$$;

revoke all on function public.decide_purchase_request(uuid, text, text) from public;
grant execute on function public.decide_purchase_request(uuid, text, text) to authenticated;

drop policy if exists "purchase requests workflow read" on public.purchase_requests;
create policy "purchase requests workflow read"
  on public.purchase_requests
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant', 'owner'));

drop policy if exists "purchase request items workflow read" on public.purchase_request_items;
create policy "purchase request items workflow read"
  on public.purchase_request_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'storekeeper', 'accountant', 'owner'));
