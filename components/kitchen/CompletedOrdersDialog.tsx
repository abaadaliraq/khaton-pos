import { X } from "lucide-react";
import { formatOrderLabel, getTimestamp } from "@/lib/displayFormat";
import { formatKitchenClock } from "@/lib/formatElapsedTime";
import { getPreparationMinutes } from "@/lib/kitchenOrders";
import type { KitchenOrder } from "@/types/kitchen";

type CompletedOrdersDialogProps = {
  orders: KitchenOrder[];
  isOpen: boolean;
  onClose: () => void;
};

export function CompletedOrdersDialog({ orders, isOpen, onClose }: CompletedOrdersDialogProps) {
  if (!isOpen) {
    return null;
  }

  const latestServed = orders
    .filter((order) => order.status === "served")
    .sort((first, second) => (getTimestamp(second.timing.servedAt) ?? 0) - (getTimestamp(first.timing.servedAt) ?? 0))
    .slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#E1D3C2] bg-white p-5 text-[#2C211D] shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-[#2C211D]">الطلبات المكتملة</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] p-2 text-[#2C211D] hover:bg-[#F1E6D8]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {latestServed.length > 0 ? (
            latestServed.map((order) => {
              const prepMinutes = getPreparationMinutes(order);
              return (
                <article key={order.id} className="rounded-lg border border-[#E1D3C2] bg-[#FFFDF9] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-black text-[#2C211D]">طاولة {order.tableId} / {formatOrderLabel(order.orderNumber)}</h3>
                    <span className="font-bold text-[#B94B43]">مدة التحضير: {prepMinutes ?? "-"} دقيقة</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm font-semibold text-[#5A4A42] sm:grid-cols-4">
                    <span>وصل: {formatKitchenClock(order.timing.receivedAt)}</span>
                    <span>بدأ: {formatKitchenClock(order.timing.startedAt)}</span>
                    <span>جاهز: {formatKitchenClock(order.timing.readyAt)}</span>
                    <span>سُلّم: {formatKitchenClock(order.timing.servedAt)}</span>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed border-[#D8C8B7] bg-[#FFFDF9] p-6 text-center font-bold text-[#6F6258]">لا توجد طلبات مكتملة بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}
