"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type {
  InventoryRequisitionCatalogConversion,
  InventoryRequisitionCatalogItem,
  InventoryRequisitionDestination,
  InventoryItemType,
  InventoryUnit,
  InventoryUnitCode,
  InventoryUnitFamily,
  InventoryWasteCatalog,
  InventoryWasteContext,
  InventoryWasteIssuedItem,
  InventoryWasteReason,
  InventoryWasteReport,
  InventoryWasteReportItem,
  InventoryWasteStatus,
} from "@/types/inventory";

type ProfileNameRow = { full_name: string | null; username: string | null };

type WasteItemRow = {
  id: string;
  report_id: string;
  inventory_item_id: string;
  quantity: number | string;
  unit_id: string | null;
  conversion_id: string | null;
  unit_label: string;
  quantity_base: number | string;
  reason: InventoryWasteReason;
  notes: string | null;
  requisition_id: string | null;
  requisition_item_id: string | null;
  inventory_item: {
    name_ar: string;
    item_type: InventoryItemType;
    base_unit: { code: InventoryUnitCode; name_ar: string } | null;
  } | null;
  requisition: { request_number: number } | null;
};

type WasteReportRow = {
  id: string;
  report_number: number;
  context: InventoryWasteContext;
  destination: InventoryRequisitionDestination | null;
  status: InventoryWasteStatus;
  note: string | null;
  posted_at: string;
  posted_by_profile: ProfileNameRow | null;
  inventory_waste_items: WasteItemRow[] | null;
};

type CatalogPayload = {
  items?: {
    id: string;
    name_ar: string;
    item_type: InventoryRequisitionCatalogItem["itemType"];
    base_unit_id: string;
    base_unit_code: InventoryUnitCode;
    base_unit_name_ar: string;
    stock_on_hand: number | string;
  }[];
  issued_items?: {
    requisition_id: string;
    requisition_item_id: string;
    requisition_number: number;
    destination: InventoryRequisitionDestination;
    inventory_item_id: string;
    inventory_item_name_ar: string;
    base_unit_id: string;
    base_unit_code: InventoryUnitCode;
    base_unit_name_ar: string;
    issued_quantity_base: number | string;
    wasted_quantity_base: number | string;
    remaining_waste_base: number | string;
  }[];
  units?: {
    id: string;
    code: InventoryUnitCode;
    name_ar: string;
    name_en?: string | null;
    unit_family: InventoryUnitFamily;
    factor_to_base: number | string;
    is_base_unit: boolean;
    sort_order?: number;
  }[];
  conversions?: {
    id: string;
    inventory_item_id: string;
    packaging_unit_name_ar: string;
    quantity_in_base_unit: number | string;
  }[];
};

export type CreateInventoryWasteInput = {
  context: InventoryWasteContext;
  destination?: InventoryRequisitionDestination;
  note?: string;
  items: {
    inventoryItemId: string;
    quantity: number;
    unitId?: string;
    conversionId?: string;
    reason: InventoryWasteReason;
    notes?: string;
    requisitionId?: string;
    requisitionItemId?: string;
  }[];
};

const profileNameSelect = "full_name, username";
const wasteSelect = `id, report_number, context, destination, status, note, posted_at,
  posted_by_profile:profiles!inventory_waste_reports_posted_by_fkey(${profileNameSelect}),
  inventory_waste_items(id, report_id, inventory_item_id, quantity, unit_id, conversion_id, unit_label, quantity_base, reason, notes, requisition_id, requisition_item_id,
    inventory_item:inventory_items!inventory_waste_items_inventory_item_id_fkey(name_ar, item_type, base_unit:inventory_units(code, name_ar)),
    requisition:inventory_requisitions!inventory_waste_items_requisition_id_fkey(request_number))`;

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function profileName(profile: ProfileNameRow | null | undefined) {
  return profile?.full_name ?? profile?.username ?? "مستخدم غير معروف";
}

function requestCode(requestNumber: number) {
  return `REQ-${String(requestNumber).padStart(4, "0")}`;
}

function wasteCode(reportNumber: number) {
  return `WST-${String(reportNumber).padStart(4, "0")}`;
}

function rowToWasteItem(row: WasteItemRow): InventoryWasteReportItem {
  return {
    id: row.id,
    reportId: row.report_id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_item?.name_ar ?? "مادة غير معروفة",
    itemType: row.inventory_item?.item_type ?? "operational_consumable",
    baseUnitCode: row.inventory_item?.base_unit?.code ?? "piece",
    baseUnitName: row.inventory_item?.base_unit?.name_ar ?? "-",
    quantity: asNumber(row.quantity),
    unitId: row.unit_id ?? undefined,
    conversionId: row.conversion_id ?? undefined,
    unitLabel: row.unit_label,
    quantityBase: asNumber(row.quantity_base),
    reason: row.reason,
    notes: row.notes ?? undefined,
    requisitionId: row.requisition_id ?? undefined,
    requisitionItemId: row.requisition_item_id ?? undefined,
    requisitionCode: row.requisition?.request_number ? requestCode(row.requisition.request_number) : undefined,
  };
}

function rowToWasteReport(row: WasteReportRow): InventoryWasteReport {
  return {
    id: row.id,
    reportNumber: row.report_number,
    reportCode: wasteCode(row.report_number),
    context: row.context,
    destination: row.destination ?? undefined,
    status: row.status,
    note: row.note ?? undefined,
    postedByName: profileName(row.posted_by_profile),
    postedAt: row.posted_at,
    items: (row.inventory_waste_items ?? []).map(rowToWasteItem),
  };
}

function mapCatalog(payload: CatalogPayload | null): InventoryWasteCatalog {
  return {
    items: (payload?.items ?? []).map((item): InventoryRequisitionCatalogItem => ({
      id: item.id,
      nameAr: item.name_ar,
      itemType: item.item_type,
      baseUnitId: item.base_unit_id,
      baseUnitCode: item.base_unit_code,
      baseUnitName: item.base_unit_name_ar,
      stockOnHand: asNumber(item.stock_on_hand),
    })),
    issuedItems: (payload?.issued_items ?? []).map((item): InventoryWasteIssuedItem => ({
      requisitionId: item.requisition_id,
      requisitionItemId: item.requisition_item_id,
      requisitionCode: requestCode(item.requisition_number),
      destination: item.destination,
      inventoryItemId: item.inventory_item_id,
      inventoryItemName: item.inventory_item_name_ar,
      baseUnitId: item.base_unit_id,
      baseUnitCode: item.base_unit_code,
      baseUnitName: item.base_unit_name_ar,
      issuedQuantityBase: asNumber(item.issued_quantity_base),
      wastedQuantityBase: asNumber(item.wasted_quantity_base),
      remainingWasteBase: asNumber(item.remaining_waste_base),
    })),
    units: (payload?.units ?? []).map((unit): InventoryUnit => ({
      id: unit.id,
      code: unit.code,
      nameAr: unit.name_ar,
      nameEn: unit.name_en ?? undefined,
      family: unit.unit_family,
      factorToBase: asNumber(unit.factor_to_base),
      isBaseUnit: unit.is_base_unit,
      sortOrder: unit.sort_order ?? 0,
    })),
    conversions: (payload?.conversions ?? []).map((conversion): InventoryRequisitionCatalogConversion => ({
      id: conversion.id,
      inventoryItemId: conversion.inventory_item_id,
      packagingUnitNameAr: conversion.packaging_unit_name_ar,
      quantityInBaseUnit: asNumber(conversion.quantity_in_base_unit),
    })),
  };
}

export async function getInventoryWasteCatalog(context: InventoryWasteContext): Promise<InventoryWasteCatalog> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_inventory_waste_catalog" as never, { p_context: context } as never);

  if (error) {
    logSupabaseError("[inventory waste catalog RPC]", error);
    throw error;
  }

  return mapCatalog(data as CatalogPayload | null);
}

export async function getInventoryWasteReports(): Promise<InventoryWasteReport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory_waste_reports" as never)
    .select(wasteSelect)
    .order("posted_at", { ascending: false })
    .limit(120);

  if (error) {
    logSupabaseError("[inventory waste reports SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as WasteReportRow[]).map(rowToWasteReport);
}

export async function recordInventoryWaste(input: CreateInventoryWasteInput): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("record_inventory_waste" as never, {
    p_context: input.context,
    p_destination: input.destination ?? null,
    p_note: clean(input.note),
    p_items: input.items.map((item) => ({
      inventory_item_id: item.inventoryItemId,
      quantity: item.quantity,
      unit_id: item.unitId ?? null,
      conversion_id: item.conversionId ?? null,
      reason: item.reason,
      notes: clean(item.notes),
      requisition_id: item.requisitionId ?? null,
      requisition_item_id: item.requisitionItemId ?? null,
    })),
  } as never);

  if (error) {
    logSupabaseError("[inventory waste record RPC]", error);
    throw error;
  }

  const id = (data as { waste_report_id?: string } | null)?.waste_report_id;
  if (!id) throw new Error("لم يرجع Supabase معرف تقرير الهدر");
  return id;
}
