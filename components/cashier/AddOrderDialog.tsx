"use client";

import { Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { MenuItem, OrderItem } from "@/types/pos";
import type { CashierTable } from "@/types/cashier";

type AddOrderDialogProps = {
  table: CashierTable | null;
  items: MenuItem[];
  orderItems: OrderItem[];
  searchTerm: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onSearchChange: (value: string) => void;
  onAddItem: (item: MenuItem) => void;
  onIncrease: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function AddOrderDialog({
  table,
  items,
  orderItems,
  searchTerm,
  isOpen,
  isSubmitting,
  onSearchChange,
  onAddItem,
  onIncrease,
  onDecrease,
  onRemove,
  onClose,
  onSubmit,
}: AddOrderDialogProps) {
  if (!isOpen || !table) {
    return null;
  }

  const subtotal = orderItems.reduce((total, orderItem) => total + orderItem.item.price * orderItem.quantity, 0);

  return (
    <div className="cashier-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#2C211D]">إضافة طلب</h2>
            <p className="mt-1 text-sm text-[#7a665c]">طاولة {table.id} / طلب إضافي</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8c9b7] p-2 text-[#2C211D]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a665c]" size={18} />
              <input
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#d8c9b7] bg-[#F7F1E8] px-3 pr-10 outline-none focus:border-[#B85F4A] focus:bg-white"
                placeholder="ابحث عن صنف..."
              />
            </div>
            <div className="mt-3 grid max-h-[48vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAddItem(item)}
                  disabled={item.price <= 0}
                  className="rounded-lg border border-[#eadfce] p-3 text-right transition hover:border-[#B85F4A] disabled:opacity-50"
                >
                  <span className="block font-semibold text-[#2C211D]">{item.name}</span>
                  {item.description ? <span className="mt-1 block text-xs text-[#7a665c]">{item.description}</span> : null}
                  <span className="mt-2 block text-sm font-bold text-[#7B3F32]">{formatCurrency(item.price)}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col rounded-lg border border-[#eadfce] bg-[#F7F1E8] p-3">
            <h3 className="font-semibold text-[#2C211D]">سلة الإضافة</h3>
            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
              {orderItems.length ? (
                orderItems.map((orderItem) => (
                  <article key={orderItem.item.id} className="rounded-lg bg-white p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-[#2C211D]">{orderItem.item.name}</span>
                      <span className="font-semibold text-[#7B3F32]">{formatCurrency(orderItem.item.price * orderItem.quantity)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <button type="button" onClick={() => onRemove(orderItem.item.id)} className="text-xs font-medium text-[#7B3F32]">
                        حذف
                      </button>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onDecrease(orderItem.item.id)} className="h-8 w-8 rounded-md border border-[#d8c9b7]">-</button>
                        <span className="w-6 text-center font-semibold">{orderItem.quantity}</span>
                        <button type="button" onClick={() => onIncrease(orderItem.item.id)} className="h-8 w-8 rounded-md border border-[#d8c9b7]">+</button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[#d8c9b7] p-4 text-center text-sm text-[#7a665c]">لم تتم إضافة أصناف بعد</p>
              )}
            </div>
            <div className="mt-3 border-t border-[#d8c9b7] pt-3">
              <div className="flex justify-between font-semibold text-[#2C211D]">
                <span>الإجمالي</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!orderItems.length || isSubmitting}
                className="mt-3 h-11 w-full rounded-lg bg-[#B85F4A] font-semibold text-white hover:bg-[#7B3F32] disabled:bg-stone-300"
              >
                {isSubmitting ? "جارٍ الإرسال..." : "إرسال للمطبخ"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
