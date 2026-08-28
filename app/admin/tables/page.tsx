"use client";

import { Edit2, Loader2, Move, Plus, RotateCcw, Save, X } from "lucide-react";
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { createRestaurantTable, getAdminTables, saveTableLayout, updateRestaurantTable } from "@/services/adminTableService";
import type { AdminRestaurantTable, TableDetailsInput, TableLayoutInput } from "@/types/adminTables";

type DraftPosition = { x: number; y: number; rotation: number };

const emptyForm: TableDetailsInput = { tableNumber: 1, name: "", capacity: 4, area: "", isActive: true };
const baghdadTimeZone = "Asia/Baghdad";

const statusLabels = {
  available: "متاحة",
  occupied: "مشغولة",
  cleaning: "تنظيف",
};

const statusStyles = {
  available: "border-emerald-300 bg-emerald-50 text-emerald-800",
  occupied: "border-rose-300 bg-rose-50 text-rose-800",
  cleaning: "border-amber-300 bg-amber-50 text-amber-800",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function fallbackPosition(index: number): DraftPosition {
  const positions: DraftPosition[] = [
    { x: 28, y: 17, rotation: 0 }, { x: 44, y: 17, rotation: 0 }, { x: 64, y: 17, rotation: 0 }, { x: 79, y: 18, rotation: 0 },
    { x: 31, y: 34, rotation: 0 }, { x: 48, y: 34, rotation: 0 }, { x: 65, y: 34, rotation: 0 }, { x: 80, y: 39, rotation: 0 },
    { x: 31, y: 52, rotation: 0 }, { x: 48, y: 52, rotation: 0 }, { x: 64, y: 52, rotation: 0 }, { x: 78, y: 58, rotation: 0 },
    { x: 22, y: 69, rotation: -25 }, { x: 33, y: 72, rotation: -15 }, { x: 47, y: 74, rotation: 0 }, { x: 59, y: 74, rotation: 0 },
    { x: 72, y: 73, rotation: 0 }, { x: 88, y: 61, rotation: 0 }, { x: 12, y: 42, rotation: 0 }, { x: 12, y: 69, rotation: 0 },
  ];
  return positions[index % positions.length];
}

function tablePosition(table: AdminRestaurantTable, index: number): DraftPosition {
  const fallback = fallbackPosition(index);
  return {
    x: table.layoutX ?? fallback.x,
    y: table.layoutY ?? fallback.y,
    rotation: table.layoutRotation ?? fallback.rotation,
  };
}

export default function AdminTablesPage() {
  const [tables, setTables] = useState<AdminRestaurantTable[]>([]);
  const [draftPositions, setDraftPositions] = useState<Record<string, DraftPosition>>({});
  const [selectedTable, setSelectedTable] = useState<AdminRestaurantTable | null>(null);
  const [editingTable, setEditingTable] = useState<AdminRestaurantTable | null>(null);
  const [form, setForm] = useState<TableDetailsInput>(emptyForm);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const planRef = useRef<HTMLDivElement | null>(null);

  async function loadTables() {
    setIsLoading(true);
    setError("");
    try {
      const nextTables = await getAdminTables();
      setTables(nextTables);
      setDraftPositions(Object.fromEntries(nextTables.map((table, index) => [table.id, tablePosition(table, index)])));
    } catch (loadError) {
      logSupabaseError("[admin tables load]", loadError);
      setError("تعذر تحميل بيانات الطاولات.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTables();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(() => ({
    total: tables.length,
    available: tables.filter((table) => table.isActive && table.status === "available").length,
    occupied: tables.filter((table) => table.isActive && table.status === "occupied").length,
    disabled: tables.filter((table) => !table.isActive).length,
  }), [tables]);

  const areas = Array.from(new Set(tables.map((table) => table.area).filter(Boolean) as string[]));

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function openNewTable() {
    const nextNumber = Math.max(0, ...tables.map((table) => table.tableNumber)) + 1;
    setEditingTable(null);
    setForm({ ...emptyForm, tableNumber: nextNumber });
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditTable(table: AdminRestaurantTable) {
    setSelectedTable(null);
    setEditingTable(table);
    setForm({
      tableNumber: table.tableNumber,
      name: table.name ?? "",
      capacity: table.capacity,
      area: table.area ?? "",
      isActive: table.isActive,
    });
    setFormError("");
    setIsFormOpen(true);
  }

  async function submitTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(Number(form.tableNumber)) || Number(form.tableNumber) <= 0) {
      setFormError("رقم الطاولة يجب أن يكون رقماً صحيحاً أكبر من صفر.");
      return;
    }
    if (form.capacity !== null && form.capacity !== undefined && Number(form.capacity) <= 0) {
      setFormError("عدد المقاعد يجب أن يكون أكبر من صفر.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const saved = editingTable ? await updateRestaurantTable(editingTable, form) : await createRestaurantTable(form);
      setTables((current) => editingTable ? current.map((table) => table.id === saved.id ? saved : table) : [...current, saved]);
      setDraftPositions((current) => ({ ...current, [saved.id]: tablePosition(saved, tables.length) }));
      setSelectedTable(saved);
      setIsFormOpen(false);
      flash(editingTable ? "تم تعديل بيانات الطاولة" : "تمت إضافة الطاولة");
    } catch (saveError) {
      logSupabaseError("[admin table save]", saveError);
      setFormError(saveError instanceof Error ? saveError.message : "تعذر حفظ الطاولة.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginLayoutEdit() {
    setDraftPositions(Object.fromEntries(tables.map((table, index) => [table.id, tablePosition(table, index)])));
    setIsLayoutEditing(true);
    setSelectedTable(null);
  }

  function cancelLayoutEdit() {
    setDraftPositions(Object.fromEntries(tables.map((table, index) => [table.id, tablePosition(table, index)])));
    setDraggingId(null);
    setIsLayoutEditing(false);
  }

  async function saveLayout() {
    const changes: TableLayoutInput[] = tables
      .map((table, index) => {
        const draft = draftPositions[table.id] ?? tablePosition(table, index);
        return { id: table.id, layoutX: draft.x, layoutY: draft.y, layoutRotation: draft.rotation };
      })
      .filter((change) => {
        const previous = tables.find((table) => table.id === change.id);
        return Boolean(previous && (
          Math.abs((previous.layoutX ?? -1) - change.layoutX) > 0.01 ||
          Math.abs((previous.layoutY ?? -1) - change.layoutY) > 0.01 ||
          Math.abs((previous.layoutRotation ?? 0) - change.layoutRotation) > 0.01
        ));
      });

    if (changes.length === 0) {
      setIsLayoutEditing(false);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const updatedTables = await saveTableLayout(changes, tables);
      setTables((current) => current.map((table) => updatedTables.find((updated) => updated.id === table.id) ?? table));
      setIsLayoutEditing(false);
      flash("تم حفظ توزيع الطاولات");
    } catch (saveError) {
      logSupabaseError("[admin table layout save]", saveError);
      setError("تعذر حفظ توزيع الطاولات.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDrag(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    const rect = planRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(6, ((event.clientY - rect.top) / rect.height) * 100));
    setDraftPositions((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { x, y, rotation: 0 }), x, y },
    }));
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, table: AdminRestaurantTable) {
    if (!isLayoutEditing) {
      setSelectedTable(table);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(table.id);
    updateDrag(event as unknown as ReactPointerEvent<HTMLDivElement>, table.id);
  }

  function rotateTable(tableId: string) {
    setDraftPositions((current) => {
      const position = current[tableId] ?? { x: 50, y: 50, rotation: 0 };
      return { ...current, [tableId]: { ...position, rotation: (position.rotation + 90) % 360 } };
    });
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">لوحة الإدارة</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">إدارة الطاولات</h1>
          <p className="mt-2 text-sm text-[#7c6b60]">إدارة توزيع طاولات المطعم وأعداد المقاعد وحالة كل طاولة.</p>
        </div>
        <button type="button" onClick={openNewTable} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]"><Plus size={18} />إضافة طاولة</button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي الطاولات" value={stats.total} />
        <StatCard title="المتاحة" value={stats.available} />
        <StatCard title="المشغولة" value={stats.occupied} />
        <StatCard title="المعطلة" value={stats.disabled} />
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee4d8] p-4">
          <div>
            <h2 className="font-semibold text-[#2f211c]">مخطط الطاولات</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">{isLayoutEditing ? "اسحب الطاولات داخل المخطط ثم احفظ التوزيع." : "اضغط على أي طاولة لعرض بياناتها."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isLayoutEditing ? (
              <>
                <button type="button" onClick={cancelLayoutEdit} disabled={isSaving} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm text-[#4a3b34]">إلغاء</button>
                <button type="button" onClick={() => void saveLayout()} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />حفظ التوزيع</button>
              </>
            ) : (
              <button type="button" onClick={beginLayoutEdit} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] px-4 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]"><Move size={16} />تعديل توزيع الطاولات</button>
            )}
          </div>
        </div>

        {isLoading ? <div className="p-5 text-sm text-[#7c6b60]"><Loader2 className="ml-2 inline animate-spin" size={16} />جارٍ تحميل الطاولات...</div> : null}
        {!isLoading && tables.length === 0 ? <p className="p-5 text-sm text-[#7c6b60]">لا توجد طاولات مسجلة حتى الآن.</p> : null}
        {tables.length > 0 ? (
          <div className="overflow-x-auto bg-[#f5eee6] p-3 sm:p-4">
            <div
              ref={planRef}
              className="relative h-[560px] min-w-[780px] overflow-hidden rounded-md border border-[#d8c8b8] bg-[#fffdfa]"
              onPointerMove={(event) => draggingId ? updateDrag(event, draggingId) : undefined}
              onPointerUp={() => setDraggingId(null)}
              onPointerCancel={() => setDraggingId(null)}
            >
              <div className="pointer-events-none absolute inset-[5%] rounded-[24px] border-2 border-[#c9b8a6]" />
              <div className="pointer-events-none absolute bottom-[8%] right-[18%] h-[18%] w-[38%] border-t-2 border-r-2 border-[#c9b8a6]" />
              <div className="pointer-events-none absolute right-[86%] top-[18%] h-[18%] w-[10%] rounded-r-full border-2 border-l-0 border-[#d8c8b8]" />
              <div className="pointer-events-none absolute left-[4%] top-[30%] h-[28%] w-[10%] rounded-l-full border-2 border-r-0 border-[#d8c8b8]" />
              <div className="pointer-events-none absolute right-[4%] top-[38%] h-[20%] w-[12%] rounded-r-full border-2 border-l-0 border-[#d8c8b8]" />

              {tables.map((table, index) => {
                const position = draftPositions[table.id] ?? tablePosition(table, index);
                return (
                  <button
                    key={table.id}
                    type="button"
                    onPointerDown={(event) => startDrag(event, table)}
                    className={`absolute flex h-20 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-md border-2 text-center shadow-sm transition ${table.isActive ? statusStyles[table.status] : "border-stone-300 bg-stone-100 text-stone-500"} ${isLayoutEditing ? "cursor-grab active:cursor-grabbing" : "hover:scale-[1.03]"}`}
                    style={{ left: `${position.x}%`, top: `${position.y}%`, transform: `translate(-50%, -50%) rotate(${position.rotation}deg)` }}
                  >
                    <span className="text-base font-bold">T{String(table.tableNumber).padStart(2, "0")}</span>
                    <span className="mt-1 text-xs">{table.capacity ?? "-"} مقاعد</span>
                    <span className="mt-1 text-[11px]">{table.isActive ? statusLabels[table.status] : "معطلة"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => (
          <article key={table.id} className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#2f211c]">T{String(table.tableNumber).padStart(2, "0")} {table.name ? `- ${table.name}` : ""}</h3>
                <p className="mt-1 text-sm text-[#7c6b60]">{table.area ?? "منطقة غير محددة"} · {table.capacity ?? "-"} مقاعد</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${table.isActive ? statusStyles[table.status] : "border-stone-300 bg-stone-100 text-stone-600"}`}>{table.isActive ? statusLabels[table.status] : "معطلة"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedTable(table)} className="h-9 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">عرض التفاصيل</button>
              <button type="button" onClick={() => openEditTable(table)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Edit2 size={15} />تعديل</button>
              {isLayoutEditing ? <button type="button" onClick={() => rotateTable(table.id)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><RotateCcw size={15} />تدوير</button> : null}
            </div>
          </article>
        ))}
      </section>

      {selectedTable ? <TableDetailsDialog table={selectedTable} onEdit={() => openEditTable(selectedTable)} onClose={() => setSelectedTable(null)} /> : null}
      {isFormOpen ? <TableFormDialog form={form} areas={areas} editingTable={editingTable} formError={formError} isSaving={isSaving} onChange={setForm} onClose={() => setIsFormOpen(false)} onSubmit={submitTable} /> : null}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-[#2f211c]">{new Intl.NumberFormat("en-US").format(value)}</p>
    </section>
  );
}

function TableDetailsDialog({ table, onEdit, onClose }: { table: AdminRestaurantTable; onEdit: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="w-full max-w-xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3">
          <div>
            <p className="text-sm text-[#7c6b60]">تفاصيل الطاولة</p>
            <h2 className="text-xl font-semibold text-[#2f211c]">T{String(table.tableNumber).padStart(2, "0")}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]" aria-label="إغلاق"><X size={16} /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail label="الاسم" value={table.name ?? "-"} />
          <Detail label="المنطقة" value={table.area ?? "-"} />
          <Detail label="عدد المقاعد" value={String(table.capacity ?? "-")} />
          <Detail label="الحالة الحالية" value={table.isActive ? statusLabels[table.status] : "معطلة"} />
          <Detail label="فعال/معطل" value={table.isActive ? "فعال" : "معطل"} />
        </div>
        {table.currentOrder ? (
          <div className="mt-5 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-4">
            <h3 className="font-semibold text-[#2f211c]">الطلب الحالي</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Detail label="رقم الطلب" value={`#${table.currentOrder.orderNumber}`} />
              <Detail label="وقت فتح الطلب" value={formatDateTime(table.currentOrder.openedAt)} />
              <Detail label="الكابتن" value={table.currentOrder.captainName} />
              <Detail label="قيمة الطلب الحالية" value={formatCurrency(table.currentOrder.total)} />
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إغلاق</button>
          <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white"><Edit2 size={16} />تعديل البيانات</button>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eee4d8] bg-white p-3">
      <p className="text-xs text-[#7c6b60]">{label}</p>
      <p className="mt-1 font-semibold text-[#2f211c]">{value}</p>
    </div>
  );
}

function TableFormDialog({
  form,
  areas,
  editingTable,
  formError,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: TableDetailsInput;
  areas: string[];
  editingTable: AdminRestaurantTable | null;
  formError: string;
  isSaving: boolean;
  onChange: (form: TableDetailsInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const disableToggleLocked = editingTable?.status === "occupied" && form.isActive;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3">
          <h2 className="text-xl font-semibold text-[#2f211c]">{editingTable ? "تعديل بيانات طاولة" : "إضافة طاولة"}</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]" aria-label="إغلاق"><X size={16} /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">رقم الطاولة<input required min="1" step="1" type="number" value={form.tableNumber || ""} onChange={(event) => onChange({ ...form, tableNumber: Number(event.target.value) || 0 })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">اسم الطاولة<input value={form.name ?? ""} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="اختياري" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">عدد المقاعد<input min="1" step="1" type="number" value={form.capacity ?? ""} onChange={(event) => onChange({ ...form, capacity: event.target.value ? Number(event.target.value) : null })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">المنطقة<input list="table-areas" value={form.area ?? ""} onChange={(event) => onChange({ ...form, area: event.target.value })} placeholder="مثال: القاعة الرئيسية" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <datalist id="table-areas">{areas.map((area) => <option key={area} value={area} />)}</datalist>
          <label className="flex items-center gap-2 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm font-medium text-[#4a3b34] sm:col-span-2">
            <input type="checkbox" checked={form.isActive} disabled={disableToggleLocked} onChange={(event) => onChange({ ...form, isActive: event.target.checked })} />
            الطاولة فعالة
          </label>
          {disableToggleLocked ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 sm:col-span-2">لا يمكن تعطيل طاولة عليها طلب مفتوح حتى لا تختفي من شاشة الكاشير.</p> : null}
        </div>
        {formError ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button>
          <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{isSaving ? "جارٍ الحفظ..." : "حفظ"}</button>
        </div>
      </form>
    </div>
  );
}
