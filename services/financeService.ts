"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { CreateExpenseInput, Expense, ExpenseCategory, ExpensePaymentMethod } from "@/types/finance";

type ExpenseRow = {
  id: string;
  expense_number: number;
  amount: number | string;
  category: ExpenseCategory;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  receipt_number: string | null;
  description: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  created_by_profile: { full_name: string; username: string } | null;
};

const expenseSelect = "id, expense_number, amount, category, expense_date, payment_method, receipt_number, description, notes, created_by, created_at, created_by_profile:profiles!expenses_created_by_fkey(full_name, username)";

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function asAmount(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    expenseNumber: row.expense_number,
    amount: asAmount(row.amount),
    category: row.category,
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method,
    receiptNumber: row.receipt_number,
    description: row.description,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: row.created_by_profile?.full_name ?? row.created_by_profile?.username ?? "مستخدم غير معروف",
    createdAt: row.created_at,
  };
}

export async function getExpenses() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expenses" as never)
    .select(expenseSelect)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logSupabaseError("[expenses SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as ExpenseRow[]).map(rowToExpense);
}

export async function getExpenseById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expenses" as never)
    .select(expenseSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logSupabaseError("[expenses SELECT by id]", error);
    throw error;
  }

  return data ? rowToExpense(data as unknown as ExpenseRow) : null;
}

export async function createExpense(input: CreateExpenseInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_expense" as never, {
    p_amount: input.amount,
    p_category: input.category,
    p_payment_method: input.paymentMethod,
    p_receipt_number: clean(input.receiptNumber),
    p_description: input.description.trim(),
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[expense create RPC create_expense]", error);
    throw error;
  }

  const id = (data as { id?: string } | null)?.id;
  if (!id) throw new Error("لم يرجع Supabase معرف المصروف");

  const expense = await getExpenseById(id);
  if (!expense) throw new Error("لم يتم العثور على المصروف بعد الحفظ");
  return expense;
}
