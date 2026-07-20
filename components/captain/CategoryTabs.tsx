import clsx from "clsx";
import type { Category } from "@/types/pos";

type CategoryTabsProps = {
  categories: Category[];
  activeCategory: string;
  onChange: (categoryId: string) => void;
};

export function CategoryTabs({ categories, activeCategory, onChange }: CategoryTabsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 py-1">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            className={clsx(
              "rounded-lg border px-4 py-2 text-sm font-medium transition",
              activeCategory === category.id
                ? "border-[#4c5a35] bg-[#4c5a35] text-white shadow-sm"
                : "border-stone-200 bg-white text-stone-700 hover:border-[#4c5a35]/50",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
