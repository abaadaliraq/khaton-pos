create or replace function public.prevent_closed_order_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'cancelled' then
    raise exception 'Paid or cancelled orders cannot be modified';
  end if;

  if old.status = 'paid' then
    if old.closed_at is null
      and new.closed_at is not null
      and new.status = old.status
      and new.id = old.id
      and new.order_number = old.order_number
      and new.table_id = old.table_id
      and new.captain_id = old.captain_id
      and new.guest_count is not distinct from old.guest_count
      and new.general_notes is not distinct from old.general_notes
      and new.subtotal is not distinct from old.subtotal
      and new.discount_amount is not distinct from old.discount_amount
      and new.service_charge is not distinct from old.service_charge
      and new.total is not distinct from old.total
      and new.opened_at = old.opened_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.served_at is not distinct from old.served_at
      and new.paid_at is not distinct from old.paid_at
      and new.created_at = old.created_at
    then
      return new;
    end if;

    raise exception 'Paid or cancelled orders cannot be modified';
  end if;

  return new;
end;
$$;
