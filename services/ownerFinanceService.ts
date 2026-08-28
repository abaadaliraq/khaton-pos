"use client";

import { createClient } from '@/lib/supabase/client';
import { logSupabaseError } from '@/lib/supabaseError';
import type { Expense, ExpenseCategory, ExpensePaymentMethod, PurchasePayment, PurchasePaymentStatus } from '@/types/finance';

type ProfileNameRow = { full_name: string | null; username: string | null };
type ExpenseRow = { id: string; expense_number: number; amount: number | string; category: ExpenseCategory; expense_date: string; payment_method: ExpensePaymentMethod; receipt_number: string | null; description: string; notes: string | null; created_by: string; created_at: string; created_by_profile: ProfileNameRow | null; };
type PurchaseRow = { id: string; purchase_number: number; total_amount: number | string; payment_status: PurchasePaymentStatus; };
type PurchasePaymentRow = { id: string; payment_number: number | null; purchase_id: string; amount: number | string; payment_method: ExpensePaymentMethod; reference_number: string | null; notes: string | null; paid_by: string; created_at: string; paid_by_profile: ProfileNameRow | null; purchase: { purchase_number: number; supplier_invoice_number: string | null; supplier_invoice_date: string | null; created_at: string; notes: string | null; supplier: { name: string } | null; created_by_profile: ProfileNameRow | null; } | null; };

export type OwnerFinancePurchase = { id: string; purchaseNumber: number; totalAmount: number; paymentStatus: PurchasePaymentStatus };
export type OwnerFinanceData = { expenses: Expense[]; payments: PurchasePayment[]; purchases: OwnerFinancePurchase[]; errors: string[] };

const bang = String.fromCharCode(33);
const profileNameSelect = 'full_name, username';
const expenseSelect = 'id, expense_number, amount, category, expense_date, payment_method, receipt_number, description, notes, created_by, created_at, created_by_profile:profiles' + bang + 'expenses_created_by_fkey(' + profileNameSelect + ')';
const purchaseSelect = 'id, purchase_number, total_amount, payment_status';
const paymentSelect = 'id, payment_number, purchase_id, amount, payment_method, reference_number, notes, paid_by, created_at, paid_by_profile:profiles' + bang + 'purchase_payments_paid_by_fkey(' + profileNameSelect + '), purchase:purchases' + bang + 'purchase_payments_purchase_id_fkey(purchase_number, supplier_invoice_number, supplier_invoice_date, created_at, notes, supplier:suppliers' + bang + 'purchases_supplier_id_fkey(name), created_by_profile:profiles' + bang + 'purchases_created_by_fkey(' + profileNameSelect + '))';

function asNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileName(profile: ProfileNameRow | null) {
  return profile?.full_name ?? profile?.username ?? 'مستخدم غير معروف';
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    expenseNumber: row.expense_number,
    amount: asNumber(row.amount),
    category: row.category,
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method,
    receiptNumber: row.receipt_number,
    description: row.description,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: profileName(row.created_by_profile),
    createdAt: row.created_at,
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
    supplierName: row.purchase?.supplier?.name ?? 'مورد غير معروف',
    amount: asNumber(row.amount),
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    notes: row.notes,
    paidBy: row.paid_by,
    paidByName: profileName(row.paid_by_profile),
    createdAt: row.created_at,
  };
}

export async function getOwnerFinanceData(): Promise<OwnerFinanceData> {
  const supabase = createClient();
  const [{ data: expenses, error: expensesError }, { data: purchases, error: purchasesError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from('expenses' as never).select(expenseSelect).order('created_at', { ascending: false }).limit(1000),
    supabase.from('purchases' as never).select(purchaseSelect).order('created_at', { ascending: false }).limit(1000),
    supabase.from('purchase_payments' as never).select(paymentSelect).order('created_at', { ascending: false }).limit(1000),
  ]);

  const errors: string[] = [];

  if (expensesError) {
    logSupabaseError('[owner finance expenses SELECT]', expensesError);
    errors.push('expenses');
  }
  if (purchasesError) {
    logSupabaseError('[owner finance purchases SELECT]', purchasesError);
    errors.push('purchases');
  }
  if (paymentsError) {
    logSupabaseError('[owner finance purchase_payments SELECT]', paymentsError);
    errors.push('purchase_payments');
  }

  return {
    errors,
    expenses: ((expenses ?? []) as unknown as ExpenseRow[]).map(rowToExpense),
    purchases: ((purchases ?? []) as unknown as PurchaseRow[]).map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchase_number,
      totalAmount: asNumber(purchase.total_amount),
      paymentStatus: purchase.payment_status,
    })),
    payments: ((payments ?? []) as unknown as PurchasePaymentRow[]).map(rowToPayment),
  };
}
