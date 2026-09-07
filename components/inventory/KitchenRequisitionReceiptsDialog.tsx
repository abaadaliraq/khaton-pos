"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageCheck, X } from "lucide-react";
import { confirmInventoryRequisitionReceipt, getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import type { InventoryRequisition, InventoryUnitCode } from "@/types/inventory";

type KitchenRequisitionReceiptsDialogProps = {
  isOpen: boolean;
  destination?: InventoryRequisition["destination"];
  title?: string;
  emptyMessage?: string;
  onClose: () => void;
  onChanged: () => void;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatQuantity(quantity: number, unitCode: InventoryUnitCode, unitName: string) {
  if (unitCode === "g" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} كغم`;
  if (unitCode === "ml" && Math.abs(quantity) >= 1000) return `${formatNumber(quantity / 1000)} لتر`;
  return `${formatNumber(quantity)} ${unitName}`;
}

export function KitchenRequisitionReceiptsDialog({
  isOpen,
  destination = "kitchen",
  title = "طلبات بانتظار تأكيد الاستلام",
  emptyMessage = "لا توجد مواد مصروفة بانتظار استلام.",
  onClose,
  onChanged,
}: KitchenRequisitionReceiptsDialogProps) {
  const [requisitions, setRequisitions] = useState<InventoryRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextRequisitions = await getInventoryRequisitions();
      setRequisitions(nextRequisitions.filter((requisition) => requisition.destination === destination && requisition.status === "issued"));
    } catch (loadError) {
      console.error("Failed to load issued requisitions", { destination, error: loadError });
      setError("تعذر تحميل طلبات الاستلام.");
    } finally {
      setIsLoading(false);
    }
  }, [destination]);

  useEffect(() => {
    if (!isOpen) return;
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [isOpen, load]);

  async function confirmReceipt(requisitionId: string) {
    setIsSaving(true);
    setError("");

    try {
      await confirmInventoryRequisitionReceipt(requisitionId);
      await load();
      onChanged();
    } catch (receiptError) {
      console.error("Failed to confirm requisition receipt", { destination, error: receiptError });
      setError("تعذر تأكيد الاستلام.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#3b3631] bg-[#24211E] p-4 text-[#FFF8EE] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <PackageCheck size={19} className="text-[#D88A3D]" />
            <h2 className="font-semibold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#C9BEB2] hover:bg-[#302B27]" aria-label="إغلاق">
            <X size={17} />
          </button>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
        {isLoading ? <p className="mt-4 text-sm text-[#C9BEB2]">جارٍ التحميل...</p> : null}
        {!isLoading && requisitions.length === 0 ? <p className="mt-4 rounded-lg border border-white/10 bg-[#171513] p-4 text-sm text-[#C9BEB2]">{emptyMessage}</p> : null}

        <div className="mt-4 space-y-3">
          {requisitions.map((requisition) => (
            <article key={requisition.id} className="rounded-lg border border-white/10 bg-[#171513] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{requisition.requestCode}</h3>
                  <p className="mt-1 text-xs text-[#C9BEB2]">صرف بواسطة: {requisition.issuedByName ?? "-"}</p>
                </div>
                <button disabled={isSaving} type="button" onClick={() => void confirmReceipt(requisition.id)} className="rounded-lg bg-[#D88A3D] px-3 py-2 text-sm font-semibold text-[#171513] disabled:opacity-60">
                  تم الاستلام
                </button>
              </div>
              <div className="mt-3 divide-y divide-white/10">
                {requisition.items.filter((item) => item.status === "issued").map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{item.inventoryItemName}</span>
                    <span className="text-[#C9BEB2]">{item.issuedQuantityBase ? formatQuantity(item.issuedQuantityBase, item.baseUnitCode, item.baseUnitName) : "-"}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
