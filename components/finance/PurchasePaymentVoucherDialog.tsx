"use client";

import { Printer, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { PurchasePayment } from "@/types/finance";
import { expensePaymentMethodLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";

export function purchasePaymentVoucherNumber(payment: PurchasePayment) {
  return payment.paymentNumber ? `PAY-${String(payment.paymentNumber).padStart(6, "0")}` : "سند دفع";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
      <p className="text-xs text-[#7c6b60]">{label}</p>
      <p className="mt-1 font-semibold text-[#2f211c]">{value || "-"}</p>
    </div>
  );
}

export function PurchasePaymentVoucherDialog({ payment, onClose }: { payment: PurchasePayment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="finance-payment-voucher w-full max-w-2xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <div className="finance-payment-voucher-actions mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]"><X size={16} /></button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white"><Printer size={16} />طباعة</button>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#2f211c]">خاتون</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#2f211c]">سند دفع مورد</h2>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <DetailLine label="رقم السند" value={purchasePaymentVoucherNumber(payment)} />
          <DetailLine label="رقم فاتورة الشراء" value={payment.purchaseNumber ? `#${payment.purchaseNumber}` : "-"} />
          <DetailLine label="اسم المورد" value={payment.supplierName} />
          <DetailLine label="المبلغ المدفوع" value={formatCurrency(payment.amount)} />
          <DetailLine label="طريقة الدفع" value={expensePaymentMethodLabels[payment.paymentMethod]} />
          <DetailLine label="مرجع خارجي" value={payment.referenceNumber ?? "-"} />
          <DetailLine label="تاريخ الدفع" value={formatDate(payment.createdAt)} />
          <DetailLine label="وقت الدفع" value={formatTime(payment.createdAt)} />
          <DetailLine label="اسم المحاسب" value={payment.paidByName} />
          <DetailLine label="رقم فاتورة المورد" value={payment.supplierInvoiceNumber ?? "-"} />
          <div className="sm:col-span-2"><DetailLine label="ملاحظات" value={payment.notes ?? "-"} /></div>
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
