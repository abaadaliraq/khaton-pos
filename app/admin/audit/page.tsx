"use client";

import { Eye, Filter, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { getAuditLogs } from "@/services/auditService";
import type { AuditFilters, AuditLog } from "@/types/audit";
import type { Json } from "@/types/database.types";

const pageSize = 50;
const baghdadTimeZone = "Asia/Baghdad";
const initialFilters: AuditFilters = { period: "all", user: "all", section: "all", action: "all", search: "" };

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  storekeeper: "مسؤول المخزن",
  captain: "كابتن",
  cashier: "كاشير",
  kitchen: "مطبخ",
};

const entitySections: Record<string, string> = {
  purchase_requests: "المخزن",
  purchases: "المخزن",
  suppliers: "الموردون",
  purchase_payments: "الحسابات",
  expenses: "الحسابات",
  staff_members: "العمال",
  menu_items: "المنيو",
  restaurant_tables: "الطاولات",
  orders: "الطلبات",
  payments: "الكاشير",
};

const actionLabels: Record<string, string> = {
  create_order: "إنشاء طلب",
  update_kitchen_status: "تحديث حالة المطبخ",
  apply_discount: "تطبيق خصم",
  record_payment: "تسجيل دفع طلب",
  close_paid_table: "إغلاق طاولة مدفوعة",
  create_staff_member: "إضافة عامل",
  update_staff_member: "تعديل عامل",
  update_staff_status: "تغيير حالة عامل",
  update_staff_system_access: "تغيير صلاحية نظام",
  link_staff_system_profile: "إنشاء حساب نظام",
  set_menu_item_inventory_tracking: "تفعيل/تعطيل خصم المخزون",
};

const fieldLabels: Record<string, string> = {
  status: "الحالة",
  payment_status: "حالة الدفع",
  amount: "المبلغ",
  total_amount: "المبلغ",
  category: "التصنيف",
  expense_date: "تاريخ المصروف",
  payment_method: "طريقة الدفع",
  item_count: "عدد المواد",
  reason: "السبب",
  full_name: "الاسم",
  job_title: "المسمى الوظيفي",
  department: "القسم",
  has_system_access: "صلاحية النظام",
};

const categoryLabels: Record<string, string> = {
  electricity: "كهرباء",
  water: "ماء",
  internet: "إنترنت",
  generator: "مولدة",
  maintenance: "صيانة",
  cleaning: "تنظيف",
  transport: "نقل",
  marketing: "تسويق",
  external_services: "خدمات خارجية",
  other: "مصروف آخر",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone }).format(new Date(value));
}

function periodStart(period: AuditFilters["period"]) {
  const today = dateKey(new Date().toISOString());
  if (period === "all") return null;
  if (period === "today") return today;
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (period === "week") {
    const offset = (date.getUTCDay() + 1) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
  }
  if (period === "month") date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatValue(value: Json | undefined): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "-";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "string") return categoryLabels[value] ?? roleLabels[value] ?? value;
  return "بيانات متعددة";
}

function actionLabel(action: string) {
  return actionLabels[action] ?? action;
}

function sectionLabel(log: AuditLog) {
  return entitySections[log.entityType] ?? log.entityType;
}

function userName(log: AuditLog) {
  return log.user?.fullName ?? log.user?.username ?? "مستخدم غير معروف";
}

function humanReference(log: AuditLog) {
  const newData = isRecord(log.newData) ? log.newData : {};
  const oldData = isRecord(log.oldData) ? log.oldData : {};
  const source = { ...oldData, ...newData };
  if (typeof source.payment_number === "number") return `PAY-${String(source.payment_number).padStart(6, "0")}`;
  if (typeof source.expense_number === "number") return `EXP-${String(source.expense_number).padStart(6, "0")}`;
  if (typeof source.purchase_number === "number") return `فاتورة شراء #${source.purchase_number}`;
  if (typeof source.request_number === "number") return `طلب شراء #${source.request_number}`;
  if (typeof source.employee_number === "number") return `عامل #${source.employee_number}`;
  if (typeof source.order_number === "number") return `طلب #${source.order_number}`;
  return null;
}

function logDescription(log: AuditLog) {
  const data = isRecord(log.newData) ? log.newData : {};
  const bits: string[] = [];
  if (typeof data.amount === "number") bits.push(formatCurrency(data.amount));
  if (typeof data.total_amount === "number") bits.push(formatCurrency(data.total_amount));
  if (typeof data.category === "string") bits.push(categoryLabels[data.category] ?? data.category);
  if (typeof data.item_count === "number") bits.push(`${data.item_count} مادة`);
  if (typeof data.status === "string") bits.push(`الحالة: ${data.status}`);
  if (typeof data.payment_status === "string") bits.push(`الدفع: ${data.payment_status}`);
  const reference = humanReference(log);
  return [reference, ...bits].filter(Boolean).join(" - ") || actionLabel(log.action);
}

function changedFields(log: AuditLog) {
  const oldData = isRecord(log.oldData) ? log.oldData : {};
  const newData = isRecord(log.newData) ? log.newData : {};
  const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
    .filter((key) => !key.endsWith("_id") && key !== "id" && key !== "created_at" && key !== "updated_at")
    .slice(0, 14);

  return keys.map((key) => ({
    label: fieldLabels[key] ?? key,
    before: formatValue(oldData[key]),
    after: formatValue(newData[key]),
  })).filter((item) => item.before !== item.after || item.after !== "-");
}

function AuditDetailsDialog({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const changes = changedFields(log);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3">
          <div>
            <p className="text-sm text-[#7c6b60]">تفاصيل العملية</p>
            <h2 className="text-xl font-semibold text-[#2f211c]">{actionLabel(log.action)}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]" aria-label="إغلاق"><X size={16} /></button>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="المستخدم" value={userName(log)} />
          <Detail label="الدور / القسم" value={`${roleLabels[log.user?.role ?? ""] ?? "-"} / ${sectionLabel(log)}`} />
          <Detail label="التاريخ والوقت" value={formatDateTime(log.createdAt)} />
          <Detail label="المرجع المرتبط" value={humanReference(log) ?? "-"} />
          <div className="sm:col-span-2"><Detail label="وصف العملية" value={logDescription(log)} /></div>
        </div>
        <div className="mt-5">
          <h3 className="mb-2 font-semibold text-[#2f211c]">التفاصيل</h3>
          {changes.length === 0 ? <p className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm text-[#7c6b60]">لا توجد تفاصيل إضافية مرتبة لهذه العملية.</p> : null}
          <div className="space-y-2">
            {changes.map((change) => (
              <div key={change.label} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
                <p className="font-semibold text-[#2f211c]">{change.label}</p>
                <p className="mt-1 text-[#7c6b60]">{change.before} → {change.after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
      <p className="text-xs text-[#7c6b60]">{label}</p>
      <p className="mt-1 font-semibold text-[#2f211c]">{value}</p>
    </div>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      setIsLoading(true);
      setError("");
      try {
        const nextLogs = await getAuditLogs(0, pageSize);
        if (!isMounted) return;
        setLogs(nextLogs);
        setPage(0);
        setHasMore(nextLogs.length === pageSize);
      } catch (loadError) {
        logSupabaseError("[admin audit load]", loadError);
        if (isMounted) setError("تعذر تحميل سجل العمليات.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadInitial();
    return () => { isMounted = false; };
  }, []);

  const filteredLogs = useMemo(() => {
    const start = periodStart(filters.period);
    const query = filters.search.trim().toLowerCase();
    return logs.filter((log) => {
      const logDay = dateKey(log.createdAt);
      if (start && logDay < start) return false;
      if (filters.user !== "all" && log.userId !== filters.user) return false;
      if (filters.section !== "all" && sectionLabel(log) !== filters.section) return false;
      if (filters.action !== "all" && log.action !== filters.action) return false;
      if (query) {
        const haystack = [userName(log), actionLabel(log.action), sectionLabel(log), logDescription(log), humanReference(log) ?? ""].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [filters, logs]);

  const today = dateKey(new Date().toISOString());
  const todayLogs = logs.filter((log) => dateKey(log.createdAt) === today);
  const users = Array.from(new Map(logs.filter((log) => log.userId).map((log) => [log.userId, userName(log)])).entries());
  const sections = Array.from(new Set(logs.map(sectionLabel)));
  const actions = Array.from(new Set(logs.map((log) => log.action)));

  async function loadMore() {
    setIsLoadingMore(true);
    setError("");
    try {
      const nextPage = page + 1;
      const nextLogs = await getAuditLogs(nextPage, pageSize);
      setLogs((current) => [...current, ...nextLogs]);
      setPage(nextPage);
      setHasMore(nextLogs.length === pageSize);
    } catch (loadError) {
      logSupabaseError("[admin audit load more]", loadError);
      setError("تعذر تحميل سجل العمليات.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm text-[#7c6b60]">لوحة الإدارة</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">سجل العمليات</h1>
        <p className="mt-2 text-sm text-[#7c6b60]">متابعة العمليات الإدارية والمالية والمخزنية المنفذة داخل النظام.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="عمليات اليوم" value={todayLogs.length} />
        <Kpi title="عمليات الحسابات اليوم" value={todayLogs.filter((log) => sectionLabel(log) === "الحسابات").length} />
        <Kpi title="عمليات المخزن اليوم" value={todayLogs.filter((log) => sectionLabel(log) === "المخزن").length} />
        <Kpi title="عمليات العمال اليوم" value={todayLogs.filter((log) => sectionLabel(log) === "العمال").length} />
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2f211c]"><Filter size={17} />الفلاتر</div>
        <div className="grid gap-3 md:grid-cols-5">
          <select value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value as AuditFilters["period"] }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل الفترات</option>
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
          </select>
          <select value={filters.user} onChange={(event) => setFilters((current) => ({ ...current, user: event.target.value }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل المستخدمين</option>
            {users.map(([id, name]) => <option key={id} value={id ?? ""}>{name}</option>)}
          </select>
          <select value={filters.section} onChange={(event) => setFilters((current) => ({ ...current, section: event.target.value }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل الأقسام</option>
            {sections.map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
          <select value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل العمليات</option>
            {actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}
          </select>
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="بحث نصي" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none" />
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eee4d8] p-4">
          <h2 className="font-semibold text-[#2f211c]">العمليات المسجلة</h2>
          {isLoading ? <span className="inline-flex items-center gap-2 text-sm text-[#7c6b60]"><Loader2 className="animate-spin" size={16} />جارٍ التحميل...</span> : null}
        </div>
        {error ? <p className="m-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {!isLoading && !error && filteredLogs.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد عمليات مسجلة حتى الآن.</p> : null}
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="bg-[#fbfaf7] text-[#7c6b60]">
                <tr>
                  <th className="px-3 py-3 font-medium">التاريخ والوقت</th>
                  <th className="px-3 py-3 font-medium">المستخدم</th>
                  <th className="px-3 py-3 font-medium">الدور / القسم</th>
                  <th className="px-3 py-3 font-medium">نوع العملية</th>
                  <th className="px-3 py-3 font-medium">الوصف</th>
                  <th className="px-3 py-3 font-medium">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#fffaf4]">
                    <td className="px-3 py-3 text-[#4a3b34]">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{userName(log)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{roleLabels[log.user?.role ?? ""] ?? "-"} / {sectionLabel(log)}</td>
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{actionLabel(log.action)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{logDescription(log)}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelectedLog(log)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Eye size={16} />عرض التفاصيل</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {hasMore ? (
          <div className="border-t border-[#eee4d8] p-4 text-center">
            <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] px-4 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6] disabled:opacity-50">
              {isLoadingMore ? <Loader2 className="animate-spin" size={16} /> : null}
              تحميل المزيد
            </button>
          </div>
        ) : null}
      </section>

      {selectedLog ? <AuditDetailsDialog log={selectedLog} onClose={() => setSelectedLog(null)} /> : null}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-[#2f211c]">{new Intl.NumberFormat("en-US").format(value)}</p>
    </section>
  );
}
