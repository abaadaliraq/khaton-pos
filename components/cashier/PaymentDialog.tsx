"use client";

import { X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { getBillTotals } from "@/lib/cashierCalculations";
import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierOrder, PaymentMethod, PaymentRecord } from "@/types/cashier";

type PaymentDialogProps = {
  order: CashierOrder | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (payment: PaymentRecord) => Promise<boolean>;
};

const methods: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "نقدي" },
  { id: "card", label: "بطاقة" },
  { id: "transfer", label: "تحويل" },
  { id: "mixed", label: "دفع مختلط" },
];

export function PaymentDialog({ order, isOpen, isSubmitting, onClose, onConfirm }: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  const totals = useMemo(() => (order ? getBillTotals(order) : null), [order]);

  if (!isOpen || !order || !totals) {
    return null;
  }

  const remaining = totals.remainingAmount;
  const cash = Number(cashAmount || 0);
  const receivedForCash = method === "cash" ? cash : 0;
  const mixedTotal = Number(cashAmount || 0) + Number(cardAmount || 0) + Number(transferAmount || 0);
  const changeAmount = method === "cash" && cash > remaining ? cash - remaining : 0;

  function resetAndClose() {
    setError("");
    setCashAmount("");
    setCardAmount("");
    setTransferAmount("");
    setReference("");
    setMethod("cash");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");

    if (method === "cash" && (!Number.isFinite(cash) || cash < remaining)) {
      setError("المبلغ المستلم أقل من المبلغ المطلوب.");
      return;
    }

    if ((method === "card" || method === "transfer") && remaining <= 0) {
      setError("لا يوجد مبلغ متبقٍ للتحصيل.");
      return;
    }

    if (method === "mixed" && (!Number.isFinite(mixedTotal) || mixedTotal !== remaining)) {
      setError("مجموع مبالغ الدفع المختلط يجب أن يساوي المبلغ المطلوب.");
      return;
    }

    const didRecordPayment = await onConfirm({
      id: `PAY-${Date.now()}`,
      method,
      amount: remaining,
      receivedAmount: method === "cash" ? receivedForCash : undefined,
      changeAmount: method === "cash" ? changeAmount : undefined,
      reference: reference.trim() || undefined,
      createdAt: new Intl.DateTimeFormat("ar-IQ", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()),
    });

    if (didRecordPayment) {
      resetAndClose();
    }
  }

  return (
    <div className="cashier-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#2C211D]">تحصيل الدفع</h2>
          <button type="button" onClick={resetAndClose} className="rounded-lg border border-[#d8c9b7] p-2">
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 rounded-lg bg-[#F7F1E8] p-3 text-sm">
          <div className="flex justify-between">
            <span>الإجمالي</span>
            <span className="font-semibold">{formatCurrency(totals.total)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>المتبقي</span>
            <span className="font-semibold text-[#7B3F32]">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {methods.map((paymentMethod) => (
            <button
              key={paymentMethod.id}
              type="button"
              onClick={() => setMethod(paymentMethod.id)}
              disabled={isSubmitting}
              className={`h-10 rounded-lg border text-sm ${method === paymentMethod.id ? "border-[#B85F4A] bg-[#B85F4A] text-white" : "border-[#d8c9b7]"}`}
            >
              {paymentMethod.label}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="mt-3">
            <input
            value={cashAmount}
            onChange={(event) => setCashAmount(event.target.value)}
            disabled={isSubmitting}
            inputMode="numeric"
              className="h-11 w-full rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 outline-none focus:border-[#B85F4A] focus:bg-white"
              placeholder="المبلغ المستلم"
            />
            <p className="mt-2 text-sm text-[#3B8F8B]">الباقي للزبون: {formatCurrency(Math.max(0, changeAmount))}</p>
          </div>
        ) : null}

        {method === "card" || method === "transfer" ? (
          <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          disabled={isSubmitting}
          className="mt-3 h-11 w-full rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 outline-none focus:border-[#B85F4A] focus:bg-white"
            placeholder="مرجع اختياري"
          />
        ) : null}

        {method === "mixed" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} disabled={isSubmitting} inputMode="numeric" className="h-11 rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 outline-none" placeholder="مبلغ نقدي" />
            <input value={cardAmount} onChange={(event) => setCardAmount(event.target.value)} disabled={isSubmitting} inputMode="numeric" className="h-11 rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 outline-none" placeholder="مبلغ بطاقة" />
            <input value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} disabled={isSubmitting} inputMode="numeric" className="h-11 rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 outline-none" placeholder="مبلغ تحويل" />
          </div>
        ) : null}

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#7B3F32]">{error}</p> : null}

        <button type="submit" disabled={isSubmitting} className="mt-4 h-11 w-full rounded-lg bg-[#B85F4A] font-semibold text-white hover:bg-[#7B3F32] disabled:bg-stone-300">
          {isSubmitting ? "جارٍ تسجيل الدفع..." : "تأكيد الدفع"}
        </button>
      </form>
    </div>
  );
}
