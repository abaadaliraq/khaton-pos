import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { MenuItem } from "@/types/pos";

type ProductCardProps = {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
};

export function ProductCard({ item, onAdd }: ProductCardProps) {
  const isPriced = item.price > 0;

  return (
    <article className="flex min-h-40 flex-col justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-base font-bold text-stone-950">{item.name}</h3>
        {item.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{item.description}</p> : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#4c5a35]">
          {isPriced ? formatCurrency(item.price) : "السعر غير محدد"}
        </span>
        <button
          type="button"
          onClick={() => onAdd(item)}
          disabled={!isPriced}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4c5a35] px-3 text-sm font-semibold text-white transition hover:bg-[#394427] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
        >
          <Plus size={17} />
          إضافة
        </button>
      </div>
    </article>
  );
}
