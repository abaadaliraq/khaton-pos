import { getBillTotals, getPaymentLabel } from "@/lib/cashierCalculations";
import { formatCurrency } from "@/lib/formatCurrency";
import type { CashierOrder } from "@/types/cashier";
import type { UserSession } from "@/types/auth";

type PrintReceiptProps = {
  order: CashierOrder | null;
  session: UserSession;
};

export function PrintReceipt({ order, session }: PrintReceiptProps) {
  if (!order) {
    return null;
  }

  const totals = getBillTotals(order);
  const lastPayment = order.payments[order.payments.length - 1];

  return (
    <section className="cashier-print-receipt hidden" dir="rtl">
      <h1>خاتون / KHATOUN</h1>
      <p>رقم الطلب: {order.id}</p>
      <p>رقم الطاولة: {order.tableId}</p>
      <p>التاريخ والوقت: {new Intl.DateTimeFormat("ar-IQ", { dateStyle: "short", timeStyle: "short" }).format(new Date())}</p>
      <p>المحاسب: {session.name}</p>
      <hr />
      {order.items.map((item) => (
        <div key={item.id} className="receipt-row">
          <span>
            {item.quantity} × {item.name}
          </span>
          <span>{formatCurrency(item.quantity * item.unitPrice)}</span>
        </div>
      ))}
      <hr />
      <div className="receipt-row"><span>المجموع</span><span>{formatCurrency(totals.subtotal)}</span></div>
      <div className="receipt-row"><span>الخصم</span><span>{formatCurrency(totals.discountAmount)}</span></div>
      <div className="receipt-row"><span>الإجمالي</span><span>{formatCurrency(totals.total)}</span></div>
      <div className="receipt-row"><span>طريقة الدفع</span><span>{lastPayment ? getPaymentLabel(lastPayment.method) : "-"}</span></div>
      <p className="receipt-thanks">شكرًا لزيارتكم</p>
    </section>
  );
}
