"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, Trash2 } from "lucide-react";
import { InventoryWasteDialog } from "@/components/inventory/InventoryWasteDialog";
import { createClient } from "@/lib/supabase/client";
import { getInventoryWasteReports } from "@/services/inventoryWasteService";
import type { InventoryItemType, InventoryRequisitionDestination, InventoryUnitCode, InventoryWasteContext, InventoryWasteReason, InventoryWasteReport } from "@/types/inventory";

type WasteFilter = "all" | InventoryWasteContext;
type DestinationFilter = "all" | InventoryRequisitionDestination;
type ReasonFilter = "all" | InventoryWasteReason;
type ItemTypeFilter = "all" | InventoryItemType;

type InventoryWastePanelProps = {
  onInventoryChanged: () => void;
  readOnly?: boolean;
};

const contextLabels: Record<InventoryWasteContext, string> = {
  warehouse: "هدر المخزن",
  issued_department: "هدر الأقسام",
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

const itemTypeLabels: Record<InventoryItemType, string> = {
  food_recipe: "مادة وصفة",
  food_indirect: "غذائي غير مباشر",
  packaging: "تغليف",
  cleaning: "تنظيف",
  operational_consumable: "مستهلك تشغيلي",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatQuantity(quantity: number, unitCode: InventoryUnitCode, unitName: string) {
  if (unitCode === "g" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} كغم`;
  if (unitCode === "ml" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} لتر`;
  return `${formatNumber(quantity)} ${unitName}`;
}

export function InventoryWastePanel({ onInventoryChanged, readOnly = false }: InventoryWastePanelProps) {
  const [reports, setReports] = useState<InventoryWasteReport[]>([]);
  const [filter, setFilter] = useState<WasteFilter>("all");
  const [destinationFilter, setDestinationFilter] = useState<DestinationFilter>("all");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar-IQ");
    return reports.filter((report) => {
      const filterMatches = filter === "all" || report.context === filter;
      const destinationMatches = destinationFilter === "all" || report.destination === destinationFilter;
      const userMatches = !userFilter.trim() || report.postedByName.toLocaleLowerCase("ar-IQ").includes(userFilter.trim().toLocaleLowerCase("ar-IQ"));
      const reportDate = report.postedAt.slice(0, 10);
      const dateMatches = (!dateFrom || reportDate >= dateFrom) && (!dateTo || reportDate <= dateTo);
      const itemFilterMatches = report.items.some((item) => {
        const typeMatches = itemTypeFilter === "all" || item.itemType === itemTypeFilter;
        const reasonMatches = reasonFilter === "all" || item.reason === reasonFilter;
        return typeMatches && reasonMatches;
      });
      const searchMatches =
        !query ||
        `${report.reportCode} ${report.postedByName} ${report.note ?? ""} ${report.items.map((item) => `${item.inventoryItemName} ${item.requisitionCode ?? ""} ${item.notes ?? ""}`).join(" ")}`
          .toLocaleLowerCase("ar-IQ")
          .includes(query);
      return filterMatches && destinationMatches && userMatches && dateMatches && itemFilterMatches && searchMatches;
    });
  }, [dateFrom, dateTo, destinationFilter, filter, itemTypeFilter, reasonFilter, reports, search, userFilter]);

  const filteredRows = useMemo(
    () =>
      filteredReports.flatMap((report) =>
        report.items
          .filter((item) => (itemTypeFilter === "all" || item.itemType === itemTypeFilter) && (reasonFilter === "all" || item.reason === reasonFilter))
          .map((item) => ({ report, item })),
      ),
    [filteredReports, itemTypeFilter, reasonFilter],
  );

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
    return reports.filter((report) => new Date(report.postedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }) === today).length;
  }, [reports]);

  const loadWaste = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setReports(await getInventoryWasteReports());
    } catch (loadError) {
      console.error("Failed to load inventory waste reports", loadError);
      setError("تعذر تحميل سجل الهدر.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWaste();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadWaste]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleReload() {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadWaste();
        void onInventoryChanged();
      }, 250);
    }

    const channel = supabase
      .channel("inventory-waste-panel-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_waste_reports" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_waste_items" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadWaste, onInventoryChanged]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e4d8c8] bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-[#a65f3f]" />
          <div>
            <h2 className="font-semibold text-[#2f211c]">الهدر والتلف | {formatNumber(filteredRows.length)} سطر</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">هدر اليوم: {formatNumber(todayCount)} عمليات</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث عملية / مادة / مستخدم" className="h-9 w-56 rounded-md border border-[#e4d8c8] bg-white pr-8 pl-3 text-sm outline-none focus:border-[#a65f3f]" />
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as WasteFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
            <option value="all">كل الهدر</option>
            <option value="warehouse">هدر المخزن</option>
            <option value="issued_department">هدر الأقسام</option>
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm" title="من تاريخ" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm" title="إلى تاريخ" />
          <select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value as ItemTypeFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
            <option value="all">كل أنواع المواد</option>
            {(Object.keys(itemTypeLabels) as InventoryItemType[]).map((type) => (
              <option key={type} value={type}>{itemTypeLabels[type]}</option>
            ))}
          </select>
          <select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value as ReasonFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
            <option value="all">كل الأسباب</option>
            {(Object.keys(reasonLabels) as InventoryWasteReason[]).map((reason) => (
              <option key={reason} value={reason}>{reasonLabels[reason]}</option>
            ))}
          </select>
          <select value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value as DestinationFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
            <option value="all">كل الأقسام</option>
            {(Object.keys(destinationLabels) as InventoryRequisitionDestination[]).map((destination) => (
              <option key={destination} value={destination}>{destinationLabels[destination]}</option>
            ))}
          </select>
          <input value={userFilter} onChange={(event) => setUserFilter(event.target.value)} placeholder="المستخدم" className="h-9 w-32 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm outline-none focus:border-[#a65f3f]" />
          <button type="button" onClick={() => void loadWaste()} className="flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
            <RefreshCw size={15} />
            تحديث
          </button>
          {!readOnly ? <button type="button" onClick={() => setIsDialogOpen(true)} className="h-9 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]">
            تسجيل هدر
          </button> : null}
        </div>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        {isLoading ? <p className="p-4 text-sm text-[#7c6b60]">جارٍ تحميل سجل الهدر...</p> : null}
        {!isLoading && filteredRows.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد عمليات هدر مطابقة.</p> : null}
        {filteredRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1560px] table-fixed border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
                <tr>
                  <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">رقم العملية</th>
                  <th className="w-32 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">التاريخ</th>
                  <th className="w-24 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الوقت</th>
                  <th className="sticky right-0 z-30 w-48 border-l border-[#e6dacd] bg-[#2b2421] px-3 py-2 text-right font-semibold">اسم المادة</th>
                  <th className="w-36 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">نوع المادة</th>
                  <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الكمية</th>
                  <th className="w-20 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الوحدة</th>
                  <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">نوع الهدر</th>
                  <th className="w-32 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">القسم</th>
                  <th className="w-36 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">سبب الهدر</th>
                  <th className="w-32 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المستخدم</th>
                  <th className="w-32 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">طلب الصرف المرتبط</th>
                  <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المرجع</th>
                  <th className="w-44 px-3 py-2 text-right font-semibold">الملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {filteredRows.map(({ report, item }) => (
                    <tr key={`${report.id}-${item.id}`} className="odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                      <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]" dir="ltr">{report.reportCode}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDate(report.postedAt)}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatTime(report.postedAt)}</td>
                      <td className="sticky right-0 z-10 truncate border-l border-[#d5c2af] bg-inherit px-3 py-2 font-semibold text-[#1f1713]" title={item.inventoryItemName}>{item.inventoryItemName}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{itemTypeLabels[item.itemType]}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 font-bold text-rose-700">{formatQuantity(item.quantityBase, item.baseUnitCode, item.baseUnitName)}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{item.baseUnitName}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2"><span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${report.context === "warehouse" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{contextLabels[report.context]}</span></td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{report.destination ? destinationLabels[report.destination] : "المخزن"}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{reasonLabels[item.reason]}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{report.postedByName}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]" dir="ltr">{item.requisitionCode ?? "-"}</td>
                      <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]" dir="ltr">{item.id.slice(0, 8)}</td>
                      <td className="truncate px-3 py-2 text-[#4a3b34]" title={item.notes ?? report.note ?? ""}>{item.notes ?? report.note ?? "-"}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {!readOnly ? <InventoryWasteDialog
        isOpen={isDialogOpen}
        context="warehouse"
        onClose={() => setIsDialogOpen(false)}
        onPosted={() => {
          void Promise.all([loadWaste(), onInventoryChanged()]);
          showMessage("تم تسجيل الهدر وتحديث رصيد المخزن");
        }}
      /> : null}
    </div>
  );
}
