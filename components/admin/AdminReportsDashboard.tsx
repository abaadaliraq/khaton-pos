"use client";

import { BarChart3, ReceiptText, Soup, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { createClient } from "@/lib/supabase/client";
import { getAdminSalesReport } from "@/services/adminReportService";
import type {
  AdminSalesReport,
  DailyRevenuePoint,
  MenuItemSalesReport,
  OrderStatusCount,
  PaymentMethodRevenue,
  ReportPeriodPreset,
  SalesReportSummary,
  SalesReportTrend,
} from "@/types/adminReports";

const baghdadTimeZone = "Asia/Baghdad";

const periodOptions: { id: ReportPeriodPreset; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "month", label: "هذا الشهر" },
  { id: "custom", label: "فترة مخصصة" },
];

const paymentMethodLabels: Record<PaymentMethodRevenue["method"], string> = {
  cash: "نقدي",
  card: "بطاقة",
  transfer: "تحويل",
};

const orderStatusLabels: Record<OrderStatusCount["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  cancelled: "Cancelled",
};

const emptySummary: SalesReportSummary = {
  revenue: 0,
  orderCount: 0,
  mealCount: 0,
  averageOrderValue: 0,
};

function getBaghdadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: baghdadTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfBaghdadWeek(today: string) {
  const date = parseDate(today);
  const offset = (date.getUTCDay() + 1) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return formatDateInput(date);
}

function startOfMonth(today: string) {
  const [year, month] = today.split("-");
  return year + "-" + month + "-01";
}

function formatDateLabel(value: string, withWeekday = false) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "UTC",
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
  }).format(date);
}

function normalizeRange(from: string, to: string) {
  return from <= to ? { from, to } : { from: to, to: from };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getComparison(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? "جديد" : "0%";
  }

  const value = ((current - previous) / previous) * 100;
  return (value > 0 ? "+" : "") + value.toFixed(1) + "%";
}

function getComparisonTone(current: number, previous: number) {
  if (current > previous) {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }

  if (current < previous) {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }

  return "text-[#7c6b60] bg-[#fbfaf7] border-[#e4d8c8]";
}

function KpiCard({ title, value, helper, icon: Icon, previous, current }: { title: string; value: string; helper: string; icon: typeof ReceiptText; previous: number; current: number }) {
  return (
    <div className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-[#7c6b60]">{helper}</span>
        <span className={"rounded-full border px-2 py-1 font-semibold " + getComparisonTone(current, previous)}>{getComparison(current, previous)}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="h-4 w-24 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-8 w-36 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-4 w-full rounded bg-[#f5eee6]" />
          </div>
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed border-[#e4d8c8] bg-[#fbfaf7] p-6 text-center text-sm text-[#7c6b60]">{message}</div>;
}

function RevenueBars({ data, compact = false }: { data: DailyRevenuePoint[]; compact?: boolean }) {
  const maxRevenue = Math.max(...data.map((point) => point.revenue), 0);
  const labelStep = compact ? Math.max(1, Math.ceil(data.length / 8)) : 1;

  if (data.length === 0) {
    return <EmptyPanel message="لا توجد بيانات للرسم خلال هذه الفترة" />;
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[520px] items-end gap-2 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-4">
        {data.map((point, index) => {
          const height = maxRevenue > 0 ? Math.max(8, Math.round((point.revenue / maxRevenue) * 160)) : 8;
          const showLabel = index % labelStep === 0 || index === data.length - 1;

          return (
            <div key={point.date} className="flex min-w-10 flex-1 flex-col items-center gap-2" title={formatDateLabel(point.date, true) + " - " + formatCurrency(point.revenue)}>
              <div className="flex h-44 w-full items-end justify-center">
                <div className="w-full max-w-8 rounded-t-md bg-[#a65f3f] transition" style={{ height }} />
              </div>
              <span className="h-8 text-center text-[11px] leading-4 text-[#7c6b60]">{showLabel ? formatDateLabel(point.date, !compact) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-[#2f211c]">{title}</h2>
        <p className="mt-1 text-sm text-[#7c6b60]">{subtitle}</p>
      </div>
    </div>
  );
}

function RevenueSection({ title, trend }: { title: string; trend: SalesReportTrend }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <SectionHeader title={title} subtitle={formatDateLabel(trend.from) + " إلى " + formatDateLabel(trend.to)} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-2xl font-semibold text-[#2f211c]">{formatCurrency(trend.summary.revenue)}</p>
        <span className={"rounded-full border px-2 py-1 text-xs font-semibold " + getComparisonTone(trend.summary.revenue, trend.previousSummary.revenue)}>
          {getComparison(trend.summary.revenue, trend.previousSummary.revenue)}
        </span>
      </div>
      <RevenueBars data={trend.dailyRevenue} compact={trend.dailyRevenue.length > 10} />
    </section>
  );
}

function ItemsTable({ title, items }: { title: string; items: MenuItemSalesReport[] }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <SectionHeader title={title} subtitle="حسب الطلبات المدفوعة في الفترة المحددة" />
      {items.length === 0 ? (
        <EmptyPanel message="لا توجد مبيعات أصناف خلال هذه الفترة" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-[#e4d8c8] text-[#7c6b60]">
                <th className="py-2 text-right font-medium">الصنف</th>
                <th className="py-2 text-left font-medium">الكمية</th>
                <th className="py-2 text-left font-medium">قيمة المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name} className="border-b border-[#f0e7dc] last:border-0">
                  <td className="py-3 font-medium text-[#2f211c]">{item.name}</td>
                  <td className="py-3 text-left text-[#4a3b34]">{formatNumber(item.quantity)}</td>
                  <td className="py-3 text-left font-semibold text-[#2f211c]">{formatCurrency(item.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PaymentMethods({ methods }: { methods: PaymentMethodRevenue[] }) {
  const total = methods.reduce((sum, method) => sum + method.revenue, 0);

  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <SectionHeader title="طرق الدفع" subtitle="حسب الدفعات المكتملة في الفترة المحددة" />
      {methods.length === 0 ? (
        <EmptyPanel message="لا توجد دفعات مكتملة خلال هذه الفترة" />
      ) : (
        <div className="space-y-3">
          {methods.map((method) => {
            const width = total > 0 ? Math.round((method.revenue / total) * 100) : 0;
            return (
              <div key={method.method}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-[#4a3b34]">{paymentMethodLabels[method.method]}</span>
                  <span className="font-semibold text-[#2f211c]">{formatCurrency(method.revenue)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#efe7dc]">
                  <div className="h-2 rounded-full bg-[#5d4032]" style={{ width: width + "%" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OrderStatuses({ statuses }: { statuses: OrderStatusCount[] }) {
  const statusMap = new Map(statuses.map((status) => [status.status, status.count]));

  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <SectionHeader title="حالة الطلبات اليوم" subtitle="متابعة تشغيلية حسب يوم المطعم" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(orderStatusLabels).map(([status, label]) => (
          <div key={status} className="flex items-center justify-between rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 py-2 text-sm">
            <span className="text-[#4a3b34]">{label}</span>
            <span className="font-semibold text-[#2f211c]">{formatNumber(statusMap.get(status as OrderStatusCount["status"]) ?? 0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminReportsDashboard() {
  const today = useMemo(() => getBaghdadDate(), []);
  const [period, setPeriod] = useState<ReportPeriodPreset>("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [report, setReport] = useState<AdminSalesReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const realtimeTimerRef = useRef<number | null>(null);

  const selectedRange = useMemo(() => {
    if (period === "week") {
      return { from: startOfBaghdadWeek(today), to: today };
    }

    if (period === "month") {
      return { from: startOfMonth(today), to: today };
    }

    if (period === "custom") {
      return normalizeRange(customFrom, customTo);
    }

    return { from: today, to: today };
  }, [customFrom, customTo, period, today]);

  const selectedTitle = periodOptions.find((option) => option.id === period)?.label ?? "الفترة";

  const loadReport = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const nextReport = await getAdminSalesReport({ ...selectedRange, today });
        setReport(nextReport);
        setErrorMessage("");
      } catch (error) {
        console.error("Failed to load admin sales report", error);
        setErrorMessage("تعذر تحميل التقارير من Supabase.");
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [selectedRange, today],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReport]);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    function scheduleReload() {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
      }

      realtimeTimerRef.current = window.setTimeout(() => {
        realtimeTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        void loadReport(false);
      }, 250);
    }

    const channel = supabase
      .channel("admin-report-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleReload)
      .subscribe((status, error) => {
        if (error) {
          console.error("Admin reports realtime subscription error", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Admin reports realtime subscription failed", { status });
        }
      });

    return () => {
      isMounted = false;

      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [loadReport]);

  const summary = report?.summary ?? emptySummary;
  const previousSummary = report?.previousSummary ?? emptySummary;
  const hasSales = summary.revenue > 0 || summary.orderCount > 0 || summary.mealCount > 0;

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[#a65f3f]">Sales & Orders Reports</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">التقارير</h1>
            <p className="mt-2 text-sm text-[#7c6b60]">الإيرادات محسوبة من الدفعات المكتملة بتوقيت العراق.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <button key={option.id} type="button" onClick={() => setPeriod(option.id)} className={"h-10 rounded-md border px-3 text-sm font-medium transition " + (period === option.id ? "border-[#5d4032] bg-[#5d4032] text-white" : "border-[#e4d8c8] bg-[#fbfaf7] text-[#4a3b34] hover:bg-[#efe7dc]")}>{option.label}</button>
            ))}
          </div>
        </div>

        {period === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label className="text-sm text-[#4a3b34]">
              <span className="mb-1 block text-[#7c6b60]">From</span>
              <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#5d4032]" />
            </label>
            <label className="text-sm text-[#4a3b34]">
              <span className="mb-1 block text-[#7c6b60]">To</span>
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#5d4032]" />
            </label>
          </div>
        ) : null}
      </section>

      {errorMessage ? <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : report ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title={period === "today" ? "مبيعات اليوم" : "مبيعات " + selectedTitle} value={formatCurrency(summary.revenue)} helper="مقارنة بالفترة السابقة" icon={ReceiptText} current={summary.revenue} previous={previousSummary.revenue} />
            <KpiCard title={period === "today" ? "عدد الطلبات اليوم" : "عدد الطلبات"} value={formatNumber(summary.orderCount) + " طلب"} helper="طلبات لديها دفعة مكتملة" icon={BarChart3} current={summary.orderCount} previous={previousSummary.orderCount} />
            <KpiCard title={period === "today" ? "عدد الوجبات اليوم" : "عدد الوجبات"} value={formatNumber(summary.mealCount) + " وجبة"} helper="مجموع كميات الأصناف" icon={Soup} current={summary.mealCount} previous={previousSummary.mealCount} />
            <KpiCard title="متوسط قيمة الطلب" value={formatCurrency(summary.averageOrderValue)} helper="الإيراد ÷ الطلبات المدفوعة" icon={TrendingUp} current={summary.averageOrderValue} previous={previousSummary.averageOrderValue} />
          </section>

          {!hasSales ? <EmptyPanel message="لا توجد مبيعات خلال هذه الفترة" /> : null}

          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <SectionHeader title="حركة المبيعات خلال الفترة" subtitle={formatDateLabel(report.period.from) + " إلى " + formatDateLabel(report.period.to)} />
            <RevenueBars data={report.dailyRevenue} compact={report.dailyRevenue.length > 10} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <RevenueSection title="مبيعات هذا الأسبوع" trend={report.week} />
            <RevenueSection title="مبيعات هذا الشهر" trend={report.month} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ItemsTable title="الأصناف الأكثر مبيعاً" items={report.topItems} />
            <ItemsTable title="الأصناف الأقل مبيعاً" items={report.leastItems} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PaymentMethods methods={report.paymentMethods} />
            <OrderStatuses statuses={report.orderStatusCounts} />
          </div>
        </>
      ) : (
        <EmptyPanel message="لا توجد بيانات تقارير متاحة" />
      )}
    </div>
  );
}
