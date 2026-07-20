import { formatCurrency } from "@/lib/formatCurrency";

type OrderSummaryProps = {
  subtotal: number;
};

export function OrderSummary({ subtotal }: OrderSummaryProps) {
  return (
    <div className="space-y-2 rounded-lg bg-[#fbfaf6] p-3 text-sm">
      <div className="flex items-center justify-between text-stone-600">
        <span>المجموع الفرعي</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between text-stone-600">
        <span>الضريبة</span>
        <span>{formatCurrency(0)}</span>
      </div>
      <div className="flex items-center justify-between text-stone-600">
        <span>الخدمة</span>
        <span>{formatCurrency(0)}</span>
      </div>
      <div className="border-t border-stone-200 pt-2">
        <div className="flex items-center justify-between text-base font-bold text-stone-950">
          <span>الإجمالي النهائي</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
