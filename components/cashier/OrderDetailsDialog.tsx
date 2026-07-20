import { X } from "lucide-react";
import { BillItems } from "@/components/cashier/BillItems";
import { BillSummary } from "@/components/cashier/BillSummary";
import { getBillTotals } from "@/lib/cashierCalculations";
import type { CashierOrder } from "@/types/cashier";

type OrderDetailsDialogProps = {
  order: CashierOrder | null;
  isOpen: boolean;
  onClose: () => void;
};

export function OrderDetailsDialog({ order, isOpen, onClose }: OrderDetailsDialogProps) {
  if (!isOpen || !order) {
    return null;
  }

  return (
    <div className="cashier-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#2C211D]">تفاصيل الطلب {order.id}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8c9b7] p-2">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-[#6f5b52] sm:grid-cols-3">
          <span>طاولة {order.tableId}</span>
          <span>{order.captainName}</span>
          <span>وقت الفتح: {order.openedAt}</span>
        </div>
        <div className="mt-4">
          <BillItems order={order} />
        </div>
        <div className="mt-4">
          <BillSummary totals={getBillTotals(order)} />
        </div>
      </div>
    </div>
  );
}
