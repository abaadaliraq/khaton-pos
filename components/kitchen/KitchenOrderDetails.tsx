import { X } from "lucide-react";
import { kitchenStatusLabels } from "@/config/kitchen";
import { KitchenOrderItems } from "@/components/kitchen/KitchenOrderItems";
import { formatOrderLabel } from "@/lib/displayFormat";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#E1D3C2] bg-white p-5 text-[#2C211D] shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-[#6F6258]">{formatOrderLabel(order.orderNumber)}</p>
            <h2 className="text-3xl font-black text-[#2C211D]">طاولة {order.tableId}</h2>
            {order.roundNo > 1 ? (
              <span className="mt-2 inline-flex rounded-full bg-[#B94B43] px-3 py-1 text-sm font-bold text-white">
                إضافة #{order.roundNo}
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] p-2 text-[#2C211D] hover:bg-[#F1E6D8]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-base font-semibold text-[#5A4A42] sm:grid-cols-2">
          <span>الحالة: {kitchenStatusLabels[order.status]}</span>
          {order.status === "ready" && order.hasOtherStationPending ? <span>حالة الطلب: بانتظار محطة أخرى</span> : null}
          <span>الكابتن: {order.captainName}</span>
          {order.generalNotes ? <span className="sm:col-span-2">ملاحظات الطلب: {order.generalNotes}</span> : null}
          <span>وصل: {formatKitchenClock(order.timing.receivedAt)} / {formatElapsedTime(order.timing.receivedAt, now)}</span>
          <span>بدأ التحضير: {formatKitchenClock(order.timing.startedAt)}</span>
          <span>جاهز: {formatKitchenClock(order.timing.readyAt)}</span>
          <span>تم التقديم: {formatKitchenClock(order.timing.servedAt)}</span>
        </div>

        <div className="mt-5">
          <KitchenOrderItems items={order.items} />
        </div>
      </div>
    </div>
  );
}
