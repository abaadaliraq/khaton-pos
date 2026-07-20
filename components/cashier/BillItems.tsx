import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierOrder } from "@/types/cashier";

type BillItemsProps = {
  order: CashierOrder;
};

export function BillItems({ order }: BillItemsProps) {
  return (
    <div className="space-y-2">
      {order.items.map((item) => (
        <article key={item.id} className="rounded-lg border border-[#eadfce] bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-medium text-[#2C211D]">
                {item.quantity} × {item.name}
              </h4>
              <p className="mt-1 text-xs text-[#7a665c]">{formatCurrency(item.unitPrice)} للوحدة</p>
            </div>
            <p className="font-semibold text-[#7B3F32]">{formatCurrency(item.quantity * item.unitPrice)}</p>
          </div>
          {item.note ? <p className="mt-2 rounded-md bg-[#F7F1E8] px-2 py-1 text-xs text-[#6f5b52]">{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}
