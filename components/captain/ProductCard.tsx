import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { MenuItem } from "@/types/pos";

type ProductCardProps = {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  isDisabled: boolean;
};

export function ProductCard({ item, onAdd, isDisabled }: ProductCardProps) {
  const isPriced = item.price > 0;
  const canAdd = isPriced && !isDisabled;

  return (
    <article className="captain-product-card flex min-h-40 flex-col justify-between p-4">
      <div>
        <h3 className="captain-heading text-base font-bold">{item.name}</h3>
        {item.description ? <p className="captain-muted mt-2 line-clamp-2 text-sm leading-6">{item.description}</p> : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="captain-accent text-sm font-bold">
          {isPriced ? formatCurrency(item.price) : "السعر غير محدد"}
        </span>
        <button
          type="button"
          onClick={() => onAdd(item)}
          disabled={!canAdd}
          className="captain-primary-button inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold"
        >
          <Plus size={17} />
          إضافة
        </button>
      </div>
    </article>
  );
}
