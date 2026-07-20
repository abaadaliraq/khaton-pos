import { Banknote, CheckCircle2, ReceiptText, Utensils } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

type CashierStatsProps = {
  openTables: number;
  paidInvoices: number;
  sales: number;
  unpaid: number;
};

const items = [
  { key: "openTables", label: "الطاولات المفتوحة", icon: Utensils },
  { key: "paidInvoices", label: "الفواتير المدفوعة", icon: CheckCircle2 },
  { key: "sales", label: "المبيعات الحالية", icon: Banknote },
  { key: "unpaid", label: "غير المدفوع", icon: ReceiptText },
] as const;

export function CashierStats({ openTables, paidInvoices, sales, unpaid }: CashierStatsProps) {
  const values = {
    openTables,
    paidInvoices,
    sales: formatCurrency(sales),
    unpaid: formatCurrency(unpaid),
  };

  return (
    <section className="cashier-no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.key} className="rounded-lg border border-[#d8c9b7] bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#7a665c]">{item.label}</span>
              <Icon className="text-[#B85F4A]" size={18} />
            </div>
            <p className="mt-2 text-xl font-semibold text-[#2C211D]">{values[item.key]}</p>
          </article>
        );
      })}
    </section>
  );
}
