import { formatCurrency } from "@/lib/formatCurrency";

type OrderSummaryProps = {
  subtotal: number;
};

export function OrderSummary({ subtotal }: OrderSummaryProps) {
  return (
    <div className="captain-summary space-y-2 p-3 text-sm">
      <div className="captain-muted flex items-center justify-between">
        <span>المجموع الفرعي</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="captain-muted flex items-center justify-between">
        <span>الضريبة</span>
        <span>{formatCurrency(0)}</span>
      </div>
      <div className="captain-muted flex items-center justify-between">
        <span>الخدمة</span>
        <span>{formatCurrency(0)}</span>
      </div>
      <div className="captain-divider border-t pt-2">
        <div className="captain-heading flex items-center justify-between text-base font-bold">
          <span>الإجمالي النهائي</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
