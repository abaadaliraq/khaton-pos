"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, RefreshCw, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { getInventoryAnalytics } from "@/services/inventoryAnalyticsService";
import type { InventoryAnalytics, InventoryAnalyticsItem, InventoryItemType, InventoryRequisitionDestination, InventoryUnitCode, InventoryWasteReason } from "@/types/inventory";

type RangePreset = "7d" | "30d" | "this_month" | "previous_month" | "custom";

type InventoryAnalyticsPanelProps = {
  onInventoryChanged: () => void;
};

const itemTypeLabels: Record<InventoryItemType, string> = {
  food_recipe: "مادة وصفة",
  food_indirect: "غذائي غير مباشر",
  packaging: "تغليف",
  cleaning: "تنظيف",
  operational_consumable: "مستهلك تشغيلي",
};

const destinationLabels: Record<InventoryRequisitionDestination, string> = {
  kitchen: "المطبخ",
  barista: "الكوفي / الباريستا",
  bar: "البار",
  service: "الخدمة",
  cleaning: "التنظيف",
  management: "الإدارة",
  other: "أخرى",
};

const reasonLabels: Record<InventoryWasteReason, string> = {
  expired: "انتهاء صلاحية",
  spoiled: "تلف",
  damaged: "ضرر",
  contaminated: "تلوث",
  broken: "كسر",
  preparation_error: "خطأ تحضير",
  overproduction: "إنتاج زائد",
  oil_disposal: "التخلص من زيت مستخدم",
  other: "أخرى",
};

function baghdadToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00+03:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(date);
}

function monthRange(offset: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? new Date().getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? new Date().getMonth() + 1);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1, 9));
  const last = new Date(Date.UTC(year, month + offset, 0, 9));
  return {
    startDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(first),
    endDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(last),
  };
}

function presetRange(preset: RangePreset) {
  const today = baghdadToday();
  if (preset === "7d") return { startDate: addDays(today, -6), endDate: today };
  if (preset === "30d") return { startDate: addDays(today, -29), endDate: today };
  if (preset === "this_month") return monthRange(0);
  if (preset === "previous_month") return monthRange(-1);
  return { startDate: addDays(today, -29), endDate: today };
}

function normalize(value: string) {
  return value
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar-IQ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number | undefined) {
  if (value === undefined) return "بيانات غير كافية";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

function formatDate(value: string | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatDateTime(value: string | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatQuantity(quantity: number, unitCode: InventoryUnitCode, unitName: string) {
  if (unitCode === "g" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} كغم`;
  if (unitCode === "ml" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} لتر`;
  return `${formatNumber(quantity)} ${unitName}`;
}

function trendLabel(value: number | undefined) {
  if (value === undefined) return "بيانات غير كافية";
  if (value > 20) return "أعلى من الفترة السابقة - يحتاج مراجعة";
  if (value < -20) return "أقل من الفترة السابقة";
  return "ضمن النطاق المعتاد";
}

function timelineTone(type: InventoryAnalyticsItem["timeline"][number]["type"]) {
  if (type === "purchase") return "text-emerald-700";
  if (type === "department_waste") return "text-amber-700";
  if (type === "warehouse_waste") return "text-rose-700";
  return "text-[#4a3b34]";
}

export function InventoryAnalyticsPanel({ onInventoryChanged }: InventoryAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<InventoryAnalytics | null>(null);
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [range, setRange] = useState(presetRange("30d"));
  const [itemType, setItemType] = useState<InventoryItemType | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  const selectedItem = analytics?.items.find((item) => item.id === selectedId) ?? null;
  const filteredItems = useMemo(() => {
    const query = normalize(search);
    return (analytics?.items ?? []).filter((item) => !query || normalize(item.nameAr).includes(query));
  }, [analytics, search]);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextAnalytics = await getInventoryAnalytics({ ...range, itemType });
      setAnalytics(nextAnalytics);
      setSelectedId((current) => (current && nextAnalytics.items.some((item) => item.id === current) ? current : null));
    } catch (loadError) {
      console.error("Failed to load inventory analytics", loadError);
      setError("تعذر تحميل تحليلات المخزون.");
    } finally {
      setIsLoading(false);
    }
  }, [itemType, range]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalytics();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleReload() {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadAnalytics();
        void onInventoryChanged();
      }, 300);
    }

    const channel = supabase
      .channel("inventory-analytics-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisitions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisition_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_waste_reports" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_waste_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadAnalytics, onInventoryChanged]);

  function changePreset(nextPreset: RangePreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") setRange(presetRange(nextPreset));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-[#a65f3f]" />
            <div>
              <h2 className="font-semibold text-[#2f211c]">تحليل المخزون</h2>
              <p className="mt-1 text-xs text-[#7c6b60]">حسابات deterministic من قاعدة البيانات حسب توقيت بغداد.</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadAnalytics()} className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
            <RefreshCw size={16} />
            تحديث
          </button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_minmax(220px,1fr)]">
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            {[
              ["7d", "7 أيام"],
              ["30d", "30 يوم"],
              ["this_month", "هذا الشهر"],
              ["previous_month", "الشهر السابق"],
              ["custom", "مخصص"],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => changePreset(value as RangePreset)} className={`h-10 rounded-md border px-3 ${preset === value ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={itemType} onChange={(event) => setItemType(event.target.value as InventoryItemType | "all")} className="h-10 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
            <option value="all">كل الأنواع</option>
            {Object.entries(itemTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث عن مادة" className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] pr-9 pl-3 text-sm outline-none focus:border-[#a65f3f]" />
          </div>
        </div>

        {preset === "custom" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="date" value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} className="h-10 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
            <input type="date" value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} className="h-10 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]">جارٍ تحميل التحليلات...</div> : null}

      {analytics && !isLoading ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="قيمة المخزون الحالية" value={formatCurrency(analytics.overview.inventoryValue)} helper="حسب average_cost الحالي" />
            <StatCard title="مواد تحتاج متابعة" value={formatNumber(analytics.overview.followUpCount)} helper="الرصيد عند أو دون الحد الأدنى" />
            <StatCard title="تكلفة الصرف التقديرية" value={formatCurrency(analytics.overview.issueCostEstimate)} helper="Stock Issue × average_cost" />
            <StatCard title="إجمالي الأطباق" value={formatNumber(analytics.overview.dishQuantity)} helper="order_items.quantity بعد بدء الإنتاج" />
          </div>

          <div className="grid gap-4">
            <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
              <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3 text-sm text-[#7c6b60]">
                تحليل المواد | {formatNumber(filteredItems.length)} مادة · الفترة: {analytics.range.startDate} إلى {analytics.range.endDate} · مقارنة مع {analytics.range.previousStartDate} إلى {analytics.range.previousEndDate}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] table-fixed border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
                    <tr>
                      <th className="sticky right-0 z-30 w-44 border-l border-white/15 bg-[#2b2421] px-3 py-2 text-right font-semibold">المادة</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">الرصيد</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">المشتريات</th>
                      <th className="w-20 border-l border-white/15 px-2 py-2 text-right font-semibold">مرات شراء</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">المصروف</th>
                      <th className="w-20 border-l border-white/15 px-2 py-2 text-right font-semibold">مرات صرف</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">الهدر</th>
                      <th className="w-20 border-l border-white/15 px-2 py-2 text-right font-semibold">نسبة الهدر</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">Coverage</th>
                      <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">Per 100</th>
                      <th className="px-3 py-2 text-right font-semibold">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee4d8]">
                    {filteredItems.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb] ${selectedId === item.id ? "bg-[#fff1e8]" : ""}`}>
                        <td className="sticky right-0 z-10 truncate border-l border-[#d5c2af] bg-inherit px-3 py-2" title={item.nameAr}>
                          <p className="font-semibold text-[#2f211c]">{item.nameAr}</p>
                          <p className="mt-1 text-xs text-[#7c6b60]">{itemTypeLabels[item.itemType]}</p>
                        </td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 font-bold text-[#2f211c]">{formatQuantity(item.stockOnHand, item.baseUnitCode, item.baseUnitName)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatQuantity(item.purchases.quantity, item.baseUnitCode, item.baseUnitName)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatNumber(item.purchases.count)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatQuantity(item.issues.quantity, item.baseUnitCode, item.baseUnitName)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatNumber(item.issues.count)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-rose-700">{formatQuantity(item.waste.totalQuantity, item.baseUnitCode, item.baseUnitName)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{item.waste.ratioDepartmentToIssued === undefined ? "بيانات غير كافية" : `${formatNumber(item.waste.ratioDepartmentToIssued)}%`}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{item.operations.coverageDays === undefined ? "بيانات غير كافية" : `${formatNumber(item.operations.coverageDays)} يوم`}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{item.operations.issuePer100Dishes === undefined ? "بيانات غير كافية" : formatQuantity(item.operations.issuePer100Dishes, item.baseUnitCode, item.baseUnitName)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${item.comparison.issuePer100DishesPercent !== undefined && item.comparison.issuePer100DishesPercent > 20 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#e4d8c8] bg-[#fbfaf7] text-[#4a3b34]"}`}>
                            {trendLabel(item.comparison.issuePer100DishesPercent)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          {selectedItem ? <ItemDetails item={selectedItem} dishQuantity={analytics.overview.dishQuantity} onClose={() => setSelectedId(null)} /> : null}
        </>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 text-right shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2f211c]">{value}</p>
      <p className="mt-1 text-xs text-[#9a8779]">{helper}</p>
    </section>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
      <h3 className="mb-3 text-sm font-semibold text-[#2f211c]">{title}</h3>
      {children}
    </section>
  );
}

function MetricGrid({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md border border-[#eee4d8] bg-white p-3">
          <p className="text-xs text-[#7c6b60]">{row.label}</p>
          <p className="mt-1 font-semibold text-[#2f211c]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function ItemDetails({ item, dishQuantity, onClose }: { item: InventoryAnalyticsItem | null; dishQuantity: number; onClose: () => void }) {
  if (!item) {
    return (
      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 text-sm text-[#7c6b60] shadow-sm">
        اختر مادة لعرض التحليل التفصيلي.
      </section>
    );
  }

  const maxChartValue = Math.max(...item.timeline.map((event) => Math.abs(event.quantityBase)), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
    <section className="w-full max-w-6xl overflow-hidden rounded-md border border-[#e4d8c8] bg-white p-4 shadow-2xl">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#eee4d8] pb-3">
        <div>
          <p className="text-sm text-[#7c6b60]">تحليل مادة</p>
          <h2 className="text-xl font-semibold text-[#2f211c]">{item.nameAr}</h2>
          <p className="mt-1 text-xs text-[#9a8779]">{itemTypeLabels[item.itemType]} · {item.isActive ? "نشطة" : "متوقفة"}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" aria-label="إغلاق">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(100vh-150px)] space-y-3 overflow-y-auto pl-1">
        <DetailBlock title="الرصيد والمعلومات الأساسية">
          <MetricGrid
            rows={[
              { label: "الرصيد الحالي", value: formatQuantity(item.stockOnHand, item.baseUnitCode, item.baseUnitName) },
              { label: "الحد الأدنى", value: formatQuantity(item.minimumStock, item.baseUnitCode, item.baseUnitName) },
              { label: "متوسط الكلفة", value: formatCurrency(item.averageCost) },
              { label: "آخر كلفة شراء", value: formatCurrency(item.lastPurchaseCost) },
            ]}
          />
        </DetailBlock>

        <DetailBlock title="Purchase Analytics">
          <MetricGrid
            rows={[
              { label: "الكمية المشتراة", value: formatQuantity(item.purchases.quantity, item.baseUnitCode, item.baseUnitName) },
              { label: "عدد مرات الشراء", value: formatNumber(item.purchases.count) },
              { label: "إجمالي قيمة الشراء", value: formatCurrency(item.purchases.total) },
              { label: "متوسط سعر الوحدة", value: formatCurrency(item.purchases.averageUnitCost) },
              { label: "أقل / أعلى سعر", value: `${formatCurrency(item.purchases.minUnitCost)} / ${formatCurrency(item.purchases.maxUnitCost)}` },
              { label: "آخر مورد", value: item.purchases.lastSupplierName ?? "لا توجد بيانات" },
            ]}
          />
          <div className="mt-3 divide-y divide-[#eee4d8] rounded-md border border-[#eee4d8] bg-white">
            {item.purchases.history.slice(0, 5).map((history) => (
              <div key={`${history.reference}-${history.date}`} className="grid gap-1 p-3 text-sm">
                <p className="font-semibold text-[#2f211c]">{formatDate(history.date)} · {history.supplierName}</p>
                <p className="text-[#7c6b60]">{formatQuantity(history.quantityBase, item.baseUnitCode, item.baseUnitName)} · {formatCurrency(history.lineTotal)} · {formatCurrency(history.unitCostBase)} / {item.baseUnitName}</p>
              </div>
            ))}
            {item.purchases.history.length === 0 ? <p className="p-3 text-sm text-[#7c6b60]">لا يوجد تاريخ شراء ضمن الفترة.</p> : null}
          </div>
        </DetailBlock>

        <DetailBlock title="Issue Analytics">
          <MetricGrid
            rows={[
              { label: "إجمالي الصرف", value: formatQuantity(item.issues.quantity, item.baseUnitCode, item.baseUnitName) },
              { label: "عدد مرات الصرف", value: formatNumber(item.issues.count) },
              { label: "متوسط كمية الصرف", value: formatQuantity(item.issues.averageQuantity, item.baseUnitCode, item.baseUnitName) },
              { label: "أكبر صرف", value: formatQuantity(item.issues.maxQuantity, item.baseUnitCode, item.baseUnitName) },
              { label: "آخر صرف", value: formatDateTime(item.issues.lastIssueAt) },
              { label: "متوسط الأيام بين الصرف", value: item.issues.averageDaysBetween === undefined ? "بيانات غير كافية" : `${formatNumber(item.issues.averageDaysBetween)} يوم` },
            ]}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(item.issues.departmentBreakdown).map(([destination, quantity]) => (
              <div key={destination} className="rounded-md border border-[#eee4d8] bg-white p-3 text-sm">
                <p className="text-[#7c6b60]">{destinationLabels[destination as InventoryRequisitionDestination] ?? destination}</p>
                <p className="mt-1 font-semibold text-[#2f211c]">{formatQuantity(quantity, item.baseUnitCode, item.baseUnitName)}</p>
              </div>
            ))}
          </div>
        </DetailBlock>

        <DetailBlock title="Waste Analytics">
          <MetricGrid
            rows={[
              { label: "هدر المخزن", value: formatQuantity(item.waste.warehouseQuantity, item.baseUnitCode, item.baseUnitName) },
              { label: "هدر الأقسام", value: formatQuantity(item.waste.departmentQuantity, item.baseUnitCode, item.baseUnitName) },
              { label: "إجمالي الهدر الفعلي", value: formatQuantity(item.waste.totalQuantity, item.baseUnitCode, item.baseUnitName) },
              { label: "Waste Ratio", value: item.waste.ratioDepartmentToIssued === undefined ? "بيانات غير كافية" : `${formatNumber(item.waste.ratioDepartmentToIssued)}% من صرف الأقسام` },
              { label: "أكثر سبب", value: item.waste.topReason ? reasonLabels[item.waste.topReason] : "لا توجد بيانات" },
              { label: "أكثر قسم", value: item.waste.topDestination ? destinationLabels[item.waste.topDestination] : "لا توجد بيانات" },
            ]}
          />
        </DetailBlock>

        <DetailBlock title="Operational Benchmark">
          <MetricGrid
            rows={[
              { label: "متوسط الصرف اليومي", value: item.operations.dailyIssueRate === undefined ? "بيانات غير كافية" : formatQuantity(item.operations.dailyIssueRate, item.baseUnitCode, item.baseUnitName) },
              { label: "Coverage", value: item.operations.coverageDays === undefined ? "بيانات غير كافية" : `${formatNumber(item.operations.coverageDays)} يوم` },
              { label: "معدل الصرف لكل 100 طبق", value: item.operations.issuePer100Dishes === undefined ? "بيانات غير كافية" : formatQuantity(item.operations.issuePer100Dishes, item.baseUnitCode, item.baseUnitName) },
              { label: "حجم الأطباق", value: formatNumber(dishQuantity) },
              { label: "مقارنة Benchmark", value: formatPercent(item.comparison.issuePer100DishesPercent) },
              { label: "ملاحظة", value: trendLabel(item.comparison.issuePer100DishesPercent) },
            ]}
          />
        </DetailBlock>

        <DetailBlock title="Timeline">
          <div className="space-y-2">
            {item.timeline.slice(0, 12).map((event) => (
              <div key={`${event.type}-${event.date}-${event.reference}`} className="grid gap-2 rounded-md border border-[#eee4d8] bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`font-semibold ${timelineTone(event.type)}`}>{event.label}</p>
                  <p className="text-xs text-[#9a8779]">{formatDateTime(event.date)} · {event.reference ?? "-"}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f5eee6]">
                  <div className="h-full rounded-full bg-[#a65f3f]" style={{ width: `${Math.max(6, (Math.abs(event.quantityBase) / maxChartValue) * 100)}%` }} />
                </div>
                <p className="text-[#4a3b34]">
                  {event.type === "department_waste" ? "هدر بعد الصرف: " : ""}
                  {formatQuantity(event.quantityBase, item.baseUnitCode, item.baseUnitName)}
                  {event.destination ? ` · ${destinationLabels[event.destination]}` : ""}
                  {event.reason ? ` · ${reasonLabels[event.reason]}` : ""}
                  {event.supplierName ? ` · ${event.supplierName}` : ""}
                </p>
              </div>
            ))}
            {item.timeline.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد أحداث ضمن الفترة.</p> : null}
          </div>
        </DetailBlock>
      </div>
    </section>
    </div>
  );
}
