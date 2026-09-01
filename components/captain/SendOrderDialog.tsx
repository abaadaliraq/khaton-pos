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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="captain-card w-full max-w-md p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="captain-accent" size={22} />
            <h2 className="captain-heading text-lg font-bold">تأكيد إرسال الطلب</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="captain-icon-button p-2"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="captain-summary mt-4 space-y-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="captain-muted">الطاولة</span>
            <span className="captain-heading font-bold">{selectedTable ? selectedTable.id : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="captain-muted">عدد الأصناف</span>
            <span className="captain-heading font-bold">{itemCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="captain-muted">الإجمالي</span>
            <span className="captain-accent font-bold">{formatCurrency(subtotal)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="captain-primary-button h-11 text-sm font-bold"
          >
            تأكيد
          </button>
          <button
            type="button"
            onClick={onClose}
            className="captain-secondary-button h-11 text-sm font-bold"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
