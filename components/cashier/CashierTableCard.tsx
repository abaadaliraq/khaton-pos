import clsx from "clsx";
import { Clock, ReceiptText, UserRound } from "lucide-react";
import { getBillTotals } from "@/lib/cashierCalculations";
import { formatBaghdadTime, formatOrderLabel, getElapsedMinutes } from "@/lib/displayFormat";
import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierOrderRawStatus, CashierTable, CashierTableStatus } from "@/types/cashier";

const statusLabel: Record<CashierTableStatus, string> = {
  available: "فارغة",
  occupied: "طلب مفتوح",
  waiting_payment: "بانتظار الدفع",
  paid: "مدفوعة - بانتظار الإخلاء",
  reserved: "محجوزة",
};

const statusClass: Record<CashierTableStatus, string> = {
  available: "border-stone-200 bg-stone-50 text-stone-600",
  occupied: "border-[#B85F4A]/30 bg-[#B85F4A]/10 text-[#7B3F32]",
  waiting_payment: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-[#3B8F8B]/25 bg-[#3B8F8B]/10 text-[#2f7470]",
  reserved: "border-slate-200 bg-slate-50 text-slate-600",
};

const orderStatusLabel: Record<CashierOrderRawStatus, string> = {
  submitted: "طلب مرسل",
  preparing: "قيد التحضير",
  ready: "جاهز للتقديم",
  served: "تم التقديم",
  awaiting_payment: "بانتظار الدفع",
  paid: "مدفوعة",
};

const orderStatusClass: Record<CashierOrderRawStatus, string> = {
  submitted: "border-[#B85F4A]/30 bg-[#B85F4A]/10 text-[#7B3F32]",
  preparing: "border-[#B85F4A]/30 bg-[#B85F4A]/10 text-[#7B3F32]",
  ready: "border-sky-200 bg-sky-50 text-sky-800",
  served: "border-violet-200 bg-violet-50 text-violet-800",
  awaiting_payment: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-[#3B8F8B]/25 bg-[#3B8F8B]/10 text-[#2f7470]",
};

function getDuration(openedAt?: string) {
  const diffMinutes = getElapsedMinutes(openedAt);

  if (diffMinutes === null) {
    return "-";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} دقيقة`;
  }

  return `${Math.floor(diffMinutes / 60)}س ${diffMinutes % 60}د`;
}

type CashierTableCardProps = {
  table: CashierTable;
  isSelected: boolean;
  onSelect: (table: CashierTable) => void;
};

export function CashierTableCard({ table, isSelected, onSelect }: CashierTableCardProps) {
  const totals = table.order ? getBillTotals(table.order) : null;
  const itemCount =
    table.order?.rounds?.reduce((roundTotal, round) => roundTotal + round.items.reduce((total, item) => total + item.quantity, 0), 0) ??
    table.order?.items.reduce((total, item) => total + item.quantity, 0) ??
    0;
  const displayedStatus = table.order?.rawStatus;
  const isAwaitingRelease = displayedStatus === "paid" && table.status === "paid";
  const unpaidCount = table.unpaidOrders?.length ?? 0;
  const additionRounds = table.order?.rounds?.filter((round) => round.roundNo > 1).sort((first, second) => second.roundNo - first.roundNo) ?? [];
  const featuredAddition = additionRounds.find((round) => round.isNewAddition) ?? additionRounds[0];
  const featuredAdditionTotal =
    featuredAddition?.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0) ?? 0;
  const featuredAdditionItemCount = featuredAddition?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const featuredAdditionStatus = featuredAddition?.isNewAddition ? "جديدة" : featuredAddition ? orderStatusLabel[featuredAddition.rawStatus] : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      className={clsx(
        "min-h-44 rounded-lg border bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-[#B85F4A]",
        isSelected ? "border-[#B85F4A] ring-2 ring-[#B85F4A]/15" : "border-[#d8c9b7]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#7a665c]">طاولة</p>
          <h3 className="text-2xl font-semibold text-[#2C211D]">{table.id}</h3>
        </div>
        <span className={clsx("rounded-full border px-2 py-1 text-xs font-medium", displayedStatus ? orderStatusClass[displayedStatus] : statusClass[table.status])}>
          {displayedStatus ? orderStatusLabel[displayedStatus] : statusLabel[table.status]}
        </span>
      </div>
      {isAwaitingRelease ? (
        <p className="mt-2 rounded-lg border border-[#3B8F8B]/20 bg-[#3B8F8B]/10 px-3 py-2 text-xs font-medium text-[#2f7470]">
          بانتظار الإخلاء
        </p>
      ) : null}

      {table.order ? (
        <div className="mt-3 space-y-2 text-sm text-[#6f5b52]">
          <div className="flex items-center gap-2">
            <ReceiptText size={15} />
            <span>{unpaidCount > 1 ? `${unpaidCount} طلبات غير مدفوعة` : formatOrderLabel(table.order.orderNumber)}</span>
          </div>
          {featuredAddition ? (
            <div
              className={clsx(
                "rounded-lg border px-3 py-2",
                featuredAddition.isNewAddition
                  ? "border-[#B85F4A]/40 bg-[#B85F4A]/10 text-[#7B3F32]"
                  : "border-[#eadfce] bg-[#F7F1E8] text-[#6f5b52]",
              )}
            >
              <p className="font-semibold">
                {featuredAddition.isNewAddition ? "إضافة جديدة" : "إضافة"} #{featuredAddition.roundNo}
              </p>
              <p className="mt-1 text-xs">
                {featuredAdditionStatus} • {featuredAdditionItemCount} صنف • {formatCurrency(featuredAdditionTotal)}
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <UserRound size={15} />
            <span>{table.order.captainName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={15} />
            <span>
              {formatBaghdadTime(table.order.openedAt)} / {getDuration(table.order.openedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-[#eadfce] pt-2">
            <span>{itemCount} صنف</span>
            <span className="font-semibold text-[#7B3F32]">{totals ? formatCurrency(totals.total) : "-"}</span>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-sm text-[#7a665c]">لا يوجد طلب مفتوح على هذه الطاولة</p>
      )}
    </button>
  );
}
