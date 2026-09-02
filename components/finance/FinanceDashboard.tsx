"use client";

import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, Clock3, Eye, Landmark, ReceiptText, Save, TrendingDown, TrendingUp, WalletCards, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExpenseVoucherDialog, expenseVoucherNumber } from "@/components/finance/ExpenseVoucherDialog";
import { PurchasePaymentVoucherDialog, purchasePaymentVoucherNumber } from "@/components/finance/PurchasePaymentVoucherDialog";
import { ManagementTabs } from "@/components/ui/ManagementTabs";
import { formatCurrency } from "@/lib/formatCurrency";
import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import { closeCashShift, createExpense, getCurrentExpectedCash, getExpenses, getFinanceSalesSummary, getOpenCashShift, getRecentCashShifts, openCashShift } from "@/services/financeService";
import { decidePurchaseRequest, getPurchasePayments, getPurchaseRequests, getPurchases, payPurchase } from "@/services/purchaseService";
import type { CashShift, CloseCashShiftInput, CreateExpenseInput, CustomerPayment, ExpectedCashBreakdown, Expense, ExpenseCategory, ExpensePaymentMethod, FinanceSalesSummary, OpenCashShiftInput, PayPurchaseInput, Purchase, PurchasePayment, PurchaseRequest } from "@/types/finance";
import { expenseCategoryLabels, expensePaymentMethodLabels, purchasePaymentStatusLabels, purchaseRequestStatusLabels } from "@/types/finance";

type FinanceTab = "overview" | "requests" | "invoices" | "expenses" | "payments";

const baghdadTimeZone = "Asia/Baghdad";
const emptyExpense: CreateExpenseInput = { amount: 0, category: "electricity", paymentMethod: "cash", receiptNumber: "", description: "", notes: "" };
const emptyPayment = { paymentMethod: "cash" as ExpensePaymentMethod, referenceNumber: "", notes: "" };
const tabs: { id: FinanceTab; label: string }[] = [
  { id: "overview", label: "نظرة عامة" },
  { id: "requests", label: "طلبات الشراء" },
  { id: "invoices", label: "فواتير الموردين" },
  { id: "expenses", label: "المصروفات" },
  { id: "payments", label: "المدفوعات" },
];

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function localDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone }).format(new Date(value));
}

function todayKey() {
  return localDateKey(new Date().toISOString());
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { hour: "numeric", minute: "2-digit", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: baghdadTimeZone }).format(new Date(value));
}

function parseCashInput(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function shiftActionError(error: unknown, action: "open" | "close") {
  const text = JSON.stringify(error).toLowerCase();
  if (text.includes("already has an open cash shift")) return "لديك وردية مفتوحة بالفعل.";
  if (text.includes("no open cash shift")) return "لا توجد وردية مفتوحة لإغلاقها.";
  if (text.includes("only cashier") || text.includes("permission") || text.includes("not authorized")) {
    return action === "open" ? "لا تملك صلاحية فتح الوردية." : "لا تملك صلاحية إغلاق الوردية.";
  }
  return action === "open" ? "تعذر فتح الوردية. حاول مرة أخرى." : "تعذر إغلاق الوردية. حاول مرة أخرى.";
}

function DifferenceLabel({ value }: { value: number }) {
  if (value === 0) {
    return <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-sm font-semibold text-emerald-200">الصندوق مطابق</span>;
  }

  if (value > 0) {
    return <span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-sm font-semibold text-amber-200">زيادة في الصندوق + {formatCurrency(value)}</span>;
  }

  return <span className="rounded-md border border-[#ff5656]/25 bg-[#ff5656]/10 px-2 py-1 text-sm font-semibold text-[#ffb0b0]">نقص في الصندوق - {formatCurrency(Math.abs(value))}</span>;
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </section>
  );
}

type FinanceKpi = {
  title: string;
  value: string;
  helper: string;
  icon: typeof Banknote;
  tone?: "income" | "outgoing" | "neutral";
};

type FinanceMovement = {
  id: string;
  time: string;
  type: "sale" | "expense" | "supplier-payment" | "purchase";
  reference: string;
  description: string;
  method: string;
  amount: number;
  status: string;
};

type FinanceAlert = {
  id: string;
  title: string;
  description: string;
  amount?: number;
};

const movementTypeLabels: Record<FinanceMovement["type"], string> = {
  sale: "بيع",
  expense: "مصروف",
  "supplier-payment": "دفع مورد",
  purchase: "فاتورة شراء",
};

function DashboardHeader() {
  return (
    <section
      className="relative isolate min-h-[180px] overflow-hidden rounded-none border-b border-white/10 bg-[#202020] px-5 py-6 lg:min-h-[210px] lg:px-7"
      style={{
        backgroundImage:
          'linear-gradient(to left, rgba(32,32,32,0.18), rgba(32,32,32,0.82)), url("/images/dashboard/accountant-dashboard-hero.jpg")',
        backgroundPosition: "left center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="relative z-10 flex min-h-[130px] max-w-3xl flex-col justify-end">
        <p className="text-xs font-semibold uppercase tracking-normal text-[#ff5656]">FINANCE CENTER</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">الحسابات</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-200">متابعة الحركة المالية للمطعم</p>
      </div>
    </section>
  );
}

function FinanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-md border border-white/10 bg-white/[0.06]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <div className="h-72 animate-pulse rounded-md border border-white/10 bg-white/[0.06]" />
        <div className="h-72 animate-pulse rounded-md border border-white/10 bg-white/[0.06]" />
      </div>
    </div>
  );
}

function KpiCard({ card }: { card: FinanceKpi }) {
  const Icon = card.icon;
  const toneClass =
    card.tone === "income"
      ? "text-emerald-300"
      : card.tone === "outgoing"
        ? "text-[#ff7070]"
        : "text-zinc-200";

  return (
    <section className="rounded-md border border-white/10 bg-[#303030] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-300">{card.title}</p>
          <p className={`mt-3 text-2xl font-semibold ${toneClass}`}>{card.value}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-white/[0.06] text-[#ff5656]">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-400">{card.helper}</p>
    </section>
  );
}

function CashBoxCard({ receivedToday, expensesToday, supplierPaidToday, netToday }: { receivedToday: number; expensesToday: number; supplierPaidToday: number; netToday: number }) {
  const outgoing = expensesToday + supplierPaidToday;

  return (
    <section className="rounded-md border border-white/10 bg-[#303030] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">الصندوق</p>
          <h2 className="mt-1 text-xl font-semibold text-white">حركة اليوم</h2>
        </div>
        <Banknote className="text-[#ff5656]" size={24} />
      </div>
      <div className="mt-5 grid gap-3">
        <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-3">
          <span className="text-sm text-zinc-300">داخل اليوم</span>
          <span className="font-semibold text-emerald-300">+ {formatCurrency(receivedToday)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-3">
          <span className="text-sm text-zinc-300">خارج اليوم</span>
          <span className="font-semibold text-[#ff7070]">- {formatCurrency(outgoing)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-white/10 px-3 py-3">
          <span className="text-sm font-medium text-white">صافي الحركة</span>
          <span className="font-semibold text-white">{formatCurrency(netToday)}</span>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-zinc-400">يمثل حركة اليوم ولا يمثل الرصيد المرحّل.</p>
    </section>
  );
}

function MovementBadge({ type }: { type: FinanceMovement["type"] }) {
  const className = type === "sale" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-[#ff5656]/25 bg-[#ff5656]/10 text-[#ffb0b0]";

  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{movementTypeLabels[type]}</span>;
}

function FinancialMovements({ movements }: { movements: FinanceMovement[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-white/10 bg-[#303030] shadow-sm">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-lg font-semibold text-white">آخر الحركات المالية</h2>
      </div>
      {movements.length === 0 ? <p className="p-4 text-sm text-zinc-400">لا توجد حركات مالية مسجلة حالياً.</p> : null}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-xs text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-right font-medium">الوقت</th>
              <th className="px-4 py-3 text-right font-medium">النوع</th>
              <th className="px-4 py-3 text-right font-medium">المرجع</th>
              <th className="px-4 py-3 text-right font-medium">البيان</th>
              <th className="px-4 py-3 text-right font-medium">طريقة الدفع</th>
              <th className="px-4 py-3 text-right font-medium">المبلغ</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td className="px-4 py-3 text-zinc-300">{formatTime(movement.time)}</td>
                <td className="px-4 py-3"><MovementBadge type={movement.type} /></td>
                <td className="px-4 py-3 text-zinc-200">{movement.reference}</td>
                <td className="px-4 py-3 text-zinc-300">{movement.description}</td>
                <td className="px-4 py-3 text-zinc-400">{movement.method}</td>
                <td className="px-4 py-3 font-semibold text-white">{formatCurrency(movement.amount)}</td>
                <td className="px-4 py-3 text-zinc-300">{movement.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-white/10 md:hidden">
        {movements.map((movement) => (
          <article key={movement.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <MovementBadge type={movement.type} />
              <span className="text-xs text-zinc-400">{formatTime(movement.time)}</span>
            </div>
            <p className="font-semibold text-white">{movement.reference}</p>
            <p className="text-sm text-zinc-300">{movement.description}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{movement.method}</span>
              <span className="font-semibold text-white">{formatCurrency(movement.amount)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinanceAlerts({ alerts }: { alerts: FinanceAlert[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#303030] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-[#ff5656]" size={20} />
        <h2 className="text-lg font-semibold text-white">تنبيهات تحتاج متابعة</h2>
      </div>
      <div className="mt-4 space-y-3">
        {alerts.length === 0 ? <p className="rounded-md bg-white/[0.04] p-3 text-sm text-zinc-400">لا توجد إجراءات مالية معلقة حالياً</p> : null}
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <p className="font-semibold text-white">{alert.title}</p>
            <p className="mt-1 text-sm text-zinc-400">{alert.description}</p>
            {typeof alert.amount === "number" ? <p className="mt-2 text-sm font-semibold text-[#ffb0b0]">{formatCurrency(alert.amount)}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ExpectedCashBreakdownView({ expected }: { expected: ExpectedCashBreakdown }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2">
        <span className="text-sm text-zinc-300">الرصيد الافتتاحي</span>
        <span className="font-semibold text-white">{formatCurrency(expected.openingCash)}</span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2">
        <span className="text-sm text-zinc-300">المبيعات النقدية</span>
        <span className="font-semibold text-emerald-300">+ {formatCurrency(expected.cashSales)}</span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2">
        <span className="text-sm text-zinc-300">المصروفات النقدية</span>
        <span className="font-semibold text-[#ffb0b0]">- {formatCurrency(expected.cashExpenses)}</span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2">
        <span className="text-sm text-zinc-300">دفعات الموردين النقدية</span>
        <span className="font-semibold text-[#ffb0b0]">- {formatCurrency(expected.cashSupplierPayments)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-white/10 px-3 pt-3">
        <span className="text-sm font-semibold text-white">النقد المتوقع</span>
        <span className="text-xl font-semibold text-white">{formatCurrency(expected.expectedCash)}</span>
      </div>
    </div>
  );
}

function CashShiftCard({
  openShift,
  expectedCash,
  recentShifts,
  onOpen,
  onClose,
  isSaving,
}: {
  openShift: CashShift | null;
  expectedCash: ExpectedCashBreakdown | null;
  recentShifts: CashShift[];
  onOpen: () => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const lastClosedShift = recentShifts.find((shift) => shift.status === "closed") ?? null;

  return (
    <section className="rounded-md border border-white/10 bg-[#303030] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">الوردية الحالية</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{openShift ? "حالة: مفتوحة" : "لا توجد وردية مفتوحة"}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {openShift ? "متابعة النقد المتوقع لهذه الوردية فقط." : "افتح وردية لبدء متابعة الصندوق النقدي."}
          </p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-white/[0.06] text-[#ff5656]">
          <CalendarClock size={21} />
        </span>
      </div>

      {openShift ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-white/[0.04] p-3">
              <p className="text-xs text-zinc-500">بدأت</p>
              <p className="mt-1 font-semibold text-white">{formatTime(openShift.openedAt)}</p>
            </div>
            <div className="rounded-md bg-white/[0.04] p-3">
              <p className="text-xs text-zinc-500">تاريخ العمل</p>
              <p className="mt-1 font-semibold text-white">{formatDate(`${openShift.businessDate}T00:00:00+03:00`)}</p>
            </div>
            <div className="rounded-md bg-white/[0.04] p-3">
              <p className="text-xs text-zinc-500">الرصيد الافتتاحي</p>
              <p className="mt-1 font-semibold text-white">{formatCurrency(openShift.openingCash)}</p>
            </div>
          </div>
          {expectedCash ? <ExpectedCashBreakdownView expected={expectedCash} /> : <p className="rounded-md bg-white/[0.04] p-3 text-sm text-zinc-400">تعذر تحميل النقد المتوقع حالياً.</p>}
          <div className="flex justify-end">
            <button type="button" disabled={isSaving} onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-4 text-sm font-semibold text-white shadow-lg shadow-[#ff5656]/15 disabled:opacity-50">
              <Clock3 size={16} />
              إغلاق الوردية
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <button type="button" disabled={isSaving} onClick={onOpen} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-4 text-sm font-semibold text-white shadow-lg shadow-[#ff5656]/15 disabled:opacity-50">
            <Banknote size={16} />
            فتح وردية
          </button>
          {lastClosedShift ? (
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">آخر وردية</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <p className="text-zinc-400">بدأت: <span className="text-zinc-200">{formatTime(lastClosedShift.openedAt)}</span></p>
                <p className="text-zinc-400">أغلقت: <span className="text-zinc-200">{formatTime(lastClosedShift.closedAt)}</span></p>
                <p className="text-zinc-400">الرصيد الافتتاحي: <span className="text-zinc-200">{formatCurrency(lastClosedShift.openingCash)}</span></p>
                <p className="text-zinc-400">النقد المتوقع: <span className="text-zinc-200">{formatCurrency(lastClosedShift.expectedCashSnapshot ?? 0)}</span></p>
                <p className="text-zinc-400">النقد المعدود: <span className="text-zinc-200">{formatCurrency(lastClosedShift.countedCash ?? 0)}</span></p>
                <div><DifferenceLabel value={lastClosedShift.cashDifference ?? 0} /></div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RecentCashShifts({ shifts }: { shifts: CashShift[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-white/10 bg-[#303030] shadow-sm">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-lg font-semibold text-white">آخر الورديات</h2>
      </div>
      {shifts.length === 0 ? <p className="p-4 text-sm text-zinc-400">لا توجد ورديات مسجلة بعد.</p> : null}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-xs text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-right font-medium">تاريخ العمل</th>
              <th className="px-4 py-3 text-right font-medium">وقت الفتح</th>
              <th className="px-4 py-3 text-right font-medium">وقت الإغلاق</th>
              <th className="px-4 py-3 text-right font-medium">الرصيد الافتتاحي</th>
              <th className="px-4 py-3 text-right font-medium">المتوقع</th>
              <th className="px-4 py-3 text-right font-medium">المعدود</th>
              <th className="px-4 py-3 text-right font-medium">الفرق</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td className="px-4 py-3 text-zinc-300">{formatDate(`${shift.businessDate}T00:00:00+03:00`)}</td>
                <td className="px-4 py-3 text-zinc-300">{formatTime(shift.openedAt)}</td>
                <td className="px-4 py-3 text-zinc-300">{formatTime(shift.closedAt)}</td>
                <td className="px-4 py-3 text-zinc-200">{formatCurrency(shift.openingCash)}</td>
                <td className="px-4 py-3 text-zinc-200">{shift.expectedCashSnapshot === null ? "-" : formatCurrency(shift.expectedCashSnapshot)}</td>
                <td className="px-4 py-3 text-zinc-200">{shift.countedCash === null ? "-" : formatCurrency(shift.countedCash)}</td>
                <td className="px-4 py-3">{shift.cashDifference === null ? <span className="text-zinc-500">-</span> : <DifferenceLabel value={shift.cashDifference} />}</td>
                <td className="px-4 py-3 text-zinc-300">{shift.status === "open" ? "مفتوحة" : "مغلقة"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-white/10 md:hidden">
        {shifts.map((shift) => (
          <article key={shift.id} className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{formatDate(`${shift.businessDate}T00:00:00+03:00`)}</p>
              <span className="text-zinc-400">{shift.status === "open" ? "مفتوحة" : "مغلقة"}</span>
            </div>
            <p className="text-zinc-400">الفتح: {formatTime(shift.openedAt)} · الإغلاق: {formatTime(shift.closedAt)}</p>
            <p className="text-zinc-300">افتتاحي {formatCurrency(shift.openingCash)} · متوقع {shift.expectedCashSnapshot === null ? "-" : formatCurrency(shift.expectedCashSnapshot)}</p>
            {shift.cashDifference === null ? null : <DifferenceLabel value={shift.cashDifference} />}
          </article>
        ))}
      </div>
    </section>
  );
}

function OpenShiftModal({
  form,
  onChange,
  onCancel,
  onSubmit,
  isSaving,
}: {
  form: { openingCash: string; openingNote: string };
  onChange: (form: { openingCash: string; openingNote: string }) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-md border border-white/10 bg-[#303030] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">فتح وردية جديدة</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-zinc-200">
            الرصيد الافتتاحي
            <div className="relative">
              <input
                required
                min="0"
                step="1"
                inputMode="decimal"
                type="number"
                value={form.openingCash}
                onChange={(event) => onChange({ ...form, openingCash: event.target.value })}
                placeholder="0 د.ع"
                className="h-11 w-full rounded-md border border-white/10 bg-[#252525] px-3 pl-12 text-sm text-white outline-none focus:border-[#ff5656]"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">د.ع</span>
            </div>
          </label>
          <label className="grid gap-1 text-sm font-medium text-zinc-200">
            ملاحظة اختيارية
            <textarea
              value={form.openingNote}
              onChange={(event) => onChange({ ...form, openingNote: event.target.value })}
              placeholder="المبلغ الموجود في الصندوق عند بداية الوردية"
              className="min-h-24 rounded-md border border-white/10 bg-[#252525] p-3 text-sm text-white outline-none focus:border-[#ff5656]"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-md border border-white/10 px-4 text-sm text-zinc-200 hover:bg-white/[0.04]">إلغاء</button>
          <button disabled={isSaving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Save size={16} />
            فتح الوردية
          </button>
        </div>
      </form>
    </div>
  );
}

function CloseShiftModal({
  expectedCash,
  form,
  onChange,
  onCancel,
  onSubmit,
  isSaving,
}: {
  expectedCash: ExpectedCashBreakdown | null;
  form: { countedCash: string; closingNote: string };
  onChange: (form: { countedCash: string; closingNote: string }) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
}) {
  const countedCash = parseCashInput(form.countedCash);
  const difference = expectedCash && countedCash !== null ? countedCash - expectedCash.expectedCash : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-md border border-white/10 bg-[#303030] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">إغلاق الوردية</h2>
        <div className="mt-4">
          {expectedCash ? <ExpectedCashBreakdownView expected={expectedCash} /> : <p className="rounded-md bg-white/[0.04] p-3 text-sm text-zinc-400">تعذر تحميل النقد المتوقع.</p>}
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-zinc-200">
            أدخل النقد الموجود فعلياً في الصندوق
            <div className="relative">
              <input
                required
                min="0"
                step="1"
                inputMode="decimal"
                type="number"
                value={form.countedCash}
                onChange={(event) => onChange({ ...form, countedCash: event.target.value })}
                placeholder="240000"
                className="h-11 w-full rounded-md border border-white/10 bg-[#252525] px-3 pl-12 text-sm text-white outline-none focus:border-[#ff5656]"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">د.ع</span>
            </div>
          </label>
          {difference !== null ? (
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-3">
              <span className="text-sm font-semibold text-white">الفرق</span>
              <DifferenceLabel value={difference} />
            </div>
          ) : null}
          <label className="grid gap-1 text-sm font-medium text-zinc-200">
            ملاحظة الإغلاق
            <textarea
              value={form.closingNote}
              onChange={(event) => onChange({ ...form, closingNote: event.target.value })}
              placeholder="فرق 10,000 قيد المراجعة"
              className="min-h-20 rounded-md border border-white/10 bg-[#252525] p-3 text-sm text-white outline-none focus:border-[#ff5656]"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-md border border-white/10 px-4 text-sm text-zinc-200 hover:bg-white/[0.04]">إلغاء</button>
          <button disabled={isSaving || !expectedCash} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Save size={16} />
            إغلاق الوردية
          </button>
        </div>
      </form>
    </div>
  );
}

function FinanceOverview({
  salesSummary,
  openShift,
  expectedCash,
  recentCashShifts,
  pendingRequests,
  unpaidPurchases,
  payments,
  expenses,
  purchases,
  onOpenShift,
  onCloseShift,
  isSaving,
}: {
  salesSummary: FinanceSalesSummary;
  openShift: CashShift | null;
  expectedCash: ExpectedCashBreakdown | null;
  recentCashShifts: CashShift[];
  pendingRequests: PurchaseRequest[];
  unpaidPurchases: Purchase[];
  payments: PurchasePayment[];
  expenses: Expense[];
  purchases: Purchase[];
  onOpenShift: () => void;
  onCloseShift: () => void;
  isSaving: boolean;
}) {
  const today = todayKey();
  const expensesToday = expenses.filter((expense) => expense.expenseDate === today).reduce((total, expense) => total + expense.amount, 0);
  const supplierPaidToday = payments.filter((payment) => localDateKey(payment.createdAt) === today).reduce((total, payment) => total + payment.amount, 0);
  const supplierPayables = unpaidPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);
  const cashSalesToday = expectedCash?.cashSales ?? 0;
  const cashExpensesToday = expectedCash?.cashExpenses ?? 0;
  const cashSupplierPaidToday = expectedCash?.cashSupplierPayments ?? 0;
  const cashNetToday = cashSalesToday - cashExpensesToday - cashSupplierPaidToday;
  const kpis: FinanceKpi[] = [
    {
      title: "مبيعات اليوم",
      value: formatCurrency(salesSummary.salesToday),
      helper: "إجمالي المبيعات المسجلة اليوم",
      icon: TrendingUp,
      tone: "income",
    },
    {
      title: "المقبوض اليوم",
      value: formatCurrency(salesSummary.receivedToday),
      helper: "المبالغ المستلمة من المبيعات",
      icon: Banknote,
      tone: "income",
    },
    {
      title: "مصروفات اليوم",
      value: formatCurrency(expensesToday),
      helper: "إجمالي المصروفات المسجلة",
      icon: TrendingDown,
      tone: "outgoing",
    },
    {
      title: "صافي الحركة اليوم",
      value: formatCurrency(cashNetToday),
      helper: "الداخل النقدي ناقص الخارج النقدي",
      icon: Landmark,
      tone: "neutral",
    },
  ];
  const positionCards = [
    { title: "مستحقات الموردين", value: formatCurrency(supplierPayables), helper: "إجمالي المبالغ غير المسددة للموردين" },
    { title: "فواتير غير مسددة", value: formatNumber(unpaidPurchases.length), helper: "فواتير موردين تنتظر الدفع" },
    { title: "مدفوع للموردين اليوم", value: formatCurrency(supplierPaidToday), helper: "دفعات الموردين المسجلة اليوم" },
    {
      title: "الطلبات المفتوحة",
      value: `${formatNumber(salesSummary.openOrders.count)} طلبات`,
      helper: formatCurrency(salesSummary.openOrders.total),
    },
  ];
  const movements: FinanceMovement[] = [
    ...salesSummary.customerPaymentsToday.map((payment: CustomerPayment) => ({
      id: `sale:${payment.id}`,
      time: payment.createdAt,
      type: "sale" as const,
      reference: payment.orderNumber ? `#ORD-${String(payment.orderNumber).padStart(6, "0")}` : "بيع",
      description: payment.tableNumber ? `طاولة ${payment.tableNumber}` : "دفعة زبون",
      method: expensePaymentMethodLabels[payment.method],
      amount: payment.amount,
      status: payment.status === "completed" ? "مكتمل" : "ملغي",
    })),
    ...expenses.slice(0, 20).map((expense) => ({
      id: `expense:${expense.id}`,
      time: expense.createdAt,
      type: "expense" as const,
      reference: expenseVoucherNumber(expense),
      description: expense.description,
      method: expensePaymentMethodLabels[expense.paymentMethod],
      amount: expense.amount,
      status: "مدفوع",
    })),
    ...payments.slice(0, 20).map((payment) => ({
      id: `supplier-payment:${payment.id}`,
      time: payment.createdAt,
      type: "supplier-payment" as const,
      reference: purchasePaymentVoucherNumber(payment),
      description: payment.supplierName,
      method: expensePaymentMethodLabels[payment.paymentMethod],
      amount: payment.amount,
      status: "مكتمل",
    })),
    ...purchases.slice(0, 20).map((purchase) => ({
      id: `purchase:${purchase.id}`,
      time: purchase.createdAt,
      type: "purchase" as const,
      reference: `#PUR-${String(purchase.purchaseNumber).padStart(4, "0")}`,
      description: purchase.supplierName,
      method: "-",
      amount: purchase.totalAmount,
      status: purchasePaymentStatusLabels[purchase.paymentStatus],
    })),
  ]
    .sort((first, second) => new Date(second.time).getTime() - new Date(first.time).getTime())
    .slice(0, 10);
  const alerts: FinanceAlert[] = [
    ...unpaidPurchases.slice(0, 4).map((purchase) => ({
      id: `unpaid:${purchase.id}`,
      title: "فاتورة مورد بانتظار الدفع",
      description: `فاتورة شراء #${purchase.purchaseNumber} - ${purchase.supplierName}`,
      amount: purchase.totalAmount,
    })),
    ...pendingRequests.slice(0, 3).map((request) => ({
      id: `request:${request.id}`,
      title: "طلب شراء ينتظر الموافقة",
      description: `طلب شراء #${request.requestNumber} - ${request.requestedByName}`,
    })),
  ].slice(0, 6);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[#ff5656]">ملخص اليوم</p>
          <h2 className="text-xl font-semibold text-white">المؤشرات السريعة</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((card) => <KpiCard key={card.title} card={card} />)}
        </div>
      </section>

      <CashShiftCard
        openShift={openShift}
        expectedCash={expectedCash}
        recentShifts={recentCashShifts}
        onOpen={onOpenShift}
        onClose={onCloseShift}
        isSaving={isSaving}
      />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">الوضع المالي الحالي</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {positionCards.map((card) => (
            <section key={card.title} className="rounded-md border border-white/10 bg-[#303030] p-4">
              <p className="text-sm text-zinc-400">{card.title}</p>
              <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
              <p className="mt-2 text-xs text-zinc-500">{card.helper}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="space-y-4">
          <CashBoxCard receivedToday={cashSalesToday} expensesToday={cashExpensesToday} supplierPaidToday={cashSupplierPaidToday} netToday={cashNetToday} />
          <RecentCashShifts shifts={recentCashShifts.slice(0, 5)} />
          <FinancialMovements movements={movements} />
        </div>
        <FinanceAlerts alerts={alerts} />
      </section>
    </div>
  );
}

function RequestDetails({ request }: { request: PurchaseRequest }) {
  return (
    <div className="space-y-2">
      {request.items.map((item) => (
        <div key={item.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
          <p className="font-semibold text-[#2f211c]">{item.inventoryItemName}</p>
          <p className="text-[#7c6b60]">{formatNumber(item.quantity)} {item.unitCode}</p>
          {item.notes ? <p className="mt-1 text-[#9a8779]">{item.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}

function PurchaseDetails({ purchase }: { purchase: Purchase }) {
  return (
    <div className="space-y-2">
      {purchase.items.map((item) => (
        <div key={item.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-semibold text-[#2f211c]">{item.inventoryItemName}</p>
            <p className="font-semibold text-[#2f211c]">{formatCurrency(item.lineTotal)}</p>
          </div>
          <p className="text-[#7c6b60]">{formatNumber(item.quantity)} {item.unitCode} × {formatCurrency(item.unitPrice)}</p>
        </div>
      ))}
    </div>
  );
}

function InvoiceList({
  title,
  purchases,
  payments,
  expandedPurchaseId,
  setExpandedPurchaseId,
  onPay,
  onOpenPayment,
  isSaving,
}: {
  title: string;
  purchases: Purchase[];
  payments: PurchasePayment[];
  expandedPurchaseId: string | null;
  setExpandedPurchaseId: (id: string | null) => void;
  onPay: (purchase: Purchase) => void;
  onOpenPayment: (purchaseId: string) => void;
  isSaving: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">{title}</h2></div>
      {purchases.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد فواتير في هذا القسم</p> : null}
      <div className="divide-y divide-[#eee4d8]">
        {purchases.map((purchase) => {
          const payment = payments.find((item) => item.purchaseId === purchase.id);
          return (
            <article key={purchase.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#2f211c]">فاتورة شراء #{purchase.purchaseNumber}</p>
                  <p className="text-sm text-[#7c6b60]">{purchase.supplierName} · {formatCurrency(purchase.totalAmount)}</p>
                  <p className="mt-1 text-xs text-[#9a8779]">استلام: {formatDateTime(purchase.createdAt)} · المسجل: {purchase.createdByName} · الحالة: {purchasePaymentStatusLabels[purchase.paymentStatus]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setExpandedPurchaseId(expandedPurchaseId === purchase.id ? null : purchase.id)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض</button>
                  {purchase.paymentStatus === "unpaid" ? (
                    <button disabled={isSaving} type="button" onClick={() => onPay(purchase)} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-semibold text-white disabled:opacity-50"><WalletCards size={16} />تسجيل دفع</button>
                  ) : (
                    <button disabled={!payment} type="button" onClick={() => onOpenPayment(purchase.id)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6] disabled:opacity-50"><ReceiptText size={16} />عرض سند الدفع</button>
                  )}
                </div>
              </div>
              {expandedPurchaseId === purchase.id ? <div className="mt-3"><PurchaseDetails purchase={purchase} /></div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function FinanceDashboard({ mode = "finance" }: { mode?: "finance" | "adminPurchases" }) {
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salesSummary, setSalesSummary] = useState<FinanceSalesSummary | null>(null);
  const [openShift, setOpenShift] = useState<CashShift | null>(null);
  const [expectedCash, setExpectedCash] = useState<ExpectedCashBreakdown | null>(null);
  const [recentCashShifts, setRecentCashShifts] = useState<CashShift[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [expenseForm, setExpenseForm] = useState<CreateExpenseInput>(emptyExpense);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [openShiftForm, setOpenShiftForm] = useState({ openingCash: "", openingNote: "" });
  const [closeShiftForm, setCloseShiftForm] = useState({ countedCash: "", closingNote: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const realtimeReloadTimerRef = useRef<number | null>(null);

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const unpaidPurchases = purchases.filter((purchase) => purchase.paymentStatus === "unpaid");
  const paidPurchases = purchases.filter((purchase) => purchase.paymentStatus === "paid");
  const totalUnpaid = unpaidPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);
  const today = todayKey();
  const expensesToday = expenses.filter((expense) => expense.expenseDate === today).reduce((total, expense) => total + expense.amount, 0);
  const supplierPaidToday = payments.filter((payment) => localDateKey(payment.createdAt) === today).reduce((total, payment) => total + payment.amount, 0);
  const totalOutgoingToday = expensesToday + supplierPaidToday;
  const visibleRequests = mode === "finance" ? pendingRequests : requests;
  const visibleExpenses = mode === "finance" ? expenses : [];
  const title = mode === "adminPurchases" ? "متابعة دورة المشتريات" : "الحسابات";
  const subtitle = mode === "adminPurchases" ? "لوحة الإدارة" : "واجهة المحاسب";
  const overviewCards = useMemo(() => [
    { title: "طلبات شراء بانتظار الموافقة", value: formatNumber(pendingRequests.length) },
    { title: "فواتير موردين بانتظار الدفع", value: formatNumber(unpaidPurchases.length) },
    { title: "إجمالي غير مدفوع للموردين", value: formatCurrency(totalUnpaid) },
    { title: "مصروفات اليوم", value: formatCurrency(expensesToday) },
    { title: "المدفوع للموردين اليوم", value: formatCurrency(supplierPaidToday) },
    { title: "إجمالي الأموال الخارجة اليوم", value: formatCurrency(totalOutgoingToday) },
  ], [expensesToday, pendingRequests.length, supplierPaidToday, totalOutgoingToday, totalUnpaid, unpaidPurchases.length]);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError("");
    try {
      const [nextRequests, nextPurchases, nextPayments, nextExpenses, nextSalesSummary, nextOpenShift, nextExpectedCash, nextRecentCashShifts] = await Promise.all([
        getPurchaseRequests(),
        getPurchases(),
        getPurchasePayments(),
        mode === "finance" ? getExpenses() : Promise.resolve([]),
        mode === "finance" ? getFinanceSalesSummary() : Promise.resolve(null),
        mode === "finance" ? getOpenCashShift() : Promise.resolve(null),
        mode === "finance" ? getCurrentExpectedCash() : Promise.resolve(null),
        mode === "finance" ? getRecentCashShifts() : Promise.resolve([]),
      ]);
      setRequests(nextRequests);
      setPurchases(nextPurchases);
      setPayments(nextPayments);
      setExpenses(nextExpenses);
      setSalesSummary(nextSalesSummary);
      setOpenShift(nextOpenShift);
      setExpectedCash(nextExpectedCash);
      setRecentCashShifts(nextRecentCashShifts);
      return { nextRequests, nextPurchases, nextPayments, nextExpenses, nextSalesSummary, nextOpenShift, nextExpectedCash, nextRecentCashShifts };
    } catch (loadError) {
      logSupabaseError("[finance dashboard load]", loadError);
      setError("تعذر تحميل بيانات الحسابات.");
      return null;
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (mode !== "finance") {
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    function scheduleReload() {
      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
      }

      realtimeReloadTimerRef.current = window.setTimeout(() => {
        realtimeReloadTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        void loadData(false);
      }, 250);
    }

    const channel = supabase
      .channel("finance-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_payments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_shifts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, scheduleReload)
      .subscribe((status, subscriptionError) => {
        if (subscriptionError) {
          console.warn("Finance dashboard realtime subscription error", subscriptionError);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Finance dashboard realtime subscription failed", { status });
        }
      });

    return () => {
      isMounted = false;

      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [loadData, mode]);

  function flash(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  async function decide(request: PurchaseRequest, decision: "approved" | "rejected") {
    setIsSaving(true);
    setError("");
    try {
      const updated = await decidePurchaseRequest({ requestId: request.id, decision, decisionNotes: decisionNotes[request.id] });
      setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
      flash(decision === "approved" ? "تمت الموافقة على طلب الشراء" : "تم رفض طلب الشراء");
    } catch (decisionError) {
      logSupabaseError("[purchase request decision]", decisionError);
      setError("تعذر حفظ قرار طلب الشراء.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentPurchase) return;
    setIsSaving(true);
    setError("");
    try {
      const payload: PayPurchaseInput = {
        purchaseId: paymentPurchase.id,
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      };
      const paidPurchase = await payPurchase(payload);
      setPurchases((current) => current.map((purchase) => purchase.id === paidPurchase.id ? paidPurchase : purchase));
      setPaymentPurchase(null);
      setPaymentForm(emptyPayment);
      const reloaded = await loadData();
      const createdPayment = reloaded?.nextPayments.find((payment) => payment.purchaseId === paidPurchase.id) ?? null;
      if (createdPayment) setSelectedPayment(createdPayment);
      setActiveTab("invoices");
      flash("تم تسجيل دفع المورد");
    } catch (paymentError) {
      logSupabaseError("[purchase payment submit]", paymentError);
      setError("تعذر تسجيل دفع المورد.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const created = await createExpense(expenseForm);
      setExpenses((current) => [created, ...current]);
      setExpenseForm(emptyExpense);
      setIsExpenseOpen(false);
      setSelectedExpense(created);
      await loadData();
      flash("تم تسجيل المصروف");
    } catch (expenseError) {
      logSupabaseError("[accountant expense create]", expenseError);
      setError("تعذر تسجيل المصروف.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitOpenShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const openingCash = parseCashInput(openShiftForm.openingCash);
    if (openingCash === null) {
      setError("أدخل رصيداً افتتاحياً صحيحاً.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const payload: OpenCashShiftInput = {
        openingCash,
        openingNote: openShiftForm.openingNote,
      };
      const created = await openCashShift(payload);
      setOpenShift(created);
      setOpenShiftForm({ openingCash: "", openingNote: "" });
      setIsOpenShiftModalOpen(false);
      await loadData();
      flash("تم فتح الوردية");
    } catch (shiftError) {
      logSupabaseError("[cash shift open submit]", shiftError);
      setError(shiftActionError(shiftError, "open"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitCloseShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const countedCash = parseCashInput(closeShiftForm.countedCash);
    if (countedCash === null) {
      setError("أدخل النقد المعدود بشكل صحيح.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const payload: CloseCashShiftInput = {
        countedCash,
        closingNote: closeShiftForm.closingNote,
      };
      await closeCashShift(payload);
      setCloseShiftForm({ countedCash: "", closingNote: "" });
      setIsCloseShiftModalOpen(false);
      setOpenShift(null);
      setExpectedCash(null);
      await loadData();
      flash("تم إغلاق الوردية");
    } catch (shiftError) {
      logSupabaseError("[cash shift close submit]", shiftError);
      setError(shiftActionError(shiftError, "close"));
    } finally {
      setIsSaving(false);
    }
  }

  function openPaymentForPurchase(purchaseId: string) {
    const payment = payments.find((item) => item.purchaseId === purchaseId);
    if (payment) setSelectedPayment(payment);
  }

  return (
    <div className={mode === "finance" ? "-mx-4 -my-5 min-h-[calc(100vh-4rem)] space-y-5 bg-[#292929] px-4 pb-5 lg:-mx-6 lg:px-6" : "space-y-5"}>
      {mode === "finance" ? (
        <div className="-mx-4 lg:-mx-6">
          <DashboardHeader />
        </div>
      ) : (
        <section>
          <p className="text-sm text-[#7c6b60]">{subtitle}</p>
          <h1 className="text-2xl font-semibold text-[#2f211c]">{title}</h1>
        </section>
      )}

      {mode === "finance" && activeTab === "expenses" ? (
        <section className="flex justify-end">
          <button type="button" onClick={() => setIsExpenseOpen(true)} className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]">
            <ReceiptText size={18} />
            إضافة مصروف
          </button>
        </section>
      ) : null}

      {mode === "finance" ? (
        <ManagementTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} ariaLabel="أقسام الحسابات" />
      ) : null}

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {isLoading && mode === "finance" && activeTab === "overview" ? <FinanceSkeleton /> : null}
      {isLoading && (mode !== "finance" || activeTab !== "overview") ? <div className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]">جارٍ التحميل...</div> : null}

      {mode === "finance" && activeTab === "overview" && !isLoading && salesSummary ? (
        <FinanceOverview
          salesSummary={salesSummary}
          openShift={openShift}
          expectedCash={expectedCash}
          recentCashShifts={recentCashShifts}
          pendingRequests={pendingRequests}
          unpaidPurchases={unpaidPurchases}
          payments={payments}
          expenses={expenses}
          purchases={purchases}
          onOpenShift={() => {
            setOpenShiftForm({ openingCash: "", openingNote: "" });
            setIsOpenShiftModalOpen(true);
          }}
          onCloseShift={() => {
            setCloseShiftForm({ countedCash: expectedCash ? String(expectedCash.expectedCash) : "", closingNote: "" });
            setIsCloseShiftModalOpen(true);
          }}
          isSaving={isSaving}
        />
      ) : null}

      {mode !== "finance" ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map((card) => <Card key={card.title} title={card.title} value={card.value} />)}
        </section>
      ) : null}

      {(mode !== "finance" || activeTab === "requests") ? (
        <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">طلبات الشراء</h2></div>
          {visibleRequests.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد طلبات مطابقة حالياً</p> : null}
          <div className="divide-y divide-[#eee4d8]">
            {visibleRequests.map((request) => (
              <article key={request.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#2f211c]">طلب شراء #{request.requestNumber}</p>
                    <p className="text-sm text-[#7c6b60]">{purchaseRequestStatusLabels[request.status]} · {request.requestedByName} · {formatDateTime(request.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setExpandedRequestId(expandedRequestId === request.id ? null : request.id)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض</button>
                    {request.status === "pending" ? (
                      <>
                        <button disabled={isSaving} type="button" onClick={() => void decide(request, "approved")} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16} />موافقة</button>
                        <button disabled={isSaving} type="button" onClick={() => void decide(request, "rejected")} className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-700 px-3 text-sm font-semibold text-white disabled:opacity-50"><XCircle size={16} />رفض</button>
                      </>
                    ) : null}
                  </div>
                </div>
                {request.status === "pending" ? (
                  <input value={decisionNotes[request.id] ?? ""} onChange={(event) => setDecisionNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="ملاحظة القرار اختيارية" className="mt-3 h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
                ) : null}
                {expandedRequestId === request.id ? <div className="mt-3"><RequestDetails request={request} /></div> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(mode !== "finance" || activeTab === "invoices") ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <InvoiceList title="بانتظار الدفع" purchases={unpaidPurchases} payments={payments} expandedPurchaseId={expandedPurchaseId} setExpandedPurchaseId={setExpandedPurchaseId} onPay={setPaymentPurchase} onOpenPayment={openPaymentForPurchase} isSaving={isSaving} />
          <InvoiceList title="مدفوعة" purchases={paidPurchases} payments={payments} expandedPurchaseId={expandedPurchaseId} setExpandedPurchaseId={setExpandedPurchaseId} onPay={setPaymentPurchase} onOpenPayment={openPaymentForPurchase} isSaving={isSaving} />
        </section>
      ) : null}

      {mode === "finance" && activeTab === "expenses" ? (
        <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">المصروفات</h2></div>
          {visibleExpenses.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد مصروفات مسجلة</p> : null}
          <div className="divide-y divide-[#eee4d8]">
            {visibleExpenses.map((expense) => (
              <div key={expense.id} className="grid gap-3 p-4 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="space-y-1">
                  <p className="font-semibold text-[#2f211c]">{expenseVoucherNumber(expense)} · {expenseCategoryLabels[expense.category]}</p>
                  <p className="text-[#4a3b34]">{expense.description}</p>
                  <p className="text-xs text-[#9a8779]">المحاسب: {expense.createdByName} · {formatDateTime(expense.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#2f211c]">{formatCurrency(expense.amount)}</span>
                  <button type="button" onClick={() => setSelectedExpense(expense)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض سند الصرف</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "finance" && activeTab === "payments" ? (
        <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">مدفوعات الموردين</h2></div>
          {payments.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد مدفوعات موردين حتى الآن</p> : null}
          <div className="divide-y divide-[#eee4d8]">
            {payments.map((payment) => (
              <div key={payment.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-1">
                  <p className="font-semibold text-[#2f211c]">{purchasePaymentVoucherNumber(payment)} · {payment.supplierName}</p>
                  <p className="text-[#7c6b60]">فاتورة شراء {payment.purchaseNumber ? `#${payment.purchaseNumber}` : "-"} · {formatCurrency(payment.amount)} · {expensePaymentMethodLabels[payment.paymentMethod]}</p>
                  <p className="text-xs text-[#9a8779]">مرجع خارجي: {payment.referenceNumber ?? "-"} · المحاسب: {payment.paidByName} · {formatDateTime(payment.createdAt)}</p>
                </div>
                <button type="button" onClick={() => setSelectedPayment(payment)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض السند</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {paymentPurchase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form onSubmit={submitPayment} className="w-full max-w-lg rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#2f211c]">تسجيل دفع المورد</h2>
            <p className="mt-1 text-sm text-[#7c6b60]">فاتورة #{paymentPurchase.purchaseNumber} · {formatCurrency(paymentPurchase.totalAmount)}</p>
            <div className="mt-4 grid gap-3">
              <select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value as ExpensePaymentMethod }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">{Object.entries(expensePaymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
                مرجع خارجي اختياري
                <input value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="رقم حوالة 45872" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
                <span className="text-xs font-normal text-[#7c6b60]">يستخدم لرقم وصل المورد أو رقم التحويل أو أي مرجع خارجي، وليس رقم سند النظام.</span>
              </label>
              <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="ملاحظات" className="min-h-24 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm outline-none" />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setPaymentPurchase(null)} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button><button disabled={isSaving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />حفظ الدفع</button></div>
          </form>
        </div>
      ) : null}

      {isExpenseOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form onSubmit={submitExpense} className="w-full max-w-xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#2f211c]">إضافة مصروف</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required min="1" type="number" value={expenseForm.amount || ""} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value ? Number(event.target.value) : 0 }))} placeholder="المبلغ" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
              <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as ExpenseCategory }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">{Object.entries(expenseCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select value={expenseForm.paymentMethod} onChange={(event) => setExpenseForm((current) => ({ ...current, paymentMethod: event.target.value as ExpensePaymentMethod }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">{Object.entries(expensePaymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
                مرجع خارجي اختياري
                <input value={expenseForm.receiptNumber ?? ""} onChange={(event) => setExpenseForm((current) => ({ ...current, receiptNumber: event.target.value }))} placeholder="رقم وصل أو تحويل" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
                <span className="text-xs font-normal text-[#7c6b60]">يستخدم لرقم وصل المورد أو رقم التحويل أو أي مرجع خارجي، وليس رقم سند النظام.</span>
              </label>
              <input required value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder="البيان" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none sm:col-span-2" />
              <textarea value={expenseForm.notes ?? ""} onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))} placeholder="ملاحظات" className="min-h-24 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm outline-none sm:col-span-2" />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setIsExpenseOpen(false)} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button><button disabled={isSaving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />حفظ المصروف</button></div>
          </form>
        </div>
      ) : null}

      {isOpenShiftModalOpen ? (
        <OpenShiftModal
          form={openShiftForm}
          onChange={setOpenShiftForm}
          onCancel={() => setIsOpenShiftModalOpen(false)}
          onSubmit={submitOpenShift}
          isSaving={isSaving}
        />
      ) : null}

      {isCloseShiftModalOpen ? (
        <CloseShiftModal
          expectedCash={expectedCash}
          form={closeShiftForm}
          onChange={setCloseShiftForm}
          onCancel={() => setIsCloseShiftModalOpen(false)}
          onSubmit={submitCloseShift}
          isSaving={isSaving}
        />
      ) : null}

      {selectedPayment ? <PurchasePaymentVoucherDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} /> : null}
      {selectedExpense ? <ExpenseVoucherDialog expense={selectedExpense} onClose={() => setSelectedExpense(null)} /> : null}
    </div>
  );
}
