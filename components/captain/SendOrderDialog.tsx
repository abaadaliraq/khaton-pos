import { CheckCircle2, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { RestaurantTable } from "@/types/pos";

type SendOrderDialogProps = {
  isOpen: boolean;
  selectedTable: RestaurantTable | null;
  itemCount: number;
  subtotal: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function SendOrderDialog({
  isOpen,
  selectedTable,
  itemCount,
  subtotal,
  onClose,
  onConfirm,
}: SendOrderDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-[#4c5a35]" size={22} />
            <h2 className="text-lg font-bold text-stone-950">تأكيد إرسال الطلب</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-[#fbfaf6] p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">الطاولة</span>
            <span className="font-bold text-stone-950">{selectedTable ? selectedTable.id : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">عدد الأصناف</span>
            <span className="font-bold text-stone-950">{itemCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">الإجمالي</span>
            <span className="font-bold text-[#4c5a35]">{formatCurrency(subtotal)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-lg bg-[#4c5a35] text-sm font-bold text-white hover:bg-[#394427]"
          >
            تأكيد
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-stone-200 text-sm font-bold text-stone-700 hover:bg-stone-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
