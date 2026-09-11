"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, PackageCheck, RefreshCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmInventoryRequisitionReceipt, getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import type { InventoryRequisition, InventoryRequisitionStatus, InventoryUnitCode } from "@/types/inventory";

type BaristaInventoryRequestsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
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

function formatDateTime(value: string | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatQuantity(quantity: number | undefined, unitCode: InventoryUnitCode, unitName: string) {
  const value = quantity ?? 0;
  if (unitCode === "g" && Math.abs(value) >= 1000) return `${formatNumber(value / 1000)} كغم`;
  if (unitCode === "ml" && Math.abs(value) >= 1000) return `${formatNumber(value / 1000)} لتر`;
  return `${formatNumber(value)} ${unitName}`;
}

function statusTone(status: InventoryRequisitionStatus) {
  if (status === "pending") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "approved") return "border-sky-300 bg-sky-50 text-sky-800";
  if (status === "issued") return "border-[#D88A3D]/55 bg-[#FFF1DF] text-[#8B4A16]";
  if (status === "received") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  return "border-rose-300 bg-rose-50 text-rose-800";
}

export function BaristaInventoryRequestsDialog({ isOpen, onClose, onChanged }: BaristaInventoryRequestsDialogProps) {
  const [requisitions, setRequisitions] = useState<InventoryRequisition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  const selected = requisitions.find((requisition) => requisition.id === selectedId) ?? requisitions[0] ?? null;

  const pendingReceiptCount = useMemo(
    () => requisitions.filter((requisition) => requisition.status === "issued").length,
    [requisitions],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextRequisitions = (await getInventoryRequisitions()).filter((requisition) => requisition.destination === "barista");
      setRequisitions(nextRequisitions);
      setSelectedId((current) => nextRequisitions.find((requisition) => requisition.id === current)?.id ?? nextRequisitions[0]?.id ?? null);
    } catch (loadError) {
      console.error("Failed to load barista inventory requisitions", loadError);
      setError("تعذر تحميل طلبات مواد الباريستا.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();

    function scheduleReload() {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void load();
      }, 250);
    }

    const channel = supabase
      .channel("barista-requisitions-dialog-sync")
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
  }, [isOpen, load]);

  async function confirmReceipt(requisitionId: string) {
    setIsSaving(true);
    setError("");

    try {
      await confirmInventoryRequisitionReceipt(requisitionId);
      await load();
      onChanged();
    } catch (receiptError) {
      console.error("Failed to confirm barista requisition receipt", receiptError);
      setError("تعذر تأكيد الاستلام لهذا الطلب.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
      <section className="w-full max-w-6xl rounded-lg border border-[#E1D3C2] bg-white p-4 text-[#2C211D] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1D3C2] pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={19} className="text-[#D88A3D]" />
            <div>
              <h2 className="font-black">طلباتي من المخزن</h2>
              <p className="mt-1 text-xs font-semibold text-[#6F6258]">طلبات الباريستا ومتابعة الصرف والاستلام</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingReceiptCount > 0 ? <span className="rounded-full bg-[#B94B43] px-3 py-1 text-xs font-bold text-white">{formatNumber(pendingReceiptCount)} بانتظار الاستلام</span> : null}
            <button type="button" onClick={() => void load()} className="rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] p-2 text-[#2C211D] hover:bg-[#F1E6D8]" aria-label="تحديث">
              <RefreshCw size={17} />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-[#D8C8B7] bg-[#FFFDF9] p-2 text-[#2C211D] hover:bg-[#F1E6D8]" aria-label="إغلاق">
              <X size={17} />
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{error}</p> : null}
        {isLoading ? <p className="mt-4 text-sm font-bold text-[#6F6258]">جارٍ تحميل الطلبات...</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <div className="overflow-x-auto rounded-lg border border-[#E1D3C2]">
            <table className="w-full min-w-[820px] table-fixed border-collapse text-xs">
              <thead className="bg-[#F2E7D9] text-[#2C211D]">
                <tr>
                  <th className="border-l border-[#E1D3C2] px-3 py-2 text-right">رقم الطلب</th>
                  <th className="border-l border-[#E1D3C2] px-3 py-2 text-right">التاريخ</th>
                  <th className="border-l border-[#E1D3C2] px-3 py-2 text-right">عدد المواد</th>
                  <th className="border-l border-[#E1D3C2] px-3 py-2 text-right">الحالة</th>
                  <th className="border-l border-[#E1D3C2] px-3 py-2 text-right">المعتمد</th>
                  <th className="border-l border-[#E1D3C2] px-3 py-2 text-right">الصرف</th>
                  <th className="px-3 py-2 text-right">الاستلام</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((requisition) => (
                  <tr key={requisition.id} onClick={() => setSelectedId(requisition.id)} className={`cursor-pointer border-b border-[#E1D3C2] hover:bg-[#F7F1E8] ${selected?.id === requisition.id ? "bg-[#F2E7D9]" : "bg-white"}`}>
                    <td className="border-l border-[#E1D3C2] px-3 py-2 font-bold" dir="ltr">{requisition.requestCode}</td>
                    <td className="border-l border-[#E1D3C2] px-3 py-2 font-semibold text-[#5A4A42]">{formatDateTime(requisition.requestedAt)}</td>
                    <td className="border-l border-[#E1D3C2] px-3 py-2 font-semibold">{formatNumber(requisition.items.length)}</td>
                    <td className="border-l border-[#E1D3C2] px-3 py-2"><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusTone(requisition.status)}`}>{statusLabels[requisition.status]}</span></td>
                    <td className="border-l border-[#E1D3C2] px-3 py-2 font-semibold text-[#5A4A42]">{requisition.approvedByName ?? "-"}</td>
                    <td className="border-l border-[#E1D3C2] px-3 py-2 font-semibold text-[#5A4A42]">{formatDateTime(requisition.issuedAt)}</td>
                    <td className="px-3 py-2 font-semibold text-[#5A4A42]">{formatDateTime(requisition.receivedAt)}</td>
                  </tr>
                ))}
                {!isLoading && requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm font-bold text-[#6F6258]">لا توجد طلبات مواد للباريستا.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <section className="rounded-lg border border-[#E1D3C2] bg-[#FFFDF9] p-3">
            {!selected ? <p className="text-sm font-bold text-[#6F6258]">اختر طلباً لعرض التفاصيل.</p> : null}
            {selected ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black">{selected.requestCode}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6F6258]">طلب بواسطة: {selected.requestedByName}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(selected.status)}`}>{statusLabels[selected.status]}</span>
                </div>
                <div className="mt-3 divide-y divide-[#E1D3C2]">
                  {selected.items.map((item) => (
                    <div key={item.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{item.inventoryItemName}</span>
                        <span className="font-semibold text-[#6F6258]">{item.status}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#6F6258]">
                        مطلوب: {formatNumber(item.requestedQuantity)} {item.requestedUnitLabel} · معتمد: {item.approvedQuantityBase ? formatQuantity(item.approvedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"} · مصروف: {item.issuedQuantityBase ? formatQuantity(item.issuedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"}
                      </p>
                    </div>
                  ))}
                </div>
                {selected.status === "issued" ? (
                  <button disabled={isSaving} type="button" onClick={() => void confirmReceipt(selected.id)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#B94B43] text-sm font-bold text-white disabled:bg-[#E4D8C9] disabled:text-[#6F6258]">
                    <PackageCheck size={17} />
                    تأكيد استلام المواد
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
