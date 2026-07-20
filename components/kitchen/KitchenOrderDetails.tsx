import { X } from "lucide-react";
import { kitchenStatusLabels } from "@/config/kitchen";
import { KitchenOrderItems } from "@/components/kitchen/KitchenOrderItems";
import { formatElapsedTime, formatKitchenClock } from "@/lib/formatElapsedTime";
import type { KitchenOrder } from "@/types/kitchen";

type KitchenOrderDetailsProps = {
  order: KitchenOrder | null;
  now: number;
  onClose: () => void;
};

export function KitchenOrderDetails({ order, now, onClose }: KitchenOrderDetailsProps) {
  if (!order) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-[#24211E] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[#C9BEB2]">طلب {order.id}</p>
            <h2 className="text-3xl font-semibold text-[#FFF8EE]">طاولة {order.tableId}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#FFF8EE] hover:bg-[#302B27]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-base text-[#C9BEB2] sm:grid-cols-2">
          <span>الحالة: {kitchenStatusLabels[order.status]}</span>
          <span>الكابتن: {order.captainName}</span>
          <span>وصل: {formatKitchenClock(order.timing.receivedAt)} / {formatElapsedTime(order.timing.receivedAt, now)}</span>
          <span>بدأ التحضير: {formatKitchenClock(order.timing.startedAt)}</span>
          <span>جاهز: {formatKitchenClock(order.timing.readyAt)}</span>
          <span>تم التسليم: {formatKitchenClock(order.timing.servedAt)}</span>
        </div>

        <div className="mt-5">
          <KitchenOrderItems items={order.items} />
        </div>
      </div>
    </div>
  );
}
