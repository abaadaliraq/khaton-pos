import { CheckCircle2, DoorOpen, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { RestaurantOrderStatus, RestaurantTable } from "@/types/pos";
import { getCaptainTableStatus } from "@/components/captain/CaptainTableBoard";

type TableDetailsPanelProps = {
  table: RestaurantTable | null;
  onClose: () => void;
  onAddOrder: (table: RestaurantTable) => void;
  onConfirmServed: (table: RestaurantTable) => void;
  onReleaseTable: (table: RestaurantTable) => void;
  confirmingServedOrderId: string | null;
  releasingTableId: number | null;
};

const orderStatusLabels: Record<RestaurantOrderStatus, string> = {
  submitted: "تم الإرسال",
  preparing: "قيد التحضير",
  ready: "جاهز للتقديم",
  served: "تم التقديم",
  awaiting_payment: "بانتظار الدفع",
  paid: "مدفوع",
  cancelled: "ملغى",
};

function formatBaghdadDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ar-IQ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Baghdad",
  }).format(new Date(value));
}

function getSessionTotal(table: RestaurantTable) {
  return table.orders?.reduce((total, order) => total + (order.total ?? 0), 0) ?? 0;
}

export function TableDetailsPanel({
  table,
  onClose,
  onAddOrder,
  onConfirmServed,
  onReleaseTable,
  confirmingServedOrderId,
  releasingTableId,
}: TableDetailsPanelProps) {
  if (!table) {
    return null;
  }

  const status = getCaptainTableStatus(table);
  const canConfirmReady = table.currentOrder?.status === "ready";
  const canRelease = status === "needs_clearing";
  const isConfirming = confirmingServedOrderId === table.currentOrder?.id;
  const isReleasing = releasingTableId === table.id;

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/30 p-3 backdrop-blur-[1px]">
      <aside className="captain-card flex h-full w-full max-w-2xl flex-col overflow-hidden shadow-xl">
        <div className="captain-divider flex items-center justify-between gap-3 border-b p-4">
          <div>
            <p className="captain-muted text-xs font-bold">تفاصيل الجلسة</p>
            <h2 className="captain-heading text-2xl font-black">طاولة {table.id}</h2>
          </div>
          <button type="button" onClick={onClose} className="captain-icon-button flex h-10 w-10 items-center justify-center" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="captain-summary p-3">
              <p className="captain-muted text-xs">الحالة</p>
              <p className="captain-heading mt-1 font-black">
                {status === "needs_clearing" ? "تحتاج إخلاء" : status === "available" ? "فارغة" : orderStatusLabels[table.currentOrder?.status ?? "submitted"]}
              </p>
            </div>
            <div className="captain-summary p-3">
              <p className="captain-muted text-xs">الجولات</p>
              <p className="captain-heading mt-1 font-black tabular-nums">{table.sessionOrderCount ?? table.orders?.length ?? 0}</p>
            </div>
            <div className="captain-summary p-3">
              <p className="captain-muted text-xs">غير مدفوعة</p>
              <p className="captain-heading mt-1 font-black tabular-nums">{table.unpaidOrderCount ?? 0}</p>
            </div>
            <div className="captain-summary p-3">
              <p className="captain-muted text-xs">إجمالي الجلسة</p>
              <p className="captain-accent mt-1 font-black">{formatCurrency(getSessionTotal(table))}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(table.orders ?? []).map((order) => (
              <section key={order.id} className="rounded-lg border border-[#dfd1c1] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eadfd3] px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-[#6b6259]">Round {order.roundNo}</p>
                    <h3 className="text-base font-black text-[#111]">طلب #{order.orderNumber}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-lg bg-[#f7efe5] px-2 py-1 text-[#4b4035]">{formatBaghdadDateTime(order.openedAt)}</span>
                    <span className="rounded-lg bg-[#fff1f1] px-2 py-1 text-[#b42323]">{orderStatusLabels[order.status]}</span>
                  </div>
                </div>

                <div className="grid gap-2 p-3 md:grid-cols-[1fr_1.1fr]">
                  <div className="space-y-2">
                    <p className="text-xs font-black text-[#4b4035]">حالة المحطات</p>
                    {(order.stationStatuses ?? []).length > 0 ? (
                      order.stationStatuses?.map((station) => (
                        <div key={`${order.id}-${station.station}`} className="flex items-center justify-between rounded-lg border border-[#eadfd3] bg-[#fbf6ef] px-3 py-2 text-sm">
                          <span className="font-black text-[#111]">{station.label}</span>
                          <span className="font-bold text-[#4b4035]">
                            {orderStatusLabels[station.status]} · {station.readyCount}/{station.itemCount}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#dfd1c1] px-3 py-2 text-sm font-bold text-[#6b6259]">
                        لا توجد محطات مسجلة لهذا الطلب
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-black text-[#4b4035]">الأصناف</p>
                    {(order.items ?? []).length > 0 ? (
                      order.items?.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-[#eadfd3] px-3 py-2 text-sm">
                          <span className="font-bold text-[#111]">{item.name}</span>
                          <span className="font-black tabular-nums text-[#4b4035]">x{item.quantity}</span>
                          <span className="rounded bg-[#f7efe5] px-2 py-1 text-xs font-bold text-[#4b4035]">{orderStatusLabels[item.status]}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#dfd1c1] px-3 py-2 text-sm font-bold text-[#6b6259]">
                        لا توجد أصناف ظاهرة
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="captain-divider grid gap-2 border-t p-4 sm:grid-cols-3">
          {canConfirmReady ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={() => onConfirmServed(table)}
              className="captain-primary-button flex h-12 items-center gap-2 text-sm font-black"
            >
              <CheckCircle2 size={18} />
              {isConfirming ? "جارٍ التأكيد..." : "تم التقديم"}
            </button>
          ) : null}
          {canRelease ? (
            <button
              type="button"
              disabled={isReleasing}
              onClick={() => onReleaseTable(table)}
              className="captain-primary-button flex h-12 items-center gap-2 text-sm font-black"
            >
              <DoorOpen size={18} />
              {isReleasing ? "جارٍ الإخلاء..." : "إخلاء الطاولة"}
            </button>
          ) : null}
          {table.canAddOrder ? (
            <button
              type="button"
              onClick={() => onAddOrder(table)}
              className="captain-secondary-button flex h-12 items-center justify-center gap-2 text-sm font-black"
            >
              <Plus size={18} />
              إضافة طلب
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="captain-secondary-button h-12 text-sm font-black">
            إغلاق
          </button>
        </div>
      </aside>
    </div>
  );
}
