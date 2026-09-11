import clsx from "clsx";
import { RefreshCw, Search, X } from "lucide-react";
import type { KitchenFilter } from "@/types/kitchen";

type KitchenToolbarProps = {
  searchTerm: string;
  filter: KitchenFilter;
  pendingReceiptCount: number;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: KitchenFilter) => void;
  onOpenRequisitionReceipts: () => void;
  onRefresh: () => void;
};

const filters: { id: KitchenFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "normal", label: "عادي" },
  { id: "late", label: "متأخر" },
  { id: "priority", label: "أولوية" },
];

export function KitchenToolbar({ searchTerm, filter, pendingReceiptCount, onSearchChange, onFilterChange, onOpenRequisitionReceipts, onRefresh }: KitchenToolbarProps) {
  return (
    <section className="rounded-lg border border-[#E1D3C2] bg-white p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6258]" size={19} />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ابحث برقم الطاولة أو الطلب..."
            className="h-12 w-full rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] pr-11 pl-12 text-base font-semibold text-[#2C211D] outline-none placeholder:text-[#8B7A6D] focus:border-[#B94B43]"
          />
          {searchTerm ? (
            <button type="button" onClick={() => onSearchChange("")} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#6F6258] hover:bg-[#F1E6D8]" aria-label="مسح البحث">
              <X size={17} />
            </button>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={clsx(
                "h-12 shrink-0 rounded-lg border px-4 text-base font-medium",
                filter === item.id
                  ? "border-[#B94B43] bg-[#B94B43] text-white shadow-sm"
                  : "border-[#D8C8B7] bg-[#FFFDF9] text-[#2C211D] hover:border-[#B94B43]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button type="button" onClick={onRefresh} className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] px-4 text-base font-bold text-[#2C211D] hover:border-[#B94B43]">
          <RefreshCw size={18} />
          تحديث
        </button>
        <button type="button" onClick={onOpenRequisitionReceipts} className="h-12 rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] px-4 text-sm font-bold text-[#2C211D] hover:border-[#B94B43]">
          بانتظار الاستلام {pendingReceiptCount > 0 ? pendingReceiptCount : ""}
        </button>
      </div>
    </section>
  );
}
