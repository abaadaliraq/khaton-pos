import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/captain/ProductCard";
import type { MenuItem } from "@/types/pos";

type ProductGridProps = {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
  isDisabled: boolean;
};

export function ProductGrid({ items, onAdd, isDisabled }: ProductGridProps) {
  if (items.length === 0) {
    return (
      <div className="captain-empty-state flex min-h-64 flex-col items-center justify-center text-center">
        <SearchX size={32} />
        <p className="mt-3 font-medium">لا توجد أصناف مطابقة</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <ProductCard key={item.id} item={item} onAdd={onAdd} isDisabled={isDisabled} />
      ))}
    </div>
  );
}
