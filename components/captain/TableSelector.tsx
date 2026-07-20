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
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200 bg-[#fbfaf6] px-4 py-3 text-right transition hover:border-[#4c5a35]"
      >
        <span>
          <span className="block text-xs text-stone-500">الطاولة المختارة</span>
          <span className="text-lg font-bold text-stone-950">
            {selectedTable ? `طاولة ${selectedTable.id}` : "اختر الطاولة"}
          </span>
        </span>
        <ChevronDown size={20} className="text-[#4c5a35]" />
      </button>

      {selectedTable ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#eef1e8] px-3 py-2 text-sm">
          <span className="font-medium text-[#394427]">الطلب الحالي لطاولة {selectedTable.id}</span>
          <span className={clsx("rounded-full border px-2 py-1 text-xs", statusClass[selectedTable.status])}>
            {statusLabel[selectedTable.status]}
          </span>
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center">
          <div className="w-full rounded-lg bg-white p-4 shadow-xl sm:max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-stone-950">اختيار الطاولة</h2>
                <p className="text-sm text-stone-500">يمكن اختيار الطاولات المشغولة حاليًا مع ظهور حالتها.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
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
                      ? "border-[#4c5a35] bg-[#4c5a35] text-white"
                      : "border-stone-200 bg-[#fbfaf6] text-stone-900",
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
