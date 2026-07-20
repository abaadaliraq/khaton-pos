import { formatCurrency } from "@/lib/formatCurrency";
import type { BillTotals } from "@/types/cashier";

type BillSummaryProps = {
  totals: BillTotals;
};

export function BillSummary({ totals }: BillSummaryProps) {
  const rows = [
    ["المجموع الفرعي", totals.subtotal],
    ["الخصم", totals.discountAmount],
    ["رسوم الخدمة", totals.serviceFee],
    ["المبلغ المدفوع", totals.paidAmount],
    ["المبلغ المتبقي", totals.remainingAmount],
  ] as const;

  return (
    <div className="rounded-lg bg-[#F7F1E8] p-3 text-sm">
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-[#6f5b52]">
            <span>{label}</span>
            <span>{formatCurrency(value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#d8c9b7] pt-3 text-base font-semibold text-[#2C211D]">
        <span>الإجمالي النهائي</span>
        <span>{formatCurrency(totals.total)}</span>
      </div>
    </div>
  );
}
