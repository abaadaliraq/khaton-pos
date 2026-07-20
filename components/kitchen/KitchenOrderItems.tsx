import type { KitchenOrderItem } from "@/types/kitchen";

type KitchenOrderItemsProps = {
  items: KitchenOrderItem[];
  limit?: number;
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
              <p className="text-lg font-medium text-[#FFF8EE]">{item.name}</p>
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
