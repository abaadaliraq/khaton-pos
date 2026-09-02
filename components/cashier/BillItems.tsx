import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierOrder, CashierOrderRawStatus } from "@/types/cashier";

type BillItemsProps = {
  order: CashierOrder;
};

const roundStatusLabel: Record<CashierOrderRawStatus, string> = {
  submitted: "جديدة",
  preparing: "قيد التحضير",
  ready: "جاهزة للتقديم",
  served: "تم التقديم",
  awaiting_payment: "بانتظار الدفع",
  paid: "مدفوعة",
};

export function BillItems({ order }: BillItemsProps) {
  const rounds = order.rounds?.length ? order.rounds : [order];

  return (
    <div className="space-y-2">
      {rounds.map((round) => (
        <section key={round.id} className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-[#F7F1E8] px-3 py-2 text-xs font-semibold text-[#7B3F32]">
            <span>
              {round.roundNo > 1 ? `إضافة #${round.roundNo}` : "الطلب الأساسي"}
              {round.roundNo > 1 ? ` — ${round.isNewAddition ? "جديدة" : roundStatusLabel[round.rawStatus]}` : ""}
            </span>
            <span>{formatCurrency(round.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0))}</span>
          </div>
          {round.items.map((item) => (
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
        </section>
      ))}
    </div>
  );
}
