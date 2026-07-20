"use client";

import { createClient } from "@/lib/supabase/client";
import type { Category, MenuItem } from "@/types/pos";

type MenuCategoryRow = {
  id: string;
  name_ar: string;
  sort_order: number;
};

type MenuItemRow = {
  id: string;
  category_id: string;
  name_ar: string;
  description_ar: string | null;
  price: number | null;
  is_available: boolean;
  sort_order: number;
};

export async function getMenuCatalog(): Promise<{ categories: Category[]; menuItems: MenuItem[] }> {
  const supabase = createClient();
  const [{ data: categoriesData, error: categoriesError }, { data: itemsData, error: itemsError }] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name_ar, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name_ar, description_ar, price, is_available, sort_order")
      .order("sort_order", { ascending: true }),
  ]);

  if (categoriesError) {
    throw categoriesError;
  }

  if (itemsError) {
    throw itemsError;
  }

  return {
    categories: [
      { id: "all", name: "الكل" },
      ...((categoriesData ?? []) as MenuCategoryRow[]).map((category) => ({
        id: category.id,
        name: category.name_ar,
      })),
    ],
    menuItems: ((itemsData ?? []) as MenuItemRow[]).map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      name: item.name_ar,
      description: item.description_ar ?? undefined,
      price: item.is_available && item.price !== null ? item.price : 0,
    })),
  };
}
