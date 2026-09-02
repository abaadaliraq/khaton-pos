import { FileText, Percent, Plus, Printer, Wallet, X } from "lucide-react";
import { BillItems } from "@/components/cashier/BillItems";
import { BillSummary } from "@/components/cashier/BillSummary";
import { getBillTotals, getPaymentLabel } from "@/lib/cashierCalculations";
import { formatBaghdadDate, formatBaghdadTime, formatOrderLabel } from "@/lib/displayFormat";
import type { CashierTable } from "@/types/cashier";

type BillPanelProps = {
  table: CashierTable | null;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onOpenDetails: () => void;
  onOpenDiscount: () => void;
  onRemoveDiscount: () => void;
  onOpenPayment: () => void;
  onPrint: () => void;
  onOpenAddOrder: () => void;
  onOpenCloseTable: () => void;
  isPaymentSubmitting: boolean;
};

function EmptyBill() {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-[#d8c9b7] bg-white p-6 text-center text-[#7a665c]">
      <FileText size={34} />
      <p className="mt-3 font-medium">اختر طاولة تحتوي على طلب لعرض الفاتورة</p>
    </div>
  );
}

function BillContent({
  table,
  onOpenDetails,
  onOpenDiscount,
  onRemoveDiscount,
  onOpenPayment,
  onPrint,
  onOpenAddOrder,
  onOpenCloseTable,
  isPaymentSubmitting,
}: Omit<BillPanelProps, "isMobileOpen" | "onMobileClose">) {
  if (!table?.order) {
    return <EmptyBill />;
  }

  const order = table.order;
  const totals = getBillTotals(order);
  const canCollect = table.billingStatus === "payable" && totals.remainingAmount > 0 && !isPaymentSubmitting;
  const isPaid = totals.remainingAmount === 0 && order.payments.length > 0;
  const roundCount = order.rounds?.length ?? 1;
  const hasBusyAdditionalOrders = table.billingStatus === "blocked";
  const statusLabel =
    hasBusyAdditionalOrders
      ? "يوجد طلب قيد التحضير"
      : order.rawStatus === "ready"
      ? "جاهز للتقديم"
      : order.rawStatus === "served"
        ? "تم التقديم"
        : order.rawStatus === "awaiting_payment"
        ? "بانتظار الدفع"
        : table.status === "paid"
          ? "مدفوع"
          : "مفتوحة";

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#d8c9b7] bg-white p-4 shadow-sm">
      <div className="border-b border-[#eadfce] pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#7a665c]">فاتورة طاولة {table.id}</p>
            <h2 className="text-xl font-semibold text-[#2C211D]">{formatOrderLabel(order.orderNumber)}</h2>
            {roundCount > 1 ? <p className="mt-1 text-xs font-semibold text-[#7B3F32]">{roundCount} طلبات غير مدفوعة</p> : null}
          </div>
          <button
            type="button"
            onClick={onOpenDetails}
            className="rounded-lg border border-[#d8c9b7] px-3 py-2 text-sm font-medium text-[#2C211D] hover:bg-[#F7F1E8]"
          >
            عرض تفاصيل الطلب
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#6f5b52]">
          <span>الكابتن: {order.captainName}</span>
          <span>الفتح: {formatBaghdadTime(order.openedAt)}</span>
          <span>التاريخ: {formatBaghdadDate(order.openedAt)}</span>
          <span>الحالة: {statusLabel}</span>
          <span>الضيوف: {order.guests ?? "-"}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        <BillItems order={order} />
      </div>

      <div className="space-y-3 border-t border-[#eadfce] pt-3">
        <BillSummary totals={totals} />
        {order.discount ? (
          <button type="button" onClick={onRemoveDiscount} className="text-sm font-medium text-[#7B3F32]">
            إزالة الخصم الحالي
          </button>
        ) : null}
        {order.payments.length > 0 ? (
          <div className="rounded-lg border border-[#3B8F8B]/25 bg-[#3B8F8B]/10 p-2 text-xs text-[#2f7470]">
            آخر دفع: {getPaymentLabel(order.payments[order.payments.length - 1].method)}
            {order.rawStatus === "paid" ? <span className="block font-medium">بانتظار إخلاء الطاولة</span> : null}
          </div>
        ) : null}
        {hasBusyAdditionalOrders ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
            يوجد طلب إضافي قيد التحضير. يصبح الدفع متاحاً بعد وصول كل الطلبات إلى بانتظار الدفع.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenAddOrder}
            disabled={table.status === "available"}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d8c9b7] text-sm font-medium text-[#2C211D] hover:bg-[#F7F1E8] disabled:bg-stone-100 disabled:text-stone-400"
          >
            <Plus size={16} />
            إضافة طلب
          </button>
          <button
            type="button"
            onClick={onOpenDiscount}
            disabled={isPaid}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d8c9b7] text-sm font-medium text-[#2C211D] hover:bg-[#F7F1E8] disabled:bg-stone-100 disabled:text-stone-400"
          >
            <Percent size={16} />
            خصم
          </button>
          <button
            type="button"
            onClick={onOpenPayment}
            disabled={!canCollect}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#B85F4A] text-sm font-semibold text-white hover:bg-[#7B3F32] disabled:bg-stone-300"
          >
            <Wallet size={16} />
            {isPaymentSubmitting ? "جارٍ التسجيل..." : "تحصيل الدفع"}
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d8c9b7] text-sm font-medium text-[#2C211D] hover:bg-[#F7F1E8] disabled:bg-stone-100 disabled:text-stone-400"
          >
            <Printer size={16} />
            طباعة فاتورة الطاولة
          </button>
          <button
            type="button"
            onClick={onOpenCloseTable}
            disabled={!isPaid}
            className="h-11 rounded-lg bg-[#7B3F32] text-sm font-semibold text-white hover:bg-[#5f3026] disabled:bg-stone-300"
          >
            إغلاق الطاولة
          </button>
        </div>
      </div>
    </div>
  );
}

export function BillPanel(props: BillPanelProps) {
  return (
    <>
      <aside className="cashier-no-print hidden h-[calc(100vh-110px)] lg:sticky lg:top-4 lg:block">
        <BillContent {...props} />
      </aside>

      {props.isMobileOpen ? (
        <div className="cashier-no-print fixed inset-0 z-50 flex items-end bg-black/35 p-3 lg:hidden">
          <div className="h-[86vh] w-full rounded-t-lg bg-[#F7F1E8] p-3 shadow-xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={props.onMobileClose}
                className="rounded-lg border border-[#d8c9b7] bg-white p-2 text-[#2C211D]"
                aria-label="إغلاق تفاصيل الفاتورة"
              >
                <X size={18} />
              </button>
            </div>
            <BillContent {...props} />
          </div>
        </div>
      ) : null}
    </>
  );
}
