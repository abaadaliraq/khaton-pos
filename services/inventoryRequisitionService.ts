"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type {
  InventoryItemType,
  InventoryRequisition,
  InventoryRequisitionCatalog,
  InventoryRequisitionCatalogConversion,
  InventoryRequisitionCatalogItem,
  InventoryRequisitionDestination,
  InventoryRequisitionItem,
  InventoryRequisitionItemStatus,
  InventoryRequisitionStatus,
  InventoryUnit,
  InventoryUnitCode,
  InventoryUnitFamily,
} from "@/types/inventory";

type ProfileNameRow = { full_name: string; username: string };

type RequisitionItemRow = {
  id: string;
  requisition_id: string;
  inventory_item_id: string;
  requested_quantity: number | string;
  requested_unit_id: string | null;
  requested_conversion_id: string | null;
  requested_unit_label: string;
  requested_quantity_base: number | string;
  approved_quantity_base: number | string | null;
  issued_quantity_base: number | string | null;
  status: InventoryRequisitionItemStatus;
  notes: string | null;
  inventory_item: {
    name_ar: string;
    stock_on_hand: number | string;
    base_unit: { code: InventoryUnitCode; name_ar: string } | null;
  } | null;
};

type RequisitionRow = {
  id: string;
  request_number: number;
  destination: InventoryRequisitionDestination;
  status: InventoryRequisitionStatus;
  note: string | null;
  rejection_reason: string | null;
  requested_by: string;
  requested_at: string;
  approved_at: string | null;
  issued_at: string | null;
  received_at: string | null;
  rejected_at: string | null;
  requested_by_profile: ProfileNameRow | null;
  approved_by_profile: ProfileNameRow | null;
  issued_by_profile: ProfileNameRow | null;
  received_by_profile: ProfileNameRow | null;
  rejected_by_profile: ProfileNameRow | null;
  inventory_requisition_items: RequisitionItemRow[] | null;
};

type CatalogPayload = {
  items?: {
    id: string;
    name_ar: string;
    item_type: InventoryItemType;
    base_unit_id: string;
    base_unit_code: InventoryUnitCode;
    base_unit_name_ar: string;
    stock_on_hand: number | string;
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

export type CreateInventoryRequisitionInput = {
  destination: InventoryRequisitionDestination;
  note?: string;
  items: {
    inventoryItemId: string;
    quantity: number;
    unitId?: string;
    conversionId?: string;
    notes?: string;
  }[];
};

export type ApproveInventoryRequisitionInput = {
  requisitionId: string;
  items: {
    itemId: string;
    approvedQuantityBase?: number;
    rejected?: boolean;
  }[];
};

const profileNameSelect = "full_name, username";
const requisitionSelect = `id, request_number, destination, status, note, rejection_reason, requested_by, requested_at, approved_at, issued_at, received_at, rejected_at,
  requested_by_profile:profiles!inventory_requisitions_requested_by_fkey(${profileNameSelect}),
  approved_by_profile:profiles!inventory_requisitions_approved_by_fkey(${profileNameSelect}),
  issued_by_profile:profiles!inventory_requisitions_issued_by_fkey(${profileNameSelect}),
  received_by_profile:profiles!inventory_requisitions_received_by_fkey(${profileNameSelect}),
  rejected_by_profile:profiles!inventory_requisitions_rejected_by_fkey(${profileNameSelect}),
  inventory_requisition_items(id, requisition_id, inventory_item_id, requested_quantity, requested_unit_id, requested_conversion_id, requested_unit_label, requested_quantity_base, approved_quantity_base, issued_quantity_base, status, notes,
    inventory_item:inventory_items!inventory_requisition_items_inventory_item_id_fkey(name_ar, stock_on_hand, base_unit:inventory_units(code, name_ar)))`;

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function profileName(profile: ProfileNameRow | null | undefined) {
  return profile?.full_name ?? profile?.username ?? undefined;
}

function requestCode(requestNumber: number) {
  return `REQ-${String(requestNumber).padStart(4, "0")}`;
}

function rowToRequisitionItem(row: RequisitionItemRow): InventoryRequisitionItem {
  return {
    id: row.id,
    requisitionId: row.requisition_id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_item?.name_ar ?? "مادة غير معروفة",
    baseUnitCode: row.inventory_item?.base_unit?.code ?? "piece",
    baseUnitName: row.inventory_item?.base_unit?.name_ar ?? "-",
    stockOnHand: asNumber(row.inventory_item?.stock_on_hand),
    requestedQuantity: asNumber(row.requested_quantity),
    requestedUnitId: row.requested_unit_id ?? undefined,
    requestedConversionId: row.requested_conversion_id ?? undefined,
    requestedUnitLabel: row.requested_unit_label,
    requestedQuantityBase: asNumber(row.requested_quantity_base),
    approvedQuantityBase: row.approved_quantity_base === null ? undefined : asNumber(row.approved_quantity_base),
    issuedQuantityBase: row.issued_quantity_base === null ? undefined : asNumber(row.issued_quantity_base),
    status: row.status,
    notes: row.notes ?? undefined,
  };
}

function rowToRequisition(row: RequisitionRow): InventoryRequisition {
  return {
    id: row.id,
    requestNumber: row.request_number,
    requestCode: requestCode(row.request_number),
    destination: row.destination,
    status: row.status,
    note: row.note ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    requestedBy: row.requested_by,
    requestedByName: profileName(row.requested_by_profile) ?? "مستخدم غير معروف",
    requestedAt: row.requested_at,
    approvedByName: profileName(row.approved_by_profile),
    approvedAt: row.approved_at ?? undefined,
    issuedByName: profileName(row.issued_by_profile),
    issuedAt: row.issued_at ?? undefined,
    receivedByName: profileName(row.received_by_profile),
    receivedAt: row.received_at ?? undefined,
    rejectedByName: profileName(row.rejected_by_profile),
    rejectedAt: row.rejected_at ?? undefined,
    items: (row.inventory_requisition_items ?? []).map(rowToRequisitionItem),
  };
}

function mapCatalog(payload: CatalogPayload | null): InventoryRequisitionCatalog {
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

export async function getInventoryRequisitionCatalog(): Promise<InventoryRequisitionCatalog> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_inventory_requisition_catalog" as never);

  if (error) {
    logSupabaseError("[inventory requisition catalog RPC]", error);
    throw error;
  }

  return mapCatalog(data as CatalogPayload | null);
}

export async function getInventoryRequisitions(): Promise<InventoryRequisition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory_requisitions" as never)
    .select(requisitionSelect)
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    logSupabaseError("[inventory requisitions SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as RequisitionRow[]).map(rowToRequisition);
}

export async function createInventoryRequisition(input: CreateInventoryRequisitionInput): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_inventory_requisition" as never, {
    p_destination: input.destination,
    p_note: clean(input.note),
    p_items: input.items.map((item) => ({
      inventory_item_id: item.inventoryItemId,
      quantity: item.quantity,
      unit_id: item.unitId ?? null,
      conversion_id: item.conversionId ?? null,
      notes: clean(item.notes),
    })),
  } as never);

  if (error) {
    logSupabaseError("[inventory requisition create RPC]", error);
    throw error;
  }

  const id = (data as { requisition_id?: string } | null)?.requisition_id;
  if (!id) throw new Error("لم يرجع Supabase معرف طلب المواد");
  return id;
}

export async function approveInventoryRequisition(input: ApproveInventoryRequisitionInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_inventory_requisition" as never, {
    p_requisition_id: input.requisitionId,
    p_items: input.items.map((item) => ({
      item_id: item.itemId,
      approved_quantity_base: item.approvedQuantityBase ?? null,
      rejected: Boolean(item.rejected),
    })),
  } as never);

  if (error) {
    logSupabaseError("[inventory requisition approve RPC]", error);
    throw error;
  }
}

export async function rejectInventoryRequisition(requisitionId: string, reason: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("reject_inventory_requisition" as never, {
    p_requisition_id: requisitionId,
    p_rejection_reason: reason,
  } as never);

  if (error) {
    logSupabaseError("[inventory requisition reject RPC]", error);
    throw error;
  }
}

export async function cancelInventoryRequisition(requisitionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_inventory_requisition" as never, {
    p_requisition_id: requisitionId,
  } as never);

  if (error) {
    logSupabaseError("[inventory requisition cancel RPC]", error);
    throw error;
  }
}

export async function issueInventoryRequisition(requisitionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("issue_inventory_requisition" as never, {
    p_requisition_id: requisitionId,
  } as never);

  if (error) {
    logSupabaseError("[inventory requisition issue RPC]", error);
    throw error;
  }
}

export async function confirmInventoryRequisitionReceipt(requisitionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("confirm_inventory_requisition_receipt" as never, {
    p_requisition_id: requisitionId,
  } as never);

  if (error) {
    logSupabaseError("[inventory requisition receipt RPC]", error);
    throw error;
  }
}
