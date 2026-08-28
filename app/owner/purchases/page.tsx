"use client";

import { CheckCircle2, ClipboardList, Eye, ReceiptText, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { getPurchaseRequests, getPurchases } from "@/services/purchaseService";
import type { Purchase, PurchaseRequest, PurchaseRequestStatus } from "@/types/finance";
import { purchasePaymentStatusLabels, purchaseRequestStatusLabels } from "@/types/finance";

const baghdadTimeZone = "Asia/Baghdad";

function getBaghdadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}

function startOfMonth(today: string) {
  const [year, month] = today.split("-");
  return year + "-" + month + "-01";
}

function localDateKey(value: string) {
  return getBaghdadDate(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function requestNumber(request: PurchaseRequest) {
  return "PR-" + String(request.requestNumber).padStart(6, "0");
}

function purchaseNumber(purchase: Purchase) {
  return "PUR-" + String(purchase.purchaseNumber).padStart(6, "0");
}

function statusTone(status: PurchaseRequestStatus | "paid" | "unpaid") {
  if (status === "approved" || status === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "pending" || status === "unpaid") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "rejected" || status === "cancelled") return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-[#f5eee6] text-[#a65f3f] border-[#eadccd]";
}

function itemSummary(items: PurchaseRequest["items"]) {
  if (items.length === 0) return "لا توجد مواد";
  const names = items.slice(0, 3).map((item) => item.inventoryItemName).join("، ");
  return items.length > 3 ? names + " +" + formatNumber(items.length - 3) : names;
}

function SummaryCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof ShoppingCart }) {
  return (
    <article className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </article>
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
            <div className="mt-5 h-8 w-24 rounded bg-[#efe7dc]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
        <div className="h-80 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
      </div>
    </div>
  );
}

function ReadOnlyDialog({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-[#fbfaf7] shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#e4d8c8] bg-white p-5">
          <div>
            <p className="text-sm text-[#7c6b60]">{subtitle}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#2f211c]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e4d8c8] text-[#4a3b34] hover:bg-[#f5eee6]" aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-[#e4d8c8] bg-white p-3">
          <dt className="text-xs text-[#7c6b60]">{label}</dt>
          <dd className="mt-1 font-semibold text-[#2f211c]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RequestDetailsDialog({ request, onClose }: { request: PurchaseRequest; onClose: () => void }) {
  return (
    <ReadOnlyDialog title={requestNumber(request)} subtitle="تفاصيل طلب الشراء" onClose={onClose}>
      <div className="space-y-4">
        <InfoGrid rows={[
          ["الحالة", purchaseRequestStatusLabels[request.status]],
          ["مقدم الطلب", request.requestedByName],
          ["التاريخ", formatDateTime(request.createdAt)],
          ["من وافق أو رفض", request.decidedByName ?? "-"],
          ["وقت القرار", formatDateTime(request.decidedAt)],
          ["وقت الاستلام", formatDateTime(request.receivedAt)],
        ]} />
        <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
          <h3 className="font-semibold text-[#2f211c]">المواد المطلوبة</h3>
          <div className="mt-3 divide-y divide-[#eee4d8]">
            {request.items.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto]">
                <span className="font-medium text-[#2f211c]">{item.inventoryItemName}</span>
                <span className="text-[#7c6b60]">{formatNumber(item.quantity)} {item.unitCode}</span>
                {item.notes ? <p className="sm:col-span-2 text-xs text-[#7c6b60]">{item.notes}</p> : null}
              </div>
            ))}
            {request.items.length === 0 ? <EmptyState message="لا توجد مواد مرتبطة بهذا الطلب." /> : null}
          </div>
        </section>
        <InfoGrid rows={[
          ["ملاحظات الطلب", request.notes ?? "-"],
          ["ملاحظات القرار", request.decisionNotes ?? "-"],
        ]} />
      </div>
    </ReadOnlyDialog>
  );
}

function PurchaseDetailsDialog({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  return (
    <ReadOnlyDialog title={purchaseNumber(purchase)} subtitle="تفاصيل فاتورة الشراء" onClose={onClose}>
      <div className="space-y-4">
        <InfoGrid rows={[
          ["المورد", purchase.supplierName],
          ["رقم فاتورة المورد", purchase.supplierInvoiceNumber ?? "-"],
          ["الإجمالي", formatCurrency(purchase.totalAmount)],
          ["حالة الدفع", purchasePaymentStatusLabels[purchase.paymentStatus]],
          ["تاريخ الاستلام", formatDateTime(purchase.createdAt)],
          ["المسؤول عن الاستلام", purchase.createdByName],
          ["طلب الشراء المرتبط", purchase.purchaseRequestNumber ? "PR-" + String(purchase.purchaseRequestNumber).padStart(6, "0") : "-"],
          ["ملاحظات", purchase.notes ?? "-"],
        ]} />
        <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
          <h3 className="font-semibold text-[#2f211c]">المواد المستلمة</h3>
          <div className="mt-3 divide-y divide-[#eee4d8]">
            {purchase.items.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                <span className="font-medium text-[#2f211c]">{item.inventoryItemName}</span>
                <span className="text-[#7c6b60]">{formatNumber(item.quantity)} {item.unitCode}</span>
                <span className="text-[#7c6b60]">{formatCurrency(item.unitPrice)}</span>
                <span className="font-semibold text-[#2f211c]">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
            {purchase.items.length === 0 ? <EmptyState message="لا توجد مواد مرتبطة بهذه الفاتورة." /> : null}
          </div>
        </section>
      </div>
    </ReadOnlyDialog>
  );
}

function RequestsPanel({ requests, onOpen }: { requests: PurchaseRequest[]; onOpen: (request: PurchaseRequest) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">طلبات الشراء الأخيرة</h2></div>
      {requests.length === 0 ? <div className="p-4"><EmptyState message="لا توجد طلبات شراء حالياً." /></div> : null}
      <div className="divide-y divide-[#eee4d8]">
        {requests.map((request) => (
          <article key={request.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#2f211c]">{requestNumber(request)}</span>
                <span className={"rounded-md border px-2 py-1 text-xs font-semibold " + statusTone(request.status)}>{purchaseRequestStatusLabels[request.status]}</span>
              </div>
              <p className="mt-2 text-[#2f211c]">{itemSummary(request.items)}</p>
              <p className="mt-1 text-xs text-[#7c6b60]">مقدم الطلب: {request.requestedByName} · {formatDateTime(request.createdAt)}</p>
              <p className="mt-1 text-xs text-[#7c6b60]">من وافق أو رفض: {request.decidedByName ?? "-"}</p>
            </div>
            <button type="button" onClick={() => onOpen(request)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
              <Eye size={16} />عرض
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PurchasesPanel({ purchases, onOpen }: { purchases: Purchase[]; onOpen: (purchase: Purchase) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">آخر فواتير الشراء</h2></div>
      {purchases.length === 0 ? <div className="p-4"><EmptyState message="لا توجد فواتير شراء حالياً." /></div> : null}
      <div className="divide-y divide-[#eee4d8]">
        {purchases.map((purchase) => (
          <article key={purchase.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#2f211c]">{purchaseNumber(purchase)}</span>
                <span className={"rounded-md border px-2 py-1 text-xs font-semibold " + statusTone(purchase.paymentStatus)}>{purchasePaymentStatusLabels[purchase.paymentStatus]}</span>
              </div>
              <p className="mt-2 text-[#2f211c]">{purchase.supplierName} · {formatCurrency(purchase.totalAmount)}</p>
              <p className="mt-1 text-xs text-[#7c6b60]">رقم فاتورة المورد: {purchase.supplierInvoiceNumber ?? "-"} · {formatDateTime(purchase.createdAt)}</p>
              <p className="mt-1 text-xs text-[#7c6b60]">المسؤول عن الاستلام: {purchase.createdByName}</p>
            </div>
            <button type="button" onClick={() => onOpen(purchase)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
              <Eye size={16} />عرض
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function OwnerPurchasesPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPurchases() {
      try {
        const [requestResult, purchaseResult] = await Promise.allSettled([getPurchaseRequests(), getPurchases()]);
        if (!isMounted) return;
        if (requestResult.status === "fulfilled") setRequests(requestResult.value);
        if (purchaseResult.status === "fulfilled") setPurchases(purchaseResult.value);
        setErrorMessage(requestResult.status === "rejected" || purchaseResult.status === "rejected" ? "تعذر تحميل بعض بيانات المشتريات." : "");
      } catch (error) {
        console.error("Failed to load owner purchases data", error);
        if (!isMounted) return;
        setErrorMessage("تعذر تحميل بعض بيانات المشتريات.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadPurchases();
    return () => { isMounted = false; };
  }, []);

  const summary = useMemo(() => {
    const today = getBaghdadDate();
    const monthStart = startOfMonth(today);
    return {
      pendingRequests: requests.filter((request) => request.status === "pending").length,
      approvedAwaitingReceiving: requests.filter((request) => request.status === "approved").length,
      purchasesThisMonth: purchases.filter((purchase) => {
        const purchaseDate = localDateKey(purchase.createdAt);
        return purchaseDate >= monthStart && purchaseDate <= today;
      }).reduce((total, purchase) => total + purchase.totalAmount, 0),
      unpaidInvoices: purchases.filter((purchase) => purchase.paymentStatus === "unpaid").length,
    };
  }, [requests, purchases]);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة الشركاء</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">المشتريات</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">متابعة طلبات الشراء وفواتير التوريد من بيانات النظام الحالية، للعرض فقط.</p>
      </section>

      {errorMessage ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="طلبات شراء بانتظار الموافقة" value={formatNumber(summary.pendingRequests) + " طلب"} icon={ClipboardList} />
            <SummaryCard title="معتمدة بانتظار الاستلام" value={formatNumber(summary.approvedAwaitingReceiving) + " طلب"} icon={CheckCircle2} />
            <SummaryCard title="مشتريات هذا الشهر" value={formatCurrency(summary.purchasesThisMonth)} icon={ShoppingCart} />
            <SummaryCard title="فواتير مشتريات غير مدفوعة" value={formatNumber(summary.unpaidInvoices) + " فاتورة"} icon={ReceiptText} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <RequestsPanel requests={requests.slice(0, 10)} onOpen={setSelectedRequest} />
            <PurchasesPanel purchases={purchases.slice(0, 10)} onOpen={setSelectedPurchase} />
          </div>
        </>
      )}

      {selectedRequest ? <RequestDetailsDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} /> : null}
      {selectedPurchase ? <PurchaseDetailsDialog purchase={selectedPurchase} onClose={() => setSelectedPurchase(null)} /> : null}
    </div>
  );
}
