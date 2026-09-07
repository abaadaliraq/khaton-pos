import clsx from "clsx";
import { Search, X } from "lucide-react";
import type { KitchenFilter } from "@/types/kitchen";

type BaristaToolbarProps = {
  searchTerm: string;
  filter: KitchenFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: KitchenFilter) => void;
};

const filters: { id: KitchenFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "normal", label: "عادي" },
  { id: "late", label: "متأخر" },
  { id: "priority", label: "أولوية" },
];

export function BaristaToolbar({ searchTerm, filter, onSearchChange, onFilterChange }: BaristaToolbarProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#24211E] p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#C9BEB2]" size={19} />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ابحث برقم الطاولة أو الطلب..."
            className="h-12 w-full rounded-lg border border-white/10 bg-[#171513] pr-11 pl-12 text-base text-[#FFF8EE] outline-none placeholder:text-[#756d65] focus:border-[#D88A3D]"
          />
          {searchTerm ? (
            <button type="button" onClick={() => onSearchChange("")} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#C9BEB2] hover:bg-[#302B27]" aria-label="مسح البحث">
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
                  ? "border-[#D88A3D] bg-[#D88A3D] text-[#171513]"
                  : "border-white/10 bg-[#302B27] text-[#FFF8EE] hover:border-[#D88A3D]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
