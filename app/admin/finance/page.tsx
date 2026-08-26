"use client";

import { CalendarDays, Eye, Landmark, Plus, ReceiptText, Save, WalletCards, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExpenseVoucherDialog, expenseVoucherNumber } from "@/components/finance/ExpenseVoucherDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { createExpense, getExpenses } from "@/services/financeService";
import type { CreateExpenseInput, Expense, ExpenseCategory, ExpensePaymentMethod, ExpenseSummary } from "@/types/finance";
import { expenseCategoryLabels, expensePaymentMethodLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";
const categories = Object.keys(expenseCategoryLabels) as ExpenseCategory[];
const paymentMethods = Object.keys(expensePaymentMethodLabels) as ExpensePaymentMethod[];

const emptyForm: CreateExpenseInput = {
  amount: 0,
  category: "electricity",
  paymentMethod: "cash",
  receiptNumber: "",
  description: "",
  notes: "",
};

function getBaghdadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: baghdadTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function startOfBaghdadWeek(today: string) {
  const date = parseDate(today);
  const offset = (date.getUTCDay() + 1) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(today: string) {
  const [year, month] = today.split("-");
  return year + "-" + month + "-01";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(parseDate(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function summarizeExpenses(expenses: Expense[]): ExpenseSummary {
  const today = getBaghdadDate();
  const weekStart = startOfBaghdadWeek(today);
  const monthStart = startOfMonth(today);

  return expenses.reduce<ExpenseSummary>((summary, expense) => {
    const amount = Number.isFinite(expense.amount) ? expense.amount : 0;
    if (expense.expenseDate === today) {
      summary.todayTotal += amount;
      summary.todayCount += 1;
    }
    if (expense.expenseDate >= weekStart && expense.expenseDate <= today) summary.weekTotal += amount;
    if (expense.expenseDate >= monthStart && expense.expenseDate <= today) summary.monthTotal += amount;
    return summary;
  }, { todayTotal: 0, weekTotal: 0, monthTotal: 0, todayCount: 0 });
}

function FinanceCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Landmark }) {
  return (
    <div className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-[#2f211c]">{value}</p>
    </div>
  );
}

export default function AdminFinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<CreateExpenseInput>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const summary = useMemo(() => summarizeExpenses(expenses), [expenses]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialExpenses() {
      try {
        const nextExpenses = await getExpenses();
        if (!isMounted) return;
        setExpenses(nextExpenses);
      } catch (loadError) {
        logSupabaseError("[finance expenses load]", loadError);
        if (isMounted) setError("تعذر تحميل المصروفات");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadInitialExpenses();
    return () => { isMounted = false; };
  }, []);

  function updateForm<K extends keyof CreateExpenseInput>(key: K, value: CreateExpenseInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function openForm() {
    setForm({ ...emptyForm });
    setFormError("");
    setIsFormOpen(true);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }
    if (!form.description.trim()) {
      setFormError("الوصف مطلوب");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const created = await createExpense({ ...form, amount, description: form.description.trim() });
      setExpenses((current) => [created, ...current]);
      setIsFormOpen(false);
      setSelectedExpense(created);
    } catch (saveError) {
      logSupabaseError("[finance expense create]", saveError);
      setFormError("تعذر حفظ المصروف. تأكد من تطبيق migration وصلاحية المدير.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">لوحة الإدارة</p>
          <h1 className="text-2xl font-semibold text-[#2f211c]">الحسابات</h1>
        </div>
        <button type="button" onClick={openForm} className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]"><Plus size={18} />إضافة مصروف</button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceCard title="مصروفات اليوم" value={formatCurrency(summary.todayTotal)} icon={WalletCards} />
        <FinanceCard title="مصروفات هذا الأسبوع" value={formatCurrency(summary.weekTotal)} icon={CalendarDays} />
        <FinanceCard title="مصروفات هذا الشهر" value={formatCurrency(summary.monthTotal)} icon={Landmark} />
        <FinanceCard title="عدد العمليات اليوم" value={new Intl.NumberFormat("en-US").format(summary.todayCount)} icon={ReceiptText} />
      </section>

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eee4d8] p-4">
          <h2 className="font-semibold text-[#2f211c]">آخر المصروفات</h2>
          {isLoading ? <span className="text-sm text-[#7c6b60]">جارٍ التحميل...</span> : null}
        </div>
        {error ? <p className="m-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {!isLoading && !error && expenses.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد مصروفات مسجلة حتى الآن</p> : null}
        {expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-right text-sm">
              <thead className="bg-[#fbfaf7] text-[#7c6b60]">
                <tr>
                  <th className="px-3 py-3 font-medium">رقم السند</th>
                  <th className="px-3 py-3 font-medium">تاريخ العملية</th>
                  <th className="px-3 py-3 font-medium">وقت التسجيل</th>
                  <th className="px-3 py-3 font-medium">التصنيف</th>
                  <th className="px-3 py-3 font-medium">الوصف</th>
                  <th className="px-3 py-3 font-medium">المبلغ</th>
                  <th className="px-3 py-3 font-medium">طريقة الدفع</th>
                  <th className="px-3 py-3 font-medium">المسجل بواسطة</th>
                  <th className="px-3 py-3 font-medium">السند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-[#fffaf4]">
                    <td className="px-3 py-3 font-semibold text-[#2f211c]">{expenseVoucherNumber(expense)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatDate(expense.expenseDate)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatDateTime(expense.createdAt)}</td>
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{expenseCategoryLabels[expense.category]}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{expense.description}</td>
                    <td className="px-3 py-3 font-semibold text-[#2f211c]">{formatCurrency(expense.amount)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{expensePaymentMethodLabels[expense.paymentMethod]}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{expense.createdByName}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelectedExpense(expense)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض سند الصرف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form onSubmit={submitExpense} className="w-full max-w-2xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3">
              <div>
                <p className="text-sm text-[#7c6b60]">سند صرف جديد</p>
                <h2 className="text-xl font-semibold text-[#2f211c]">إضافة مصروف</h2>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md p-2 text-[#7c6b60] hover:bg-[#f5eee6]" aria-label="إغلاق"><X size={18} /></button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">المبلغ<input type="number" min="1" value={form.amount || ""} onChange={(event) => updateForm("amount", event.target.value ? Number(event.target.value) : 0)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">التصنيف<select value={form.category} onChange={(event) => updateForm("category", event.target.value as ExpenseCategory)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">{categories.map((category) => <option key={category} value={category}>{expenseCategoryLabels[category]}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">طريقة الدفع<select value={form.paymentMethod} onChange={(event) => updateForm("paymentMethod", event.target.value as ExpensePaymentMethod)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">{paymentMethods.map((method) => <option key={method} value={method}>{expensePaymentMethodLabels[method]}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
                مرجع خارجي اختياري
                <input value={form.receiptNumber ?? ""} onChange={(event) => updateForm("receiptNumber", event.target.value)} placeholder="رقم وصل أو تحويل" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" />
                <span className="text-xs font-normal text-[#7c6b60]">يستخدم لرقم وصل المورد أو رقم التحويل أو أي مرجع خارجي، وليس رقم سند النظام.</span>
              </label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34] md:col-span-2">الوصف<input value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="فاتورة كهرباء" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34] md:col-span-2">ملاحظات<textarea value={form.notes ?? ""} onChange={(event) => updateForm("notes", event.target.value)} className="min-h-24 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 outline-none" /></label>
            </div>

            {formError ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsFormOpen(false)} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button>
              <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:bg-stone-300"><Save size={16} />{isSaving ? "جارٍ الحفظ..." : "حفظ المصروف"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedExpense ? <ExpenseVoucherDialog expense={selectedExpense} onClose={() => setSelectedExpense(null)} /> : null}
    </div>
  );
}

