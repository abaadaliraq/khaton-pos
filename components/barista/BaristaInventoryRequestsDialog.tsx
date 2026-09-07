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
  if (status === "pending") return "border-amber-300/40 bg-amber-400/10 text-amber-100";
  if (status === "approved") return "border-sky-300/40 bg-sky-400/10 text-sky-100";
  if (status === "issued") return "border-[#D88A3D]/45 bg-[#D88A3D]/15 text-[#f3c68d]";
  if (status === "received") return "border-emerald-300/40 bg-emerald-400/10 text-emerald-100";
  return "border-rose-300/40 bg-rose-400/10 text-rose-100";
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <section className="w-full max-w-6xl rounded-lg border border-white/10 bg-[#24211E] p-4 text-[#FFF8EE] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={19} className="text-[#D88A3D]" />
            <div>
              <h2 className="font-semibold">طلباتي من المخزن</h2>
              <p className="mt-1 text-xs text-[#C9BEB2]">طلبات الباريستا ومتابعة الصرف والاستلام</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingReceiptCount > 0 ? <span className="rounded-full bg-[#D88A3D] px-3 py-1 text-xs font-bold text-[#171513]">{formatNumber(pendingReceiptCount)} بانتظار الاستلام</span> : null}
            <button type="button" onClick={() => void load()} className="rounded-lg border border-white/10 p-2 text-[#C9BEB2] hover:bg-[#302B27]" aria-label="تحديث">
              <RefreshCw size={17} />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#C9BEB2] hover:bg-[#302B27]" aria-label="إغلاق">
              <X size={17} />
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
        {isLoading ? <p className="mt-4 text-sm text-[#C9BEB2]">جارٍ تحميل الطلبات...</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[820px] table-fixed border-collapse text-xs">
              <thead className="bg-[#171513] text-[#FFF8EE]">
                <tr>
                  <th className="border-l border-white/10 px-3 py-2 text-right">رقم الطلب</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">التاريخ</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">عدد المواد</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">الحالة</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">المعتمد</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">الصرف</th>
                  <th className="px-3 py-2 text-right">الاستلام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {requisitions.map((requisition) => (
                  <tr key={requisition.id} onClick={() => setSelectedId(requisition.id)} className={`cursor-pointer hover:bg-[#302B27] ${selected?.id === requisition.id ? "bg-[#302B27]" : "bg-[#24211E]"}`}>
                    <td className="border-l border-white/10 px-3 py-2 font-semibold" dir="ltr">{requisition.requestCode}</td>
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{formatDateTime(requisition.requestedAt)}</td>
                    <td className="border-l border-white/10 px-3 py-2">{formatNumber(requisition.items.length)}</td>
                    <td className="border-l border-white/10 px-3 py-2"><span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(requisition.status)}`}>{statusLabels[requisition.status]}</span></td>
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{requisition.approvedByName ?? "-"}</td>
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{formatDateTime(requisition.issuedAt)}</td>
                    <td className="px-3 py-2 text-[#C9BEB2]">{formatDateTime(requisition.receivedAt)}</td>
                  </tr>
                ))}
                {!isLoading && requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#C9BEB2]">لا توجد طلبات مواد للباريستا.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <section className="rounded-lg border border-white/10 bg-[#171513] p-3">
            {!selected ? <p className="text-sm text-[#C9BEB2]">اختر طلباً لعرض التفاصيل.</p> : null}
            {selected ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{selected.requestCode}</h3>
                    <p className="mt-1 text-xs text-[#C9BEB2]">طلب بواسطة: {selected.requestedByName}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(selected.status)}`}>{statusLabels[selected.status]}</span>
                </div>
                <div className="mt-3 divide-y divide-white/10">
                  {selected.items.map((item) => (
                    <div key={item.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.inventoryItemName}</span>
                        <span className="text-[#C9BEB2]">{item.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#C9BEB2]">
                        مطلوب: {formatNumber(item.requestedQuantity)} {item.requestedUnitLabel} · معتمد: {item.approvedQuantityBase ? formatQuantity(item.approvedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"} · مصروف: {item.issuedQuantityBase ? formatQuantity(item.issuedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"}
                      </p>
                    </div>
                  ))}
                </div>
                {selected.status === "issued" ? (
                  <button disabled={isSaving} type="button" onClick={() => void confirmReceipt(selected.id)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#D88A3D] text-sm font-semibold text-[#171513] disabled:opacity-60">
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
