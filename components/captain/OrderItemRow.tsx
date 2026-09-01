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
    <div className="captain-subcard p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="captain-heading font-bold">{orderItem.item.name}</h3>
          <p className="captain-muted mt-1 text-xs">
            {formatCurrency(orderItem.item.price)} × {orderItem.quantity}
          </p>
        </div>
        <p className="captain-accent shrink-0 text-sm font-bold">{formatCurrency(itemTotal)}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="captain-stepper flex items-center">
          <button
            type="button"
            onClick={onIncrease}
            className="flex h-9 w-9 items-center justify-center"
            aria-label="زيادة الكمية"
          >
            <Plus size={16} />
          </button>
          <span className="flex h-9 min-w-9 items-center justify-center border-x text-sm font-bold">
            {orderItem.quantity}
          </span>
          <button
            type="button"
            onClick={onDecrease}
            className="flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed"
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
            className="captain-icon-button flex h-9 w-9 items-center justify-center"
            aria-label="ملاحظة"
          >
            <StickyNote size={16} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ff5656]/25 text-[#ff5656] hover:bg-[#ff5656]/10"
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
          className="captain-input mt-3 w-full resize-none px-3 py-2"
        />
      ) : orderItem.note ? (
        <p className="mt-3 rounded-lg bg-[#ff5656]/10 px-3 py-2 text-xs leading-5 text-[#ff5656]">{orderItem.note}</p>
      ) : null}
    </div>
  );
}
