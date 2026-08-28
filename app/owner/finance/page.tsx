"use client";

import { Eye, Landmark, ReceiptText, TrendingDown, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExpenseVoucherDialog, expenseVoucherNumber } from "@/components/finance/ExpenseVoucherDialog";
import { PurchasePaymentVoucherDialog, purchasePaymentVoucherNumber } from "@/components/finance/PurchasePaymentVoucherDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { getOwnerFinanceData, type OwnerFinanceData } from "@/services/ownerFinanceService";
import type { Expense, PurchasePayment } from "@/types/finance";
import { expenseCategoryLabels, expensePaymentMethodLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";

function getBaghdadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}

function startOfMonth(today: string) {
  const [year, month] = today.split("-");
  return year + "-" + month + "-01";
}

function localDateKey(value: string) {
  return getBaghdadDate(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function SummaryCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Landmark }) {
  return (
    <article className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-[#e4d8c8] bg-[#fbfaf7] p-5 text-center text-sm text-[#7c6b60]">{message}</p>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="h-4 w-28 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-8 w-36 rounded bg-[#efe7dc]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
        <div className="h-72 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
      </div>
    </div>
  );
}

function ExpensesPanel({ expenses, onOpenVoucher }: { expenses: Expense[]; onOpenVoucher: (expense: Expense) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">آخر المصروفات</h2></div>
      {expenses.length === 0 ? <div className="p-4"><EmptyState message="لا توجد مصروفات مسجلة حالياً." /></div> : null}
      <div className="divide-y divide-[#eee4d8]">
        {expenses.map((expense) => (
          <article key={expense.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#2f211c]">{expenseVoucherNumber(expense)}</span><span className="rounded-md bg-[#f5eee6] px-2 py-1 text-xs font-semibold text-[#a65f3f]">{expenseCategoryLabels[expense.category]}</span></div>
              <p className="mt-2 font-medium text-[#2f211c]">{expense.description}</p>
              <p className="mt-1 text-xs text-[#7c6b60]">المحاسب: {expense.createdByName} · {formatDateTime(expense.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end"><span className="font-semibold text-[#2f211c]">{formatCurrency(expense.amount)}</span><button type="button" onClick={() => onOpenVoucher(expense)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض السند</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PaymentsPanel({ payments, onOpenVoucher }: { payments: PurchasePayment[]; onOpenVoucher: (payment: PurchasePayment) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">آخر دفعات الموردين</h2></div>
      {payments.length === 0 ? <div className="p-4"><EmptyState message="لا توجد دفعات موردين مسجلة حالياً." /></div> : null}
      <div className="divide-y divide-[#eee4d8]">
        {payments.map((payment) => (
          <article key={payment.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#2f211c]">{purchasePaymentVoucherNumber(payment)}</span><span className="rounded-md bg-[#f5eee6] px-2 py-1 text-xs font-semibold text-[#a65f3f]">{expensePaymentMethodLabels[payment.paymentMethod]}</span></div>
              <p className="mt-2 font-medium text-[#2f211c]">{payment.supplierName}</p>
              <p className="mt-1 text-xs text-[#7c6b60]">المحاسب: {payment.paidByName} · {formatDateTime(payment.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end"><span className="font-semibold text-[#2f211c]">{formatCurrency(payment.amount)}</span><button type="button" onClick={() => onOpenVoucher(payment)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض السند</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function OwnerFinancePage() {
  const [data, setData] = useState<OwnerFinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadFinance() {
      try {
        const nextData = await getOwnerFinanceData();
        if (!isMounted) return;
        setData(nextData);
        setErrorMessage(nextData.errors.length > 0 ? "تعذر تحميل بعض بيانات الحسابات." : "");
      } catch (error) {
        console.error("Failed to load owner finance data", error);
        if (!isMounted) return;
        setErrorMessage("تعذر تحميل بعض بيانات الحسابات.");
        setData({ expenses: [], payments: [], purchases: [], errors: ["finance"] });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadFinance();
    return () => { isMounted = false; };
  }, []);

  const summary = useMemo(() => {
    const today = getBaghdadDate();
    const monthStart = startOfMonth(today);
    const expenses = data?.expenses ?? [];
    const payments = data?.payments ?? [];
    const purchases = data?.purchases ?? [];
    const totalPurchases = purchases.reduce((total, purchase) => total + purchase.totalAmount, 0);
    const totalPayments = payments.reduce((total, payment) => total + payment.amount, 0);

    return {
      expensesToday: expenses.filter((expense) => expense.expenseDate === today).reduce((total, expense) => total + expense.amount, 0),
      expensesMonth: expenses.filter((expense) => expense.expenseDate >= monthStart && expense.expenseDate <= today).reduce((total, expense) => total + expense.amount, 0),
      supplierPaymentsToday: payments.filter((payment) => localDateKey(payment.createdAt) === today).reduce((total, payment) => total + payment.amount, 0),
      supplierPaymentsMonth: payments.filter((payment) => {
        const paymentDate = localDateKey(payment.createdAt);
        return paymentDate >= monthStart && paymentDate <= today;
      }).reduce((total, payment) => total + payment.amount, 0),
      supplierPayables: Math.max(totalPurchases - totalPayments, 0),
      unpaidInvoiceCount: purchases.filter((purchase) => purchase.paymentStatus === "unpaid").length,
    };
  }, [data]);

  const latestExpenses = (data?.expenses ?? []).slice(0, 10);
  const latestPayments = (data?.payments ?? []).slice(0, 10);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة الشركاء</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">الحسابات</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">متابعة المصروفات ومدفوعات الموردين والمبالغ المستحقة من بيانات النظام الحالية.</p>
      </section>

      {errorMessage ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard title="مصروفات اليوم" value={formatCurrency(summary.expensesToday)} icon={TrendingDown} />
            <SummaryCard title="مصروفات هذا الشهر" value={formatCurrency(summary.expensesMonth)} icon={Landmark} />
            <SummaryCard title="دفعات الموردين اليوم" value={formatCurrency(summary.supplierPaymentsToday)} icon={WalletCards} />
            <SummaryCard title="دفعات الموردين هذا الشهر" value={formatCurrency(summary.supplierPaymentsMonth)} icon={ReceiptText} />
            <SummaryCard title="إجمالي المبالغ المستحقة للموردين" value={formatCurrency(summary.supplierPayables)} icon={WalletCards} />
            <SummaryCard title="عدد فواتير الموردين غير المدفوعة" value={formatNumber(summary.unpaidInvoiceCount) + " فاتورة"} icon={ReceiptText} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ExpensesPanel expenses={latestExpenses} onOpenVoucher={setSelectedExpense} />
            <PaymentsPanel payments={latestPayments} onOpenVoucher={setSelectedPayment} />
          </div>
        </>
      )}

      {selectedExpense ? <ExpenseVoucherDialog expense={selectedExpense} onClose={() => setSelectedExpense(null)} /> : null}
      {selectedPayment ? <PurchasePaymentVoucherDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} /> : null}
    </div>
  );
}

