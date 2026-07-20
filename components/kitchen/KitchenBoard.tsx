import { kitchenStatusColumns } from "@/config/kitchen";
import { KitchenColumn } from "@/components/kitchen/KitchenColumn";
import type { KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type KitchenBoardProps = {
  orders: KitchenOrder[];
  activeMobileStatus: KitchenOrderStatus;
  now: number;
  onMobileStatusChange: (status: KitchenOrderStatus) => void;
  onStatusChange: (orderId: string, status: KitchenOrderStatus) => void;
  onOpenDetails: (order: KitchenOrder) => void;
};

export function KitchenBoard({
  orders,
  activeMobileStatus,
  now,
  onMobileStatusChange,
  onStatusChange,
  onOpenDetails,
}: KitchenBoardProps) {
  return (
    <>
      <div className="flex gap-2 overflow-x-auto lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {kitchenStatusColumns.map((column) => (
          <button
            key={column.status}
            type="button"
            onClick={() => onMobileStatusChange(column.status)}
            className={`h-12 shrink-0 rounded-lg px-4 text-base font-semibold ${
              activeMobileStatus === column.status ? "bg-[#D88A3D] text-[#171513]" : "bg-[#24211E] text-[#FFF8EE]"
            }`}
          >
            {column.shortTitle}
          </button>
        ))}
      </div>

      <div className="hidden h-[calc(100vh-310px)] min-h-[520px] grid-cols-3 gap-3 lg:grid">
        {kitchenStatusColumns.map((column) => (
          <KitchenColumn
            key={column.status}
            status={column.status}
            title={column.title}
            orders={orders.filter((order) => order.status === column.status)}
            now={now}
            onStatusChange={onStatusChange}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>

      <div className="lg:hidden">
        {kitchenStatusColumns
          .filter((column) => column.status === activeMobileStatus)
          .map((column) => (
            <KitchenColumn
              key={column.status}
              status={column.status}
              title={column.title}
              orders={orders.filter((order) => order.status === column.status)}
              now={now}
              onStatusChange={onStatusChange}
              onOpenDetails={onOpenDetails}
            />
          ))}
      </div>
    </>
  );
}
