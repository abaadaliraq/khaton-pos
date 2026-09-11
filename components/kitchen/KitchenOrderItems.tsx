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
  submitted: "border-[#D8C8B7] bg-[#F7F1E8] text-[#5A4A42]",
  preparing: "border-[#D88A3D]/45 bg-[#FFF1DF] text-[#8B4A16]",
  ready: "border-[#2F7D57]/35 bg-[#EAF6EF] text-[#205C3F]",
};

export function KitchenOrderItems({ items, limit }: KitchenOrderItemsProps) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;
  const remaining = typeof limit === "number" ? Math.max(0, items.length - limit) : 0;

  return (
    <div className="space-y-2">
      {visibleItems.map((item) => (
        <div key={item.id} className="rounded-lg border border-[#E1D3C2] bg-[#FFFDF9] p-3">
          <div className="flex items-start gap-3">
            <span className="rounded-md bg-[#B94B43] px-2 py-1 text-lg font-black text-white">
              {item.quantity} ×
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-[#2C211D]">{item.name}</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${itemStatusClasses[item.status]}`}>
                  {itemStatusLabels[item.status]}
                </span>
              </div>
              {item.note ? (
                <p className="mt-2 rounded-md border border-[#D88A3D]/35 bg-[#FFF1DF] px-2 py-1 text-sm font-semibold text-[#8B4A16]">
                  ملاحظة: {item.note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {remaining > 0 ? <p className="text-sm font-bold text-[#B94B43]">عرض باقي الأصناف: {remaining}</p> : null}
    </div>
  );
}
