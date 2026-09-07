"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2, X } from "lucide-react";
import { InventoryWasteDialog } from "@/components/inventory/InventoryWasteDialog";
import { createClient } from "@/lib/supabase/client";
import { getInventoryWasteReports } from "@/services/inventoryWasteService";
import type { InventoryUnitCode, InventoryWasteReason, InventoryWasteReport } from "@/types/inventory";

type BaristaWasteDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
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

export function BaristaWasteDialog({ isOpen, onClose, onChanged }: BaristaWasteDialogProps) {
  const [reports, setReports] = useState<InventoryWasteReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  const rows = useMemo(
    () =>
      reports
        .filter((report) => report.context === "issued_department" && report.destination === "barista")
        .flatMap((report) => report.items.map((item) => ({ report, item }))),
    [reports],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setReports(await getInventoryWasteReports());
    } catch (loadError) {
      console.error("Failed to load barista waste history", loadError);
      setError("تعذر تحميل سجل هدر الباريستا.");
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
      .channel("barista-waste-dialog-sync")
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
  }, [isOpen, load]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
        <section className="w-full max-w-6xl rounded-lg border border-white/10 bg-[#24211E] p-4 text-[#FFF8EE] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Trash2 size={19} className="text-[#D88A3D]" />
              <div>
                <h2 className="font-semibold">الهدر والتلف</h2>
                <p className="mt-1 text-xs text-[#C9BEB2]">سجل هدر المواد المصروفة للباريستا فقط</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setIsPostOpen(true)} className="flex h-10 items-center gap-2 rounded-lg bg-[#D88A3D] px-3 text-sm font-semibold text-[#171513]">
                <Plus size={16} />
                تسجيل هدر
              </button>
              <button type="button" onClick={() => void load()} className="rounded-lg border border-white/10 p-2 text-[#C9BEB2] hover:bg-[#302B27]" aria-label="تحديث">
                <RefreshCw size={17} />
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#C9BEB2] hover:bg-[#302B27]" aria-label="إغلاق">
                <X size={17} />
              </button>
            </div>
          </div>

          {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
          {isLoading ? <p className="mt-4 text-sm text-[#C9BEB2]">جارٍ تحميل السجل...</p> : null}

          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-xs">
              <thead className="bg-[#171513] text-[#FFF8EE]">
                <tr>
                  <th className="border-l border-white/10 px-3 py-2 text-right">التاريخ</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">المادة</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">الكمية</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">الوحدة</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">السبب</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">طلب الصرف</th>
                  <th className="border-l border-white/10 px-3 py-2 text-right">المستخدم</th>
                  <th className="px-3 py-2 text-right">الملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map(({ report, item }) => (
                  <tr key={item.id} className="odd:bg-[#24211E] even:bg-[#211e1b]">
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{formatDateTime(report.postedAt)}</td>
                    <td className="border-l border-white/10 px-3 py-2 font-semibold">{item.inventoryItemName}</td>
                    <td className="border-l border-white/10 px-3 py-2 text-rose-100">{formatQuantity(item.quantityBase, item.baseUnitCode, item.baseUnitName)}</td>
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{item.baseUnitName}</td>
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{reasonLabels[item.reason]}</td>
                    <td className="border-l border-white/10 px-3 py-2" dir="ltr">{item.requisitionCode ?? "-"}</td>
                    <td className="border-l border-white/10 px-3 py-2 text-[#C9BEB2]">{report.postedByName}</td>
                    <td className="truncate px-3 py-2 text-[#C9BEB2]" title={item.notes ?? report.note ?? ""}>{item.notes ?? report.note ?? "-"}</td>
                  </tr>
                ))}
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-[#C9BEB2]">لا يوجد سجل هدر للباريستا.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <InventoryWasteDialog
        isOpen={isPostOpen}
        context="issued_department"
        defaultDestination="barista"
        onClose={() => setIsPostOpen(false)}
        onPosted={() => {
          void load();
          onChanged();
        }}
      />
    </>
  );
}
