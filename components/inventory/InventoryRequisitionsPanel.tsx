"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, PackageCheck, RefreshCw, Search, Send, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  approveInventoryRequisition,
  confirmInventoryRequisitionReceipt,
  getInventoryRequisitions,
  issueInventoryRequisition,
  rejectInventoryRequisition,
} from "@/services/inventoryRequisitionService";
import type { InventoryRequisition, InventoryRequisitionDestination, InventoryRequisitionStatus, InventoryUnitCode } from "@/types/inventory";

type InventoryRequisitionsPanelProps = {
  onInventoryChanged: () => void;
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

const statusLabels: Record<InventoryRequisitionStatus, string> = {
  pending: "بانتظار المخزن",
  approved: "معتمد",
  issued: "مصروف بانتظار الاستلام",
  received: "تم الاستلام",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatQuantity(quantity: number, unitCode: InventoryUnitCode, unitName: string) {
  if (unitCode === "g" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} كغم`;
  if (unitCode === "ml" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} لتر`;
  return `${formatNumber(quantity)} ${unitName}`;
}

function materialsSummary(requisition: InventoryRequisition) {
  const names = requisition.items.map((item) => item.inventoryItemName).filter(Boolean);
  if (names.length === 0) return "-";
  if (names.length <= 3) return names.join("، ");
  return `${names.slice(0, 3).join("، ")} +${names.length - 3}`;
}

function statusTone(status: InventoryRequisitionStatus) {
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "approved") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "issued") return "border-[#e4d8c8] bg-[#fbfaf7] text-[#4a3b34]";
  if (status === "received") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function InventoryRequisitionsPanel({ onInventoryChanged }: InventoryRequisitionsPanelProps) {
  const [requisitions, setRequisitions] = useState<InventoryRequisition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, string>>({});
  const [rejectedItems, setRejectedItems] = useState<Record<string, boolean>>({});
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryRequisitionStatus | "all">("all");
  const [destinationFilter, setDestinationFilter] = useState<InventoryRequisitionDestination | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const reloadTimerRef = useRef<number | null>(null);

  const selected = requisitions.find((requisition) => requisition.id === selectedId) ?? null;
  const pendingCount = requisitions.filter((requisition) => requisition.status === "pending").length;

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar-IQ");
    return requisitions.filter((requisition) => {
      const searchMatches =
        !query ||
        `${requisition.requestCode} ${requisition.requestedByName} ${requisition.approvedByName ?? ""} ${requisition.issuedByName ?? ""} ${requisition.receivedByName ?? ""} ${materialsSummary(requisition)}`
          .toLocaleLowerCase("ar-IQ")
          .includes(query);
      const statusMatches = statusFilter === "all" || requisition.status === statusFilter;
      const destinationMatches = destinationFilter === "all" || requisition.destination === destinationFilter;
      return searchMatches && statusMatches && destinationMatches;
    });
  }, [destinationFilter, requisitions, search, statusFilter]);

  const loadRequisitions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextRequisitions = await getInventoryRequisitions();
      setRequisitions(nextRequisitions);

      const nextSelected = nextRequisitions.find((requisition) => requisition.id === selectedId) ?? null;
      setSelectedId(nextSelected?.id ?? null);
      if (nextSelected) {
        setApprovedQuantities(Object.fromEntries(nextSelected.items.map((item) => [item.id, String(item.approvedQuantityBase ?? item.requestedQuantityBase)])));
        setRejectedItems(Object.fromEntries(nextSelected.items.map((item) => [item.id, item.status === "rejected"])));
      }
    } catch (loadError) {
      console.error("Failed to load inventory requisitions", loadError);
      setError("تعذر تحميل طلبات الصرف.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadRequisitions();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadRequisitions]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleReload() {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadRequisitions();
      }, 250);
    }

    const channel = supabase
      .channel("inventory-requisition-panel-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisitions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisition_items" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadRequisitions]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function selectRequisition(requisition: InventoryRequisition) {
    setSelectedId(requisition.id);
    setRejectionReason("");
    setApprovedQuantities(Object.fromEntries(requisition.items.map((item) => [item.id, String(item.approvedQuantityBase ?? item.requestedQuantityBase)])));
    setRejectedItems(Object.fromEntries(requisition.items.map((item) => [item.id, item.status === "rejected"])));
  }

  async function approveSelected() {
    if (!selected) return;
    setIsSaving(true);
    setError("");

    try {
      await approveInventoryRequisition({
        requisitionId: selected.id,
        items: selected.items.map((item) => ({
          itemId: item.id,
          approvedQuantityBase: Number(approvedQuantities[item.id] ?? item.requestedQuantityBase),
          rejected: Boolean(rejectedItems[item.id]),
        })),
      });
      await loadRequisitions();
      showMessage("تم اعتماد طلب الصرف");
    } catch (approveError) {
      console.error("Failed to approve inventory requisition", approveError);
      setError("تعذر اعتماد الطلب. تحقق من الكميات المعتمدة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectSelected() {
    if (!selected) return;
    setIsSaving(true);
    setError("");

    try {
      await rejectInventoryRequisition(selected.id, rejectionReason || "رفض من واجهة المخزن");
      await loadRequisitions();
      showMessage("تم رفض طلب الصرف");
    } catch (rejectError) {
      console.error("Failed to reject inventory requisition", rejectError);
      setError("تعذر رفض الطلب.");
    } finally {
      setIsSaving(false);
    }
  }

  async function issueSelected() {
    if (!selected) return;
    setIsSaving(true);
    setError("");

    try {
      await issueInventoryRequisition(selected.id);
      await Promise.all([loadRequisitions(), onInventoryChanged()]);
      showMessage("تم صرف المواد وتحديث المخزون");
    } catch (issueError) {
      console.error("Failed to issue inventory requisition", issueError);
      setError("تعذر صرف المواد. قد يكون الرصيد المتاح غير كافٍ.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmReceipt() {
    if (!selected) return;
    setIsSaving(true);
    setError("");

    try {
      await confirmInventoryRequisitionReceipt(selected.id);
      await loadRequisitions();
      showMessage("تم تأكيد الاستلام");
    } catch (receiptError) {
      console.error("Failed to confirm inventory requisition receipt", receiptError);
      setError("تعذر تأكيد الاستلام.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee4d8] bg-[#fbfaf7] px-3 py-2">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-[#a65f3f]" />
            <div>
              <h2 className="font-semibold text-[#2f211c]">طلبات الصرف | {formatNumber(rows.length)} طلب</h2>
              <p className="mt-1 text-xs text-[#7c6b60]">طلبات جديدة {formatNumber(pendingCount)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث رقم / مستخدم" className="h-9 w-52 rounded-md border border-[#e4d8c8] bg-white pr-8 pl-3 text-sm outline-none focus:border-[#a65f3f]" />
            </div>
            <select value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value as InventoryRequisitionDestination | "all")} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
              <option value="all">كل الأقسام</option>
              {Object.entries(destinationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InventoryRequisitionStatus | "all")} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
              <option value="all">كل الحالات</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={() => void loadRequisitions()} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]" title="تحديث">
              <RefreshCw size={15} />
              تحديث
            </button>
          </div>
        </div>
        {isLoading ? <p className="p-4 text-sm text-[#7c6b60]">جارٍ تحميل طلبات الصرف...</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
              <tr>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">رقم الطلب</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">التاريخ</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">القسم</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">طالب المواد</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المواد</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الحالة</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المعتمد بواسطة</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المصروف بواسطة</th>
                <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المستلم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {rows.map((requisition) => (
                <tr key={requisition.id} onClick={() => selectRequisition(requisition)} className={`cursor-pointer odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb] ${requisition.status === "pending" ? "outline outline-1 -outline-offset-1 outline-amber-200" : ""} ${selected?.id === requisition.id ? "bg-[#fff1e8]" : ""}`}>
                  <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]" dir="ltr">
                    <span>{requisition.requestCode}</span>
                    {requisition.status === "pending" ? <span className="mr-2 rounded-full bg-[#ff5656] px-2 py-0.5 text-[10px] font-bold text-white" dir="rtl">جديد</span> : null}
                  </td>
                  <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDateTime(requisition.requestedAt)}</td>
                  <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{destinationLabels[requisition.destination]}</td>
                  <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{requisition.requestedByName}</td>
                  <td className="truncate border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]" title={requisition.items.map((item) => item.inventoryItemName).join("، ")}>{materialsSummary(requisition)}</td>
                  <td className="border-l border-[#f0e5da] px-3 py-2"><span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${statusTone(requisition.status)}`}>{statusLabels[requisition.status]}</span></td>
                  <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{requisition.approvedByName ?? "-"}</td>
                  <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{requisition.issuedByName ?? "-"}</td>
                  <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{requisition.receivedByName ?? "-"}</td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-[#4a3b34]">لا توجد طلبات صرف مطابقة.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
      <section className="w-full max-w-6xl rounded-md border border-[#e4d8c8] bg-white p-4 shadow-2xl">
        {message ? <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <button type="button" onClick={() => setSelectedId(null)} className="mb-3 rounded-md border border-[#e4d8c8] px-3 py-2 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">إغلاق التفاصيل</button>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee4d8] pb-3">
              <div>
                <p className="text-sm text-[#7c6b60]">طلب صرف داخلي</p>
                <h2 className="text-xl font-semibold text-[#2f211c]">{selected.requestCode}</h2>
                <p className="mt-1 text-sm text-[#7c6b60]">القسم: {destinationLabels[selected.destination]} · بواسطة: {selected.requestedByName}</p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(selected.status)}`}>{statusLabels[selected.status]}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[#2b2421] text-white">
                  <tr>
                    <th className="px-3 py-3 text-right font-semibold">المادة</th>
                    <th className="px-3 py-3 text-right font-semibold">المطلوب</th>
                    <th className="px-3 py-3 text-right font-semibold">المتاح حالياً</th>
                    <th className="px-3 py-3 text-right font-semibold">المعتمد</th>
                    <th className="px-3 py-3 text-right font-semibold">المصروف</th>
                    <th className="px-3 py-3 text-right font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee4d8]">
                  {selected.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#fffaf4]">
                      <td className="px-3 py-3 font-medium text-[#2f211c]">{item.inventoryItemName}</td>
                      <td className="px-3 py-3 text-[#4a3b34]">
                        {formatNumber(item.requestedQuantity)} {item.requestedUnitLabel}
                        <span className="block text-xs text-[#9a8779]">{formatQuantity(item.requestedQuantityBase, item.baseUnitCode, item.baseUnitName)}</span>
                      </td>
                      <td className="px-3 py-3 text-[#4a3b34]">{formatQuantity(item.stockOnHand, item.baseUnitCode, item.baseUnitName)}</td>
                      <td className="px-3 py-3">
                        {selected.status === "pending" ? (
                          <div className="flex items-center gap-2">
                            <input disabled={Boolean(rejectedItems[item.id])} min="0.001" step="0.001" type="number" value={approvedQuantities[item.id] ?? ""} onChange={(event) => setApprovedQuantities((current) => ({ ...current, [item.id]: event.target.value }))} className="h-10 w-28 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-2 text-sm outline-none focus:border-[#a65f3f] disabled:opacity-50" />
                            <span className="text-xs text-[#7c6b60]">{item.baseUnitName}</span>
                            <label className="flex items-center gap-1 text-xs text-[#7c6b60]">
                              <input type="checkbox" checked={Boolean(rejectedItems[item.id])} onChange={(event) => setRejectedItems((current) => ({ ...current, [item.id]: event.target.checked }))} />
                              رفض
                            </label>
                          </div>
                        ) : (
                          <span className="text-[#4a3b34]">{item.approvedQuantityBase ? formatQuantity(item.approvedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[#4a3b34]">{item.issuedQuantityBase ? formatQuantity(item.issuedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"}</td>
                      <td className="px-3 py-3 text-[#4a3b34]">{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected.note ? <p className="rounded-md bg-[#fbfaf7] p-3 text-sm text-[#4a3b34]">ملاحظة: {selected.note}</p> : null}
            {selected.status === "rejected" && selected.rejectionReason ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">سبب الرفض: {selected.rejectionReason}</p> : null}

            {selected.status === "pending" ? (
              <div className="space-y-3 border-t border-[#eee4d8] pt-3">
                <input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="سبب الرفض عند رفض الطلب بالكامل" className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
                <div className="flex flex-wrap gap-2">
                  <button disabled={isSaving} type="button" onClick={() => void approveSelected()} className="flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-3 text-sm font-semibold text-white disabled:opacity-60"><CheckCircle2 size={16} />اعتماد الطلب</button>
                  <button disabled={isSaving} type="button" onClick={() => void rejectSelected()} className="flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 disabled:opacity-60"><XCircle size={16} />رفض الطلب</button>
                </div>
              </div>
            ) : null}

            {selected.status === "approved" ? (
              <button disabled={isSaving} type="button" onClick={() => void issueSelected()} className="flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-3 text-sm font-semibold text-white disabled:opacity-60">
                <Send size={16} />
                صرف المواد
              </button>
            ) : null}

            {selected.status === "issued" ? (
              <button disabled={isSaving} type="button" onClick={() => void confirmReceipt()} className="flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-60">
                <PackageCheck size={16} />
                تأكيد الاستلام
              </button>
            ) : null}
          </div>
      </section>
      </div>
      ) : null}
    </div>
  );
}
