"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Boxes, ClipboardList, Minus, ReceiptText, ShoppingCart, TrendingUp, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { RevenueBars } from "@/components/reports/SalesReportsDashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { getAdminSalesReport } from "@/services/adminReportService";
import { getInventoryOverview } from "@/services/inventoryService";
import { getOwnerFinanceData } from "@/services/ownerFinanceService";
import { getPurchaseRequests } from "@/services/purchaseService";
import type { DailyRevenuePoint, MenuItemSalesReport, SalesReportSummary } from "@/types/adminReports";
import type { InventoryItem, InventoryUnitCode } from "@/types/inventory";

type TrendDirection = "up" | "down" | "flat";
type StockDialog = "low" | "out" | null;

const baghdadTimeZone = "Asia/Baghdad";
const emptySummary: SalesReportSummary = { revenue: 0, orderCount: 0, mealCount: 0, averageOrderValue: 0 };

function getBaghdadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
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

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateInput(date);
}

function startOfMonth(value: string) {
  const [year, month] = value.split("-");
  return year + "-" + month + "-01";
}

function previousMonthRange(today: string) {
  const currentMonthStart = parseDate(startOfMonth(today));
  const previousMonthEnd = new Date(currentMonthStart);
  previousMonthEnd.setUTCDate(previousMonthEnd.getUTCDate() - 1);
  const previousMonthStart = new Date(Date.UTC(previousMonthEnd.getUTCFullYear(), previousMonthEnd.getUTCMonth(), 1));
  return { from: formatDateInput(previousMonthStart), to: formatDateInput(previousMonthEnd) };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

function formatQuantity(quantity: number, unitCode: InventoryUnitCode) {
  const labels: Record<InventoryUnitCode, string> = {
    g: "غرام",
    kg: "كغم",
    ml: "مل",
    l: "لتر",
    piece: "قطعة",
    pack: "علبة",
    bottle: "قنينة",
  };

  return `${new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(quantity)} ${labels[unitCode]}`;
}

function comparisonPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function trendDirection(current: number, previous: number): TrendDirection {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function formatTrendLabel(current: number, previous: number) {
  const percent = comparisonPercent(current, previous);
  if (percent === null) return "جديد";
  return (percent > 0 ? "+" : "") + percent.toFixed(1) + "%";
}

function trendTone(direction: TrendDirection, higherIsGood = true) {
  if (direction === "flat") return "border-white/10 bg-white/[0.04] text-zinc-300";
  const preferredDirection = higherIsGood ? "up" : "down";
  return direction === preferredDirection ? "border-[#ff5656]/25 bg-[#ff5656]/10 text-[#ff5656]" : "border-[#ff5656]/25 bg-[#ff5656]/10 text-[#ffb0b0]";
}

function TrendBadge({ current, previous, higherIsGood = true }: { current: number; previous: number; higherIsGood?: boolean }) {
  const direction = trendDirection(current, previous);
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold " + trendTone(direction, higherIsGood)}>
      <Icon size={13} />
      {formatTrendLabel(current, previous)}
    </span>
  );
}

function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
  current,
  previous,
  higherIsGood = true,
  onClick,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof TrendingUp;
  current?: number;
  previous?: number;
  higherIsGood?: boolean;
  onClick?: () => void;
}) {
  const className = "rounded-md border border-white/[0.08] bg-[#343434] p-4 text-right shadow-[0_18px_34px_rgba(0,0,0,0.14)]";
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-300">{title}</span>
        <Icon size={19} className="text-[#ff5656]" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-zinc-400">{helper}</span>
        {typeof current === "number" && typeof previous === "number" ? <TrendBadge current={current} previous={previous} higherIsGood={higherIsGood} /> : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} transition hover:-translate-y-0.5 hover:border-[#ff5656]/60 hover:bg-[#383838] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5656]/35`}>
        {content}
      </button>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed border-white/10 bg-white/[0.04] p-5 text-center text-sm text-zinc-400">{message}</div>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-md border border-white/[0.08] bg-[#343434] p-4 shadow-[0_18px_34px_rgba(0,0,0,0.14)]">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="mt-5 h-8 w-36 rounded bg-white/10" />
            <div className="mt-5 h-4 w-full rounded bg-white/[0.07]" />
          </div>
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-md border border-white/[0.08] bg-[#343434]" />
    </div>
  );
}

function TopItemsTable({ items }: { items: MenuItemSalesReport[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#343434] shadow-[0_18px_34px_rgba(0,0,0,0.14)]">
      <div className="border-b border-white/10 p-4">
        <h2 className="font-semibold text-white">الأصناف الأكثر مبيعاً هذا الشهر</h2>
      </div>
      {items.length === 0 ? <div className="p-4"><EmptyPanel message="لا توجد مبيعات أصناف هذا الشهر." /></div> : null}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-right text-sm">
            <thead className="bg-white/[0.04] text-zinc-300">
              <tr>
                <th className="px-3 py-3 font-semibold">الصنف</th>
                <th className="px-3 py-3 font-semibold">الكمية المباعة</th>
                <th className="px-3 py-3 font-semibold">قيمة المبيعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.map((item) => (
                <tr key={item.name} className="hover:bg-white/[0.04]">
                  <td className="px-3 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-3 py-3 text-zinc-300">{formatNumber(item.quantity)}</td>
                  <td className="px-3 py-3 font-semibold text-white">{formatCurrency(item.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function AttentionPanel({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="rounded-md border border-[#ff5656]/25 bg-[#ff5656]/10 p-4 shadow-[0_18px_34px_rgba(0,0,0,0.14)]">
      <div className="mb-3 flex items-center gap-2 text-[#ff5656]">
        <AlertTriangle size={18} />
        <h2 className="font-semibold">يحتاج انتباهك</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {alerts.map((alert) => (
          <div key={alert} className="rounded-md border border-white/10 bg-[#343434] px-3 py-2 text-sm font-medium text-white">{alert}</div>
        ))}
      </div>
    </section>
  );
}

function OwnerInventoryItemsDialog({ title, items, onClose }: { title: string; items: InventoryItem[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" dir="rtl">
      <section className="max-h-[84vh] w-full max-w-3xl overflow-hidden rounded-md border border-white/10 bg-[#2f2f2f] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#ff5656]">Inventory Alert</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 p-2 text-zinc-300 hover:bg-white/10 hover:text-white" title="إغلاق">
            <X size={17} />
          </button>
        </div>
        {items.length === 0 ? <p className="p-6 text-center text-sm text-zinc-400">لا توجد مواد ضمن هذا التصنيف حالياً.</p> : null}
        {items.length > 0 ? (
          <div className="max-h-[64vh] overflow-auto">
            <table className="w-full min-w-[620px] text-right text-sm">
              <thead className="sticky top-0 bg-[#262626] text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">المادة</th>
                  <th className="px-4 py-3 font-semibold">الرصيد الحالي</th>
                  <th className="px-4 py-3 font-semibold">الحد الأدنى</th>
                  <th className="px-4 py-3 font-semibold">متوسط التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.04]">
                    <td className="px-4 py-3 font-medium text-white">{item.nameAr}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatQuantity(item.stockOnHand, item.baseUnitCode)}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatQuantity(item.minimumStock, item.baseUnitCode)}</td>
                    <td className="px-4 py-3 text-white">{formatCurrency(item.averageCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function stockStatus(item: InventoryItem) {
  if (item.stockOnHand <= 0) return "out";
  if (item.stockOnHand <= item.minimumStock) return "low";
  return "normal";
}

export default function OwnerPage() {
  const today = useMemo(() => getBaghdadDate(), []);
  const yesterday = useMemo(() => addDays(today, -1), [today]);
  const sevenDaysFrom = useMemo(() => addDays(today, -6), [today]);
  const monthFrom = useMemo(() => startOfMonth(today), [today]);
  const previousMonth = useMemo(() => previousMonthRange(today), [today]);

  const [todaySummary, setTodaySummary] = useState<SalesReportSummary>(emptySummary);
  const [yesterdaySummary, setYesterdaySummary] = useState<SalesReportSummary>(emptySummary);
  const [monthSummary, setMonthSummary] = useState<SalesReportSummary>(emptySummary);
  const [previousMonthSummary, setPreviousMonthSummary] = useState<SalesReportSummary>(emptySummary);
  const [lastSevenDays, setLastSevenDays] = useState<DailyRevenuePoint[]>([]);
  const [topItems, setTopItems] = useState<MenuItemSalesReport[]>([]);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState(0);
  const [supplierDues, setSupplierDues] = useState(0);
  const [unpaidPurchaseCount, setUnpaidPurchaseCount] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<InventoryItem[]>([]);
  const [stockDialog, setStockDialog] = useState<StockDialog>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        const [todayReport, yesterdayReport, monthReport, sevenDaysReport, financeData, inventoryData, purchaseRequests] = await Promise.all([
          getAdminSalesReport({ from: today, to: today, today }),
          getAdminSalesReport({ from: yesterday, to: yesterday, today }),
          getAdminSalesReport({ from: monthFrom, to: today, today }),
          getAdminSalesReport({ from: sevenDaysFrom, to: today, today }),
          getOwnerFinanceData(),
          getInventoryOverview(),
          getPurchaseRequests(),
        ]);

        if (!isMounted) return;

        const expensesThisMonth = financeData.expenses
          .filter((expense) => expense.expenseDate >= monthFrom && expense.expenseDate <= today)
          .reduce((total, expense) => total + expense.amount, 0);
        const expensesPreviousMonth = financeData.expenses
          .filter((expense) => expense.expenseDate >= previousMonth.from && expense.expenseDate <= previousMonth.to)
          .reduce((total, expense) => total + expense.amount, 0);
        const totalPurchases = financeData.purchases.reduce((total, purchase) => total + purchase.totalAmount, 0);
        const totalPaidToSuppliers = financeData.payments.reduce((total, payment) => total + payment.amount, 0);
        const activeInventoryItems = inventoryData.items.filter((item) => item.isActive);
        const lowInventoryItems = activeInventoryItems.filter((item) => stockStatus(item) === "low");
        const outInventoryItems = activeInventoryItems.filter((item) => stockStatus(item) === "out");
        const stockValue = activeInventoryItems.reduce((total, item) => total + item.stockOnHand * item.averageCost, 0);

        setTodaySummary(todayReport.summary);
        setYesterdaySummary(yesterdayReport.summary);
        setMonthSummary(monthReport.summary);
        setPreviousMonthSummary(monthReport.previousSummary);
        setLastSevenDays(sevenDaysReport.dailyRevenue);
        setTopItems(monthReport.topItems.slice(0, 5));
        setMonthExpenses(expensesThisMonth);
        setPreviousMonthExpenses(expensesPreviousMonth);
        setSupplierDues(Math.max(totalPurchases - totalPaidToSuppliers, 0));
        setUnpaidPurchaseCount(financeData.purchases.filter((purchase) => purchase.paymentStatus === "unpaid").length);
        setInventoryValue(stockValue);
        setLowStockCount(lowInventoryItems.length);
        setOutOfStockCount(outInventoryItems.length);
        setLowStockItems(lowInventoryItems);
        setOutOfStockItems(outInventoryItems);
        setPendingRequestCount(purchaseRequests.filter((request) => request.status === "pending").length);
        setErrorMessage(financeData.errors.length > 0 ? "تعذر تحميل بعض مؤشرات لوحة المالك." : "");
      } catch (error) {
        console.error("Failed to load owner overview", error);
        if (!isMounted) return;
        setErrorMessage("تعذر تحميل مؤشرات لوحة المالك.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadOverview();
    return () => {
      isMounted = false;
    };
  }, [monthFrom, previousMonth.from, previousMonth.to, sevenDaysFrom, today, yesterday]);

  const alerts = useMemo(() => {
    const nextAlerts: string[] = [];
    if (outOfStockCount > 0) nextAlerts.push(`${formatNumber(outOfStockCount)} مواد نافدة`);
    if (lowStockCount > 0) nextAlerts.push(`${formatNumber(lowStockCount)} مواد منخفضة`);
    if (pendingRequestCount > 0) nextAlerts.push(`${formatNumber(pendingRequestCount)} طلبات شراء معلقة`);
    if (unpaidPurchaseCount > 0) nextAlerts.push(`${formatNumber(unpaidPurchaseCount)} فواتير موردين غير مدفوعة`);
    return nextAlerts;
  }, [lowStockCount, outOfStockCount, pendingRequestCount, unpaidPurchaseCount]);

  return (
    <div className="owner-home-dark -mx-4 -my-5 min-h-[calc(100vh-4rem)] space-y-5 bg-[#292929] px-4 pb-5 lg:-mx-6 lg:px-6">
      <DashboardHero
        className="-mx-4 lg:-mx-6"
        image="/images/dashboard/owner-dashboard-hero.jpg"
        eyebrow="Executive Overview"
        title="مالك المطعم"
        description="نظرة شاملة على أداء مطعم وكافيه خاتون"
      />

      {errorMessage ? <div className="rounded-md border border-[#ff5656]/25 bg-[#ff5656]/10 p-4 text-sm text-[#ffb0b0]">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="مبيعات اليوم" value={formatCurrency(todaySummary.revenue)} helper="مقارنة بأمس" icon={TrendingUp} current={todaySummary.revenue} previous={yesterdaySummary.revenue} />
            <KpiCard title="مبيعات هذا الشهر" value={formatCurrency(monthSummary.revenue)} helper="مقارنة بالشهر السابق" icon={ReceiptText} current={monthSummary.revenue} previous={previousMonthSummary.revenue} />
            <KpiCard title="مصروفات هذا الشهر" value={formatCurrency(monthExpenses)} helper="مقارنة بالشهر السابق" icon={WalletCards} current={monthExpenses} previous={previousMonthExpenses} higherIsGood={false} />
            <KpiCard title="مستحقات الموردين" value={formatCurrency(supplierDues)} helper={`${formatNumber(unpaidPurchaseCount)} فواتير غير مدفوعة`} icon={ShoppingCart} />
            <KpiCard title="قيمة المخزون الحالية" value={formatCurrency(inventoryValue)} helper="حسب متوسط التكلفة الحالي" icon={Boxes} />
            <KpiCard title="مواد منخفضة" value={formatNumber(lowStockCount)} helper="اضغط لعرض المواد المنخفضة" icon={AlertTriangle} onClick={() => setStockDialog("low")} />
            <KpiCard title="مواد نافدة" value={formatNumber(outOfStockCount)} helper="اضغط لعرض المواد النافدة" icon={Boxes} onClick={() => setStockDialog("out")} />
            <KpiCard title="طلبات تحتاج متابعة" value={formatNumber(pendingRequestCount)} helper="طلبات شراء Pending" icon={ClipboardList} />
          </section>

          <section className="rounded-md border border-white/[0.08] bg-[#343434] p-4 shadow-[0_18px_34px_rgba(0,0,0,0.14)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">حركة المبيعات - آخر 7 أيام</h2>
              <p className="mt-1 text-sm text-zinc-400">حسب المدفوعات المكتملة بتوقيت بغداد.</p>
            </div>
            <RevenueBars data={lastSevenDays} variant="dark" />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <TopItemsTable items={topItems} />
            <AttentionPanel alerts={alerts} />
          </div>
        </>
      )}
      {stockDialog ? (
        <OwnerInventoryItemsDialog
          title={stockDialog === "low" ? "المواد المنخفضة" : "المواد النافدة"}
          items={stockDialog === "low" ? lowStockItems : outOfStockItems}
          onClose={() => setStockDialog(null)}
        />
      ) : null}
    </div>
  );
}
