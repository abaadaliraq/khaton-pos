import { Check, CheckCircle2, ChevronDown, Plus, X } from "lucide-react";
import clsx from "clsx";
import type { RestaurantTable, TableStatus } from "@/types/pos";

const statusLabel: Record<TableStatus, string> = {
  available: "متاحة",
  occupied: "مشغولة",
  reserved: "محجوزة",
};

const statusClass: Record<TableStatus, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  occupied: "border-amber-200 bg-amber-50 text-amber-800",
  reserved: "border-rose-200 bg-rose-50 text-rose-800",
};

type TableSelectorProps = {
  tables: RestaurantTable[];
  selectedTable: RestaurantTable | null;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (table: RestaurantTable) => void;
  onConfirmServed: (table: RestaurantTable) => void;
  onReleaseTable: (table: RestaurantTable) => void;
  confirmingServedOrderId: string | null;
  releasingTableId: number | null;
};

export function TableSelector({
  tables,
  selectedTable,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  onConfirmServed,
  onReleaseTable,
  confirmingServedOrderId,
  releasingTableId,
}: TableSelectorProps) {
  const readyOrder = selectedTable?.currentOrder?.status === "ready" ? selectedTable.currentOrder : null;
  const isSelectedOrderConfirming = readyOrder?.id === confirmingServedOrderId;

  function getDisplayStatus(table: RestaurantTable) {
    if (table.status === "occupied" && table.hasBusyOrders) {
      return {
        label: "مشغولة",
        detail: table.currentOrder?.roundNo && table.currentOrder.roundNo > 1 ? "طلب إضافي جديد" : "طلب قيد التحضير",
        className: "border-[#ff5656]/30 bg-[#ff5656]/10 text-[#ff5656]",
      };
    }

    if (table.status === "occupied" && table.orders?.some((order) => order.status === "ready")) {
      return {
        label: "جاهز للتقديم",
        detail: table.currentOrder?.roundNo && table.currentOrder.roundNo > 1 ? `إضافة #${table.currentOrder.roundNo}` : null,
        className: "border-sky-200 bg-sky-50 text-sky-800",
      };
    }

    if (table.status === "occupied" && table.orders?.some((order) => order.status === "awaiting_payment")) {
      return {
        label: "بانتظار الدفع",
        detail: table.unpaidOrderCount && table.unpaidOrderCount > 1 ? `${table.unpaidOrderCount} طلبات` : null,
        className: "border-amber-200 bg-amber-50 text-amber-800",
      };
    }

    if (table.status === "occupied" && table.canRelease) {
      return {
        label: "مدفوعة",
        detail: "بانتظار الإخلاء",
        className: "border-[#3B8F8B]/25 bg-[#3B8F8B]/10 text-[#2f7470]",
      };
    }

    return {
      label: statusLabel[table.status],
      detail: null,
      className: statusClass[table.status],
    };
  }

  return (
    <section className="captain-card p-3">
      <p className="captain-muted mb-2 text-xs">01 الطاولة</p>
      <button
        type="button"
        onClick={onOpen}
        className="captain-subcard flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition hover:border-[#ff5656]/50"
      >
        <span>
          <span className="captain-muted block text-xs">الطاولة المختارة</span>
          <span className="captain-heading text-lg font-bold">
            {selectedTable ? `طاولة ${selectedTable.id}` : "اختر الطاولة"}
          </span>
          {selectedTable?.status === "occupied" ? <span className="captain-muted mt-1 block text-xs">طلب إضافي</span> : null}
        </span>
        <ChevronDown size={20} className="captain-accent" />
      </button>

      {selectedTable ? (
        <div className="mt-3 space-y-2 rounded-lg bg-[#ff5656]/10 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[#ff5656]">الطلب الحالي لطاولة {selectedTable.id}</span>
            <span className={clsx("rounded-full border px-2 py-1 text-xs", statusClass[selectedTable.status])}>
              {statusLabel[selectedTable.status]}
            </span>
          </div>
          {readyOrder ? (
            <button
              type="button"
              onClick={() => onConfirmServed(selectedTable)}
              disabled={isSelectedOrderConfirming}
              className="captain-primary-button flex h-11 w-full items-center justify-center gap-2 text-sm font-bold disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={17} />
              {isSelectedOrderConfirming ? "جارٍ التأكيد..." : "تم تقديم الطلب"}
            </button>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 sm:items-center sm:justify-center">
          <div className="captain-card w-full p-4 shadow-xl sm:max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="captain-heading text-lg font-bold">اختيار الطاولة</h2>
                <p className="captain-muted text-sm">يمكن اختيار الطاولات المشغولة حاليًا مع ظهور حالتها.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="captain-icon-button p-2"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                const isAvailable = table.status === "available";
                const canAddOrder = Boolean(table.canAddOrder);
                const isReadyOrder = table.currentOrder?.status === "ready";
                const isPaidOrder = Boolean(table.canRelease);
                const displayStatus = getDisplayStatus(table);

                return (
                  <div key={table.id} className="space-y-2">
                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        onSelect(table);
                        onClose();
                      }}
                      className={clsx(
                        "min-h-24 w-full rounded-lg border p-3 text-center transition",
                        isSelected
                          ? "border-[#ff5656] bg-[#ff5656] text-white"
                          : isAvailable
                            ? "captain-table-option hover:-translate-y-0.5"
                            : "cursor-not-allowed border-[var(--captain-border)] bg-[var(--captain-card-soft)] opacity-55",
                      )}
                    >
                      <span className="block text-xl font-bold">{table.id}</span>
                      <span
                        className={clsx(
                          "mt-2 inline-flex rounded-full border px-2 py-1 text-[11px]",
                          isSelected ? "border-white/30 bg-white/15 text-white" : displayStatus.className,
                        )}
                      >
                        {displayStatus.label}
                      </span>
                      {displayStatus.detail ? <span className="mt-2 block text-[11px] font-medium">{displayStatus.detail}</span> : null}
                      {isSelected ? <Check className="mx-auto mt-2" size={16} /> : null}
                    </button>
                    {!isAvailable && canAddOrder ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(table);
                          onClose();
                        }}
                        className="captain-primary-button flex h-10 w-full items-center justify-center gap-1 text-xs font-bold"
                      >
                        <Plus size={15} />
                        طلب إضافي
                      </button>
                    ) : null}
                    {isReadyOrder ? (
                      <button
                        type="button"
                        onClick={() => onConfirmServed(table)}
                        disabled={confirmingServedOrderId === table.currentOrder?.id}
                        className="captain-primary-button h-10 w-full text-xs font-bold disabled:cursor-not-allowed"
                      >
                        {confirmingServedOrderId === table.currentOrder?.id ? "جارٍ التأكيد..." : "تم تقديم الطلب"}
                      </button>
                    ) : null}
                    {isPaidOrder ? (
                      <button
                        type="button"
                        onClick={() => onReleaseTable(table)}
                        disabled={releasingTableId === table.id}
                        className="captain-secondary-button h-10 w-full text-xs font-bold disabled:cursor-not-allowed"
                      >
                        {releasingTableId === table.id ? "جارٍ الإخلاء..." : "إخلاء الطاولة"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
