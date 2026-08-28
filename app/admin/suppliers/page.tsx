"use client";

import { Edit3, Eye, Loader2, Plus, ReceiptText, Save, Search, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PurchasePaymentVoucherDialog, purchasePaymentVoucherNumber } from "@/components/finance/PurchasePaymentVoucherDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { createAdminSupplier, getAdminSuppliers, updateAdminSupplier } from "@/services/adminSupplierService";
import type { AdminSupplierProfile, SupplierInput, SupplierStatusFilter } from "@/types/adminSuppliers";
import type { PurchasePayment } from "@/types/finance";
import { expensePaymentMethodLabels, purchasePaymentStatusLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";
const emptySupplier: SupplierInput = { name: "", phone: "", address: "", notes: "", isActive: true };

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {active ? "فعال" : "متوقف"}
    </span>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
      <p className="text-xs text-[#7c6b60]">{label}</p>
      <p className="mt-1 font-semibold text-[#2f211c]">{value || "-"}</p>
    </div>
  );
}

function SupplierFormDialog({
  initial,
  title,
  isSaving,
  onClose,
  onSubmit,
}: {
  initial: SupplierInput;
  title: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: SupplierInput) => void;
}) {
  const [form, setForm] = useState<SupplierInput>(initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#2f211c]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]"><X size={16} /></button>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
            اسم المورد
            <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
            الهاتف
            <input value={form.phone ?? ""} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
            العنوان
            <input value={form.address ?? ""} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">
            ملاحظات
            <textarea value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm outline-none" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#4a3b34]">
            <input checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" className="h-4 w-4 accent-[#5d4032]" />
            مورد فعال
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button>
          <button disabled={isSaving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />حفظ</button>
        </div>
      </form>
    </div>
  );
}

function SupplierProfileDialog({
  supplier,
  onClose,
  onEdit,
  onOpenPayment,
}: {
  supplier: AdminSupplierProfile;
  onClose: () => void;
  onEdit: () => void;
  onOpenPayment: (payment: PurchasePayment) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/35 p-4">
      <section className="mx-auto my-6 w-full max-w-6xl rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#7c6b60]">ملف المورد</p>
            <h2 className="text-2xl font-semibold text-[#2f211c]">{supplier.name}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Edit3 size={16} />تعديل المورد</button>
            <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] bg-white p-2 text-[#4a3b34]"><X size={16} /></button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailLine label="الهاتف" value={supplier.phone ?? "-"} />
          <DetailLine label="العنوان" value={supplier.address ?? "-"} />
          <DetailLine label="الحالة" value={supplier.isActive ? "فعال" : "متوقف"} />
          <DetailLine label="ملاحظات" value={supplier.notes ?? "-"} />
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="إجمالي المشتريات" value={formatCurrency(supplier.financials.totalPurchases)} />
          <StatCard title="إجمالي المدفوع" value={formatCurrency(supplier.financials.totalPaid)} />
          <StatCard title="إجمالي المتبقي" value={formatCurrency(supplier.financials.remaining)} />
          <StatCard title="عدد الفواتير" value={formatNumber(supplier.financials.purchaseCount)} />
          <StatCard title="آخر عملية شراء" value={formatDate(supplier.financials.lastPurchaseAt)} />
          <StatCard title="آخر دفعة" value={formatDate(supplier.financials.lastPaymentAt)} />
        </section>

        <section className="mt-5 rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-4"><h3 className="font-semibold text-[#2f211c]">فواتير الشراء</h3></div>
          {supplier.purchases.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد فواتير لهذا المورد.</p> : null}
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {supplier.purchases.map((purchase) => (
              <article key={purchase.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#2f211c]">فاتورة شراء #{purchase.purchaseNumber}</p>
                    <p className="text-[#7c6b60]">فاتورة المورد: {purchase.supplierInvoiceNumber ?? "-"}</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${purchase.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {purchase.paymentStatus === "paid" ? "مدفوعة" : "بانتظار الدفع"}
                  </span>
                </div>
                <p className="mt-2 text-[#4a3b34]">المبلغ: <span className="font-semibold">{formatCurrency(purchase.totalAmount)}</span></p>
                <p className="text-[#7c6b60]">التاريخ: {formatDateTime(purchase.createdAt)}</p>
                <p className="text-[#7c6b60]">حالة الدفع: {purchasePaymentStatusLabels[purchase.paymentStatus]}</p>
                {purchase.payment ? <p className="mt-2 font-semibold text-[#2f211c]">{purchasePaymentVoucherNumber(purchase.payment)}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-4"><h3 className="font-semibold text-[#2f211c]">المواد التي تم شراؤها من هذا المورد</h3></div>
          {supplier.materials.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد مواد مرتبطة بتاريخ مشتريات هذا المورد.</p> : null}
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {supplier.materials.map((material) => (
              <article key={material.inventoryItemId} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
                <p className="font-semibold text-[#2f211c]">{material.name}</p>
                <p className="text-[#7c6b60]">إجمالي الكمية الأساسية: {formatNumber(material.totalQuantityBase)}</p>
                <p className="text-[#7c6b60]">آخر سعر شراء: {formatCurrency(material.lastUnitPrice)}</p>
                <p className="text-[#9a8779]">آخر توريد: {formatDate(material.lastPurchasedAt)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="border-b border-[#eee4d8] p-4"><h3 className="font-semibold text-[#2f211c]">مدفوعات المورد</h3></div>
          {supplier.payments.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد مدفوعات لهذا المورد.</p> : null}
          <div className="divide-y divide-[#eee4d8]">
            {supplier.payments.map((payment) => (
              <article key={payment.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-1">
                  <p className="font-semibold text-[#2f211c]">{purchasePaymentVoucherNumber(payment)} · {formatCurrency(payment.amount)}</p>
                  <p className="text-[#7c6b60]">{expensePaymentMethodLabels[payment.paymentMethod]} · مرجع خارجي: {payment.referenceNumber ?? "-"}</p>
                  <p className="text-xs text-[#9a8779]">المحاسب: {payment.paidByName} · {formatDateTime(payment.createdAt)}</p>
                </div>
                <button type="button" onClick={() => onOpenPayment(payment)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><ReceiptText size={16} />عرض سند الدفع</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<AdminSupplierProfile[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<AdminSupplierProfile | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSupplier = selectedSupplierId ? suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null : null;

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setSuppliers(await getAdminSuppliers());
    } catch (loadError) {
      logSupabaseError("[admin suppliers page load]", loadError);
      setError("تعذر تحميل بيانات الموردين.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = normalize(search);
    return suppliers.filter((supplier) => {
      const matchesSearch = !query || normalize(supplier.name).includes(query) || normalize(supplier.phone).includes(query);
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? supplier.isActive : !supplier.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, suppliers]);

  const totals = useMemo(() => {
    return suppliers.reduce(
      (summary, supplier) => ({
        activeCount: summary.activeCount + (supplier.isActive ? 1 : 0),
        totalPurchases: summary.totalPurchases + supplier.financials.totalPurchases,
        totalPaid: summary.totalPaid + supplier.financials.totalPaid,
        remaining: summary.remaining + supplier.financials.remaining,
      }),
      { activeCount: 0, totalPurchases: 0, totalPaid: 0, remaining: 0 },
    );
  }, [suppliers]);

  function flash(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  async function createSupplier(input: SupplierInput) {
    setIsSaving(true);
    setError("");
    try {
      await createAdminSupplier(input);
      await loadSuppliers();
      setIsCreateOpen(false);
      flash("تمت إضافة المورد");
    } catch (createError) {
      logSupabaseError("[admin supplier create]", createError);
      setError("تعذر إضافة المورد.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateSupplier(input: SupplierInput) {
    if (!editingSupplier) return;
    setIsSaving(true);
    setError("");
    try {
      await updateAdminSupplier(editingSupplier, input);
      await loadSuppliers();
      setEditingSupplier(null);
      flash(input.isActive === editingSupplier.isActive ? "تم تعديل المورد" : input.isActive ? "تمت إعادة تفعيل المورد" : "تم إيقاف المورد");
    } catch (updateError) {
      logSupabaseError("[admin supplier update]", updateError);
      setError("تعذر حفظ بيانات المورد.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">لوحة الإدارة</p>
          <h1 className="text-2xl font-semibold text-[#2f211c]">الموردون</h1>
          <p className="mt-1 text-sm text-[#7c6b60]">إدارة بيانات الموردين ومتابعة المشتريات والمدفوعات والمبالغ المستحقة لكل مورد.</p>
        </div>
        <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]">
          <Plus size={18} />
          إضافة مورد
        </button>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="عدد الموردين الفعالين" value={formatNumber(totals.activeCount)} />
        <StatCard title="إجمالي المشتريات من الموردين" value={formatCurrency(totals.totalPurchases)} />
        <StatCard title="إجمالي المدفوع للموردين" value={formatCurrency(totals.totalPaid)} />
        <StatCard title="إجمالي المستحقات غير المدفوعة" value={formatCurrency(totals.remaining)} />
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث باسم المورد أو الهاتف" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] pr-10 pl-3 text-sm outline-none" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SupplierStatusFilter)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل الموردين</option>
            <option value="active">فعال</option>
            <option value="inactive">متوقف</option>
          </select>
        </div>
      </section>

      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]"><Loader2 className="ml-2 inline animate-spin" size={16} />جارٍ تحميل الموردين...</div> : null}

      {!isLoading && filteredSuppliers.length === 0 ? (
        <section className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]">لا يوجد موردون مطابقون للبحث الحالي.</section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredSuppliers.map((supplier) => (
          <article key={supplier.id} className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#2f211c]">{supplier.name}</h2>
                  <StatusBadge active={supplier.isActive} />
                </div>
                <p className="mt-1 text-sm text-[#7c6b60]">{supplier.phone ?? "لا يوجد هاتف"}</p>
              </div>
              <button type="button" onClick={() => setSelectedSupplierId(supplier.id)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض الملف</button>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <DetailLine label="عدد فواتير الشراء" value={formatNumber(supplier.financials.purchaseCount)} />
              <DetailLine label="إجمالي المشتريات" value={formatCurrency(supplier.financials.totalPurchases)} />
              <DetailLine label="إجمالي المدفوع" value={formatCurrency(supplier.financials.totalPaid)} />
              <DetailLine label="المبلغ المتبقي" value={formatCurrency(supplier.financials.remaining)} />
              <DetailLine label="آخر توريد" value={formatDate(supplier.financials.lastPurchaseAt)} />
              <DetailLine label="الحالة" value={supplier.isActive ? "فعال" : "متوقف"} />
            </div>
          </article>
        ))}
      </section>

      {selectedSupplier ? (
        <SupplierProfileDialog
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplierId(null)}
          onEdit={() => setEditingSupplier(selectedSupplier)}
          onOpenPayment={setSelectedPayment}
        />
      ) : null}

      {isCreateOpen ? (
        <SupplierFormDialog
          initial={emptySupplier}
          title="إضافة مورد"
          isSaving={isSaving}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(input) => void createSupplier(input)}
        />
      ) : null}

      {editingSupplier ? (
        <SupplierFormDialog
          initial={{ name: editingSupplier.name, phone: editingSupplier.phone ?? "", address: editingSupplier.address ?? "", notes: editingSupplier.notes ?? "", isActive: editingSupplier.isActive }}
          title="تعديل المورد"
          isSaving={isSaving}
          onClose={() => setEditingSupplier(null)}
          onSubmit={(input) => void updateSupplier(input)}
        />
      ) : null}

      {selectedPayment ? <PurchasePaymentVoucherDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} /> : null}
    </div>
  );
}
