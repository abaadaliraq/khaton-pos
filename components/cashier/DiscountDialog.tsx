"use client";

import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import { getBillTotals } from "@/lib/cashierCalculations";
import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierOrder, DiscountData, DiscountType } from "@/types/cashier";

type DiscountDialogProps = {
  order: CashierOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: (discount: DiscountData) => void;
};

export function DiscountDialog({ order, isOpen, onClose, onApply }: DiscountDialogProps) {
  const [type, setType] = useState<DiscountType>("fixed");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (!isOpen || !order) {
    return null;
  }

  const subtotal = getBillTotals(order).subtotal;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError("أدخل قيمة خصم صحيحة.");
      return;
    }

    if (type === "percent" && numericValue > 100) {
      setError("لا يمكن أن تتجاوز نسبة الخصم 100%.");
      return;
    }

    if (type === "fixed" && numericValue > subtotal) {
      setError("لا يمكن أن يكون الخصم أكبر من قيمة الفاتورة.");
      return;
    }

    setError("");
    onApply({ type, value: numericValue });
    setValue("");
    onClose();
  }

  return (
    <div className="cashier-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#2C211D]">إضافة خصم</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8c9b7] p-2">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-[#7a665c]">قيمة الفاتورة قبل الخصم: {formatCurrency(subtotal)}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={`h-10 rounded-lg border text-sm ${type === "fixed" ? "border-[#B85F4A] bg-[#B85F4A] text-white" : "border-[#d8c9b7]"}`}
          >
            مبلغ ثابت
          </button>
          <button
            type="button"
            onClick={() => setType("percent")}
            className={`h-10 rounded-lg border text-sm ${type === "percent" ? "border-[#B85F4A] bg-[#B85F4A] text-white" : "border-[#d8c9b7]"}`}
          >
            نسبة مئوية
          </button>
        </div>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="numeric"
          className="mt-3 h-11 w-full rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 outline-none focus:border-[#B85F4A] focus:bg-white"
          placeholder={type === "fixed" ? "مثال: 5000" : "مثال: 10"}
        />
        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#7B3F32]">{error}</p> : null}

        <button type="submit" className="mt-4 h-11 w-full rounded-lg bg-[#B85F4A] font-semibold text-white hover:bg-[#7B3F32]">
          تطبيق الخصم
        </button>
      </form>
    </div>
  );
}
