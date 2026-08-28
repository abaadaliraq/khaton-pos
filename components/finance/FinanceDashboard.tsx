"use client";

import { CheckCircle2, Eye, ReceiptText, Save, WalletCards, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ExpenseVoucherDialog, expenseVoucherNumber } from "@/components/finance/ExpenseVoucherDialog";
import { PurchasePaymentVoucherDialog, purchasePaymentVoucherNumber } from "@/components/finance/PurchasePaymentVoucherDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { createExpense, getExpenses } from "@/services/financeService";
import { decidePurchaseRequest, getPurchasePayments, getPurchaseRequests, getPurchases, payPurchase } from "@/services/purchaseService";
import type { CreateExpenseInput, Expense, ExpenseCategory, ExpensePaymentMethod, PayPurchaseInput, Purchase, PurchasePayment, PurchaseRequest } from "@/types/finance";
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

function Card({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </section>
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
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [expenseForm, setExpenseForm] = useState<CreateExpenseInput>(emptyExpense);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextRequests, nextPurchases, nextPayments, nextExpenses] = await Promise.all([
        getPurchaseRequests(),
        getPurchases(),
        getPurchasePayments(),
        mode === "finance" ? getExpenses() : Promise.resolve([]),
      ]);
      setRequests(nextRequests);
      setPurchases(nextPurchases);
      setPayments(nextPayments);
      setExpenses(nextExpenses);
      return { nextRequests, nextPurchases, nextPayments, nextExpenses };
    } catch (loadError) {
      logSupabaseError("[finance dashboard load]", loadError);
      setError("تعذر تحميل بيانات الحسابات.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

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
      flash("تم تسجيل المصروف");
    } catch (expenseError) {
      logSupabaseError("[accountant expense create]", expenseError);
      setError("تعذر تسجيل المصروف.");
    } finally {
      setIsSaving(false);
    }
  }

  function openPaymentForPurchase(purchaseId: string) {
    const payment = payments.find((item) => item.purchaseId === purchaseId);
    if (payment) setSelectedPayment(payment);
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">{subtitle}</p>
          <h1 className="text-2xl font-semibold text-[#2f211c]">{title}</h1>
        </div>
        {mode === "finance" && activeTab === "expenses" ? (
          <button type="button" onClick={() => setIsExpenseOpen(true)} className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]">
            <ReceiptText size={18} />
            إضافة مصروف
          </button>
        ) : null}
      </section>

      {mode === "finance" ? (
        <nav className="flex flex-wrap gap-2 rounded-md border border-[#e4d8c8] bg-white p-2 shadow-sm">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`h-10 rounded-md px-4 text-sm font-semibold ${activeTab === tab.id ? "bg-[#5d4032] text-white" : "text-[#4a3b34] hover:bg-[#f5eee6]"}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      ) : null}

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]">جارٍ التحميل...</div> : null}

      {(mode !== "finance" || activeTab === "overview") ? (
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

      {selectedPayment ? <PurchasePaymentVoucherDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} /> : null}
      {selectedExpense ? <ExpenseVoucherDialog expense={selectedExpense} onClose={() => setSelectedExpense(null)} /> : null}
    </div>
  );
}
