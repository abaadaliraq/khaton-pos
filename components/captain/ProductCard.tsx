import { ImageOff, Plus } from "lucide-react";
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
  const futureImageUrl = (item as MenuItem & { imageUrl?: string }).imageUrl;
  const initials = item.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <article className="captain-product-card grid min-h-44 grid-rows-[auto_1fr_auto] overflow-hidden p-3">
      <div
        className="captain-menu-visual mb-3 flex h-20 items-center justify-center rounded-lg"
        style={futureImageUrl ? { backgroundImage: `url(${futureImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {futureImageUrl ? (
          <span className="sr-only">{item.name}</span>
        ) : (
          <div className="flex items-center gap-2 text-[#4b4035]">
            <ImageOff size={18} />
            <span className="text-lg font-black">{initials || "صنف"}</span>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="captain-heading line-clamp-2 text-base font-black leading-6">{item.name}</h3>
        {item.description ? <p className="captain-muted mt-1 line-clamp-2 text-sm leading-6">{item.description}</p> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="captain-accent text-sm font-black">
          {isPriced ? formatCurrency(item.price) : "السعر غير محدد"}
        </span>
        <button
          type="button"
          onClick={() => onAdd(item)}
          disabled={!canAdd}
          className="captain-primary-button inline-flex h-11 min-w-24 items-center gap-2 px-3 text-sm font-black"
        >
          <Plus size={17} />
          إضافة
        </button>
      </div>
    </article>
  );
}
