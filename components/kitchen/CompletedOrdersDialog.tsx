import { X } from "lucide-react";
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
    .sort((first, second) => new Date(second.timing.servedAt ?? 0).getTime() - new Date(first.timing.servedAt ?? 0).getTime())
    .slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-white/10 bg-[#24211E] p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-[#FFF8EE]">الطلبات المكتملة</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#FFF8EE] hover:bg-[#302B27]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {latestServed.length > 0 ? (
            latestServed.map((order) => {
              const prepMinutes = getPreparationMinutes(order);
              return (
                <article key={order.id} className="rounded-lg border border-white/10 bg-[#171513] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-[#FFF8EE]">طاولة {order.tableId} / طلب {order.id}</h3>
                    <span className="text-[#D88A3D]">مدة التحضير: {prepMinutes ?? "-"} دقيقة</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[#C9BEB2] sm:grid-cols-4">
                    <span>وصل: {formatKitchenClock(order.timing.receivedAt)}</span>
                    <span>بدأ: {formatKitchenClock(order.timing.startedAt)}</span>
                    <span>جاهز: {formatKitchenClock(order.timing.readyAt)}</span>
                    <span>سُلّم: {formatKitchenClock(order.timing.servedAt)}</span>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-[#C9BEB2]">لا توجد طلبات مكتملة بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}
