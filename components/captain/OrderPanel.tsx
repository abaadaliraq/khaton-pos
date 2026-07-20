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
      <div className="border-b border-stone-200 pb-3">
        <p className="text-xs text-stone-500">سلة الطلب</p>
        <h2 className="text-xl font-bold text-stone-950">
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
          <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-[#fbfaf6] text-center text-stone-500">
            <ShoppingBag size={30} />
            <p className="mt-3 text-sm font-medium">السلة فارغة</p>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-stone-200 pt-3">
        <OrderSummary subtotal={subtotal} />
        <button
          type="button"
          disabled={!canSend}
          onClick={onSend}
          className="h-12 w-full rounded-lg bg-[#4c5a35] text-sm font-bold text-white transition hover:bg-[#394427] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
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
      <aside className="hidden h-[calc(100vh-88px)] rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-[76px] lg:block">
        <PanelContent {...props} />
      </aside>

      <button
        type="button"
        onClick={props.onMobileOpen}
        className="fixed inset-x-4 bottom-4 z-40 flex h-14 items-center justify-between rounded-lg bg-[#4c5a35] px-4 text-white shadow-lg lg:hidden"
      >
        <span className="flex items-center gap-2 font-bold">
          <ShoppingBag size={20} />
          {props.itemCount} صنف
        </span>
        <span className="font-bold">{formatCurrency(props.subtotal)}</span>
      </button>

      {props.isMobileOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 lg:hidden">
          <div className="h-[82vh] w-full rounded-t-lg bg-white p-4 shadow-xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={props.onMobileClose}
                className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
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
