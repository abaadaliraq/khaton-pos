"use client";

import { CheckCircle2, ClipboardList, Eye, ReceiptText, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { singlePurchaseRequestQuantity } from "@/lib/purchaseRequestDisplay";
import { createClient } from "@/lib/supabase/client";
import { getPurchaseRequests, getPurchases } from "@/services/purchaseService";
import type { Purchase, PurchaseRequest, PurchaseRequestStatus } from "@/types/finance";
import { purchasePaymentStatusLabels, purchaseRequestItemDecisionStatusLabels, purchaseRequestStatusLabels } from "@/types/finance";

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
  if (status === "approved" || status === "paid" || status === "received") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "partially_received") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "pending" || status === "decision_in_progress" || status === "partially_approved" || status === "unpaid") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "rejected" || status === "cancelled") return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-[#f5eee6] text-[#a65f3f] border-[#eadccd]";
}

function itemSummary(request: PurchaseRequest) {
  if (request.items.length === 0) return "لا توجد مواد";
  const visibleItems = request.items.slice(0, 4).map((item) => item.inventoryItemName).join("، ");
  const hiddenCount = request.items.length - 4;
  return hiddenCount > 0 ? `${visibleItems} +${formatNumber(hiddenCount)}` : visibleItems;
}

function quantitySummary(request: PurchaseRequest) {
  if (request.items.length === 1) return singlePurchaseRequestQuantity(request);
  if (request.items.length === 0) return "-";
  const visibleItems = request.items.slice(0, 4).map((item) => `${formatNumber(item.quantity)} ${item.unitCode}`).join("، ");
  const hiddenCount = request.items.length - 4;
  return hiddenCount > 0 ? `${visibleItems} +${formatNumber(hiddenCount)}` : visibleItems;
}

function itemDecisionTone(status: PurchaseRequest["items"][number]["decisionStatus"]) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function requestEstimatedValue(request: PurchaseRequest) {
  return request.items.reduce((total, item) => total + item.quantity * (item.lastPurchaseCost ?? 0), 0);
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
          <div className="mt-3 overflow-x-auto rounded-md border border-[#eee4d8]">
            <table className="w-full min-w-[760px] border-collapse text-right text-xs">
              <thead className="bg-[#2b2421] text-white"><tr><th className="border-l border-[#e6dacd] px-3 py-2">المادة</th><th className="border-l border-[#e6dacd] px-3 py-2">الكمية</th><th className="border-l border-[#e6dacd] px-3 py-2">الوحدة</th><th className="border-l border-[#e6dacd] px-3 py-2">الحالة</th><th className="px-3 py-2">السبب</th></tr></thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {request.items.map((item) => (
                  <tr key={item.id} className="align-top odd:bg-white even:bg-[#fffdfa]">
                    <td className="whitespace-normal break-words border-l border-[#f0e5da] px-3 py-3 font-bold text-[#181818]">{item.inventoryItemName}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-3 text-[#2f211c]">{formatNumber(item.quantity)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-3 text-[#2f211c]">{item.unitCode}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-3"><span className={"rounded-md border px-2 py-1 text-xs font-bold " + itemDecisionTone(item.decisionStatus)}>{purchaseRequestItemDecisionStatusLabels[item.decisionStatus]}</span></td>
                    <td className="whitespace-normal break-words px-3 py-3 text-[#4a3b34]">{item.rejectionReason ?? item.notes ?? "-"}</td>
                  </tr>
                ))}
                {request.items.length === 0 ? <tr><td colSpan={5}><EmptyState message="لا توجد مواد مرتبطة بهذا الطلب." /></td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <InfoGrid rows={[
          ["ملاحظات الطلب", request.notes ?? "-"],
          ["ملاحظات القرار", request.decisionNotes ?? "-"],
          ["سبب الرفض", request.rejectionReason ?? "-"],
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

function RequestsPanel({ requests }: { requests: PurchaseRequest[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">طلبات الشراء الأخيرة</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-right text-xs">
          <thead className="bg-[#2b2421] text-white">
            <tr>
              <th className="w-[12%] border-l border-[#e6dacd] px-3 py-2">رقم الطلب</th>
              <th className="w-[14%] border-l border-[#e6dacd] px-3 py-2">التاريخ</th>
              <th className="w-[13%] border-l border-[#e6dacd] px-3 py-2">طالب الشراء</th>
              <th className="w-[22%] border-l border-[#e6dacd] px-3 py-2">المواد</th>
              <th className="w-[14%] border-l border-[#e6dacd] px-3 py-2">الكمية</th>
              <th className="w-[8%] border-l border-[#e6dacd] px-3 py-2">عدد المواد</th>
              <th className="w-[10%] border-l border-[#e6dacd] px-3 py-2">القيمة</th>
              <th className="w-[7%] px-3 py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="align-top odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                <td className="border border-[#f0e5da] px-3 py-3 font-bold text-[#181818]" dir="ltr">{requestNumber(request)}</td>
                <td className="whitespace-normal border border-[#f0e5da] px-3 py-3 leading-6 text-[#2f211c]">{formatDateTime(request.createdAt)}</td>
                <td className="whitespace-normal break-words border border-[#f0e5da] px-3 py-3 font-semibold leading-6 text-[#181818]">{request.requestedByName}</td>
                <td className="whitespace-normal break-words border border-[#f0e5da] px-3 py-3 font-semibold leading-6 text-[#181818]">{itemSummary(request)}</td>
                <td className="whitespace-normal break-words border border-[#f0e5da] px-3 py-3 font-bold leading-6 text-[#181818]">{quantitySummary(request)}</td>
                <td className="border border-[#f0e5da] px-3 py-3 text-[#2f211c]">{formatNumber(request.items.length)}</td>
                <td className="border border-[#f0e5da] px-3 py-3 text-[#2f211c]">{formatCurrency(requestEstimatedValue(request))}</td>
                <td className="border border-[#f0e5da] px-3 py-3">
                  <span className={"rounded-md border px-2 py-1 text-xs font-semibold " + statusTone(request.status)}>{purchaseRequestStatusLabels[request.status]}</span>
                </td>
              </tr>
            ))}
            {requests.length === 0 ? <tr><td colSpan={8} className="border border-[#f0e5da] px-3 py-8 text-center text-sm text-[#7c6b60]">لا توجد طلبات شراء حالياً.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PurchasesPanel({ purchases, onOpen }: { purchases: Purchase[]; onOpen: (purchase: Purchase) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4"><h2 className="font-semibold text-[#2f211c]">آخر فواتير الشراء</h2></div>
      {purchases.length === 0 ? <div className="p-4"><EmptyState message="لا توجد فواتير شراء حالياً." /></div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-right text-xs">
          <thead className="bg-[#2b2421] text-white">
            <tr>
              <th className="w-[13%] border-l border-[#e6dacd] px-3 py-2">رقم الفاتورة</th>
              <th className="w-[22%] border-l border-[#e6dacd] px-3 py-2">المورد</th>
              <th className="w-[16%] border-l border-[#e6dacd] px-3 py-2">التاريخ</th>
              <th className="w-[13%] border-l border-[#e6dacd] px-3 py-2">المبلغ</th>
              <th className="w-[12%] border-l border-[#e6dacd] px-3 py-2">الحالة</th>
              <th className="w-[16%] border-l border-[#e6dacd] px-3 py-2">المستلم بواسطة</th>
              <th className="w-[8%] px-3 py-2">عرض</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="align-top odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                <td className="border border-[#f0e5da] px-3 py-3 font-bold text-[#181818]" dir="ltr">{purchaseNumber(purchase)}</td>
                <td className="whitespace-normal break-words border border-[#f0e5da] px-3 py-3 font-semibold leading-6 text-[#181818]">{purchase.supplierName}</td>
                <td className="whitespace-normal border border-[#f0e5da] px-3 py-3 leading-6 text-[#2f211c]">{formatDateTime(purchase.createdAt)}</td>
                <td className="border border-[#f0e5da] px-3 py-3 font-bold text-[#181818]">{formatCurrency(purchase.totalAmount)}</td>
                <td className="border border-[#f0e5da] px-3 py-3">
                  <span className={"rounded-md border px-2 py-1 text-xs font-semibold " + statusTone(purchase.paymentStatus)}>{purchasePaymentStatusLabels[purchase.paymentStatus]}</span>
                </td>
                <td className="whitespace-normal break-words border border-[#f0e5da] px-3 py-3 leading-6 text-[#2f211c]">{purchase.createdByName}</td>
                <td className="border border-[#f0e5da] px-3 py-3">
                  <button type="button" onClick={() => onOpen(purchase)} className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-xs font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">
                    <Eye size={14} />عرض
                  </button>
                </td>
              </tr>
            ))}
            {purchases.length === 0 ? <tr><td colSpan={7} className="border border-[#f0e5da] px-3 py-8 text-center text-sm text-[#7c6b60]">لا توجد فواتير شراء حالياً.</td></tr> : null}
          </tbody>
        </table>
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

  useEffect(() => {
    const supabase = createClient();
    let reloadTimer: number | null = null;
    function scheduleReload() {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        Promise.allSettled([getPurchaseRequests(), getPurchases()])
          .then(([requestResult, purchaseResult]) => {
            if (requestResult.status === "fulfilled") setRequests(requestResult.value);
            if (purchaseResult.status === "fulfilled") setPurchases(purchaseResult.value);
          })
          .catch((error) => console.error("Failed to refresh owner purchases data", error));
      }, 300);
    }
    const channel = supabase
      .channel("owner-purchase-oversight")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requests" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_request_items" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, () => scheduleReload())
      .subscribe();
    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const summary = useMemo(() => {
    const today = getBaghdadDate();
    const monthStart = startOfMonth(today);
    return {
      pendingRequests: requests.filter((request) => request.status === "pending" || request.status === "decision_in_progress").length,
      approvedAwaitingReceiving: requests.filter((request) => request.status === "approved" || request.status === "partially_approved").length,
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
            <SummaryCard title="طلبات شراء بانتظار قرار المدير" value={formatNumber(summary.pendingRequests) + " طلب"} icon={ClipboardList} />
            <SummaryCard title="معتمدة بانتظار الاستلام" value={formatNumber(summary.approvedAwaitingReceiving) + " طلب"} icon={CheckCircle2} />
            <SummaryCard title="مشتريات هذا الشهر" value={formatCurrency(summary.purchasesThisMonth)} icon={ShoppingCart} />
            <SummaryCard title="فواتير مشتريات غير مدفوعة" value={formatNumber(summary.unpaidInvoices) + " فاتورة"} icon={ReceiptText} />
          </section>

          <div className="space-y-4">
            <RequestsPanel requests={requests.slice(0, 10)} />
            <PurchasesPanel purchases={purchases.slice(0, 10)} onOpen={setSelectedPurchase} />
          </div>
        </>
      )}

      {selectedRequest ? <RequestDetailsDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} /> : null}
      {selectedPurchase ? <PurchaseDetailsDialog purchase={selectedPurchase} onClose={() => setSelectedPurchase(null)} /> : null}
    </div>
  );
}
