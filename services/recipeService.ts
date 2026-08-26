"use client";

import { createClient } from "@/lib/supabase/client";
import type { ActiveRecipe, InventoryItem, InventoryUnit, RecipeItem, RecipeSummary } from "@/types/inventory";

type SupabaseError = { message: string };

type MenuItemRow = {
  id: string;
  name_ar: string;
  price: number | null;
  inventory_tracking_enabled: boolean;
  is_available: boolean;
  sort_order: number;
};

type RecipeRow = {
  id: string;
  menu_item_id: string;
  version: number;
  is_active: boolean;
  yield_quantity: number;
  recipe_items: RecipeItemRow[];
};

type RecipeItemRow = {
  id: string;
  recipe_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_id: string;
  waste_percent: number;
  unit: {
    code: InventoryUnit["code"];
    unit_family: InventoryUnit["family"];
    factor_to_base: number;
  } | null;
  inventory_item: {
    id: string;
    name_ar: string;
    base_unit_id: string;
    average_cost: number;
    base_unit: {
      code: InventoryUnit["code"];
      unit_family: InventoryUnit["family"];
      factor_to_base: number;
    } | null;
  } | null;
};

type RecipeInventoryBaseUnit = NonNullable<RecipeItemRow["inventory_item"]>["base_unit"];

export type RecipeItemInput = {
  recipeId: string;
  inventoryItemId: string;
  quantity: number;
  unitId: string;
  wastePercent: number;
};

function throwIfError(error: SupabaseError | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function convertToBase(quantity: number, unit: RecipeItemRow["unit"], baseUnit: RecipeInventoryBaseUnit) {
  if (!unit || !baseUnit || unit.unit_family !== baseUnit.unit_family) {
    return 0;
  }

  return (quantity * Number(unit.factor_to_base)) / Number(baseUnit.factor_to_base);
}

function calculateRecipeCost(items: RecipeItemRow[]) {
  return items.reduce((total, item) => {
    const inventoryItem = item.inventory_item;
    if (!inventoryItem) {
      return total;
    }

    const quantityWithWaste = Number(item.quantity) * (1 + Number(item.waste_percent) / 100);
    const baseQuantity = convertToBase(quantityWithWaste, item.unit, inventoryItem.base_unit);
    return total + baseQuantity * Number(inventoryItem.average_cost);
  }, 0);
}

function mapRecipeItem(row: RecipeItemRow): RecipeItem {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_item?.name_ar ?? "مادة غير معروفة",
    inventoryBaseUnitId: row.inventory_item?.base_unit_id ?? "",
    inventoryBaseUnitCode: row.inventory_item?.base_unit?.code ?? "piece",
    quantity: Number(row.quantity),
    unitId: row.unit_id,
    unitCode: row.unit?.code ?? "piece",
    wastePercent: Number(row.waste_percent),
  };
}

export async function getRecipeSummaries(): Promise<RecipeSummary[]> {
  const supabase = createClient();
  const [{ data: menuItems, error: menuError }, { data: recipes, error: recipeError }] = await Promise.all([
    supabase.from("menu_items" as never).select("id, name_ar, price, inventory_tracking_enabled, is_available, sort_order").order("sort_order", { ascending: true }),
    supabase
      .from("recipes" as never)
      .select(
        "id, menu_item_id, version, is_active, yield_quantity, recipe_items(id, recipe_id, inventory_item_id, quantity, unit_id, waste_percent, unit:inventory_units(code, unit_family, factor_to_base), inventory_item:inventory_items(id, name_ar, base_unit_id, average_cost, base_unit:inventory_units(code, unit_family, factor_to_base)))",
      )
      .eq("is_active" as never, true as never),
  ]);

  throwIfError(menuError);
  throwIfError(recipeError);

  const recipeByMenuItemId = new Map(((recipes ?? []) as unknown as RecipeRow[]).map((recipe) => [recipe.menu_item_id, recipe]));

  return ((menuItems ?? []) as MenuItemRow[]).map((menuItem) => {
    const recipe = recipeByMenuItemId.get(menuItem.id);
    return {
      recipeId: recipe?.id,
      menuItemId: menuItem.id,
      menuItemName: menuItem.name_ar,
      sellingPrice: Number(menuItem.price ?? 0),
      version: recipe?.version,
      isActive: Boolean(recipe),
      ingredientCount: recipe?.recipe_items.length ?? 0,
      estimatedCost: recipe ? calculateRecipeCost(recipe.recipe_items) : 0,
      inventoryTrackingEnabled: menuItem.inventory_tracking_enabled,
    };
  });
}

export async function updateMenuItemInventoryTracking(menuItemId: string, enabled: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_menu_item_inventory_tracking" as never, {
    p_menu_item_id: menuItemId,
    p_enabled: enabled,
  } as never);

  throwIfError(error);
}

export async function getOrCreateActiveRecipe(menuItemId: string): Promise<string> {
  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from("recipes" as never)
    .select("id")
    .eq("menu_item_id" as never, menuItemId as never)
    .eq("is_active" as never, true as never)
    .maybeSingle();

  throwIfError(existingError);

  if (existing) {
    return (existing as unknown as { id: string }).id;
  }

  const { data: created, error: createError } = await supabase
    .from("recipes" as never)
    .insert({ menu_item_id: menuItemId, version: 1, is_active: true, yield_quantity: 1 } as never)
    .select("id")
    .single();

  throwIfError(createError);
  return (created as unknown as { id: string }).id;
}

export async function getActiveRecipe(menuItemId: string): Promise<ActiveRecipe | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recipes" as never)
    .select(
      "id, menu_item_id, version, is_active, yield_quantity, recipe_items(id, recipe_id, inventory_item_id, quantity, unit_id, waste_percent, unit:inventory_units(code, unit_family, factor_to_base), inventory_item:inventory_items(id, name_ar, base_unit_id, average_cost, base_unit:inventory_units(code, unit_family, factor_to_base))), menu_item:menu_items(name_ar, price)",
    )
    .eq("menu_item_id" as never, menuItemId as never)
    .eq("is_active" as never, true as never)
    .maybeSingle();

  throwIfError(error);

  if (!data) {
    return null;
  }

  const recipe = data as unknown as RecipeRow & { menu_item: { name_ar: string; price: number | null } | null };
  return {
    id: recipe.id,
    menuItemId: recipe.menu_item_id,
    menuItemName: recipe.menu_item?.name_ar ?? "صنف غير معروف",
    sellingPrice: Number(recipe.menu_item?.price ?? 0),
    version: recipe.version,
    yieldQuantity: Number(recipe.yield_quantity),
    items: recipe.recipe_items.map(mapRecipeItem),
    estimatedCost: calculateRecipeCost(recipe.recipe_items),
  };
}

export async function upsertRecipeItem(input: RecipeItemInput & { id?: string }): Promise<void> {
  const supabase = createClient();

  if (input.id) {
    const { error } = await supabase
      .from("recipe_items" as never)
      .update({
        inventory_item_id: input.inventoryItemId,
        quantity: input.quantity,
        unit_id: input.unitId,
        waste_percent: input.wastePercent,
      } as never)
      .eq("id" as never, input.id as never);

    throwIfError(error);
    return;
  }

  const { error } = await supabase.from("recipe_items" as never).insert({
    recipe_id: input.recipeId,
    inventory_item_id: input.inventoryItemId,
    quantity: input.quantity,
    unit_id: input.unitId,
    waste_percent: input.wastePercent,
  } as never);

  throwIfError(error);
}

export async function deleteRecipeItem(recipeItemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("recipe_items" as never).delete().eq("id" as never, recipeItemId as never);
  throwIfError(error);
}

export function getCompatibleUnits(item: InventoryItem, units: InventoryUnit[]) {
  const baseUnit = units.find((unit) => unit.id === item.baseUnitId);
  if (!baseUnit) {
    return units.filter((unit) => unit.code === item.baseUnitCode);
  }

  return units.filter((unit) => unit.family === baseUnit.family);
}
