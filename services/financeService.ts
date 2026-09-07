"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type {
  CashShift,
  CashierOption,
  CashShiftMovementSummary,
  CashShiftSummary,
  CloseCashShiftInput,
  CreateExpenseInput,
  CustomerPayment,
  ExpectedCashBreakdown,
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  FinanceSalesSummary,
  OpenCashShiftInput,
} from "@/types/finance";

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

type OpenOrderRow = {
  total: number | string;
};

type CustomerPaymentRow = {
  id: string;
  order_id: string;
  amount: number | string;
  method: ExpensePaymentMethod;
  status: "completed" | "voided";
  created_at: string;
  order: {
    order_number: number | null;
    table: { table_number: number | null } | null;
  } | null;
};

type CashShiftRow = {
  id: string;
  cashier_id: string;
  business_date: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number | string;
  counted_cash: number | string | null;
  expected_cash_snapshot: number | string | null;
  cash_difference: number | string | null;
  status: "open" | "closed";
  opening_note: string | null;
  closing_note: string | null;
  opened_by: string;
  closed_by: string | null;
  created_at: string;
  cashier_profile: { full_name: string | null; username: string | null } | null;
  opened_by_profile: { full_name: string | null; username: string | null } | null;
  closed_by_profile: { full_name: string | null; username: string | null } | null;
};

type CashMovementSummaryRow = {
  shift_id: string;
  direction: "in" | "out";
  amount: number | string;
  voided_at: string | null;
};

type CashierProfileRow = {
  id: string;
  username: string;
  full_name: string;
};

type ExpectedCashBreakdownPayload = {
  shiftId?: string;
  businessDate?: string;
  openedAt?: string;
  cutoffAt?: string;
  openingCash?: number | string;
  cashSales?: number | string;
  cashExpenses?: number | string;
  cashSupplierPayments?: number | string;
  expectedCash?: number | string;
  sources?: {
    cashSalesAvailable?: boolean;
    cashExpensesAvailable?: boolean;
    cashSupplierPaymentsAvailable?: boolean;
  };
};

type CloseCashShiftPayload = {
  shift?: CashShiftRow;
  expected?: ExpectedCashBreakdownPayload;
};

const expenseSelect = "id, expense_number, amount, category, expense_date, payment_method, receipt_number, description, notes, created_by, created_at, created_by_profile:profiles!expenses_created_by_fkey(full_name, username)";
const customerPaymentSelect = "id, order_id, amount, method, status, created_at, order:orders(order_number, table:restaurant_tables(table_number))";
const profileNameSelect = "full_name, username";
const cashShiftSelect = `id, cashier_id, business_date, opened_at, closed_at, opening_cash, counted_cash, expected_cash_snapshot, cash_difference, status, opening_note, closing_note, opened_by, closed_by, created_at,
  cashier_profile:profiles!cash_shifts_cashier_id_fkey(${profileNameSelect}),
  opened_by_profile:profiles!cash_shifts_opened_by_fkey(${profileNameSelect}),
  closed_by_profile:profiles!cash_shifts_closed_by_fkey(${profileNameSelect})`;

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function asAmount(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function asNullableAmount(value: number | string | null) {
  if (value === null) return null;
  return asAmount(value);
}

function profileName(profile: { full_name: string | null; username: string | null } | null | undefined) {
  return profile?.full_name ?? profile?.username ?? undefined;
}

function baghdadDayRange(date = new Date()) {
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(date);
  const [year, month, day] = dayKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
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

function rowToCashShift(row: CashShiftRow): CashShift {
  return {
    id: row.id,
    cashierId: row.cashier_id,
    cashierName: profileName(row.cashier_profile),
    businessDate: row.business_date,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingCash: asAmount(row.opening_cash),
    countedCash: asNullableAmount(row.counted_cash),
    expectedCashSnapshot: asNullableAmount(row.expected_cash_snapshot),
    cashDifference: asNullableAmount(row.cash_difference),
    status: row.status,
    openingNote: row.opening_note,
    closingNote: row.closing_note,
    openedBy: row.opened_by,
    openedByName: profileName(row.opened_by_profile),
    closedBy: row.closed_by,
    closedByName: profileName(row.closed_by_profile),
    createdAt: row.created_at,
  };
}

function payloadToExpectedCashBreakdown(payload: ExpectedCashBreakdownPayload): ExpectedCashBreakdown {
  return {
    shiftId: payload.shiftId ?? "",
    businessDate: payload.businessDate ?? "",
    openedAt: payload.openedAt ?? "",
    cutoffAt: payload.cutoffAt ?? "",
    openingCash: asAmount(payload.openingCash ?? 0),
    cashSales: asAmount(payload.cashSales ?? 0),
    cashExpenses: asAmount(payload.cashExpenses ?? 0),
    cashSupplierPayments: asAmount(payload.cashSupplierPayments ?? 0),
    expectedCash: asAmount(payload.expectedCash ?? 0),
    sources: {
      cashSalesAvailable: payload.sources?.cashSalesAvailable === true,
      cashExpensesAvailable: payload.sources?.cashExpensesAvailable === true,
      cashSupplierPaymentsAvailable: payload.sources?.cashSupplierPaymentsAvailable === true,
    },
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

export async function getFinanceSalesSummary(): Promise<FinanceSalesSummary> {
  const supabase = createClient();
  const { start, end } = baghdadDayRange();

  const [
    { data: customerPayments, error: customerPaymentsError },
    { data: openOrders, error: openOrdersError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(customerPaymentSelect)
      .eq("status", "completed")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("orders")
      .select("total")
      .in("status", ["submitted", "preparing", "ready", "awaiting_payment"]),
  ]);

  if (customerPaymentsError) {
    logSupabaseError("[finance customer payments SELECT]", customerPaymentsError);
    throw customerPaymentsError;
  }

  if (openOrdersError) {
    logSupabaseError("[finance open orders SELECT]", openOrdersError);
    throw openOrdersError;
  }

  const mappedPayments = ((customerPayments ?? []) as unknown as CustomerPaymentRow[]).map((payment): CustomerPayment => ({
    id: payment.id,
    orderId: payment.order_id,
    orderNumber: payment.order?.order_number ?? null,
    tableNumber: payment.order?.table?.table_number ?? null,
    amount: asAmount(payment.amount),
    method: payment.method,
    status: payment.status,
    createdAt: payment.created_at,
  }));
  const completedPaymentsTotal = mappedPayments.reduce((total, payment) => total + payment.amount, 0);

  return {
    salesToday: completedPaymentsTotal,
    receivedToday: completedPaymentsTotal,
    openOrders: {
      count: ((openOrders ?? []) as unknown as OpenOrderRow[]).length,
      total: ((openOrders ?? []) as unknown as OpenOrderRow[]).reduce((total, order) => total + asAmount(order.total), 0),
    },
    customerPaymentsToday: mappedPayments,
  };
}

export async function getOpenCashShift(): Promise<CashShift | null> {
  const supabase = createClient();

  const query = supabase
    .from("cash_shifts")
    .select(cashShiftSelect)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    logSupabaseError("[cash shifts SELECT open]", error);
    throw error;
  }

  return data ? rowToCashShift(data as unknown as CashShiftRow) : null;
}

export async function getCashierOptions(): Promise<CashierOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name")
    .eq("role", "cashier")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) {
    logSupabaseError("[cashier profiles SELECT]", error);
    throw error;
  }

  return ((data ?? []) as unknown as CashierProfileRow[]).map((profile) => ({
    id: profile.id,
    name: profile.full_name,
    username: profile.username,
  }));
}

export async function openCashShift(input: OpenCashShiftInput): Promise<CashShift> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("open_cash_shift" as never, {
    p_opening_cash: input.openingCash,
    p_opening_note: clean(input.openingNote),
    p_cashier_id: input.cashierId,
  } as never);

  if (error) {
    logSupabaseError("[cash shift RPC open_cash_shift]", error);
    throw error;
  }

  return rowToCashShift(data as unknown as CashShiftRow);
}

export async function getExpectedCashForShift(shiftId: string): Promise<ExpectedCashBreakdown> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("calculate_cash_shift_expected" as never, {
    p_shift_id: shiftId,
  } as never);

  if (error) {
    logSupabaseError("[cash shift RPC calculate_cash_shift_expected]", error);
    throw error;
  }

  if (!data) throw new Error("لم يرجع Supabase النقد المتوقع");
  return payloadToExpectedCashBreakdown(data as ExpectedCashBreakdownPayload);
}

export async function getCurrentExpectedCash(cashierId?: string): Promise<ExpectedCashBreakdown | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_current_expected_cash" as never, {
    p_cashier_id: cashierId ?? null,
  } as never);

  if (error) {
    logSupabaseError("[cash shift RPC get_current_expected_cash]", error);
    throw error;
  }

  return data ? payloadToExpectedCashBreakdown(data as ExpectedCashBreakdownPayload) : null;
}

export async function closeCashShift(input: CloseCashShiftInput): Promise<CashShiftSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("close_cash_shift" as never, {
    p_counted_cash: input.countedCash,
    p_closing_note: clean(input.closingNote),
    p_cashier_id: input.cashierId ?? null,
  } as never);

  if (error) {
    logSupabaseError("[cash shift RPC close_cash_shift]", error);
    throw error;
  }

  const payload = data as CloseCashShiftPayload;
  if (!payload.shift || !payload.expected) throw new Error("لم يرجع Supabase ملخص إغلاق الوردية");

  return {
    shift: rowToCashShift(payload.shift),
    expected: payloadToExpectedCashBreakdown(payload.expected),
  };
}

export async function getRecentCashShifts(): Promise<CashShift[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cash_shifts")
    .select(cashShiftSelect)
    .order("opened_at", { ascending: false })
    .limit(30);

  if (error) {
    logSupabaseError("[cash shifts SELECT recent]", error);
    throw error;
  }

  return ((data ?? []) as unknown as CashShiftRow[]).map(rowToCashShift);
}

export async function getCashShiftMovementSummaries(shiftIds: string[]): Promise<CashShiftMovementSummary[]> {
  if (shiftIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cash_movements")
    .select("shift_id, direction, amount, voided_at")
    .in("shift_id", shiftIds);

  if (error) {
    logSupabaseError("[cash movements SELECT summaries]", error);
    throw error;
  }

  const summaries = new Map<string, CashShiftMovementSummary>();
  for (const row of (data ?? []) as unknown as CashMovementSummaryRow[]) {
    if (row.voided_at) continue;
    const current = summaries.get(row.shift_id) ?? { shiftId: row.shift_id, cashIn: 0, cashOut: 0 };
    if (row.direction === "in") current.cashIn += asAmount(row.amount);
    if (row.direction === "out") current.cashOut += asAmount(row.amount);
    summaries.set(row.shift_id, current);
  }

  return shiftIds.map((shiftId) => summaries.get(shiftId) ?? { shiftId, cashIn: 0, cashOut: 0 });
}
