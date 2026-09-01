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
            data-active={activeCategory === category.id}
            className={clsx("captain-category-tab rounded-lg border px-4 py-2 text-sm font-medium transition")}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
