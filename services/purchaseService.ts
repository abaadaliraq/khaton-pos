"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type {
  CreatePurchaseInput,
  CreatePurchaseRequestInput,
  CreateSupplierInput,
  PayPurchaseInput,
  Purchase,
  PurchaseDecisionInput,
  PurchaseItem,
  PurchasePayment,
  PurchasePaymentStatus,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
  Supplier,
} from "@/types/finance";

type ProfileNameRow = { full_name: string; username: string };

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type PurchaseRequestItemRow = {
  id: string;
  inventory_item_id: string;
  quantity: number | string;
  unit_id: string;
  notes: string | null;
  inventory_item: { name_ar: string } | null;
  unit: { code: string } | null;
};

type PurchaseRequestRow = {
  id: string;
  request_number: number;
  status: PurchaseRequestStatus;
  notes: string | null;
  decision_notes: string | null;
  requested_by: string;
  requested_by_profile: ProfileNameRow | null;
  decided_by: string | null;
  decided_by_profile: ProfileNameRow | null;
  decided_at: string | null;
  received_by: string | null;
  received_by_profile: ProfileNameRow | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  purchase_request_items: PurchaseRequestItemRow[] | null;
};

type PurchaseItemRow = {
  id: string;
  inventory_item_id: string;
  quantity: number | string;
  unit_id: string;
  unit_price: number | string;
  line_total: number | string;
  quantity_base: number | string;
  unit_cost_base: number | string;
  inventory_item: { name_ar: string } | null;
  unit: { code: string } | null;
};

type PurchaseRow = {
  id: string;
  purchase_number: number;
  purchase_request_id: string | null;
  purchase_request: { request_number: number } | null;
  supplier_id: string;
  supplier_invoice_number: string | null;
  supplier_invoice_date: string | null;
  total_amount: number | string;
  payment_status: PurchasePaymentStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  supplier: { name: string } | null;
  created_by_profile: ProfileNameRow | null;
  purchase_items: PurchaseItemRow[] | null;
};

type PurchasePaymentRow = {
  id: string;
  payment_number: number | null;
  purchase_id: string;
  amount: number | string;
  payment_method: PurchasePayment["paymentMethod"];
  reference_number: string | null;
  notes: string | null;
  paid_by: string;
  created_at: string;
  paid_by_profile: ProfileNameRow | null;
  purchase: {
    purchase_number: number;
    supplier_invoice_number: string | null;
    supplier_invoice_date: string | null;
    created_at: string;
    notes: string | null;
    supplier: { name: string } | null;
    created_by_profile: ProfileNameRow | null;
  } | null;
};

const profileNameSelect = "full_name, username";
const supplierSelect = "id, name, phone, address, notes, is_active, created_by, created_at, updated_at";
const requestSelect = `id, request_number, status, notes, decision_notes, requested_by, decided_by, decided_at, received_by, received_at, created_at, updated_at,
  requested_by_profile:profiles!purchase_requests_requested_by_fkey(${profileNameSelect}),
  decided_by_profile:profiles!purchase_requests_decided_by_fkey(${profileNameSelect}),
  received_by_profile:profiles!purchase_requests_received_by_fkey(${profileNameSelect}),
  purchase_request_items(id, inventory_item_id, quantity, unit_id, notes, inventory_item:inventory_items!purchase_request_items_inventory_item_id_fkey(name_ar), unit:inventory_units!purchase_request_items_unit_id_fkey(code))`;
const purchaseSelect = `id, purchase_number, purchase_request_id, supplier_id, supplier_invoice_number, supplier_invoice_date, total_amount, payment_status, notes, created_by, created_at,
  purchase_request:purchase_requests!purchases_purchase_request_id_fkey(request_number),
  supplier:suppliers!purchases_supplier_id_fkey(name),
  created_by_profile:profiles!purchases_created_by_fkey(${profileNameSelect}),
  purchase_items(id, inventory_item_id, quantity, unit_id, unit_price, line_total, quantity_base, unit_cost_base, inventory_item:inventory_items!purchase_items_inventory_item_id_fkey(name_ar), unit:inventory_units!purchase_items_unit_id_fkey(code))`;
const paymentSelect = `id, payment_number, purchase_id, amount, payment_method, reference_number, notes, paid_by, created_at,
  paid_by_profile:profiles!purchase_payments_paid_by_fkey(${profileNameSelect}),
  purchase:purchases!purchase_payments_purchase_id_fkey(purchase_number, supplier_invoice_number, supplier_invoice_date, created_at, notes, supplier:suppliers!purchases_supplier_id_fkey(name), created_by_profile:profiles!purchases_created_by_fkey(${profileNameSelect}))`;

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileName(profile: ProfileNameRow | null) {
  return profile?.full_name ?? profile?.username ?? "مستخدم غير معروف";
}

function rowToSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRequestItem(row: PurchaseRequestItemRow): PurchaseRequestItem {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_item?.name_ar ?? "مادة غير معروفة",
    quantity: asNumber(row.quantity),
    unitId: row.unit_id,
    unitCode: row.unit?.code ?? "-",
    notes: row.notes,
  };
}

function rowToPurchaseRequest(row: PurchaseRequestRow): PurchaseRequest {
  return {
    id: row.id,
    requestNumber: row.request_number,
    status: row.status,
    notes: row.notes,
    decisionNotes: row.decision_notes,
    requestedBy: row.requested_by,
    requestedByName: profileName(row.requested_by_profile),
    decidedBy: row.decided_by,
    decidedByName: row.decided_by_profile ? profileName(row.decided_by_profile) : null,
    decidedAt: row.decided_at,
    receivedBy: row.received_by,
    receivedByName: row.received_by_profile ? profileName(row.received_by_profile) : null,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.purchase_request_items ?? []).map(rowToRequestItem),
  };
}

function rowToPurchaseItem(row: PurchaseItemRow): PurchaseItem {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_item?.name_ar ?? "مادة غير معروفة",
    quantity: asNumber(row.quantity),
    unitId: row.unit_id,
    unitCode: row.unit?.code ?? "-",
    unitPrice: asNumber(row.unit_price),
    lineTotal: asNumber(row.line_total),
    quantityBase: asNumber(row.quantity_base),
    unitCostBase: asNumber(row.unit_cost_base),
  };
}

function rowToPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    purchaseNumber: row.purchase_number,
    purchaseRequestId: row.purchase_request_id,
    purchaseRequestNumber: row.purchase_request?.request_number ?? null,
    supplierId: row.supplier_id,
    supplierName: row.supplier?.name ?? "مورد غير معروف",
    supplierInvoiceNumber: row.supplier_invoice_number,
    supplierInvoiceDate: row.supplier_invoice_date,
    totalAmount: asNumber(row.total_amount),
    paymentStatus: row.payment_status,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: profileName(row.created_by_profile),
    createdAt: row.created_at,
    items: (row.purchase_items ?? []).map(rowToPurchaseItem),
  };
}

function rowToPayment(row: PurchasePaymentRow): PurchasePayment {
  return {
    id: row.id,
    paymentNumber: row.payment_number,
    purchaseId: row.purchase_id,
    purchaseNumber: row.purchase?.purchase_number ?? null,
    supplierInvoiceNumber: row.purchase?.supplier_invoice_number ?? null,
    supplierInvoiceDate: row.purchase?.supplier_invoice_date ?? null,
    purchaseCreatedAt: row.purchase?.created_at ?? null,
    purchaseCreatedByName: row.purchase?.created_by_profile ? profileName(row.purchase.created_by_profile) : null,
    supplierName: row.purchase?.supplier?.name ?? "مورد غير معروف",
    amount: asNumber(row.amount),
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    notes: row.notes,
    paidBy: row.paid_by,
    paidByName: profileName(row.paid_by_profile),
    createdAt: row.created_at,
  };
}

export async function getSuppliers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suppliers" as never)
    .select(supplierSelect)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    logSupabaseError("[suppliers SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as SupplierRow[]).map(rowToSupplier);
}

export async function createSupplier(input: CreateSupplierInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suppliers" as never)
    .insert({
      name: input.name.trim(),
      phone: clean(input.phone),
      address: clean(input.address),
      notes: clean(input.notes),
    } as never)
    .select(supplierSelect)
    .single();

  if (error) {
    logSupabaseError("[supplier create INSERT]", error);
    throw error;
  }

  return rowToSupplier(data as unknown as SupplierRow);
}

export async function getPurchaseRequests() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchase_requests" as never)
    .select(requestSelect)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logSupabaseError("[purchase_requests SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as PurchaseRequestRow[]).map(rowToPurchaseRequest);
}

export async function getPurchaseRequestById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchase_requests" as never)
    .select(requestSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logSupabaseError("[purchase_requests SELECT by id]", error);
    throw error;
  }

  return data ? rowToPurchaseRequest(data as unknown as PurchaseRequestRow) : null;
}

export async function createPurchaseRequest(input: CreatePurchaseRequestInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_purchase_request" as never, {
    p_notes: clean(input.notes),
    p_items: input.items.map((item) => ({
      inventory_item_id: item.inventoryItemId,
      quantity: item.quantity,
      unit_id: item.unitId,
      notes: clean(item.notes),
    })),
  } as never);

  if (error) {
    logSupabaseError("[purchase request create RPC create_purchase_request]", error);
    throw error;
  }

  const id = (data as { purchase_request_id?: string } | null)?.purchase_request_id;
  if (!id) throw new Error("لم يرجع Supabase معرف طلب الشراء");

  const request = await getPurchaseRequestById(id);
  if (!request) throw new Error("لم يتم العثور على طلب الشراء بعد الحفظ");
  return request;
}

export async function decidePurchaseRequest(input: PurchaseDecisionInput) {
  const supabase = createClient();
  const { error } = await supabase.rpc("decide_purchase_request" as never, {
    p_purchase_request_id: input.requestId,
    p_decision: input.decision,
    p_decision_notes: clean(input.decisionNotes),
  } as never);

  if (error) {
    logSupabaseError("[purchase request decide RPC decide_purchase_request]", error);
    throw error;
  }

  const request = await getPurchaseRequestById(input.requestId);
  if (!request) throw new Error("لم يتم العثور على طلب الشراء بعد القرار");
  return request;
}

export async function getPurchases() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchases" as never)
    .select(purchaseSelect)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logSupabaseError("[purchases SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as PurchaseRow[]).map(rowToPurchase);
}

export async function getPurchaseById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchases" as never)
    .select(purchaseSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logSupabaseError("[purchases SELECT by id]", error);
    throw error;
  }

  return data ? rowToPurchase(data as unknown as PurchaseRow) : null;
}

export async function getPurchasePayments() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchase_payments" as never)
    .select(paymentSelect)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logSupabaseError("[purchase_payments SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as PurchasePaymentRow[]).map(rowToPayment);
}

export async function createInventoryPurchase(input: CreatePurchaseInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_inventory_purchase" as never, {
    p_client_request_id: input.clientRequestId,
    p_supplier_id: input.supplierId,
    p_supplier_invoice_number: clean(input.supplierInvoiceNumber),
    p_supplier_invoice_date: clean(input.supplierInvoiceDate),
    p_notes: clean(input.notes),
    p_items: input.items.map((item) => ({
      inventory_item_id: item.inventoryItemId,
      quantity: item.quantity,
      unit_id: item.unitId,
      unit_price: item.unitPrice,
    })),
    p_purchase_request_id: input.purchaseRequestId ?? null,
  } as never);

  if (error) {
    logSupabaseError("[purchase receive RPC create_inventory_purchase]", error);
    throw error;
  }

  const id = (data as { purchase_id?: string } | null)?.purchase_id;
  if (!id) throw new Error("لم يرجع Supabase معرف فاتورة الشراء");

  const purchase = await getPurchaseById(id);
  if (!purchase) throw new Error("لم يتم العثور على فاتورة الشراء بعد الحفظ");
  return purchase;
}

export async function payPurchase(input: PayPurchaseInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("pay_purchase" as never, {
    p_purchase_id: input.purchaseId,
    p_payment_method: input.paymentMethod,
    p_reference_number: clean(input.referenceNumber),
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[purchase payment RPC pay_purchase]", error);
    throw error;
  }

  const id = (data as { purchase_id?: string } | null)?.purchase_id;
  if (!id) throw new Error("لم يرجع Supabase معرف فاتورة الشراء بعد الدفع");

  const purchase = await getPurchaseById(id);
  if (!purchase) throw new Error("لم يتم العثور على فاتورة الشراء بعد الدفع");
  return purchase;
}
