import { getBillTotals } from "@/lib/cashierCalculations";
import { formatBaghdadDate, formatBaghdadTime, formatOrderLabel } from "@/lib/displayFormat";
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
  const printedAt = new Date();
  const hasHumanOrderNumber = Number.isFinite(order.orderNumber);
  const rounds = order.rounds?.length ? order.rounds : [order];

  return (
    <section className="cashier-print-receipt hidden" dir="rtl">
      <header className="receipt-header">
        <h1>مطعم وكافيه خاتون</h1>
        <p className="receipt-brand-en">Khatoun Restaurant & Cafe</p>
        <h2>فاتورة الطاولة</h2>
        <p className="receipt-payment-status">بانتظار الدفع</p>
      </header>

      <div className="receipt-meta">
        <div className="receipt-row"><span>الطاولة</span><span>{order.tableId}</span></div>
        {hasHumanOrderNumber ? <div className="receipt-row"><span>الطلب</span><span>{formatOrderLabel(order.orderNumber)}</span></div> : null}
        <div className="receipt-row"><span>التاريخ</span><span>{formatBaghdadDate(printedAt)}</span></div>
        <div className="receipt-row"><span>الوقت</span><span>{formatBaghdadTime(printedAt)}</span></div>
        <div className="receipt-row"><span>الكابتن</span><span>{order.captainName}</span></div>
        <div className="receipt-row"><span>الكاشير</span><span>{session.name}</span></div>
      </div>

      <div className="receipt-divider" />

      <div className="receipt-items" aria-label="أصناف فاتورة الطاولة">
        {rounds.map((round) => (
          <section key={round.id} className="receipt-round">
            <div className="receipt-table-heading">
              <span>{round.roundNo > 1 ? `إضافة #${round.roundNo}` : "الطلب الأساسي"}</span>
              <span>{formatOrderLabel(round.orderNumber)}</span>
            </div>
            {round.items.map((item) => (
              <article key={item.id} className="receipt-item">
                <h3>{item.name}</h3>
                <div className="receipt-row">
                  <span>
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </span>
                  <span>{formatCurrency(item.quantity * item.unitPrice)}</span>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>

      <div className="receipt-divider" />

      <div className="receipt-totals">
        <div className="receipt-row"><span>المجموع الفرعي</span><span>{formatCurrency(totals.subtotal)}</span></div>
        <div className="receipt-row"><span>الخصم</span><span>{formatCurrency(totals.discountAmount)}</span></div>
        <div className="receipt-row"><span>الخدمة</span><span>{formatCurrency(totals.serviceFee)}</span></div>
        <div className="receipt-total-row"><span>الإجمالي</span><span>{formatCurrency(totals.total)}</span></div>
      </div>

      <div className="receipt-unpaid">*** غير مدفوع ***</div>

      <footer className="receipt-footer">
        <p>شكراً لزيارتكم</p>
        <p>مطعم وكافيه خاتون</p>
        <small>هذه الفاتورة لعرض الحساب وليست إثباتاً للدفع</small>
      </footer>
    </section>
  );
}
