"use client";

import { Boxes, ClipboardList, PackageCheck, PackageX, Search, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { getInventoryOverview } from "@/services/inventoryService";
import { getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import { getInventoryWasteReports } from "@/services/inventoryWasteService";
import type { InventoryItem, InventoryMovement, InventoryMovementType, InventoryRequisition, InventoryUnitCode, InventoryWasteReport } from "@/types/inventory";

type StockFilter = "all" | "low" | "out";
type StockStatus = "normal" | "low" | "out";

const baghdadTimeZone = "Asia/Baghdad";

const movementLabels: Record<InventoryMovementType, string> = {
  opening_balance: "رصيد افتتاحي",
  adjustment_in: "تسوية إضافة",
  adjustment_out: "تسوية إخراج",
  purchase: "شراء",
  consumption: "استهلاك",
  waste: "هدر",
  return: "مرتجع",
  stock_issue: "صرف داخلي",
};

const stockFilterOptions: { value: StockFilter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "low", label: "منخفض المخزون" },
  { value: "out", label: "نافد" },
];

function normalizeInventoryName(value: string) {
  return value
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar-IQ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatQuantity(quantity: number, unitCode: InventoryUnitCode) {
  const absolute = Math.abs(quantity);
  const sign = quantity < 0 ? "-" : "";

  if (unitCode === "g" && absolute >= 1000) {
    return `${sign}${formatNumber(absolute / 1000)} كغم`;
  }

  if (unitCode === "ml" && absolute >= 1000) {
    return `${sign}${formatNumber(absolute / 1000)} لتر`;
  }

  const labels: Record<InventoryUnitCode, string> = {
    g: "غرام",
    kg: "كغم",
    ml: "مل",
    l: "لتر",
    piece: "قطعة",
    pack: "علبة",
    bottle: "قنينة",
  };

  return `${sign}${formatNumber(absolute)} ${labels[unitCode]}`;
}

function stockStatus(item: InventoryItem): StockStatus {
  if (item.stockOnHand <= 0) return "out";
  if (item.stockOnHand <= item.minimumStock) return "low";
  return "normal";
}

function stockStatusLabel(status: StockStatus) {
  if (status === "out") return "نافد";
  if (status === "low") return "منخفض";
  return "طبيعي";
}

function stockStatusTone(status: StockStatus) {
  if (status === "out") return "bg-rose-50 text-rose-700 border-rose-100";
  if (status === "low") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-emerald-50 text-emerald-700 border-emerald-100";
}

function SummaryCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Boxes }) {
  return (
    <article className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-[#e4d8c8] bg-[#fbfaf7] p-5 text-center text-sm text-[#7c6b60]">{message}</p>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="h-4 w-32 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-8 w-28 rounded bg-[#efe7dc]" />
          </div>
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
    </div>
  );
}

function BaristaOverview({ requisitions, wasteReports }: { requisitions: InventoryRequisition[]; wasteReports: InventoryWasteReport[] }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: baghdadTimeZone });
  const baristaRequisitions = requisitions.filter((request) => request.destination === "barista");
  const baristaWasteReports = wasteReports.filter((report) => report.destination === "barista");
  const todaysRequisitions = baristaRequisitions.filter((request) => new Date(request.requestedAt).toLocaleDateString("en-CA", { timeZone: baghdadTimeZone }) === today);
  const pendingFollowUp = baristaRequisitions.filter((request) => ["pending", "approved", "issued"].includes(request.status));
  const todaysWasteItems = baristaWasteReports
    .filter((report) => new Date(report.postedAt).toLocaleDateString("en-CA", { timeZone: baghdadTimeZone }) === today)
    .flatMap((report) => report.items);
  const issuedLines = baristaRequisitions.flatMap((request) => request.items.filter((item) => item.issuedQuantityBase && item.issuedQuantityBase > 0));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm text-[#7c6b60]">Department: Barista</p>
          <h2 className="mt-1 font-semibold text-[#2f211c]">متابعة مواد الباريستا</h2>
        </div>
        <span className="rounded-md border border-[#d8c6b5] bg-[#fff8f0] px-3 py-2 text-sm font-semibold text-[#5d4032]">قراءة فقط</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="طلبات اليوم" value={formatNumber(todaysRequisitions.length)} icon={ClipboardList} />
        <SummaryCard title="بانتظار متابعة" value={formatNumber(pendingFollowUp.length)} icon={PackageCheck} />
        <SummaryCard title="أسطر مصروفة" value={formatNumber(issuedLines.length)} icon={Boxes} />
        <SummaryCard title="هدر اليوم" value={formatNumber(todaysWasteItems.length)} icon={TrendingDown} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-3">
            <h3 className="font-semibold text-[#2f211c]">آخر طلبات مواد الباريستا</h3>
          </div>
          {baristaRequisitions.length === 0 ? <div className="p-3"><EmptyState message="لا توجد طلبات مواد باريستا ظاهرة حالياً." /></div> : null}
          {baristaRequisitions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-right text-sm">
                <thead className="bg-[#f5eee6] text-[#4a3b34]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">رقم الطلب</th>
                    <th className="px-3 py-2 font-semibold">الحالة</th>
                    <th className="px-3 py-2 font-semibold">المواد</th>
                    <th className="px-3 py-2 font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee4d8]">
                  {baristaRequisitions.slice(0, 6).map((request) => (
                    <tr key={request.id}>
                      <td className="px-3 py-2 font-semibold text-[#2f211c]" dir="ltr">{request.requestCode}</td>
                      <td className="px-3 py-2 text-[#4a3b34]">{request.status}</td>
                      <td className="px-3 py-2 text-[#4a3b34]">{formatNumber(request.items.length)}</td>
                      <td className="px-3 py-2 text-[#4a3b34]">{formatDateTime(request.requestedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
        <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-3">
            <h3 className="font-semibold text-[#2f211c]">آخر هدر الباريستا</h3>
          </div>
          {baristaWasteReports.length === 0 ? <div className="p-3"><EmptyState message="لا توجد عمليات هدر باريستا ظاهرة حالياً." /></div> : null}
          {baristaWasteReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-right text-sm">
                <thead className="bg-[#f5eee6] text-[#4a3b34]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">المادة</th>
                    <th className="px-3 py-2 font-semibold">الكمية</th>
                    <th className="px-3 py-2 font-semibold">طلب الصرف</th>
                    <th className="px-3 py-2 font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee4d8]">
                  {baristaWasteReports.flatMap((report) => report.items.map((item) => ({ report, item }))).slice(0, 6).map(({ report, item }) => (
                    <tr key={`${report.id}-${item.id}`}>
                      <td className="px-3 py-2 font-semibold text-[#2f211c]">{item.inventoryItemName}</td>
                      <td className="px-3 py-2 text-rose-700">{formatQuantity(item.quantityBase, item.baseUnitCode)}</td>
                      <td className="px-3 py-2 text-[#4a3b34]" dir="ltr">{item.requisitionCode ?? "-"}</td>
                      <td className="px-3 py-2 text-[#4a3b34]">{formatDateTime(report.postedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function InventoryTable({ items }: { items: InventoryItem[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4">
        <h2 className="font-semibold text-[#2f211c]">مواد المخزون</h2>
      </div>
      {items.length === 0 ? <div className="p-4"><EmptyState message="لا توجد مواد مطابقة للفلاتر الحالية." /></div> : null}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr>
                <th className="px-3 py-3 font-semibold">اسم المادة</th>
                <th className="px-3 py-3 font-semibold">الوحدة</th>
                <th className="px-3 py-3 font-semibold">الرصيد الحالي</th>
                <th className="px-3 py-3 font-semibold">الحد الأدنى</th>
                <th className="px-3 py-3 font-semibold">متوسط التكلفة</th>
                <th className="px-3 py-3 font-semibold">آخر سعر شراء</th>
                <th className="px-3 py-3 font-semibold">قيمة الرصيد الحالية</th>
                <th className="px-3 py-3 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {items.map((item) => {
                const status = stockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-[#fffaf4]">
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{item.nameAr}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{item.baseUnitName}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatQuantity(item.stockOnHand, item.baseUnitCode)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatQuantity(item.minimumStock, item.baseUnitCode)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatCurrency(item.averageCost)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatCurrency(item.lastPurchaseCost)}</td>
                    <td className="px-3 py-3 font-semibold text-[#2f211c]">{formatCurrency(item.stockOnHand * item.averageCost)}</td>
                    <td className="px-3 py-3">
                      <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + stockStatusTone(status)}>
                        {stockStatusLabel(status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function RecentMovements({ movements }: { movements: InventoryMovement[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#eee4d8] p-4">
        <ClipboardList size={18} className="text-[#a65f3f]" />
        <h2 className="font-semibold text-[#2f211c]">آخر حركات المخزون</h2>
      </div>
      {movements.length === 0 ? <div className="p-4"><EmptyState message="لا توجد حركات مخزون ظاهرة حالياً." /></div> : null}
      {movements.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr>
                <th className="px-3 py-3 font-semibold">المادة</th>
                <th className="px-3 py-3 font-semibold">النوع</th>
                <th className="px-3 py-3 font-semibold">الكمية</th>
                <th className="px-3 py-3 font-semibold">قبل / بعد</th>
                <th className="px-3 py-3 font-semibold">التكلفة</th>
                <th className="px-3 py-3 font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {movements.map((movement) => (
                <tr key={movement.id} className="hover:bg-[#fffaf4]">
                  <td className="px-3 py-3 font-medium text-[#2f211c]">{movement.inventoryItemName}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{movementLabels[movement.movementType]}</td>
                  <td className={`px-3 py-3 font-semibold ${movement.quantityDelta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatQuantity(movement.quantityDelta, movement.baseUnitCode)}
                  </td>
                  <td className="px-3 py-3 text-[#4a3b34]">
                    {formatQuantity(movement.quantityBefore, movement.baseUnitCode)} / {formatQuantity(movement.quantityAfter, movement.baseUnitCode)}
                  </td>
                  <td className="px-3 py-3 text-[#4a3b34]">{formatCurrency(movement.totalCost)}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{formatDateTime(movement.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function OwnerInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [baristaRequisitions, setBaristaRequisitions] = useState<InventoryRequisition[]>([]);
  const [baristaWasteReports, setBaristaWasteReports] = useState<InventoryWasteReport[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInventory() {
      try {
        const [inventoryData, requisitionsData, wasteReportsData] = await Promise.all([
          getInventoryOverview(),
          getInventoryRequisitions().catch((error) => {
            console.warn("Owner barista requisitions overview is not available yet", error);
            return [];
          }),
          getInventoryWasteReports().catch((error) => {
            console.warn("Owner barista waste overview is not available yet", error);
            return [];
          }),
        ]);
        if (!isMounted) return;
        setItems(inventoryData.items);
        setMovements(inventoryData.movements.slice(0, 10));
        setBaristaRequisitions(requisitionsData.filter((request) => request.destination === "barista"));
        setBaristaWasteReports(wasteReportsData.filter((report) => report.destination === "barista"));
        setErrorMessage("");
      } catch (error) {
        console.error("Failed to load owner inventory", error);
        if (!isMounted) return;
        setItems([]);
        setMovements([]);
        setBaristaRequisitions([]);
        setBaristaWasteReports([]);
        setErrorMessage("تعذر تحميل بيانات المخزون.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadInventory();
    return () => {
      isMounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (summary, item) => {
        const status = stockStatus(item);
        return {
          itemCount: summary.itemCount + 1,
          inventoryValue: summary.inventoryValue + item.stockOnHand * item.averageCost,
          lowStockCount: summary.lowStockCount + (status === "low" ? 1 : 0),
          outOfStockCount: summary.outOfStockCount + (status === "out" ? 1 : 0),
        };
      },
      { itemCount: 0, inventoryValue: 0, lowStockCount: 0, outOfStockCount: 0 },
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = normalizeInventoryName(search);
    return items.filter((item) => {
      const matchesSearch = !query || normalizeInventoryName(item.nameAr).includes(query) || normalizeInventoryName(item.nameEn ?? "").includes(query);
      const status = stockStatus(item);
      const matchesFilter = stockFilter === "all" || stockFilter === status;
      return matchesSearch && matchesFilter;
    });
  }, [items, search, stockFilter]);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة المالك</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">المخزون</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">متابعة أرصدة المواد وقيمة المخزون والتنبيهات من بيانات المخزن الحالية.</p>
      </section>

      {errorMessage ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="إجمالي عدد المواد" value={formatNumber(totals.itemCount)} icon={Boxes} />
            <SummaryCard title="قيمة المخزون الحالية" value={formatCurrency(totals.inventoryValue)} icon={PackageCheck} />
            <SummaryCard title="عدد المواد منخفضة المخزون" value={formatNumber(totals.lowStockCount)} icon={TrendingDown} />
            <SummaryCard title="عدد المواد النافدة" value={formatNumber(totals.outOfStockCount)} icon={PackageX} />
          </section>

          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="بحث باسم المادة"
                  className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] pr-10 pl-3 text-sm outline-none focus:border-[#a65f3f]"
                />
              </label>
              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value as StockFilter)}
                className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#a65f3f]"
              >
                {stockFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </section>

          <BaristaOverview requisitions={baristaRequisitions} wasteReports={baristaWasteReports} />
          <InventoryTable items={filteredItems} />
          <RecentMovements movements={movements} />
        </>
      )}
    </div>
  );
}
