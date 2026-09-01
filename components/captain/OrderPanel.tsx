import { ShoppingBag, X } from "lucide-react";
import { OrderItemRow } from "@/components/captain/OrderItemRow";
import { OrderSummary } from "@/components/captain/OrderSummary";
import { formatCurrency } from "@/lib/formatCurrency";
import type { OrderItem, RestaurantTable } from "@/types/pos";

type OrderPanelProps = {
  orderItems: OrderItem[];
  selectedTable: RestaurantTable | null;
  subtotal: number;
  itemCount: number;
  isMobileOpen: boolean;
  noteItemId: string | null;
  onMobileOpen: () => void;
  onMobileClose: () => void;
  onIncrease: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onToggleNote: (itemId: string) => void;
  onNoteChange: (itemId: string, note: string) => void;
  onSend: () => void;
};

function PanelContent({
  orderItems,
  selectedTable,
  subtotal,
  noteItemId,
  onIncrease,
  onDecrease,
  onRemove,
  onToggleNote,
  onNoteChange,
  onSend,
}: Omit<OrderPanelProps, "itemCount" | "isMobileOpen" | "onMobileOpen" | "onMobileClose">) {
  const canSend = Boolean(selectedTable) && orderItems.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="captain-divider border-b pb-3">
        <p className="captain-muted text-xs">سلة الطلب</p>
        <h2 className="captain-heading text-xl font-bold">
          {selectedTable ? `طاولة ${selectedTable.id}` : "لم تختر طاولة"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {orderItems.length > 0 ? (
          <div className="space-y-2">
            {orderItems.map((orderItem) => (
              <OrderItemRow
                key={orderItem.item.id}
                orderItem={orderItem}
                isNoteOpen={noteItemId === orderItem.item.id}
                onIncrease={() => onIncrease(orderItem.item.id)}
                onDecrease={() => onDecrease(orderItem.item.id)}
                onRemove={() => onRemove(orderItem.item.id)}
                onToggleNote={() => onToggleNote(orderItem.item.id)}
                onNoteChange={(note) => onNoteChange(orderItem.item.id, note)}
              />
            ))}
          </div>
        ) : (
          <div className="captain-empty-state flex h-56 flex-col items-center justify-center text-center">
            <ShoppingBag size={30} />
            <p className="mt-3 text-sm font-medium">السلة فارغة</p>
          </div>
        )}
      </div>

      <div className="captain-divider space-y-3 border-t pt-3">
        <OrderSummary subtotal={subtotal} />
        <button
          type="button"
          disabled={!canSend}
          onClick={onSend}
          className="captain-primary-button h-12 w-full text-sm font-bold"
        >
          إرسال الطلب
        </button>
      </div>
    </div>
  );
}

export function OrderPanel(props: OrderPanelProps) {
  return (
    <>
      <aside className="captain-card hidden h-[calc(100vh-88px)] p-4 lg:sticky lg:top-[76px] lg:block">
        <PanelContent {...props} />
      </aside>

      <button
        type="button"
        onClick={props.onMobileOpen}
        className="captain-primary-button fixed inset-x-4 bottom-4 z-40 flex h-14 items-center justify-between px-4 font-bold shadow-lg lg:hidden"
      >
        <span className="flex items-center gap-2 font-bold">
          <ShoppingBag size={20} />
          {props.itemCount} صنف
        </span>
        <span className="font-bold">{formatCurrency(props.subtotal)}</span>
      </button>

      {props.isMobileOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 lg:hidden">
          <div className="captain-card h-[82vh] w-full rounded-t-lg p-4 shadow-xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={props.onMobileClose}
                className="captain-icon-button p-2"
                aria-label="إغلاق السلة"
              >
                <X size={18} />
              </button>
            </div>
            <PanelContent {...props} />
          </div>
        </div>
      ) : null}
    </>
  );
}
