"use client";

import { CheckCircle2, PackageCheck, Plus, Save, UserPlus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { createInventoryPurchase, createPurchaseRequest, createSupplier, getPurchaseRequests, getSuppliers } from "@/services/purchaseService";
import type { CreatePurchaseItemInput, CreatePurchaseRequestItemInput, CreateSupplierInput, PurchaseRequest, Supplier } from "@/types/finance";
import { purchaseRequestStatusLabels } from "@/types/finance";
import type { InventoryItem, InventoryUnit } from "@/types/inventory";

const baghdadTimeZone = "Asia/Baghdad";
const emptySupplier: CreateSupplierInput = { name: "", phone: "", address: "", notes: "" };

type RequestForm = {
  notes: string;
  items: CreatePurchaseRequestItemInput[];
};

type ReceiveForm = {
  clientRequestId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  notes: string;
  items: CreatePurchaseItemInput[];
};

function newRequestForm(): RequestForm {
  return { notes: "", items: [{ inventoryItemId: "", quantity: 1, unitId: "", notes: "" }] };
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

type PurchaseRequestsPanelMode = "requests" | "receiving";

export function PurchaseRequestsPanel({
  mode = "requests",
  items,
  units,
  onInventoryChanged,
}: {
  mode?: PurchaseRequestsPanelMode;
  items: InventoryItem[];
  units: InventoryUnit[];
  onInventoryChanged: () => Promise<void>;
}) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requestForm, setRequestForm] = useState<RequestForm>(newRequestForm);
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [receiveRequest, setReceiveRequest] = useState<PurchaseRequest | null>(null);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null);
  const [supplierForm, setSupplierForm] = useState<CreateSupplierInput>(emptySupplier);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeItems = items.filter((item) => item.isActive);
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const displayedRequests = mode === "receiving" ? approvedRequests : requests;
  const receiveTotal = useMemo(() => (receiveForm?.items ?? []).reduce((total, item) => total + item.quantity * item.unitPrice, 0), [receiveForm]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextRequests, nextSuppliers] = await Promise.all([getPurchaseRequests(), getSuppliers()]);
      setRequests(nextRequests);
      setSuppliers(nextSuppliers);
    } catch (loadError) {
      logSupabaseError("[inventory purchase requests load]", loadError);
      setError("تعذر تحميل طلبات الشراء.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  function flash(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function updateRequestLine(index: number, patch: Partial<CreatePurchaseRequestItemInput>) {
    setRequestForm((current) => ({
      ...current,
      items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  }

  function updateReceiveLine(index: number, patch: Partial<CreatePurchaseItemInput>) {
    setReceiveForm((current) => current ? {
      ...current,
      items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    } : current);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validItems = requestForm.items.filter((item) => item.inventoryItemId && item.unitId && item.quantity > 0);
    if (validItems.length === 0 || validItems.length !== requestForm.items.length) {
      setError("أكمل مواد طلب الشراء والكميات والوحدات.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const created = await createPurchaseRequest({ notes: requestForm.notes, items: validItems });
      setRequests((current) => [created, ...current]);
      setRequestForm(newRequestForm());
      setIsRequestFormOpen(false);
      flash("تم إنشاء طلب الشراء بانتظار الموافقة");
    } catch (saveError) {
      logSupabaseError("[inventory purchase request create]", saveError);
      setError("تعذر إنشاء طلب الشراء.");
    } finally {
      setIsSaving(false);
    }
  }

  function openReceive(request: PurchaseRequest) {
    setReceiveRequest(request);
    setReceiveForm({
      clientRequestId: crypto.randomUUID(),
      supplierId: "",
      supplierInvoiceNumber: "",
      supplierInvoiceDate: "",
      notes: "",
      items: request.items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unitId: item.unitId,
        unitPrice: 0,
      })),
    });
  }

  async function submitReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiveRequest || !receiveForm) return;
    if (!receiveForm.supplierId) {
      setError("اختر المورد قبل تسجيل الاستلام.");
      return;
    }

    const validItems = receiveForm.items.filter((item) => item.inventoryItemId && item.unitId && item.quantity > 0 && item.unitPrice >= 0);
    if (validItems.length === 0 || validItems.length !== receiveForm.items.length) {
      setError("أكمل الكميات المستلمة والأسعار الفعلية.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await createInventoryPurchase({
        clientRequestId: receiveForm.clientRequestId,
        purchaseRequestId: receiveRequest.id,
        supplierId: receiveForm.supplierId,
        supplierInvoiceNumber: receiveForm.supplierInvoiceNumber,
        supplierInvoiceDate: receiveForm.supplierInvoiceDate,
        notes: receiveForm.notes,
        items: validItems,
      });
      setReceiveRequest(null);
      setReceiveForm(null);
      await Promise.all([loadRequests(), onInventoryChanged()]);
      flash("تم تسجيل الاستلام وتحديث المخزون");
    } catch (receiveError) {
      logSupabaseError("[inventory purchase receive]", receiveError);
      setError("تعذر تسجيل الاستلام.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplierForm.name.trim()) {
      setError("اسم المورد مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const supplier = await createSupplier(supplierForm);
      setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setReceiveForm((current) => current ? { ...current, supplierId: supplier.id } : current);
      setSupplierForm(emptySupplier);
      setIsSupplierOpen(false);
    } catch (supplierError) {
      logSupabaseError("[inventory supplier create]", supplierError);
      setError("تعذر حفظ المورد.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">إدارة المخزن</p>
          <h2 className="text-xl font-semibold text-[#2f211c]">{mode === "receiving" ? "المشتريات / الاستلام" : "طلبات الشراء"}</h2>
        </div>
        {mode === "requests" ? (
          <button type="button" onClick={() => setIsRequestFormOpen((current) => !current)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]">
            <Plus size={17} />
            طلب شراء جديد
          </button>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm"><p className="text-sm text-[#7c6b60]">بانتظار الموافقة</p><p className="mt-2 text-2xl font-semibold text-[#2f211c]">{formatNumber(pendingRequests.length)}</p></div>
        <div className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm"><p className="text-sm text-[#7c6b60]">طلبات معتمدة</p><p className="mt-2 text-2xl font-semibold text-[#2f211c]">{formatNumber(approvedRequests.length)}</p></div>
      </section>

      {mode === "requests" && isRequestFormOpen ? (
        <form onSubmit={submitRequest} className="space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><Plus size={18} className="text-[#a65f3f]" /><h2 className="font-semibold text-[#2f211c]">طلب شراء جديد</h2></div>
          <div className="overflow-x-auto rounded-md border border-[#eee4d8]">
            <table className="w-full min-w-[840px] text-right text-sm">
              <thead className="bg-[#fbfaf7] text-[#7c6b60]"><tr><th className="px-3 py-3">المادة</th><th className="px-3 py-3">الكمية المطلوبة</th><th className="px-3 py-3">الوحدة</th><th className="px-3 py-3">ملاحظات</th><th className="px-3 py-3"></th></tr></thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {requestForm.items.map((line, index) => (
                  <tr key={index}>
                    <td className="px-3 py-3"><select value={line.inventoryItemId} onChange={(event) => { const selected = activeItems.find((item) => item.id === event.target.value); updateRequestLine(index, { inventoryItemId: event.target.value, unitId: selected?.baseUnitId ?? line.unitId }); }} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 outline-none"><option value="">اختر المادة</option>{activeItems.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}</select></td>
                    <td className="px-3 py-3"><input type="number" min="0.001" step="0.001" value={line.quantity || ""} onChange={(event) => updateRequestLine(index, { quantity: event.target.value ? Number(event.target.value) : 0 })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 outline-none" /></td>
                    <td className="px-3 py-3"><select value={line.unitId} onChange={(event) => updateRequestLine(index, { unitId: event.target.value })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 outline-none"><option value="">الوحدة</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</select></td>
                    <td className="px-3 py-3"><input value={line.notes ?? ""} onChange={(event) => updateRequestLine(index, { notes: event.target.value })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 outline-none" /></td>
                    <td className="px-3 py-3"><button type="button" disabled={requestForm.items.length === 1} onClick={() => setRequestForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="h-9 rounded-md border border-[#e4d8c8] px-3 text-sm disabled:opacity-40">حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <textarea value={requestForm.notes} onChange={(event) => setRequestForm((current) => ({ ...current, notes: event.target.value }))} placeholder="ملاحظات عامة للطلب" className="min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] p-3 text-sm outline-none" />
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => setRequestForm((current) => ({ ...current, items: [...current.items, { inventoryItemId: "", quantity: 1, unitId: "", notes: "" }] }))} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">إضافة مادة</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsRequestFormOpen(false)} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">إلغاء</button>
              <button disabled={isSaving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />حفظ الطلب</button>
            </div>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">{mode === "receiving" ? "طلبات شراء معتمدة للاستلام" : "طلبات الشراء"}</h2>{isLoading ? <span className="text-sm text-[#7c6b60]">جارٍ التحميل...</span> : null}</div>
        {displayedRequests.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">{mode === "receiving" ? "لا توجد طلبات معتمدة للاستلام حالياً" : "لا توجد طلبات شراء حتى الآن"}</p> : null}
        <div className="divide-y divide-[#eee4d8]">
          {displayedRequests.map((request) => (
            <article key={request.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#2f211c]">طلب شراء #{request.requestNumber}</p>
                  <p className="text-sm text-[#7c6b60]">{purchaseRequestStatusLabels[request.status]} · {formatDateTime(request.createdAt)}</p>
                </div>
                {request.status === "approved" ? <button type="button" onClick={() => openReceive(request)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white"><PackageCheck size={17} />تسجيل الاستلام</button> : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {request.items.map((item) => <div key={item.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm"><p className="font-medium text-[#2f211c]">{item.inventoryItemName}</p><p className="text-[#7c6b60]">{formatNumber(item.quantity)} {item.unitCode}</p></div>)}
              </div>
              {request.decisionNotes ? <p className="mt-3 text-sm text-[#7c6b60]">ملاحظة القرار: {request.decisionNotes}</p> : null}
            </article>
          ))}
        </div>
      </section>

      {receiveRequest && receiveForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form onSubmit={submitReceive} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3"><div><p className="text-sm text-[#7c6b60]">استلام طلب شراء #{receiveRequest.requestNumber}</p><h2 className="text-xl font-semibold text-[#2f211c]">تسجيل الاستلام الفعلي</h2></div><button type="button" onClick={() => { setReceiveRequest(null); setReceiveForm(null); }} className="rounded-md p-2 text-[#7c6b60] hover:bg-[#f5eee6]" aria-label="إغلاق"><X size={18} /></button></div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34] lg:col-span-2">المورد<div className="flex gap-2"><select value={receiveForm.supplierId} onChange={(event) => setReceiveForm((current) => current ? { ...current, supplierId: event.target.value } : current)} className="h-11 min-w-0 flex-1 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none"><option value="">اختر المورد</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><button type="button" onClick={() => setIsSupplierOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><UserPlus size={16} />مورد</button></div></label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">رقم فاتورة المورد<input value={receiveForm.supplierInvoiceNumber} onChange={(event) => setReceiveForm((current) => current ? { ...current, supplierInvoiceNumber: event.target.value } : current)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
              <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">تاريخ فاتورة المورد<input type="date" value={receiveForm.supplierInvoiceDate} onChange={(event) => setReceiveForm((current) => current ? { ...current, supplierInvoiceDate: event.target.value } : current)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
            </div>
            <div className="mt-4 overflow-x-auto rounded-md border border-[#eee4d8]"><table className="w-full min-w-[920px] text-right text-sm"><thead className="bg-[#fbfaf7] text-[#7c6b60]"><tr><th className="px-3 py-3">المادة</th><th className="px-3 py-3">المطلوب</th><th className="px-3 py-3">المستلم فعلياً</th><th className="px-3 py-3">الوحدة</th><th className="px-3 py-3">سعر الوحدة</th><th className="px-3 py-3">الإجمالي</th></tr></thead><tbody className="divide-y divide-[#eee4d8]">{receiveForm.items.map((line, index) => { const requested = receiveRequest.items[index]; return <tr key={index}><td className="px-3 py-3 font-medium text-[#2f211c]">{requested?.inventoryItemName ?? "-"}</td><td className="px-3 py-3 text-[#7c6b60]">{requested ? `${formatNumber(requested.quantity)} ${requested.unitCode}` : "-"}</td><td className="px-3 py-3"><input type="number" min="0.001" step="0.001" value={line.quantity || ""} onChange={(event) => updateReceiveLine(index, { quantity: event.target.value ? Number(event.target.value) : 0 })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></td><td className="px-3 py-3"><select value={line.unitId} onChange={(event) => updateReceiveLine(index, { unitId: event.target.value })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}</select></td><td className="px-3 py-3"><input type="number" min="0" value={line.unitPrice || ""} onChange={(event) => updateReceiveLine(index, { unitPrice: event.target.value ? Number(event.target.value) : 0 })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></td><td className="px-3 py-3 font-semibold text-[#2f211c]">{formatCurrency(line.quantity * line.unitPrice)}</td></tr>; })}</tbody></table></div>
            <textarea value={receiveForm.notes} onChange={(event) => setReceiveForm((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="ملاحظات الاستلام" className="mt-3 min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm outline-none" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee4d8] pt-4"><p className="text-lg font-semibold text-[#2f211c]">إجمالي الفاتورة: {formatCurrency(receiveTotal)}</p><button disabled={isSaving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16} />تأكيد الاستلام</button></div>
          </form>
        </div>
      ) : null}

      {isSupplierOpen ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"><form onSubmit={submitSupplier} className="w-full max-w-lg rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold text-[#2f211c]">إضافة مورد جديد</h2><div className="mt-4 grid gap-3"><input value={supplierForm.name ?? ""} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder="اسم المورد" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /><input value={supplierForm.phone ?? ""} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} placeholder="الهاتف" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /><input value={supplierForm.address ?? ""} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} placeholder="العنوان" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /><textarea value={supplierForm.notes ?? ""} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} placeholder="ملاحظات" className="min-h-24 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 outline-none" /></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setIsSupplierOpen(false)} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button><button disabled={isSaving} type="submit" className="h-10 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50">حفظ المورد</button></div></form></div> : null}
    </div>
  );
}
