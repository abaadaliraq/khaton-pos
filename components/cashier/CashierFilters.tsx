import clsx from "clsx";
import { Search, X } from "lucide-react";
import type { CashierTableStatus } from "@/types/cashier";

export type CashierFilter = "all" | CashierTableStatus;

const filters: { id: CashierFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "occupied", label: "مفتوحة" },
  { id: "waiting_payment", label: "بانتظار الدفع" },
  { id: "paid", label: "مدفوعة" },
  { id: "reserved", label: "محجوزة" },
  { id: "available", label: "فارغة" },
];

type CashierFiltersProps = {
  searchTerm: string;
  activeFilter: CashierFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: CashierFilter) => void;
};

export function CashierFilters({ searchTerm, activeFilter, onSearchChange, onFilterChange }: CashierFiltersProps) {
  return (
    <section className="cashier-no-print rounded-lg border border-[#d8c9b7] bg-white p-3 shadow-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9c8175]" size={18} />
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ابحث برقم الطاولة أو رقم الطلب..."
          className="h-12 w-full rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] pr-10 pl-12 text-sm text-[#2C211D] outline-none focus:border-[#B85F4A] focus:bg-white"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#7a665c] hover:bg-[#E8DCCB]"
            aria-label="مسح البحث"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            className={clsx(
              "h-10 shrink-0 rounded-lg border px-4 text-sm font-medium",
              activeFilter === filter.id
                ? "border-[#B85F4A] bg-[#B85F4A] text-white"
                : "border-[#d8c9b7] bg-[#F7F1E8] text-[#2C211D] hover:border-[#B85F4A]",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </section>
  );
}
