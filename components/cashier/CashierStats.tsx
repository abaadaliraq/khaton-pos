import { Banknote, CheckCircle2, HandCoins, ReceiptText, Utensils } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

type CashierStatsProps = {
  openTables: number;
  paidInvoices: number;
  sales: number;
  tips: number;
  unpaid: number;
};

const items = [
  { key: "openTables", label: "الطاولات المفتوحة", icon: Utensils },
  { key: "paidInvoices", label: "الفواتير المدفوعة", icon: CheckCircle2 },
  { key: "sales", label: "المبيعات اليوم", icon: Banknote },
  { key: "tips", label: "البقشيش اليوم", icon: HandCoins },
  { key: "unpaid", label: "غير المدفوع", icon: ReceiptText },
] as const;

export function CashierStats({ openTables, paidInvoices, sales, tips, unpaid }: CashierStatsProps) {
  const values = {
    openTables,
    paidInvoices,
    sales: formatCurrency(sales),
    tips: formatCurrency(tips),
    unpaid: formatCurrency(unpaid),
  };

  return (
    <section className="cashier-no-print grid grid-cols-2 gap-3 lg:grid-cols-5">
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
