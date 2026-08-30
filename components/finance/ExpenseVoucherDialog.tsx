"use client";

import { Printer, X } from "lucide-react";
import Image from "next/image";
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
    <div className="rounded-md border border-[#e4d8c8] bg-white p-3">
      <p className="text-xs font-medium text-[#7c6b60]">{label}</p>
      <p className="mt-1 font-semibold leading-6 text-[#2f211c]">{value || "-"}</p>
    </div>
  );
}

function SignatureBox({ label, tall = false }: { label: string; tall?: boolean }) {
  return (
    <div className={`flex flex-col justify-end rounded-md border border-[#d9c8b5] bg-white px-3 pb-3 text-center text-sm font-semibold text-[#4a3b34] ${tall ? "min-h-24" : "min-h-20"}`}>
      <span className="border-t border-[#7c6b60] pt-2">{label}</span>
    </div>
  );
}

export function ExpenseVoucherDialog({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const voucherNumber = expenseVoucherNumber(expense);
  const hasReceiptNumber = Boolean(expense.receiptNumber?.trim());
  const hasNotes = Boolean(expense.notes?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4">
      <section className="finance-expense-voucher w-full max-w-3xl rounded-md border border-[#dccbb8] bg-[#fffdf9] p-5 shadow-xl">
        <div className="finance-expense-voucher-actions mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] px-4 text-sm text-[#4a3b34]" aria-label="إغلاق"><X size={16} />إغلاق</button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white"><Printer size={16} />طباعة السند</button>
        </div>

        <div className="rounded-md border border-[#e4d8c8] bg-white p-5">
          <div className="grid gap-4 border-b border-[#e4d8c8] pb-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="text-right">
              <p className="text-lg font-bold text-[#2f211c]">مطعم وكافيه خاتون</p>
              <p className="mt-1 text-xs font-medium text-[#7c6b60]">وثيقة صرف رسمية</p>
            </div>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-md border border-[#eadccd] bg-white p-2">
              <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={72} height={72} className="h-full w-full object-contain" priority />
            </div>
            <div className="text-right sm:text-left">
              <p className="text-sm font-semibold text-[#7c6b60]">رقم السند</p>
              <p className="mt-1 text-2xl font-bold text-[#a65f3f]">{voucherNumber}</p>
            </div>
          </div>

          <div className="mt-5 text-center">
            <h2 className="text-3xl font-bold text-[#2f211c]">سند صرف</h2>
            <p className="mt-2 text-sm text-[#7c6b60]">تم تحرير هذا السند وفق بيانات المصروف المسجلة في نظام خاتون</p>
          </div>

          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <VoucherLine label="التاريخ" value={formatDate(expense.expenseDate)} />
            <VoucherLine label="الوقت" value={formatTime(expense.createdAt)} />
            <VoucherLine label="التصنيف" value={expenseCategoryLabels[expense.category]} />
            <VoucherLine label="طريقة الدفع" value={expensePaymentMethodLabels[expense.paymentMethod]} />
            <div className="sm:col-span-2"><VoucherLine label="البيان" value={expense.description} /></div>
            <div className="sm:col-span-2 rounded-md border border-[#d9c8b5] bg-[#fbf7f1] p-4 text-center">
              <p className="text-sm font-medium text-[#7c6b60]">المبلغ</p>
              <p className="mt-2 text-3xl font-bold text-[#2f211c]">{formatCurrency(expense.amount)}</p>
            </div>
            <VoucherLine label="اسم المحاسب" value={expense.createdByName} />
            {hasReceiptNumber ? <VoucherLine label="رقم الفاتورة / الوصل الخارجي" value={expense.receiptNumber ?? ""} /> : null}
            {hasNotes ? <div className="sm:col-span-2"><VoucherLine label="الملاحظات" value={expense.notes ?? ""} /></div> : null}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SignatureBox label="توقيع المستلم" />
            <SignatureBox label="توقيع المحاسب" />
            <SignatureBox label="اعتماد الإدارة" />
            <SignatureBox label="مكان الختم" tall />
          </div>

          <p className="mt-6 border-t border-[#e4d8c8] pt-3 text-center text-xs font-medium text-[#7c6b60]">تم إصدار هذا السند إلكترونياً من نظام خاتون</p>
        </div>
      </section>
    </div>
  );
}
