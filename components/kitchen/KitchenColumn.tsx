import { kitchenStatusLabels } from "@/config/kitchen";
import { KitchenOrderCard } from "@/components/kitchen/KitchenOrderCard";
import type { KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type KitchenColumnProps = {
  status: KitchenOrderStatus;
  title: string;
  orders: KitchenOrder[];
  now: number;
  onStatusChange: (orderId: string, status: KitchenOrderStatus) => void;
  onOpenDetails: (order: KitchenOrder) => void;
};

export function KitchenColumn({ status, title, orders, now, onStatusChange, onOpenDetails }: KitchenColumnProps) {
  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-[#E1D3C2] bg-[#FFF9F1] shadow-sm">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E1D3C2] bg-[#F2E7D9] p-4">
        <div>
          <h2 className="text-xl font-black text-[#2C211D]">{title}</h2>
          <p className="text-sm font-bold text-[#6F6258]">{kitchenStatusLabels[status]}</p>
        </div>
        <span className="rounded-lg bg-white px-3 py-2 text-lg font-black text-[#B94B43] shadow-sm">{orders.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {orders.length > 0 ? (
          orders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              now={now}
              onStatusChange={onStatusChange}
              onOpenDetails={onOpenDetails}
            />
          ))
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-[#D8C8B7] bg-white text-sm font-bold text-[#6F6258]">
            لا توجد طلبات
          </div>
        )}
      </div>
    </section>
  );
}
