"use client";

import Link from "next/link";
import { BadgeCheck, ClipboardList, PackageMinus, PackageX, ReceiptText, Soup, TrendingUp, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { getAdminSalesReport } from "@/services/adminReportService";
import { getInventoryOverview } from "@/services/inventoryService";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import type { SalesReportSummary } from "@/types/adminReports";

const baghdadTimeZone = "Asia/Baghdad";

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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function OverviewCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof ReceiptText }) {
  return (
    <div className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-[#2f211c]">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const { statistics, staff, isLoading, error } = useStaffMembers();
  const [summary, setSummary] = useState<SalesReportSummary>(emptySummary);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState<{ lowStock: number; outOfStock: number } | null>(null);
  const recent = staff.slice(0, 5);

  useEffect(() => {
    let isMounted = true;

    async function loadTodayReport() {
      setIsReportLoading(true);
      setReportError("");
      try {
        const today = getBaghdadDate();
        const report = await getAdminSalesReport({ from: today, to: today, today });
        if (!isMounted) return;
        setSummary(report.summary);
      } catch (loadError) {
        console.error("[admin overview report] failed to load today sales report", loadError);
        if (!isMounted) return;
        setReportError("تعذر تحميل مؤشرات المبيعات");
      } finally {
        if (isMounted) setIsReportLoading(false);
      }
    }

    void loadTodayReport();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInventoryStatus() {
      try {
        const overview = await getInventoryOverview();
        if (!isMounted) return;
        const activeItems = overview.items.filter((item) => item.isActive);
        setInventoryStatus({
          lowStock: activeItems.filter((item) => item.stockOnHand <= item.minimumStock).length,
          outOfStock: activeItems.filter((item) => item.stockOnHand === 0).length,
        });
      } catch (loadError) {
        console.error("[admin overview inventory] failed to load inventory status", loadError);
        if (isMounted) setInventoryStatus(null);
      }
    }

    void loadInventoryStatus();
    return () => { isMounted = false; };
  }, []);

  const operationalCards = useMemo(() => {
    const cards = [
      { title: "إجمالي العمال", value: formatNumber(statistics.total), icon: UsersRound },
      { title: "العمال النشطون", value: formatNumber(statistics.active), icon: BadgeCheck },
    ];

    if (inventoryStatus) {
      cards.push(
        { title: "مواد منخفضة المخزون", value: formatNumber(inventoryStatus.lowStock), icon: PackageMinus },
        { title: "مواد نافدة", value: formatNumber(inventoryStatus.outOfStock), icon: PackageX },
      );
    }

    return cards;
  }, [inventoryStatus, statistics.active, statistics.total]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">الرئيسية</p>
          <h1 className="text-2xl font-semibold text-[#2f211c]">نظرة عامة على المطعم</h1>
        </div>
      </section>

      {reportError ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{reportError}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard title="مبيعات اليوم" value={isReportLoading ? "..." : formatCurrency(summary.revenue)} icon={TrendingUp} />
        <OverviewCard title="عدد الطلبات اليوم" value={isReportLoading ? "..." : formatNumber(summary.orderCount)} icon={ReceiptText} />
        <OverviewCard title="عدد الوجبات اليوم" value={isReportLoading ? "..." : formatNumber(summary.mealCount)} icon={Soup} />
        <OverviewCard title="متوسط قيمة الطلب" value={isReportLoading ? "..." : formatCurrency(summary.averageOrderValue)} icon={ClipboardList} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[#2f211c]">الوضع التشغيلي</h2>
          <Link href="/inventory" className="text-sm font-medium text-[#a65f3f] hover:text-[#8f4e34]">فتح المخزن</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {operationalCards.map((card) => (
            <OverviewCard key={card.title} title={card.title} value={card.value} icon={card.icon} />
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2"><UsersRound size={19} className="text-[#a65f3f]" /><h2 className="font-semibold text-[#2f211c]">آخر العمال</h2></div>
        {isLoading ? <p className="text-sm text-[#7c6b60]">جارٍ تحميل بيانات العمال...</p> : null}
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {!isLoading && !error && recent.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد سجلات عمال حتى الآن</p> : null}
        <div className="divide-y divide-[#eee4d8]">
          {recent.map((member) => (
            <Link key={member.id} href={`/admin/staff/${member.id}`} className="flex items-center justify-between py-3 text-sm hover:bg-[#fffaf4]">
              <span className="font-medium text-[#2f211c]">{member.fullName}</span>
              <span className="text-[#7c6b60]">#{member.employeeNumber} · {member.jobTitle}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
