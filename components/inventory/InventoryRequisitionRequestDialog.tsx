"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PackagePlus, Plus, Save, Trash2, X } from "lucide-react";
import {
  createInventoryRequisition,
  getInventoryRequisitionCatalog,
  type CreateInventoryRequisitionInput,
} from "@/services/inventoryRequisitionService";
import type { InventoryRequisitionCatalog, InventoryRequisitionCatalogItem, InventoryRequisitionDestination, InventoryUnit } from "@/types/inventory";

type RequestLine = {
  id: string;
  inventoryItemId: string;
  quantity: string;
  unitChoice: string;
  notes: string;
};

type InventoryRequisitionRequestDialogProps = {
  isOpen: boolean;
  defaultDestination: InventoryRequisitionDestination;
  destinationLocked?: boolean;
  onClose: () => void;
  onCreated: () => void;
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

const destinationOptions = Object.entries(destinationLabels) as [InventoryRequisitionDestination, string][];
const standardBaseUnitCodes: InventoryUnit["code"][] = ["g", "kg", "ml", "l", "piece"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function compatibleUnits(item: InventoryRequisitionCatalogItem | undefined, units: InventoryUnit[]) {
  if (!item) return [];
  const baseUnit = units.find((unit) => unit.id === item.baseUnitId);
  return baseUnit ? units.filter((unit) => unit.family === baseUnit.family && standardBaseUnitCodes.includes(unit.code)) : units.filter((unit) => unit.id === item.baseUnitId);
}

function newLine(catalog: InventoryRequisitionCatalog | null): RequestLine {
  const firstItem = catalog?.items[0];
  return {
    id: crypto.randomUUID(),
    inventoryItemId: firstItem?.id ?? "",
    quantity: "",
    unitChoice: firstItem ? `unit:${firstItem.baseUnitId}` : "",
    notes: "",
  };
}

export function InventoryRequisitionRequestDialog({ isOpen, defaultDestination, destinationLocked = false, onClose, onCreated }: InventoryRequisitionRequestDialogProps) {
  const [catalog, setCatalog] = useState<InventoryRequisitionCatalog | null>(null);
  const [destination, setDestination] = useState<InventoryRequisitionDestination>(defaultDestination);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadTimer = window.setTimeout(() => {
      setIsLoading(true);
      setError("");

      getInventoryRequisitionCatalog()
        .then((nextCatalog) => {
          if (!isMounted) return;
          setCatalog(nextCatalog);
          setDestination(defaultDestination);
          setNote("");
          setLines([newLine(nextCatalog)]);
        })
        .catch((loadError) => {
          console.error("Failed to load requisition catalog", loadError);
          if (isMounted) setError("تعذر تحميل مواد المخزن.");
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(loadTimer);
    };
  }, [defaultDestination, isOpen]);

  const itemById = useMemo(() => new Map((catalog?.items ?? []).map((item) => [item.id, item])), [catalog]);
  const unitById = useMemo(() => new Map((catalog?.units ?? []).map((unit) => [unit.id, unit])), [catalog]);
  const conversionById = useMemo(() => new Map((catalog?.conversions ?? []).map((conversion) => [conversion.id, conversion])), [catalog]);

  function updateLine(id: string, patch: Partial<RequestLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.inventoryItemId && patch.inventoryItemId !== line.inventoryItemId) {
          const nextItem = itemById.get(patch.inventoryItemId);
          next.unitChoice = nextItem ? `unit:${nextItem.baseUnitId}` : "";
        }
        return next;
      }),
    );
  }

  function baseQuantity(line: RequestLine) {
    const item = itemById.get(line.inventoryItemId);
    const quantity = Number(line.quantity);
    if (!item || !Number.isFinite(quantity) || quantity <= 0) return 0;

    if (line.unitChoice.startsWith("conversion:")) {
      const conversion = conversionById.get(line.unitChoice.replace("conversion:", ""));
      return conversion ? quantity * conversion.quantityInBaseUnit : 0;
    }

    const unit = unitById.get(line.unitChoice.replace("unit:", ""));
    const baseUnit = unitById.get(item.baseUnitId);
    if (!unit || !baseUnit || unit.family !== baseUnit.family) return 0;
    return (quantity * unit.factorToBase) / baseUnit.factorToBase;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payloadLines: CreateInventoryRequisitionInput["items"] = [];

    for (const line of lines) {
        const quantity = Number(line.quantity);
        const item = itemById.get(line.inventoryItemId);
        if (!item || !Number.isFinite(quantity) || quantity <= 0 || !line.unitChoice) continue;
        payloadLines.push({
          inventoryItemId: item.id,
          quantity,
          unitId: line.unitChoice.startsWith("unit:") ? line.unitChoice.replace("unit:", "") : undefined,
          conversionId: line.unitChoice.startsWith("conversion:") ? line.unitChoice.replace("conversion:", "") : undefined,
          notes: line.notes,
        });
    }

    if (payloadLines.length === 0) {
      setError("أضف مادة واحدة على الأقل.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await createInventoryRequisition({ destination, note, items: payloadLines });
      onCreated();
      onClose();
    } catch (saveError) {
      console.error("Failed to create inventory requisition", saveError);
      setError("تعذر إرسال طلب المواد.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#3b3631] bg-[#24211E] p-4 text-[#FFF8EE] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <PackagePlus size={19} className="text-[#D88A3D]" />
            <h2 className="font-semibold">طلب مواد من المخزن</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#C9BEB2] hover:bg-[#302B27]" aria-label="إغلاق">
            <X size={17} />
          </button>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
        {isLoading ? <p className="mt-4 text-sm text-[#C9BEB2]">جارٍ تحميل مواد المخزن...</p> : null}

        {!isLoading ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <label className="space-y-1 text-sm font-medium">
                <span>القسم المستلم</span>
                <select disabled={destinationLocked} value={destination} onChange={(event) => setDestination(event.target.value as InventoryRequisitionDestination)} className="h-11 w-full rounded-lg border border-white/10 bg-[#171513] px-3 text-sm outline-none disabled:opacity-70">
                  {destinationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>ملاحظة اختيارية</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="مثال: احتياج تحضير وردية المساء" className="h-11 w-full rounded-lg border border-white/10 bg-[#171513] px-3 text-sm outline-none placeholder:text-[#756d65]" />
              </label>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => {
                const item = itemById.get(line.inventoryItemId);
                const unitOptions = compatibleUnits(item, catalog?.units ?? []);
                const conversionOptions = (catalog?.conversions ?? []).filter((conversion) => conversion.inventoryItemId === line.inventoryItemId);
                const normalized = baseQuantity(line);

                return (
                  <section key={line.id} className="rounded-lg border border-white/10 bg-[#171513] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">مادة #{index + 1}</span>
                      {lines.length > 1 ? <button type="button" onClick={() => setLines((current) => current.filter((itemLine) => itemLine.id !== line.id))} className="rounded-lg p-2 text-rose-200 hover:bg-rose-500/10" aria-label="حذف المادة"><Trash2 size={16} /></button> : null}
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_180px]">
                      <select value={line.inventoryItemId} onChange={(event) => updateLine(line.id, { inventoryItemId: event.target.value })} className="h-11 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm outline-none">
                        {(catalog?.items ?? []).map((catalogItem) => <option key={catalogItem.id} value={catalogItem.id}>{catalogItem.nameAr}</option>)}
                      </select>
                      <input min="0.001" step="0.001" type="number" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} placeholder="الكمية" className="h-11 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm outline-none" />
                      <select value={line.unitChoice} onChange={(event) => updateLine(line.id, { unitChoice: event.target.value })} className="h-11 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm outline-none">
                        {unitOptions.map((unit) => <option key={unit.id} value={`unit:${unit.id}`}>{unit.nameAr}</option>)}
                        {conversionOptions.map((conversion) => <option key={conversion.id} value={`conversion:${conversion.id}`}>{conversion.packagingUnitNameAr}</option>)}
                      </select>
                    </div>
                    <input value={line.notes} onChange={(event) => updateLine(line.id, { notes: event.target.value })} placeholder="ملاحظة للمادة اختياري" className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm outline-none placeholder:text-[#756d65]" />
                    <p className="mt-2 text-xs text-[#C9BEB2]">
                      {normalized > 0 && item ? `يعادل ${formatNumber(normalized)} ${item.baseUnitName}. المتاح حالياً ${formatNumber(item.stockOnHand)} ${item.baseUnitName}` : "اختر المادة والكمية والوحدة."}
                    </p>
                  </section>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3">
              <button type="button" onClick={() => setLines((current) => [...current, newLine(catalog)])} className="flex h-11 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold hover:bg-[#302B27]">
                <Plus size={16} />
                إضافة مادة
              </button>
              <button disabled={isSaving} type="submit" className="flex h-11 items-center gap-2 rounded-lg bg-[#D88A3D] px-4 text-sm font-semibold text-[#171513] disabled:opacity-60">
                <Save size={16} />
                إرسال الطلب
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
