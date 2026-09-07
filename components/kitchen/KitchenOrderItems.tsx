import type { KitchenOrderItem } from "@/types/kitchen";

type KitchenOrderItemsProps = {
  items: KitchenOrderItem[];
  limit?: number;
};

const itemStatusLabels: Record<KitchenOrderItem["status"], string> = {
  submitted: "لم يبدأ",
  preparing: "قيد التحضير",
  ready: "جاهز",
};

const itemStatusClasses: Record<KitchenOrderItem["status"], string> = {
  submitted: "border-[#C9BEB2]/25 bg-[#C9BEB2]/10 text-[#E6DDD3]",
  preparing: "border-[#D88A3D]/30 bg-[#D88A3D]/10 text-[#f3c68d]",
  ready: "border-[#3E8B65]/35 bg-[#3E8B65]/15 text-[#9ed6b9]",
};

export function KitchenOrderItems({ items, limit }: KitchenOrderItemsProps) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;
  const remaining = typeof limit === "number" ? Math.max(0, items.length - limit) : 0;

  return (
    <div className="space-y-2">
      {visibleItems.map((item) => (
        <div key={item.id} className="rounded-lg bg-[#171513] p-3">
          <div className="flex items-start gap-3">
            <span className="rounded-md bg-[#D88A3D] px-2 py-1 text-lg font-semibold text-[#171513]">
              {item.quantity} ×
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-medium text-[#FFF8EE]">{item.name}</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${itemStatusClasses[item.status]}`}>
                  {itemStatusLabels[item.status]}
                </span>
              </div>
              {item.note ? (
                <p className="mt-2 rounded-md border border-[#D88A3D]/25 bg-[#D88A3D]/10 px-2 py-1 text-sm text-[#f3c68d]">
                  ملاحظة: {item.note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {remaining > 0 ? <p className="text-sm text-[#D88A3D]">عرض باقي الأصناف: {remaining}</p> : null}
    </div>
  );
}
