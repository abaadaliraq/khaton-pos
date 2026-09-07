"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { getInventoryWasteCatalog, recordInventoryWaste } from "@/services/inventoryWasteService";
import type {
  InventoryRequisitionCatalogItem,
  InventoryRequisitionDestination,
  InventoryUnit,
  InventoryWasteCatalog,
  InventoryWasteContext,
  InventoryWasteIssuedItem,
  InventoryWasteReason,
} from "@/types/inventory";

type WasteLine = {
  id: string;
  sourceId: string;
  quantity: string;
  unitChoice: string;
  reason: InventoryWasteReason;
  notes: string;
};

type InventoryWasteDialogProps = {
  isOpen: boolean;
  context: InventoryWasteContext;
  defaultDestination?: InventoryRequisitionDestination;
  onClose: () => void;
  onPosted: () => void;
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

const reasonOptions = Object.entries(reasonLabels) as [InventoryWasteReason, string][];
const standardBaseUnitCodes: InventoryUnit["code"][] = ["g", "kg", "ml", "l", "piece"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function compatibleUnits(baseUnitId: string | undefined, units: InventoryUnit[]) {
  if (!baseUnitId) return [];
  const baseUnit = units.find((unit) => unit.id === baseUnitId);
  return baseUnit ? units.filter((unit) => unit.family === baseUnit.family && standardBaseUnitCodes.includes(unit.code)) : [];
}

function newLine(catalog: InventoryWasteCatalog | null, context: InventoryWasteContext, destination: InventoryRequisitionDestination): WasteLine {
  const firstWarehouseItem = catalog?.items[0];
  const firstIssuedItem = catalog?.issuedItems.find((item) => item.destination === destination);
  const sourceId = context === "warehouse" ? firstWarehouseItem?.id : firstIssuedItem?.requisitionItemId;
  const baseUnitId = context === "warehouse" ? firstWarehouseItem?.baseUnitId : firstIssuedItem?.baseUnitId;
  return {
    id: crypto.randomUUID(),
    sourceId: sourceId ?? "",
    quantity: "",
    unitChoice: baseUnitId ? `unit:${baseUnitId}` : "",
    reason: context === "warehouse" ? "spoiled" : "preparation_error",
    notes: "",
  };
}

export function InventoryWasteDialog({ isOpen, context, defaultDestination = "kitchen", onClose, onPosted }: InventoryWasteDialogProps) {
  const [catalog, setCatalog] = useState<InventoryWasteCatalog | null>(null);
  const [lines, setLines] = useState<WasteLine[]>([]);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      setNote("");

      getInventoryWasteCatalog(context)
        .then((nextCatalog) => {
          if (!isMounted) return;
          setCatalog(nextCatalog);
          setLines([newLine(nextCatalog, context, defaultDestination)]);
        })
        .catch((loadError) => {
          console.error("Failed to load inventory waste catalog", loadError);
          if (isMounted) setError("تعذر تحميل مواد الهدر.");
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [context, defaultDestination, isOpen]);

  const itemById = useMemo(() => new Map((catalog?.items ?? []).map((item) => [item.id, item])), [catalog]);
  const issuedById = useMemo(() => new Map((catalog?.issuedItems ?? []).map((item) => [item.requisitionItemId, item])), [catalog]);
  const unitById = useMemo(() => new Map((catalog?.units ?? []).map((unit) => [unit.id, unit])), [catalog]);
  const conversionById = useMemo(() => new Map((catalog?.conversions ?? []).map((conversion) => [conversion.id, conversion])), [catalog]);

  function sourceForLine(line: WasteLine): InventoryRequisitionCatalogItem | InventoryWasteIssuedItem | undefined {
    return context === "warehouse" ? itemById.get(line.sourceId) : issuedById.get(line.sourceId);
  }

  function baseQuantity(line: WasteLine) {
    const source = sourceForLine(line);
    const quantity = Number(line.quantity);
    if (!source || !Number.isFinite(quantity) || quantity <= 0) return 0;

    if (line.unitChoice.startsWith("conversion:")) {
      const conversion = conversionById.get(line.unitChoice.replace("conversion:", ""));
      return conversion ? quantity * conversion.quantityInBaseUnit : 0;
    }

    const unit = unitById.get(line.unitChoice.replace("unit:", ""));
    const baseUnit = unitById.get(source.baseUnitId);
    if (!unit || !baseUnit || unit.family !== baseUnit.family) return 0;
    return (quantity * unit.factorToBase) / baseUnit.factorToBase;
  }

  function updateLine(id: string, patch: Partial<WasteLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.sourceId && patch.sourceId !== line.sourceId) {
          const source = context === "warehouse" ? itemById.get(patch.sourceId) : issuedById.get(patch.sourceId);
          next.unitChoice = source ? `unit:${source.baseUnitId}` : "";
        }
        return next;
      }),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      await recordInventoryWaste({
        context,
        destination: context === "issued_department" ? defaultDestination : undefined,
        note,
        items: lines.map((line) => {
          const issuedItem = context === "issued_department" ? issuedById.get(line.sourceId) : undefined;
          const inventoryItemId = context === "warehouse" ? line.sourceId : issuedItem?.inventoryItemId;
          if (!inventoryItemId) throw new Error("اختر مادة صالحة.");

          return {
            inventoryItemId,
            quantity: Number(line.quantity),
            unitId: line.unitChoice.startsWith("unit:") ? line.unitChoice.replace("unit:", "") : undefined,
            conversionId: line.unitChoice.startsWith("conversion:") ? line.unitChoice.replace("conversion:", "") : undefined,
            reason: line.reason,
            notes: line.notes,
            requisitionId: issuedItem?.requisitionId,
            requisitionItemId: issuedItem?.requisitionItemId,
          };
        }),
      });
      onPosted();
      onClose();
    } catch (saveError) {
      console.error("Failed to post inventory waste", saveError);
      setError("تعذر تسجيل الهدر. تحقق من الكمية المتاحة.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  const issuedSources = (catalog?.issuedItems ?? []).filter((item) => item.destination === defaultDestination);
  const sources = context === "warehouse" ? (catalog?.items ?? []) : issuedSources;
  const title = context === "warehouse" ? "تسجيل هدر داخل المخزن" : "تسجيل هدر قسم";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-[#e4d8c8] bg-white p-4 text-[#2f211c] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">{context === "warehouse" ? "سيتم خصم الكمية من رصيد المخزن." : "يسجل للرقابة فقط ولا يخصم من المخزن مرة ثانية."}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" aria-label="إغلاق">
            <X size={17} />
          </button>
        </div>

        {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {isLoading ? <p className="mt-4 text-sm text-[#7c6b60]">جارٍ تحميل المواد...</p> : null}
        {!isLoading && sources.length === 0 ? <p className="mt-4 rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-4 text-sm text-[#7c6b60]">لا توجد مواد متاحة لهذا النوع من الهدر.</p> : null}

        <div className="mt-4 space-y-3">
          {lines.map((line, index) => {
            const source = sourceForLine(line);
            const baseUnits = compatibleUnits(source?.baseUnitId, catalog?.units ?? []);
            const sourceConversions = (catalog?.conversions ?? []).filter((conversion) => conversion.inventoryItemId === (context === "warehouse" ? line.sourceId : (source as InventoryWasteIssuedItem | undefined)?.inventoryItemId));
            const quantityBase = baseQuantity(line);
            const remaining = context === "warehouse" ? (source as InventoryRequisitionCatalogItem | undefined)?.stockOnHand : (source as InventoryWasteIssuedItem | undefined)?.remainingWasteBase;

            return (
              <section key={line.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#2f211c]">مادة {formatNumber(index + 1)}</p>
                  {lines.length > 1 ? (
                    <button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50" title="حذف">
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_120px_180px_180px]">
                  <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                    <span>المادة</span>
                    <select required value={line.sourceId} onChange={(event) => updateLine(line.id, { sourceId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                      {context === "warehouse"
                        ? (catalog?.items ?? []).map((sourceItem) => <option key={sourceItem.id} value={sourceItem.id}>{sourceItem.nameAr}</option>)
                        : issuedSources.map((sourceItem) => <option key={sourceItem.requisitionItemId} value={sourceItem.requisitionItemId}>{sourceItem.inventoryItemName} · {sourceItem.requisitionCode}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                    <span>الكمية</span>
                    <input required min="0.001" step="0.001" type="number" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                    <span>الوحدة</span>
                    <select required value={line.unitChoice} onChange={(event) => updateLine(line.id, { unitChoice: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                      {baseUnits.map((unit) => <option key={unit.id} value={`unit:${unit.id}`}>{unit.nameAr}</option>)}
                      {sourceConversions.map((conversion) => <option key={conversion.id} value={`conversion:${conversion.id}`}>{conversion.packagingUnitNameAr}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                    <span>السبب</span>
                    <select value={line.reason} onChange={(event) => updateLine(line.id, { reason: event.target.value as InventoryWasteReason })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                      {reasonOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <input value={line.notes} onChange={(event) => updateLine(line.id, { notes: event.target.value })} placeholder="ملاحظة اختيارية" className="h-10 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm outline-none focus:border-[#a65f3f]" />
                  <p className="rounded-md border border-[#e4d8c8] bg-white px-3 py-2 text-xs leading-5 text-[#7c6b60]">
                    المتاح: {formatNumber(remaining ?? 0)} {source?.baseUnitName ?? ""}
                    <span className="block">سيتم تسجيل: {formatNumber(quantityBase)} {source?.baseUnitName ?? ""}</span>
                  </p>
                </div>
              </section>
            );
          })}
        </div>

        <button type="button" onClick={() => setLines((current) => [...current, newLine(catalog, context, defaultDestination)])} className="mt-3 flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
          <Plus size={16} />
          إضافة مادة
        </button>

        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة عامة اختيارية" className="mt-3 min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#a65f3f]" />

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee4d8] pt-3">
          <button disabled={isSaving || isLoading || sources.length === 0} type="submit" className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={16} />
            تسجيل الهدر
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
