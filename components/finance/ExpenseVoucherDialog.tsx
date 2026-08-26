"use client";

import { Printer, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { Expense } from "@/types/finance";
import { expenseCategoryLabels, expensePaymentMethodLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";

export function expenseVoucherNumber(expense: Expense) {
  return `EXP-${String(expense.expenseNumber).padStart(6, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function VoucherLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
      <p className="text-xs text-[#7c6b60]">{label}</p>
      <p className="mt-1 font-semibold text-[#2f211c]">{value || "-"}</p>
    </div>
  );
}

export function ExpenseVoucherDialog({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const voucherNumber = expenseVoucherNumber(expense);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="finance-expense-voucher w-full max-w-2xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <div className="finance-expense-voucher-actions mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] px-4 text-sm text-[#4a3b34]" aria-label="إغلاق"><X size={16} />إغلاق</button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white"><Printer size={16} />طباعة السند</button>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-[#2f211c]">خاتون</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#2f211c]">سند صرف</h2>
          <p className="mt-3 text-xl font-bold text-[#a65f3f]">سند رقم {voucherNumber}</p>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <VoucherLine label="رقم السند" value={voucherNumber} />
          <VoucherLine label="التصنيف" value={expenseCategoryLabels[expense.category]} />
          <div className="sm:col-span-2"><VoucherLine label="البيان" value={expense.description} /></div>
          <VoucherLine label="المبلغ" value={formatCurrency(expense.amount)} />
          <VoucherLine label="طريقة الدفع" value={expensePaymentMethodLabels[expense.paymentMethod]} />
          <VoucherLine label="مرجع خارجي" value={expense.receiptNumber ?? "-"} />
          <VoucherLine label="تاريخ العملية" value={formatDate(expense.expenseDate)} />
          <VoucherLine label="وقت العملية" value={formatTime(expense.createdAt)} />
          <VoucherLine label="اسم المحاسب" value={expense.createdByName} />
          <div className="sm:col-span-2"><VoucherLine label="الملاحظات" value={expense.notes ?? "-"} /></div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-[#4a3b34]">
          <div className="border-t border-[#7c6b60] pt-2">توقيع المستلم</div>
          <div className="border-t border-[#7c6b60] pt-2">توقيع المحاسب</div>
          <div className="border-t border-[#7c6b60] pt-2">الختم</div>
        </div>
      </section>
    </div>
  );
}
