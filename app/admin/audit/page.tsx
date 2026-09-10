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
  owner: "المالك",
  accountant: "محاسب",
  storekeeper: "مسؤول المخزن",
  captain: "كابتن",
  cashier: "كاشير",
  kitchen: "مطبخ",
  barista: "باريستا",
};

const entitySections: Record<string, string> = {
  inventory_requisitions: "المخزن",
  inventory_requisition_items: "المخزن",
  inventory_waste_reports: "المخزن",
  inventory_waste_items: "المخزن",
  inventory_movements: "المخزن",
  purchase_requests: "المخزن",
  purchases: "المخزن",
  suppliers: "الموردون",
  purchase_payments: "الحسابات",
  expenses: "الحسابات",
  cash_shifts: "الحسابات",
  cash_movements: "الحسابات",
  staff_members: "العمال",
  profiles: "المستخدمون",
  menu_items: "المنيو",
  menu_categories: "المنيو",
  restaurant_tables: "الطاولات",
  table_sessions: "الطاولات",
  orders: "الطلبات",
  order_items: "الطلبات",
  payments: "الكاشير",
  report_snapshots: "التقارير",
  equipment_assets: "المعدات",
  equipment_maintenance_records: "الصيانة",
};

const actionLabels: Record<string, string> = {
  create_order: "إنشاء طلب",
  update_kitchen_status: "تحديث حالة المطبخ",
  update_station_order_items_status: "تحديث حالة تحضير الطلب",
  apply_discount: "تطبيق خصم",
  record_payment: "تسجيل دفع طلب",
  record_table_payment: "تسجيل دفع طاولة",
  close_paid_table: "إغلاق طاولة مدفوعة",
  create_staff_member: "إضافة عامل",
  update_staff_member: "تعديل عامل",
  update_staff_status: "تغيير حالة عامل",
  update_staff_system_access: "تغيير صلاحية نظام",
  link_staff_system_profile: "إنشاء حساب نظام",
  set_menu_item_inventory_tracking: "تفعيل/تعطيل خصم المخزون",
  create_inventory_requisition: "إنشاء طلب مواد",
  approve_inventory_requisition: "الموافقة على طلب مواد",
  reject_inventory_requisition: "رفض طلب مواد",
  decide_inventory_requisition: "اتخاذ قرار طلب مواد",
  issue_inventory_requisition: "صرف مواد",
  confirm_inventory_requisition_receipt: "تأكيد استلام المواد",
  requisition_created: "إنشاء طلب مواد",
  requisition_approved: "الموافقة على طلب مواد",
  requisition_rejected: "رفض طلب مواد",
  requisition_cancelled: "إلغاء طلب مواد",
  requisition_issued: "صرف مواد",
  requisition_received: "تأكيد استلام المواد",
  inventory_waste_created: "تسجيل هدر وتلف",
  post_inventory_waste: "تسجيل هدر وتلف",
  open_cash_shift: "فتح وردية صندوق",
  close_cash_shift: "إغلاق وردية صندوق",
  create_purchase_request: "إنشاء طلب شراء",
  decide_purchase_request: "اتخاذ قرار طلب شراء",
  "الموافقة على طلب شراء": "الموافقة على طلب شراء",
  "رفض طلب شراء": "رفض طلب شراء",
  create_inventory_purchase: "تسجيل شراء / استلام",
  pay_purchase: "تسجيل دفعة مورد",
  report_snapshot_created: "حفظ تقرير",
  equipment_created: "إضافة معدة",
  equipment_updated: "تعديل معدة",
  equipment_status_changed: "تغيير حالة معدة",
  maintenance_reported: "تسجيل صيانة",
  maintenance_started: "بدء صيانة",
  maintenance_completed: "إكمال صيانة",
};

const fieldLabels: Record<string, string> = {
  id: "المعرف",
  status: "الحالة",
  payment_status: "حالة الدفع",
  issued_at: "وقت الصرف",
  issued_by: "تم الصرف بواسطة",
  approved_at: "وقت الموافقة",
  approved_by: "تمت الموافقة بواسطة",
  requested_at: "وقت الطلب",
  requested_by: "مقدم الطلب",
  received_at: "وقت الاستلام",
  received_by: "تم الاستلام بواسطة",
  destination: "القسم المستلم",
  created_at: "وقت الإنشاء",
  updated_at: "وقت التحديث",
  cashier_id: "الكاشير",
  opened_by: "فتح الوردية بواسطة",
  closed_by: "أغلق الوردية بواسطة",
  opened_at: "وقت فتح الوردية",
  closed_at: "وقت إغلاق الوردية",
  opening_cash: "الرصيد الافتتاحي",
  counted_cash: "النقد المعدود",
  expected_cash_snapshot: "الرصيد المتوقع",
  cash_difference: "فرق الصندوق",
  amount: "المبلغ",
  total_amount: "المبلغ",
  quantity: "الكمية",
  quantity_base: "الكمية الأساسية",
  quantity_delta: "فرق الكمية",
  unit: "الوحدة",
  unit_id: "الوحدة",
  unit_code: "الوحدة",
  notes: "الملاحظات",
  category: "التصنيف",
  expense_date: "تاريخ المصروف",
  payment_method: "طريقة الدفع",
  item_count: "عدد المواد",
  reason: "السبب",
  supplier_id: "المورد",
  inventory_item_id: "المادة",
  order_id: "الطلب",
  table_session_id: "جلسة الطاولة",
  purchase_id: "عملية الشراء",
  purchase_request_id: "طلب الشراء",
  request_number: "رقم الطلب",
  decision_by: "صاحب القرار",
  decision_at: "وقت القرار",
  decision_notes: "ملاحظات القرار",
  rejection_reason: "سبب الرفض",
  requisition_id: "طلب المواد",
  report_type: "نوع التقرير",
  period_type: "الفترة",
  period_start: "بداية الفترة",
  period_end: "نهاية الفترة",
  version: "الإصدار",
  full_name: "الاسم",
  username: "اسم المستخدم",
  role: "الدور",
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

const statusLabels: Record<string, string> = {
  requested: "بانتظار المراجعة",
  pending: "بانتظار الإجراء",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  issued: "تم الصرف",
  received: "تم الاستلام",
  submitted: "تم الإرسال",
  preparing: "قيد التحضير",
  ready: "جاهز",
  served: "تم التقديم",
  awaiting_payment: "بانتظار الدفع",
  paid: "مدفوع",
  cancelled: "ملغى",
  open: "مفتوحة",
  closed: "مغلقة",
  voided: "ملغي",
  completed: "مكتمل",
};

const destinationLabels: Record<string, string> = {
  kitchen: "المطبخ",
  barista: "الباريستا",
  bar: "البار",
  service: "الخدمة",
  cleaning: "التنظيف",
  management: "الإدارة",
  admin: "الإدارة",
  other: "أخرى",
};

const unitLabels: Record<string, string> = {
  g: "غرام",
  kg: "كيلوغرام",
  ml: "مل",
  l: "لتر",
  piece: "قطعة",
  pack: "علبة",
  packet: "باكيت",
  jar: "برطمان",
  bottle: "قنينة",
  box: "صندوق",
};

const paymentLabels: Record<string, string> = {
  cash: "نقد",
  card: "بطاقة",
  transfer: "تحويل",
};

const wasteLabels: Record<string, string> = {
  warehouse: "هدر مخزن",
  issued_department: "هدر قسم",
  spoiled: "تلف",
  expired: "انتهاء صلاحية",
  damaged: "تضرر",
  contaminated: "تلوث",
  broken: "كسر",
  preparation_error: "خطأ في التحضير",
  overproduction: "إنتاج زائد",
  oil_disposal: "التخلص من الزيت",
  other: "أخرى",
};

const itemTypeLabels: Record<string, string> = {
  food_recipe: "مادة وصفة",
  food_indirect: "مادة غذائية غير مباشرة",
  packaging: "تغليف",
  cleaning: "مواد تنظيف",
  operational_consumable: "مستهلك تشغيلي",
};

const sourceLabels: Record<string, string> = {
  inventory_requisition: "طلب مواد",
  inventory_waste_report: "هدر وتلف",
  purchase: "شراء",
  purchase_request: "طلب شراء",
  cash_shift: "وردية صندوق",
  order: "طلب",
  payment: "دفع",
};

function formatDateTime(value: string) {
  return formatDateAndTimeParts(value).value;
}

function formatDateAndTimeParts(value: string) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return { date: "—", time: "—", value: "—" };
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: baghdadTimeZone }).format(parsedDate);
  const timeParts = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: baghdadTimeZone }).formatToParts(parsedDate);
  const hour = timeParts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = timeParts.find((part) => part.type === "minute")?.value ?? "00";
  const period = timeParts.find((part) => part.type === "dayPeriod")?.value === "PM" ? "م" : "ص";
  const time = `${hour}:${minute} ${period}`;
  return { date, time, value: `${date} — ${time}` };
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isIsoTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00+03:00`));
}

function formatValue(value: Json | undefined, key: string, references: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (key.includes("amount") || key.includes("cash") || key.includes("cost") || key.includes("difference")) return formatCurrency(value);
    return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "—";
  }
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "string") {
    if (references[value]) return references[value];
    if (isUuid(value)) return "مرجع غير معروف";
    if (isIsoTimestamp(value)) return formatDateAndTimeParts(value).value;
    if (isDateOnly(value)) return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: baghdadTimeZone }).format(new Date(`${value}T00:00:00+03:00`));
    if (key.includes("payment_method") || key === "method") return paymentLabels[value] ?? value;
    if (key.includes("unit")) return unitLabels[value] ?? value;
    if (key === "status" || key.endsWith("_status")) return statusLabels[value] ?? value;
    if (key === "destination" || key === "department") return destinationLabels[value] ?? value;
    if (key === "reason" || key === "context") return wasteLabels[value] ?? value;
    if (key === "item_type") return itemTypeLabels[value] ?? value;
    const mapped = categoryLabels[value] ?? roleLabels[value] ?? statusLabels[value] ?? destinationLabels[value] ?? paymentLabels[value] ?? wasteLabels[value] ?? itemTypeLabels[value] ?? sourceLabels[value];
    if (mapped) return mapped;
    if (/^[a-z]+(?:_[a-z0-9]+)+$/i.test(value)) return "قيمة غير مصنفة";
    return value;
  }
  if (Array.isArray(value)) return value.length === 0 ? "—" : `${value.length} عناصر`;
  return "بيانات متعددة";
}

function actionLabel(action: string) {
  if (actionLabels[action]) return actionLabels[action];
  if (/[\u0600-\u06FF]/.test(action)) return action;
  return "عملية غير مصنفة";
}

function sectionLabel(log: AuditLog) {
  return entitySections[log.entityType] ?? "قسم آخر";
}

function userName(log: AuditLog) {
  return log.user?.fullName ?? log.user?.username ?? "مستخدم غير معروف";
}

function humanReference(log: AuditLog) {
  const newData = isRecord(log.newData) ? log.newData : {};
  const oldData = isRecord(log.oldData) ? log.oldData : {};
  const source = { ...oldData, ...newData };
  if (log.entityId && log.references[log.entityId]) return log.references[log.entityId];
  if (typeof source.payment_number === "number") return `PAY-${String(source.payment_number).padStart(6, "0")}`;
  if (typeof source.expense_number === "number") return `EXP-${String(source.expense_number).padStart(6, "0")}`;
  if (typeof source.purchase_number === "number") return `فاتورة شراء #${source.purchase_number}`;
  if (typeof source.request_number === "number") return `REQ-${String(source.request_number).padStart(4, "0")}`;
  if (typeof source.report_number === "number") return `WST-${String(source.report_number).padStart(4, "0")}`;
  if (typeof source.employee_number === "number") return `عامل #${source.employee_number}`;
  if (typeof source.order_number === "number") return `طلب #${source.order_number}`;
  if (log.entityId && isUuid(log.entityId)) return "مرجع غير معروف";
  return null;
}

function logDescription(log: AuditLog) {
  const data = isRecord(log.newData) ? log.newData : {};
  const bits: string[] = [];
  if (typeof data.amount === "number") bits.push(formatCurrency(data.amount));
  if (typeof data.total_amount === "number") bits.push(formatCurrency(data.total_amount));
  if (typeof data.category === "string") bits.push(categoryLabels[data.category] ?? data.category);
  if (typeof data.item_count === "number") bits.push(`${data.item_count} مادة`);
  if (typeof data.status === "string") bits.push(`الحالة: ${formatValue(data.status, "status", log.references)}`);
  if (typeof data.payment_status === "string") bits.push(`الدفع: ${formatValue(data.payment_status, "payment_status", log.references)}`);
  if (typeof data.destination === "string") bits.push(`القسم: ${formatValue(data.destination, "destination", log.references)}`);
  const reference = humanReference(log);
  return [reference, ...bits].filter(Boolean).join(" - ") || actionLabel(log.action);
}

function changedFields(log: AuditLog) {
  const oldData = isRecord(log.oldData) ? log.oldData : {};
  const newData = isRecord(log.newData) ? log.newData : {};
  const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
    .filter((key) => key !== "id" && key !== "raw_user_meta_data" && key !== "encrypted_password")
    .filter((key) => {
      const before = formatValue(oldData[key], key, log.references);
      const after = formatValue(newData[key], key, log.references);
      return before !== after || after !== "—";
    });

  return keys.map((key) => ({
    key,
    label: fieldLabels[key] ?? "حقل آخر",
    before: formatValue(oldData[key], key, log.references),
    after: formatValue(newData[key], key, log.references),
  }));
}

function AuditDetailsDialog({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const changes = changedFields(log);
  const createdAt = formatDateAndTimeParts(log.createdAt);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-md border border-[#c9b8a6] bg-[#fffdf8] shadow-xl" dir="rtl">
        <div className="flex items-center justify-between gap-3 border-b border-[#c9b8a6] bg-[#f0e7dc] px-5 py-4">
          <div>
            <p className="text-sm font-bold text-[#7c6b60]">تفاصيل العملية</p>
            <h2 className="text-xl font-black text-[#181818]">{actionLabel(log.action)}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#c9b8a6] bg-[#fffdf8] p-2 text-[#181818]" aria-label="إغلاق"><X size={16} /></button>
        </div>
        <div className="max-h-[74vh] overflow-auto p-5">
          <div className="overflow-x-auto border border-[#c9b8a6]">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <tbody>
                <tr className="bg-[#efe2d3]">
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">نوع العملية</th>
                  <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{actionLabel(log.action)}</td>
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">المرجع</th>
                  <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{humanReference(log) ?? "—"}</td>
                </tr>
                <tr className="bg-[#fffdf8]">
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">التاريخ</th>
                  <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{createdAt.date}</td>
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">الوقت</th>
                  <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{createdAt.time}</td>
                </tr>
                <tr className="bg-[#f7f1ea]">
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">المستخدم</th>
                  <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{userName(log)}</td>
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">الدور / القسم</th>
                  <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{roleLabels[log.user?.role ?? ""] ?? "—"} / {sectionLabel(log)}</td>
                </tr>
                <tr className="bg-[#fffdf8]">
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black text-[#181818]">الملخص</th>
                  <td colSpan={3} className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{logDescription(log)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3 className="mb-2 mt-5 font-black text-[#181818]">التغييرات</h3>
          <div className="max-h-[42vh] overflow-auto border border-[#c9b8a6]">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-[#e8dccd] text-[#181818]">
                <tr>
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black">الحقل</th>
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black">القيمة السابقة</th>
                  <th className="border border-[#c9b8a6] px-3 py-2 text-right font-black">القيمة الجديدة</th>
                </tr>
              </thead>
              <tbody>
                {changes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border border-[#c9b8a6] bg-[#fffdf8] px-3 py-5 text-center font-bold text-[#51483f]">لا توجد تفاصيل إضافية مرتبة لهذه العملية.</td>
                  </tr>
                ) : null}
                {changes.map((change, index) => (
                  <tr key={change.key} className={index % 2 === 0 ? "bg-[#fffdf8]" : "bg-[#f7f1ea]"}>
                    <td className="border border-[#c9b8a6] px-3 py-2 font-black text-[#181818]">{change.label}</td>
                    <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#3a312a]">{change.before}</td>
                    <td className="border border-[#c9b8a6] px-3 py-2 font-bold text-[#181818]">{change.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
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
            <table className="w-full min-w-[1040px] text-right text-sm">
              <thead className="bg-[#fbfaf7] text-[#7c6b60]">
                <tr>
                  <th className="px-3 py-3 font-medium">التاريخ والوقت</th>
                  <th className="px-3 py-3 font-medium">نوع العملية</th>
                  <th className="px-3 py-3 font-medium">المستخدم</th>
                  <th className="px-3 py-3 font-medium">الدور / القسم</th>
                  <th className="px-3 py-3 font-medium">المرجع</th>
                  <th className="px-3 py-3 font-medium">الملخص</th>
                  <th className="px-3 py-3 font-medium">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#fffaf4]">
                    <td className="px-3 py-3 text-[#4a3b34]">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{actionLabel(log.action)}</td>
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{userName(log)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{roleLabels[log.user?.role ?? ""] ?? "-"} / {sectionLabel(log)}</td>
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{humanReference(log) ?? "—"}</td>
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
