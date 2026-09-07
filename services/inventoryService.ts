"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  InventoryItem,
  InventoryItemConversion,
  InventoryItemType,
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
  item_type: InventoryItemType | null;
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

type InventoryItemConversionRow = {
  id: string;
  inventory_item_id: string;
  packaging_unit_name_ar: string;
  packaging_unit_name_en: string | null;
  quantity_in_base_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  requisition: { request_number: number; destination: InventoryMovement["destination"] } | null;
  waste_report: { report_number: number; destination: InventoryMovement["destination"] | null } | null;
  created_by_profile: { full_name: string } | null;
};

export type CreateInventoryItemInput = {
  nameAr: string;
  nameEn?: string;
  itemType: InventoryItemType;
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
  itemType: InventoryItemType;
  baseUnitId: string;
  minimumStock: number;
  isActive: boolean;
};

export type UpsertInventoryItemConversionInput = {
  id?: string;
  inventoryItemId: string;
  packagingUnitNameAr: string;
  packagingUnitNameEn?: string;
  quantityInBaseUnit: number;
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
    itemType: row.item_type ?? "operational_consumable",
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

function mapInventoryItemConversion(row: InventoryItemConversionRow): InventoryItemConversion {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    packagingUnitNameAr: row.packaging_unit_name_ar,
    packagingUnitNameEn: row.packaging_unit_name_en ?? undefined,
    quantityInBaseUnit: Number(row.quantity_in_base_unit),
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
    requisitionCode: row.requisition?.request_number ? `REQ-${String(row.requisition.request_number).padStart(4, "0")}` : undefined,
    wasteCode: row.waste_report?.report_number ? `WST-${String(row.waste_report.report_number).padStart(4, "0")}` : undefined,
    destination: row.requisition?.destination ?? row.waste_report?.destination ?? undefined,
    notes:
      row.movement_type === "consumption"
        ? (row.order?.order_number ? `استهلاك طلب #${row.order.order_number}` : "استهلاك طلب مطبخ")
        : row.movement_type === "stock_issue" && row.requisition?.request_number
          ? `صرف داخلي REQ-${String(row.requisition.request_number).padStart(4, "0")}`
          : row.movement_type === "waste" && row.waste_report?.report_number
            ? `هدر / تلف WST-${String(row.waste_report.report_number).padStart(4, "0")}`
          : row.notes ?? undefined,
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
  itemConversions: InventoryItemConversion[];
  movements: InventoryMovement[];
}> {
  const supabase = createClient();
  const [{ data: units, error: unitsError }, { data: items, error: itemsError }, { data: itemConversions, error: conversionsError }, { data: movements, error: movementsError }] =
    await Promise.all([
      supabase.from("inventory_units" as never).select("id, code, name_ar, name_en, unit_family, factor_to_base, is_base_unit, sort_order").order("sort_order", { ascending: true }),
      supabase
        .from("inventory_items" as never)
        .select("id, name_ar, name_en, item_type, base_unit_id, stock_on_hand, minimum_stock, average_cost, last_purchase_cost, is_active, created_at, updated_at, base_unit:inventory_units(code, name_ar)")
        .order("name_ar", { ascending: true }),
      supabase
        .from("inventory_item_conversions" as never)
        .select("id, inventory_item_id, packaging_unit_name_ar, packaging_unit_name_en, quantity_in_base_unit, is_active, created_at, updated_at")
        .eq("is_active" as never, true as never)
        .order("packaging_unit_name_ar", { ascending: true }),
      supabase
        .from("inventory_movements" as never)
        .select("id, inventory_item_id, movement_type, quantity_delta, quantity_before, quantity_after, unit_cost, total_cost, source_type, notes, created_at, inventory_item:inventory_items(name_ar, base_unit:inventory_units(code)), order:orders(order_number), requisition:inventory_requisitions(request_number, destination), waste_report:inventory_waste_reports(report_number, destination), created_by_profile:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

  throwIfError(unitsError);
  throwIfError(itemsError);
  throwIfError(conversionsError);
  throwIfError(movementsError);

  return {
    units: ((units ?? []) as unknown as UnitRow[]).map(mapUnit),
    items: ((items ?? []) as unknown as InventoryItemRow[]).map(mapInventoryItem),
    itemConversions: ((itemConversions ?? []) as unknown as InventoryItemConversionRow[]).map(mapInventoryItemConversion),
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
      item_type: input.itemType,
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
      item_type: input.itemType,
      base_unit_id: input.baseUnitId,
      minimum_stock: input.minimumStock,
      is_active: input.isActive,
    } as never)
    .eq("id" as never, input.id as never);

  throwIfError(error);
}

export async function upsertInventoryItemConversion(input: UpsertInventoryItemConversionInput): Promise<void> {
  const supabase = createClient();
  const payload = {
    inventory_item_id: input.inventoryItemId,
    packaging_unit_name_ar: input.packagingUnitNameAr.trim(),
    packaging_unit_name_en: input.packagingUnitNameEn?.trim() || null,
    quantity_in_base_unit: input.quantityInBaseUnit,
    is_active: true,
  };

  const query = input.id
    ? supabase.from("inventory_item_conversions" as never).update(payload as never).eq("id" as never, input.id as never)
    : supabase.from("inventory_item_conversions" as never).insert(payload as never);

  const { error } = await query;
  throwIfError(error);
}

export async function deactivateInventoryItemConversion(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("inventory_item_conversions" as never)
    .update({ is_active: false } as never)
    .eq("id" as never, id as never);

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
