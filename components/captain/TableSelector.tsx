import { Check, ChevronDown, X } from "lucide-react";
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
};

export function TableSelector({
  tables,
  selectedTable,
  isOpen,
  onOpen,
  onClose,
  onSelect,
}: TableSelectorProps) {
  return (
    <section className="captain-card p-3">
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
        </span>
        <ChevronDown size={20} className="captain-accent" />
      </button>

      {selectedTable ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#ff5656]/10 px-3 py-2 text-sm">
          <span className="font-medium text-[#ff5656]">الطلب الحالي لطاولة {selectedTable.id}</span>
          <span className={clsx("rounded-full border px-2 py-1 text-xs", statusClass[selectedTable.status])}>
            {statusLabel[selectedTable.status]}
          </span>
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
              {tables.map((table) => (
                <button
                  type="button"
                  key={table.id}
                  onClick={() => {
                    onSelect(table);
                    onClose();
                  }}
                  className={clsx(
                    "min-h-24 rounded-lg border p-3 text-center transition hover:-translate-y-0.5",
                    selectedTable?.id === table.id
                      ? "border-[#ff5656] bg-[#ff5656] text-white"
                      : "captain-table-option",
                  )}
                >
                  <span className="block text-xl font-bold">{table.id}</span>
                  <span
                    className={clsx(
                      "mt-2 inline-flex rounded-full border px-2 py-1 text-[11px]",
                      selectedTable?.id === table.id ? "border-white/30 bg-white/15 text-white" : statusClass[table.status],
                    )}
                  >
                    {statusLabel[table.status]}
                  </span>
                  {selectedTable?.id === table.id ? <Check className="mx-auto mt-2" size={16} /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
