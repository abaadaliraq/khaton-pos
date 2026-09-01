"use client";

import { Printer, X } from "lucide-react";
import Image from "next/image";
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="voucher-field break-inside-avoid border-b border-[#e3e3e3] pb-2">
      <p className="text-[11px] font-medium text-[#666]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#1c1c1c]">{value || "-"}</p>
    </div>
  );
}

function ReferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-[#d7d7d7] py-2 last:border-b-0">
      <p className="text-xs font-medium text-[#666]">{label}</p>
      <p className="text-sm font-bold text-[#1c1c1c]">{value || "-"}</p>
    </div>
  );
}

export function PurchasePaymentVoucherDialog({ payment, onClose }: { payment: PurchasePayment; onClose: () => void }) {
  const voucherNumber = purchasePaymentVoucherNumber(payment);
  const notes = payment.notes?.trim() || "لا توجد ملاحظات";

  return (
    <div className="finance-payment-voucher-backdrop fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4">
      <section className="finance-payment-voucher mx-auto w-full max-w-[210mm] rounded-md bg-white p-5 text-[#1c1c1c] shadow-2xl">
        <div className="finance-payment-voucher-actions mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-[#dedede] p-2 text-[#1c1c1c] hover:bg-[#f5f5f5]"><X size={16} /></button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2c0000] px-4 text-sm font-semibold text-white hover:bg-[#430707]"><Printer size={16} />طباعة السند</button>
        </div>

        <article className="finance-payment-voucher-paper overflow-hidden rounded-md border border-[#d8d8d8] bg-white p-8">
          <header className="voucher-header break-inside-avoid border-b-2 border-[#2c0000] pb-4">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-3">
                <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={54} height={54} className="h-14 w-14 object-contain" />
                <div>
                  <p className="text-lg font-extrabold text-[#1c1c1c]">مطعم وكافيه خاتون</p>
                  <p className="mt-1 text-xs font-medium text-[#666]">نظام إدارة خاتون</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-xl font-extrabold tracking-normal text-[#2c0000]">{voucherNumber}</p>
                <p className="mt-1 text-sm font-semibold text-[#1c1c1c]">{formatDate(payment.createdAt)}</p>
              </div>
            </div>
          </header>

          <section className="voucher-title break-inside-avoid py-6 text-center">
            <h2 className="text-3xl font-extrabold text-[#1c1c1c]">سند دفع مورد</h2>
            <p className="mt-2 text-[11px] font-bold tracking-[0.18em] text-[#666]">SUPPLIER PAYMENT VOUCHER</p>
          </section>

          <section className="voucher-meta break-inside-avoid border-y border-[#dedede] py-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <DetailField label="رقم السند" value={voucherNumber} />
              <DetailField label="تاريخ السند" value={formatDate(payment.createdAt)} />
              <DetailField label="وقت السند" value={formatTime(payment.createdAt)} />
            </div>
          </section>

          <section className="voucher-amount break-inside-avoid mx-auto mt-6 max-w-md rounded-md border-2 border-[#2c0000] bg-[#faf7f6] p-5 text-center">
            <p className="text-sm font-bold text-[#666]">المبلغ المدفوع</p>
            <p className="mt-2 text-4xl font-extrabold leading-tight text-[#1c1c1c]">{formatCurrency(payment.amount)}</p>
          </section>

          <section className="voucher-section break-inside-avoid mt-6">
            <h3 className="border-b border-[#2c0000] pb-2 text-sm font-extrabold text-[#2c0000]">بيانات المورد والدفع</h3>
            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailField label="اسم المورد" value={payment.supplierName} />
              <DetailField label="طريقة الدفع" value={expensePaymentMethodLabels[payment.paymentMethod]} />
              <DetailField label="اسم المحاسب" value={payment.paidByName} />
              <DetailField label="تاريخ الدفع" value={formatDate(payment.createdAt)} />
              <DetailField label="وقت الدفع" value={formatTime(payment.createdAt)} />
              <DetailField label="فاتورة الشراء" value={payment.purchaseNumber ? `#${payment.purchaseNumber}` : "-"} />
            </div>
          </section>

          <section className="voucher-section break-inside-avoid mt-6">
            <h3 className="border-b border-[#2c0000] pb-2 text-sm font-extrabold text-[#2c0000]">بيانات المرجع</h3>
            <div className="mt-2">
              <ReferenceRow label="رقم فاتورة الشراء" value={payment.purchaseNumber ? `#${payment.purchaseNumber}` : "-"} />
              <ReferenceRow label="رقم فاتورة المورد" value={payment.supplierInvoiceNumber ?? "-"} />
              <ReferenceRow label="المرجع الخارجي" value={payment.referenceNumber ?? "-"} />
            </div>
          </section>

          <section className="voucher-notes break-inside-avoid mt-5">
            <h3 className="text-sm font-extrabold text-[#2c0000]">ملاحظات</h3>
            <p className="mt-2 min-h-10 rounded-md border border-[#dedede] bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#1c1c1c]">{notes}</p>
          </section>

          <section className="voucher-signatures break-inside-avoid mt-8 grid grid-cols-3 gap-6 text-center text-sm font-bold text-[#1c1c1c]">
            <div className="pt-7">
              <div className="border-t border-[#1c1c1c] pt-2">توقيع المستلم</div>
            </div>
            <div className="pt-7">
              <div className="border-t border-[#1c1c1c] pt-2">توقيع المحاسب</div>
            </div>
            <div className="pt-7">
              <div className="border-t border-[#1c1c1c] pt-2">الختم / اعتماد الإدارة</div>
            </div>
          </section>

          <footer className="voucher-footer mt-7 flex items-center justify-between gap-4 border-t border-[#dedede] pt-3 text-[9px] font-medium text-[#666]">
            <p>تم إنشاء هذا السند إلكترونياً بواسطة نظام إدارة مطعم وكافيه خاتون</p>
            <p>رقم السند: {voucherNumber}</p>
          </footer>
        </article>
      </section>
    </div>
  );
}
