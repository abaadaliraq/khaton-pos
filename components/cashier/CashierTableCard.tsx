import clsx from "clsx";
import { Clock, ReceiptText, UserRound } from "lucide-react";
import { getBillTotals } from "@/lib/cashierCalculations";
import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierTable, CashierTableStatus } from "@/types/cashier";

const statusLabel: Record<CashierTableStatus, string> = {
  available: "فارغة",
  occupied: "طلب مفتوح",
  waiting_payment: "بانتظار الدفع",
  paid: "مدفوعة",
  reserved: "محجوزة",
};

const statusClass: Record<CashierTableStatus, string> = {
  available: "border-stone-200 bg-stone-50 text-stone-600",
  occupied: "border-[#B85F4A]/30 bg-[#B85F4A]/10 text-[#7B3F32]",
  waiting_payment: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-[#3B8F8B]/25 bg-[#3B8F8B]/10 text-[#2f7470]",
  reserved: "border-slate-200 bg-slate-50 text-slate-600",
};

function getDuration(openedAt?: string) {
  if (!openedAt) {
    return "-";
  }

  const [hour, minute] = openedAt.split(":").map(Number);
  const opened = new Date();
  opened.setHours(hour, minute, 0, 0);
  const diffMinutes = Math.max(0, Math.round((Date.now() - opened.getTime()) / 60000));

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
  const itemCount = table.order?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

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
        <span className={clsx("rounded-full border px-2 py-1 text-xs font-medium", statusClass[table.status])}>
          {statusLabel[table.status]}
        </span>
      </div>

      {table.order ? (
        <div className="mt-3 space-y-2 text-sm text-[#6f5b52]">
          <div className="flex items-center gap-2">
            <ReceiptText size={15} />
            <span>{table.order.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserRound size={15} />
            <span>{table.order.captainName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={15} />
            <span>
              {table.order.openedAt} / {getDuration(table.order.openedAt)}
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
