"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { AdminSupplierProfile, SupplierInput, SupplierMaterialSummary, SupplierPurchaseSummary } from "@/types/adminSuppliers";
import type { PurchasePayment } from "@/types/finance";

type ProfileNameRow = { full_name: string | null; username: string | null };

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PurchaseItemRow = {
  id: string;
  inventory_item_id: string;
  quantity_base: number | string;
  unit_price: number | string;
  created_at: string;
  inventory_item: { name_ar: string } | null;
};

type PurchaseRow = {
  id: string;
  purchase_number: number;
  supplier_id: string;
  supplier_invoice_number: string | null;
  supplier_invoice_date: string | null;
  total_amount: number | string;
  payment_status: "unpaid" | "paid";
  created_at: string;
  supplier: { name: string } | null;
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
    supplier_id: string;
    supplier_invoice_number: string | null;
    supplier_invoice_date: string | null;
    created_at: string;
    supplier: { name: string } | null;
    created_by_profile: ProfileNameRow | null;
  } | null;
};

const profileNameSelect = "full_name, username";
const supplierSelect = "id, name, phone, address, notes, is_active, created_at, updated_at";
const purchaseSelect = `id, purchase_number, supplier_id, supplier_invoice_number, supplier_invoice_date, total_amount, payment_status, created_at,
  supplier:suppliers!purchases_supplier_id_fkey(name),
  purchase_items(id, inventory_item_id, quantity_base, unit_price, created_at, inventory_item:inventory_items!purchase_items_inventory_item_id_fkey(name_ar))`;
const paymentSelect = `id, payment_number, purchase_id, amount, payment_method, reference_number, notes, paid_by, created_at,
  paid_by_profile:profiles!purchase_payments_paid_by_fkey(${profileNameSelect}),
  purchase:purchases!purchase_payments_purchase_id_fkey(purchase_number, supplier_id, supplier_invoice_number, supplier_invoice_date, created_at, supplier:suppliers!purchases_supplier_id_fkey(name), created_by_profile:profiles!purchases_created_by_fkey(${profileNameSelect}))`;

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

async function writeAudit(action: string, entityId: string, oldData: unknown, newData: unknown) {
  const supabase = createClient();
  const { error } = await supabase.rpc("write_audit_log" as never, {
    p_action: action,
    p_entity_type: "suppliers",
    p_entity_id: entityId,
    p_old_data: oldData,
    p_new_data: newData,
  } as never);

  if (error) {
    logSupabaseError(`[audit write ${action}]`, error);
    throw error;
  }
}

function supplierPayload(input: SupplierInput) {
  return {
    name: input.name.trim(),
    phone: clean(input.phone),
    address: clean(input.address),
    notes: clean(input.notes),
    is_active: input.isActive,
  };
}

function buildMaterials(purchases: PurchaseRow[]): SupplierMaterialSummary[] {
  const byItem = new Map<string, SupplierMaterialSummary>();

  purchases.forEach((purchase) => {
    (purchase.purchase_items ?? []).forEach((item) => {
      const existing = byItem.get(item.inventory_item_id);
      const nextDate = item.created_at ?? purchase.created_at;
      const nextUnitPrice = asNumber(item.unit_price);
      if (!existing) {
        byItem.set(item.inventory_item_id, {
          inventoryItemId: item.inventory_item_id,
          name: item.inventory_item?.name_ar ?? "مادة غير معروفة",
          totalQuantityBase: asNumber(item.quantity_base),
          lastUnitPrice: nextUnitPrice,
          lastPurchasedAt: nextDate,
        });
        return;
      }

      existing.totalQuantityBase += asNumber(item.quantity_base);
      if (!existing.lastPurchasedAt || new Date(nextDate) > new Date(existing.lastPurchasedAt)) {
        existing.lastPurchasedAt = nextDate;
        existing.lastUnitPrice = nextUnitPrice;
      }
    });
  });

  return Array.from(byItem.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export async function getAdminSuppliers(): Promise<AdminSupplierProfile[]> {
  const supabase = createClient();
  const [{ data: suppliers, error: suppliersError }, { data: purchases, error: purchasesError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("suppliers" as never).select(supplierSelect).order("name", { ascending: true }),
    supabase.from("purchases" as never).select(purchaseSelect).order("created_at", { ascending: false }).limit(1000),
    supabase.from("purchase_payments" as never).select(paymentSelect).order("created_at", { ascending: false }).limit(1000),
  ]);

  if (suppliersError) {
    logSupabaseError("[admin suppliers SELECT]", suppliersError);
    throw suppliersError;
  }
  if (purchasesError) {
    logSupabaseError("[admin supplier purchases SELECT]", purchasesError);
    throw purchasesError;
  }
  if (paymentsError) {
    logSupabaseError("[admin supplier payments SELECT]", paymentsError);
    throw paymentsError;
  }

  const purchaseRows = (purchases ?? []) as unknown as PurchaseRow[];
  const paymentRows = (payments ?? []) as unknown as PurchasePaymentRow[];
  const paymentModels = paymentRows.map(rowToPayment);
  const paymentsByPurchase = new Map(paymentModels.map((payment) => [payment.purchaseId, payment]));
  const purchasesBySupplier = new Map<string, PurchaseRow[]>();
  const paymentsBySupplier = new Map<string, PurchasePayment[]>();

  purchaseRows.forEach((purchase) => {
    const current = purchasesBySupplier.get(purchase.supplier_id) ?? [];
    current.push(purchase);
    purchasesBySupplier.set(purchase.supplier_id, current);
  });

  paymentRows.forEach((row, index) => {
    const supplierId = row.purchase?.supplier_id;
    if (!supplierId) return;
    const current = paymentsBySupplier.get(supplierId) ?? [];
    current.push(paymentModels[index]);
    paymentsBySupplier.set(supplierId, current);
  });

  return ((suppliers ?? []) as unknown as SupplierRow[]).map((supplier) => {
    const supplierPurchases = purchasesBySupplier.get(supplier.id) ?? [];
    const supplierPayments = paymentsBySupplier.get(supplier.id) ?? [];
    const totalPurchases = supplierPurchases.reduce((total, purchase) => total + asNumber(purchase.total_amount), 0);
    const totalPaid = supplierPayments.reduce((total, payment) => total + payment.amount, 0);
    const purchaseSummaries: SupplierPurchaseSummary[] = supplierPurchases.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchase_number,
      supplierInvoiceNumber: purchase.supplier_invoice_number,
      supplierInvoiceDate: purchase.supplier_invoice_date,
      totalAmount: asNumber(purchase.total_amount),
      paymentStatus: purchase.payment_status,
      createdAt: purchase.created_at,
      payment: paymentsByPurchase.get(purchase.id) ?? null,
    }));

    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      isActive: supplier.is_active,
      createdAt: supplier.created_at,
      updatedAt: supplier.updated_at,
      financials: {
        purchaseCount: supplierPurchases.length,
        totalPurchases,
        totalPaid,
        remaining: Math.max(totalPurchases - totalPaid, 0),
        lastPurchaseAt: supplierPurchases[0]?.created_at ?? null,
        lastPaymentAt: supplierPayments[0]?.createdAt ?? null,
      },
      purchases: purchaseSummaries,
      materials: buildMaterials(supplierPurchases),
      payments: supplierPayments,
    };
  });
}

export async function createAdminSupplier(input: SupplierInput) {
  const supabase = createClient();
  const { data, error } = await supabase.from("suppliers" as never).insert(supplierPayload(input) as never).select(supplierSelect).single();

  if (error) {
    logSupabaseError("[admin supplier INSERT]", error);
    throw error;
  }

  await writeAudit("إضافة مورد", (data as SupplierRow).id, null, data);
  return data as unknown as SupplierRow;
}

export async function updateAdminSupplier(previous: AdminSupplierProfile, input: SupplierInput) {
  const supabase = createClient();
  const payload = supplierPayload(input);
  const { data, error } = await supabase.from("suppliers" as never).update(payload as never).eq("id", previous.id).select(supplierSelect).single();

  if (error) {
    logSupabaseError("[admin supplier UPDATE]", error);
    throw error;
  }

  const next = data as unknown as SupplierRow;
  const action = previous.isActive !== next.is_active
    ? next.is_active ? "إعادة تفعيل مورد" : "إيقاف مورد"
    : "تعديل مورد";
  await writeAudit(action, previous.id, previous, next);
  return next;
}
