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
    <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[#24211E]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#24211E] p-4">
        <div>
          <h2 className="text-xl font-semibold text-[#FFF8EE]">{title}</h2>
          <p className="text-sm text-[#C9BEB2]">{kitchenStatusLabels[status]}</p>
        </div>
        <span className="rounded-lg bg-[#171513] px-3 py-2 text-lg font-semibold text-[#D88A3D]">{orders.length}</span>
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
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-[#C9BEB2]">
            لا توجد طلبات
          </div>
        )}
      </div>
    </section>
  );
}
