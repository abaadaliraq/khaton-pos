"use client";

import { Eye, ReceiptText, Search, Truck, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PurchasePaymentVoucherDialog, purchasePaymentVoucherNumber } from "@/components/finance/PurchasePaymentVoucherDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { getAdminSuppliers } from "@/services/adminSupplierService";
import type { AdminSupplierProfile } from "@/types/adminSuppliers";
import type { PurchasePayment } from "@/types/finance";
import { expensePaymentMethodLabels, purchasePaymentStatusLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";
type SupplierStatusFilter = "all" | "active" | "inactive";
type SupplierSortKey = "remaining" | "purchases" | "lastSupply";

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

function purchaseNumber(value: number) {
  return "PUR-" + String(value).padStart(6, "0");
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ar-IQ");
}

function lastSupplyTimestamp(supplier: AdminSupplierProfile) {
  if (!supplier.financials.lastPurchaseAt) return 0;
  return new Date(supplier.financials.lastPurchaseAt).getTime();
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Truck }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#7c6b60]">{title}</p>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
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

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-[#e4d8c8] bg-[#fbfaf7] p-5 text-center text-sm text-[#7c6b60]">{message}</p>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="h-4 w-32 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-8 w-28 rounded bg-[#efe7dc]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
        <div className="h-72 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
      </div>
    </div>
  );
}

function SupplierDialogShell({ supplier, onClose, children }: { supplier: AdminSupplierProfile; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/35 p-4">
      <section className="mx-auto my-6 w-full max-w-6xl rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#7c6b60]">ملف المورد</p>
            <h2 className="text-2xl font-semibold text-[#2f211c]">{supplier.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] bg-white p-2 text-[#4a3b34] hover:bg-[#f5eee6]" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SupplierProfileDialog({ supplier, onClose, onOpenPayment }: { supplier: AdminSupplierProfile; onClose: () => void; onOpenPayment: (payment: PurchasePayment) => void }) {
  return (
    <SupplierDialogShell supplier={supplier} onClose={onClose}>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailLine label="الهاتف" value={supplier.phone ?? "-"} />
        <DetailLine label="العنوان" value={supplier.address ?? "-"} />
        <DetailLine label="الحالة" value={supplier.isActive ? "فعال" : "متوقف"} />
        <DetailLine label="ملاحظات" value={supplier.notes ?? "-"} />
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي المشتريات" value={formatCurrency(supplier.financials.totalPurchases)} icon={Truck} />
        <StatCard title="إجمالي المدفوع" value={formatCurrency(supplier.financials.totalPaid)} icon={WalletCards} />
        <StatCard title="إجمالي المتبقي" value={formatCurrency(supplier.financials.remaining)} icon={ReceiptText} />
        <StatCard title="عدد الفواتير" value={formatNumber(supplier.financials.purchaseCount)} icon={ReceiptText} />
        <StatCard title="آخر عملية شراء" value={formatDate(supplier.financials.lastPurchaseAt)} icon={Truck} />
        <StatCard title="آخر دفعة" value={formatDate(supplier.financials.lastPaymentAt)} icon={WalletCards} />
      </section>

      <section className="mt-5 rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="border-b border-[#eee4d8] p-4"><h3 className="font-semibold text-[#2f211c]">فواتير المورد</h3></div>
        {supplier.purchases.length === 0 ? <div className="p-4"><EmptyState message="لا توجد فواتير لهذا المورد." /></div> : null}
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {supplier.purchases.map((purchase) => (
            <article key={purchase.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#2f211c]">{purchaseNumber(purchase.purchaseNumber)}</p>
                  <p className="text-[#7c6b60]">فاتورة المورد: {purchase.supplierInvoiceNumber ?? "-"}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${purchase.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {purchasePaymentStatusLabels[purchase.paymentStatus]}
                </span>
              </div>
              <p className="mt-2 text-[#4a3b34]">المبلغ: <span className="font-semibold">{formatCurrency(purchase.totalAmount)}</span></p>
              <p className="text-[#7c6b60]">تاريخ التوريد: {formatDateTime(purchase.createdAt)}</p>
              {purchase.payment ? <p className="mt-2 font-semibold text-[#2f211c]">{purchasePaymentVoucherNumber(purchase.payment)}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="border-b border-[#eee4d8] p-4"><h3 className="font-semibold text-[#2f211c]">المواد التي تم شراؤها منه</h3></div>
        {supplier.materials.length === 0 ? <div className="p-4"><EmptyState message="لا توجد مواد مرتبطة بتاريخ مشتريات هذا المورد." /></div> : null}
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
        {supplier.payments.length === 0 ? <div className="p-4"><EmptyState message="لا توجد مدفوعات لهذا المورد." /></div> : null}
        <div className="divide-y divide-[#eee4d8]">
          {supplier.payments.map((payment) => (
            <article key={payment.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-1">
                <p className="font-semibold text-[#2f211c]">{purchasePaymentVoucherNumber(payment)} · {formatCurrency(payment.amount)}</p>
                <p className="text-[#7c6b60]">{expensePaymentMethodLabels[payment.paymentMethod]} · مرجع خارجي: {payment.referenceNumber ?? "-"}</p>
                <p className="text-xs text-[#9a8779]">المحاسب: {payment.paidByName} · {formatDateTime(payment.createdAt)}</p>
              </div>
              <button type="button" onClick={() => onOpenPayment(payment)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
                <ReceiptText size={16} />عرض سند الدفع
              </button>
            </article>
          ))}
        </div>
      </section>
    </SupplierDialogShell>
  );
}

function SuppliersTable({ suppliers, onOpen }: { suppliers: AdminSupplierProfile[]; onOpen: (supplierId: string) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4">
        <h2 className="font-semibold text-[#2f211c]">قائمة الموردين</h2>
      </div>
      {suppliers.length === 0 ? <div className="p-4"><EmptyState message="لا توجد سجلات موردين مطابقة للفلاتر الحالية." /></div> : null}
      {suppliers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                <th className="px-3 py-3 font-semibold">اسم المورد</th>
                <th className="px-3 py-3 font-semibold">الهاتف</th>
                <th className="px-3 py-3 font-semibold">عدد الفواتير</th>
                <th className="px-3 py-3 font-semibold">إجمالي المشتريات</th>
                <th className="px-3 py-3 font-semibold">المدفوع</th>
                <th className="px-3 py-3 font-semibold">المستحق</th>
                <th className="px-3 py-3 font-semibold">آخر توريد</th>
                <th className="px-3 py-3 font-semibold">الحالة</th>
                <th className="px-3 py-3 font-semibold">عرض الملف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-[#fffaf4] [&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                  <td className="max-w-[240px] whitespace-normal px-3 py-3 font-semibold leading-6 text-[#2f211c]">{supplier.name}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{supplier.phone ?? "-"}</td>
                  <td className="px-3 py-3 font-semibold text-[#5d4032]">{formatNumber(supplier.financials.purchaseCount)}</td>
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{formatCurrency(supplier.financials.totalPurchases)}</td>
                  <td className="px-3 py-3 font-semibold text-emerald-700">{formatCurrency(supplier.financials.totalPaid)}</td>
                  <td className="px-3 py-3 font-semibold text-[#9f3128]">{formatCurrency(supplier.financials.remaining)}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{formatDate(supplier.financials.lastPurchaseAt)}</td>
                  <td className="px-3 py-3"><StatusBadge active={supplier.isActive} /></td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onOpen(supplier.id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">
                      <Eye size={16} />عرض
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function OwnerSuppliersPage() {
  const [suppliers, setSuppliers] = useState<AdminSupplierProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("all");
  const [sortKey, setSortKey] = useState<SupplierSortKey>("remaining");

  useEffect(() => {
    let isMounted = true;
    async function loadSuppliers() {
      try {
        const nextSuppliers = await getAdminSuppliers();
        if (!isMounted) return;
        setSuppliers(nextSuppliers);
        setErrorMessage("");
      } catch (error) {
        logSupabaseError("[owner suppliers load]", error);
        if (!isMounted) return;
        setErrorMessage("تعذر تحميل بيانات الموردين.");
        setSuppliers([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadSuppliers();
    return () => { isMounted = false; };
  }, []);

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

  const selectedSupplier = selectedSupplierId ? suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null : null;

  const filteredSuppliers = useMemo(() => {
    const query = normalize(search);
    return suppliers
      .filter((supplier) => {
        const matchesSearch = !query || normalize(supplier.name).includes(query) || normalize(supplier.phone).includes(query);
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? supplier.isActive : !supplier.isActive);
        return matchesSearch && matchesStatus;
      })
      .toSorted((first, second) => {
        if (sortKey === "purchases") return second.financials.totalPurchases - first.financials.totalPurchases;
        if (sortKey === "lastSupply") return lastSupplyTimestamp(second) - lastSupplyTimestamp(first);
        return second.financials.remaining - first.financials.remaining;
      });
  }, [search, sortKey, statusFilter, suppliers]);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة الشركاء</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">الموردون</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">متابعة ملفات الموردين والمشتريات والمدفوعات والمبالغ المستحقة من بيانات النظام الحالية.</p>
      </section>

      {errorMessage ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="الموردون الفعالون" value={formatNumber(totals.activeCount)} icon={Truck} />
            <StatCard title="إجمالي المشتريات" value={formatCurrency(totals.totalPurchases)} icon={ReceiptText} />
            <StatCard title="إجمالي المدفوع" value={formatCurrency(totals.totalPaid)} icon={WalletCards} />
            <StatCard title="إجمالي المستحقات" value={formatCurrency(totals.remaining)} icon={WalletCards} />
          </section>

          {suppliers.length === 0 ? <EmptyState message="لا توجد بيانات موردين حالياً." /> : null}

          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_240px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="بحث باسم المورد أو الهاتف"
                  className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] pr-10 pl-3 text-sm text-[#2f211c] outline-none focus:border-[#a65f3f]"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as SupplierStatusFilter)}
                className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm text-[#2f211c] outline-none focus:border-[#a65f3f]"
              >
                <option value="all">كل الحالات</option>
                <option value="active">فعال</option>
                <option value="inactive">متوقف</option>
              </select>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SupplierSortKey)}
                className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm text-[#2f211c] outline-none focus:border-[#a65f3f]"
              >
                <option value="remaining">ترتيب حسب المستحقات</option>
                <option value="purchases">ترتيب حسب المشتريات</option>
                <option value="lastSupply">ترتيب حسب آخر توريد</option>
              </select>
            </div>
          </section>

          <SuppliersTable suppliers={filteredSuppliers} onOpen={setSelectedSupplierId} />
        </>
      )}

      {selectedSupplier ? <SupplierProfileDialog supplier={selectedSupplier} onClose={() => setSelectedSupplierId(null)} onOpenPayment={setSelectedPayment} /> : null}
      {selectedPayment ? <PurchasePaymentVoucherDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} /> : null}
    </div>
  );
}
