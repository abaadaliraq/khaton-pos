"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryUnit,
  InventoryUnitCode,
  InventoryUnitFamily,
} from "@/types/inventory";

type SupabaseError = { message: string };

type UnitRow = {
  id: string;
  code: InventoryUnitCode;
  name_ar: string;
  name_en: string | null;
  unit_family: InventoryUnitFamily;
  factor_to_base: number;
  is_base_unit: boolean;
  sort_order: number;
};

type InventoryItemRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
  base_unit_id: string;
  stock_on_hand: number;
  minimum_stock: number;
  average_cost: number;
  last_purchase_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  base_unit: Pick<UnitRow, "code" | "name_ar"> | null;
};

type MovementRow = {
  id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number;
  total_cost: number;
  source_type: string | null;
  notes: string | null;
  created_at: string;
  inventory_item: {
    name_ar: string;
    base_unit: Pick<UnitRow, "code"> | null;
  } | null;
  order: { order_number: number } | null;
  created_by_profile: { full_name: string } | null;
};

export type CreateInventoryItemInput = {
  nameAr: string;
  nameEn?: string;
  baseUnitId: string;
  minimumStock: number;
  openingBalance?: {
    quantity: number;
    unitId: string;
    unitCost?: number;
    notes?: string;
  };
};

export type UpdateInventoryItemInput = {
  id: string;
  nameAr: string;
  nameEn?: string;
  baseUnitId: string;
  minimumStock: number;
  isActive: boolean;
};

export type AdjustInventoryInput = {
  itemId: string;
  quantityDelta: number;
  unitId: string;
  notes: string;
};

function mapUnit(row: UnitRow): InventoryUnit {
  return {
    id: row.id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en ?? undefined,
    family: row.unit_family,
    factorToBase: Number(row.factor_to_base),
    isBaseUnit: row.is_base_unit,
    sortOrder: row.sort_order,
  };
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en ?? undefined,
    baseUnitId: row.base_unit_id,
    baseUnitCode: row.base_unit?.code ?? "piece",
    baseUnitName: row.base_unit?.name_ar ?? "-",
    stockOnHand: Number(row.stock_on_hand),
    minimumStock: Number(row.minimum_stock),
    averageCost: Number(row.average_cost),
    lastPurchaseCost: Number(row.last_purchase_cost),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMovement(row: MovementRow): InventoryMovement {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_item?.name_ar ?? "مادة غير معروفة",
    baseUnitCode: row.inventory_item?.base_unit?.code ?? "piece",
    movementType: row.movement_type,
    quantityDelta: Number(row.quantity_delta),
    quantityBefore: Number(row.quantity_before),
    quantityAfter: Number(row.quantity_after),
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    sourceType: row.source_type ?? undefined,
    orderNumber: row.order?.order_number ?? undefined,
    notes: row.movement_type === "consumption" ? (row.order?.order_number ? `استهلاك طلب #${row.order.order_number}` : "استهلاك طلب مطبخ") : row.notes ?? undefined,
    createdByName: row.created_by_profile?.full_name ?? undefined,
    createdAt: row.created_at,
  };
}

function throwIfError(error: SupabaseError | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function getInventoryOverview(): Promise<{
  units: InventoryUnit[];
  items: InventoryItem[];
  movements: InventoryMovement[];
}> {
  const supabase = createClient();
  const [{ data: units, error: unitsError }, { data: items, error: itemsError }, { data: movements, error: movementsError }] =
    await Promise.all([
      supabase.from("inventory_units" as never).select("id, code, name_ar, name_en, unit_family, factor_to_base, is_base_unit, sort_order").order("sort_order", { ascending: true }),
      supabase
        .from("inventory_items" as never)
        .select("id, name_ar, name_en, base_unit_id, stock_on_hand, minimum_stock, average_cost, last_purchase_cost, is_active, created_at, updated_at, base_unit:inventory_units(code, name_ar)")
        .order("name_ar", { ascending: true }),
      supabase
        .from("inventory_movements" as never)
        .select("id, inventory_item_id, movement_type, quantity_delta, quantity_before, quantity_after, unit_cost, total_cost, source_type, notes, created_at, inventory_item:inventory_items(name_ar, base_unit:inventory_units(code)), order:orders(order_number), created_by_profile:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

  throwIfError(unitsError);
  throwIfError(itemsError);
  throwIfError(movementsError);

  return {
    units: ((units ?? []) as unknown as UnitRow[]).map(mapUnit),
    items: ((items ?? []) as unknown as InventoryItemRow[]).map(mapInventoryItem),
    movements: ((movements ?? []) as unknown as MovementRow[]).map(mapMovement),
  };
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory_items" as never)
    .insert({
      name_ar: input.nameAr.trim(),
      name_en: input.nameEn?.trim() || null,
      base_unit_id: input.baseUnitId,
      minimum_stock: input.minimumStock,
    } as never)
    .select("id")
    .single();

  throwIfError(error);

  const itemId = (data as unknown as { id: string }).id;

  if (input.openingBalance && input.openingBalance.quantity > 0) {
    const { error: openingError } = await supabase.rpc("set_inventory_opening_balance" as never, {
      p_inventory_item_id: itemId,
      p_quantity: input.openingBalance.quantity,
      p_unit_id: input.openingBalance.unitId,
      p_unit_cost: input.openingBalance.unitCost ?? 0,
      p_notes: input.openingBalance.notes ?? "رصيد افتتاحي من واجهة المخزن",
    } as never);

    throwIfError(openingError);
  }
}

export async function updateInventoryItem(input: UpdateInventoryItemInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("inventory_items" as never)
    .update({
      name_ar: input.nameAr.trim(),
      name_en: input.nameEn?.trim() || null,
      base_unit_id: input.baseUnitId,
      minimum_stock: input.minimumStock,
      is_active: input.isActive,
    } as never)
    .eq("id" as never, input.id as never);

  throwIfError(error);
}

export async function adjustInventoryStock(input: AdjustInventoryInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("adjust_inventory_stock" as never, {
    p_inventory_item_id: input.itemId,
    p_quantity_delta: input.quantityDelta,
    p_unit_id: input.unitId,
    p_notes: input.notes,
  } as never);

  throwIfError(error);
}
