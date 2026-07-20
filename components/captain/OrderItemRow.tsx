import { Minus, Plus, StickyNote, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { OrderItem } from "@/types/pos";

type OrderItemRowProps = {
  orderItem: OrderItem;
  isNoteOpen: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  onToggleNote: () => void;
  onNoteChange: (note: string) => void;
};

export function OrderItemRow({
  orderItem,
  isNoteOpen,
  onIncrease,
  onDecrease,
  onRemove,
  onToggleNote,
  onNoteChange,
}: OrderItemRowProps) {
  const itemTotal = orderItem.item.price * orderItem.quantity;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-stone-950">{orderItem.item.name}</h3>
          <p className="mt-1 text-xs text-stone-500">
            {formatCurrency(orderItem.item.price)} × {orderItem.quantity}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold text-[#4c5a35]">{formatCurrency(itemTotal)}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center rounded-lg border border-stone-200">
          <button
            type="button"
            onClick={onIncrease}
            className="flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-50"
            aria-label="زيادة الكمية"
          >
            <Plus size={16} />
          </button>
          <span className="flex h-9 min-w-9 items-center justify-center border-x border-stone-200 text-sm font-bold">
            {orderItem.quantity}
          </span>
          <button
            type="button"
            onClick={onDecrease}
            className="flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
            disabled={orderItem.quantity === 1}
            aria-label="تقليل الكمية"
          >
            <Minus size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleNote}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
            aria-label="ملاحظة"
          >
            <StickyNote size={16} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50"
            aria-label="حذف"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isNoteOpen ? (
        <textarea
          value={orderItem.note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="بدون بصل، حار، تقديم لاحقًا..."
          rows={2}
          className="mt-3 w-full resize-none rounded-lg border border-stone-200 bg-[#fbfaf6] px-3 py-2 text-sm outline-none transition focus:border-[#4c5a35]"
        />
      ) : orderItem.note ? (
        <p className="mt-3 rounded-lg bg-[#eef1e8] px-3 py-2 text-xs leading-5 text-[#394427]">{orderItem.note}</p>
      ) : null}
    </div>
  );
}
