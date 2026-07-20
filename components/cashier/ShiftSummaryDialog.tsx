import { X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { ShiftSummary } from "@/types/cashier";

type ShiftSummaryDialogProps = {
  isOpen: boolean;
  summary: ShiftSummary;
  onClose: () => void;
};

export function ShiftSummaryDialog({ isOpen, summary, onClose }: ShiftSummaryDialogProps) {
  if (!isOpen) {
    return null;
  }

  const rows = [
    ["المبيعات النقدية", formatCurrency(summary.cashSales)],
    ["مبيعات البطاقة", formatCurrency(summary.cardSales)],
    ["مبيعات التحويل", formatCurrency(summary.transferSales)],
    ["إجمالي المبيعات", formatCurrency(summary.totalSales)],
    ["عدد الفواتير", summary.paidInvoices],
    ["الطاولات المفتوحة", summary.openTables],
  ] as const;

  return (
    <div className="cashier-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#2C211D]">ملخص الوردية</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8c9b7] p-2">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between rounded-lg bg-[#F7F1E8] px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
