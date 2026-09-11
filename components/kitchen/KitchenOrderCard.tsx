import clsx from "clsx";
import { AlertTriangle, ChefHat, CheckCircle2, Clock } from "lucide-react";
import { kitchenStatusLabels } from "@/config/kitchen";
import { formatOrderLabel } from "@/lib/displayFormat";
import { formatElapsedTime, formatKitchenClock } from "@/lib/formatElapsedTime";
import { isKitchenOrderLate } from "@/lib/kitchenOrders";
import { KitchenOrderItems } from "@/components/kitchen/KitchenOrderItems";
import type { KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type KitchenOrderCardProps = {
  order: KitchenOrder;
  now: number;
  onStatusChange: (orderId: string, status: KitchenOrderStatus) => void;
  onOpenDetails: (order: KitchenOrder) => void;
};

export function KitchenOrderCard({ order, now, onStatusChange, onOpenDetails }: KitchenOrderCardProps) {
  const late = isKitchenOrderLate(order, now);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const hasSubmittedItems = order.items.some((item) => item.status === "submitted");
  const hasPreparingItems = order.items.some((item) => item.status === "preparing");
  const hasReadyItems = order.items.some((item) => item.status === "ready");

  const action =
    hasSubmittedItems
      ? { label: "بدء التحضير", next: "preparing" as const, icon: ChefHat }
      : hasPreparingItems
        ? { label: "الطلب جاهز", next: "ready" as const, icon: CheckCircle2 }
        : null;
  const actionClassName =
    action?.next === "ready"
      ? "bg-[#2F7D57] text-white hover:bg-[#256847] focus-visible:ring-[#8fd8b4]"
      : "bg-[#B94B43] text-white hover:bg-[#9f3f38] focus-visible:ring-[#f0a49e]";

  return (
    <article
      className={clsx(
        "rounded-lg border bg-white p-4 shadow-sm",
        late ? "border-[#B94B43]" : order.priority === "priority" ? "border-[#D88A3D]" : "border-[#E1D3C2]",
      )}
    >
      <button type="button" onClick={() => onOpenDetails(order)} className="w-full text-right">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#6F6258]">{formatOrderLabel(order.orderNumber)}</p>
            <h3 className="text-3xl font-black text-[#2C211D]">طاولة {order.tableId}</h3>
            {order.roundNo > 1 ? (
              <span className="mt-2 inline-flex rounded-full bg-[#B94B43] px-3 py-1 text-sm font-bold text-white">
                إضافة #{order.roundNo}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-[#D8C8B7] bg-[#F7F1E8] px-3 py-1 text-sm font-bold text-[#2C211D]">{kitchenStatusLabels[order.status]}</span>
            {hasReadyItems && hasSubmittedItems ? (
              <span className="rounded-full border border-[#D88A3D]/35 bg-[#D88A3D]/10 px-3 py-1 text-xs font-semibold text-[#f3c68d]">
                بعض الأصناف لم تبدأ
              </span>
            ) : null}
            {order.priority === "priority" ? <span className="rounded-full bg-[#D88A3D] px-3 py-1 text-sm font-semibold text-[#171513]">أولوية</span> : null}
            {order.status === "ready" && order.hasOtherStationPending ? (
              <span className="rounded-full border border-[#D88A3D]/35 bg-[#D88A3D]/10 px-3 py-1 text-xs font-semibold text-[#f3c68d]">
                بانتظار محطة أخرى
              </span>
            ) : null}
            {late ? (
              <span className="flex items-center gap-1 rounded-full bg-[#B94B43] px-3 py-1 text-sm font-semibold text-white">
                <AlertTriangle size={15} />
                متأخر
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-[#5A4A42]">
          <span>الكابتن: {order.captainName}</span>
          <span>{itemCount} صنف</span>
          <span className="flex items-center gap-1">
            <Clock size={15} />
            {formatKitchenClock(order.timing.receivedAt)}
          </span>
          <span>{formatElapsedTime(order.timing.receivedAt, now)}</span>
        </div>
      </button>

      <div className="mt-4">
        <KitchenOrderItems items={order.items} limit={4} />
      </div>

      {action ? (
        <button
          type="button"
          onClick={() => onStatusChange(order.id, action.next)}
          className={clsx("mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-lg text-lg font-bold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white", actionClassName)}
        >
          <action.icon size={20} />
          {action.label}
        </button>
      ) : null}
    </article>
  );
}
