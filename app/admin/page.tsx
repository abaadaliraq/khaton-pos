"use client";

import { AlertTriangle, Activity, Table2, UserCheck, UserCog, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAdminMenu } from "@/services/adminMenuService";
import { getAdminTables } from "@/services/adminTableService";
import { getAuditLogs } from "@/services/auditService";
import { getStaffMembers } from "@/services/staffService";
import type { AuditLog } from "@/types/audit";

type ActivityPoint = {
  date: string;
  count: number;
};

const baghdadTimeZone = "Asia/Baghdad";

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  storekeeper: "مسؤول المخزن",
  captain: "كابتن",
  cashier: "كاشير",
  kitchen: "مطبخ",
  owner: "مالك",
};

const entitySections: Record<string, string> = {
  purchase_requests: "المخزن",
  purchases: "المخزن",
  suppliers: "الموردون",
  purchase_payments: "الحسابات",
  expenses: "الحسابات",
  staff_members: "العمال",
  menu_categories: "المنيو",
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

function getBaghdadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateInput(date);
}

function formatDateLabel(value: string, withWeekday = false) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "UTC",
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

function dateKey(value: string) {
  return getBaghdadDate(new Date(value));
}

function actionLabel(action: string) {
  return actionLabels[action] ?? action;
}

function sectionLabel(entityType: string) {
  return entitySections[entityType] ?? entityType;
}

function KpiCard({ title, value, helper, icon: Icon }: { title: string; value: string; helper: string; icon: typeof Activity }) {
  return (
    <article className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
      <p className="mt-2 text-xs text-[#9a8779]">{helper}</p>
    </article>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed border-[#e4d8c8] bg-[#fbfaf7] p-5 text-center text-sm text-[#7c6b60]">{message}</div>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="h-4 w-28 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-8 w-20 rounded bg-[#efe7dc]" />
          </div>
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
    </div>
  );
}

function OperationsAlerts({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-amber-800">
        <AlertTriangle size={18} />
        <h2 className="font-semibold">حالة التشغيل</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {alerts.map((alert) => (
          <div key={alert} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-[#4a3b34]">{alert}</div>
        ))}
      </div>
    </section>
  );
}

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const maxCount = Math.max(...data.map((point) => point.count), 0);

  if (data.length === 0) {
    return <EmptyPanel message="لا توجد عمليات مسجلة خلال آخر 7 أيام." />;
  }

  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#2f211c]">نشاط النظام - آخر 7 أيام</h2>
        <p className="mt-1 text-sm text-[#7c6b60]">عدد العمليات المسجلة في سجل النظام حسب يوم بغداد.</p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[520px] items-end gap-2 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-4">
          {data.map((point) => {
            const height = maxCount > 0 ? Math.max(8, Math.round((point.count / maxCount) * 150)) : 8;
            return (
              <div key={point.date} className="flex min-w-10 flex-1 flex-col items-center gap-2" title={formatDateLabel(point.date, true) + " - " + formatNumber(point.count)}>
                <div className="flex h-40 w-full items-end justify-center">
                  <div className="w-full max-w-8 rounded-t-md bg-[#a65f3f]" style={{ height }} />
                </div>
                <span className="font-semibold text-[#2f211c]">{formatNumber(point.count)}</span>
                <span className="h-8 text-center text-[11px] leading-4 text-[#7c6b60]">{formatDateLabel(point.date, true)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AuditTable({ logs }: { logs: AuditLog[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4">
        <h2 className="font-semibold text-[#2f211c]">آخر العمليات</h2>
      </div>
      {logs.length === 0 ? <div className="p-4"><EmptyPanel message="لا توجد عمليات مسجلة حالياً." /></div> : null}
      {logs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr>
                <th className="px-3 py-3 font-semibold">المستخدم</th>
                <th className="px-3 py-3 font-semibold">الدور</th>
                <th className="px-3 py-3 font-semibold">العملية</th>
                <th className="px-3 py-3 font-semibold">القسم</th>
                <th className="px-3 py-3 font-semibold">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#fffaf4]">
                  <td className="px-3 py-3 font-medium text-[#2f211c]">{log.user?.fullName ?? log.user?.username ?? "النظام"}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{log.user ? roleLabels[log.user.role] ?? log.user.role : "-"}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{actionLabel(log.action)}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{sectionLabel(log.entityType)}</td>
                  <td className="px-3 py-3 text-[#7c6b60]">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function AdminPage() {
  const today = useMemo(() => getBaghdadDate(), []);
  const activityFrom = useMemo(() => addDays(today, -6), [today]);
  const [activeStaffCount, setActiveStaffCount] = useState(0);
  const [systemAccountCount, setSystemAccountCount] = useState(0);
  const [activeMenuItemCount, setActiveMenuItemCount] = useState(0);
  const [unavailableOrZeroPriceCount, setUnavailableOrZeroPriceCount] = useState(0);
  const [zeroPriceCount, setZeroPriceCount] = useState(0);
  const [unavailableItemCount, setUnavailableItemCount] = useState(0);
  const [staffWithoutAccountsCount, setStaffWithoutAccountsCount] = useState(0);
  const [occupiedTableCount, setOccupiedTableCount] = useState(0);
  const [availableTableCount, setAvailableTableCount] = useState(0);
  const [disabledTableCount, setDisabledTableCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activityPoints, setActivityPoints] = useState<ActivityPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [staff, menu, tables, logs] = await Promise.all([
          getStaffMembers(),
          getAdminMenu(),
          getAdminTables(),
          getAuditLogs(0, 50),
        ]);

        if (!isMounted) return;

        const activeStaff = staff.filter((member) => member.status === "active");
        const menuItemsWithIssues = menu.items.filter((item) => !item.isAvailable || (item.price ?? 0) <= 0);
        const unavailableItems = menu.items.filter((item) => !item.isAvailable);
        const zeroPriceItems = menu.items.filter((item) => (item.price ?? 0) <= 0);
        const disabledTables = tables.filter((table) => !table.isActive);
        const occupiedTables = tables.filter((table) => table.isActive && (table.status === "occupied" || Boolean(table.currentOrder)));
        const availableTables = tables.filter((table) => table.isActive && table.status === "available" && !table.currentOrder);
        const accountLinkedStaff = staff.filter((member) => member.hasSystemAccess && Boolean(member.profileId));
        const activeStaffWithoutAccounts = activeStaff.filter((member) => !member.hasSystemAccess || !member.profileId);
        const countsByDate = new Map(logs.map((log) => [dateKey(log.createdAt), 0]));
        const days = Array.from({ length: 7 }, (_, index) => addDays(activityFrom, index));

        days.forEach((day) => countsByDate.set(day, 0));
        logs.forEach((log) => {
          const key = dateKey(log.createdAt);
          if (key >= activityFrom && key <= today) {
            countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
          }
        });

        setActiveStaffCount(activeStaff.length);
        setSystemAccountCount(accountLinkedStaff.length);
        setActiveMenuItemCount(menu.items.filter((item) => item.isAvailable && (item.price ?? 0) > 0).length);
        setUnavailableOrZeroPriceCount(menuItemsWithIssues.length);
        setUnavailableItemCount(unavailableItems.length);
        setZeroPriceCount(zeroPriceItems.length);
        setStaffWithoutAccountsCount(activeStaffWithoutAccounts.length);
        setOccupiedTableCount(occupiedTables.length);
        setAvailableTableCount(availableTables.length);
        setDisabledTableCount(disabledTables.length);
        setAuditLogs(logs.slice(0, 10));
        setActivityPoints(days.map((day) => ({ date: day, count: countsByDate.get(day) ?? 0 })));
        setErrorMessage("");
      } catch (error) {
        console.error("Failed to load admin operations dashboard", error);
        if (!isMounted) return;
        setErrorMessage("تعذر تحميل مؤشرات تشغيل النظام.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [activityFrom, today]);

  const alerts = useMemo(() => {
    const nextAlerts: string[] = [];
    if (unavailableItemCount > 0) nextAlerts.push(`${formatNumber(unavailableItemCount)} أصناف منيو غير متاحة`);
    if (zeroPriceCount > 0) nextAlerts.push(`${formatNumber(zeroPriceCount)} أصناف بسعر 0`);
    if (staffWithoutAccountsCount > 0) nextAlerts.push(`${formatNumber(staffWithoutAccountsCount)} موظفين بدون حساب نظام`);
    if (disabledTableCount > 0) nextAlerts.push(`${formatNumber(disabledTableCount)} طاولات معطلة`);
    return nextAlerts;
  }, [disabledTableCount, staffWithoutAccountsCount, unavailableItemCount, zeroPriceCount]);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">مدير النظام</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">System Operations Dashboard</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">نظرة تشغيلية على المستخدمين، المنيو، الطاولات، وسجل عمليات النظام.</p>
      </section>

      {errorMessage ? <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{errorMessage}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="الموظفون الفعالون" value={formatNumber(activeStaffCount)} helper="سجلات العمال بحالة نشط" icon={UserCheck} />
            <KpiCard title="حسابات النظام المرتبطة" value={formatNumber(systemAccountCount)} helper="موظفون لديهم حساب نظام مرتبط" icon={UserCog} />
            <KpiCard title="أصناف المنيو الفعالة" value={formatNumber(activeMenuItemCount)} helper="متاحة وبسعر أعلى من 0" icon={Utensils} />
            <KpiCard title="أصناف غير جاهزة للبيع" value={formatNumber(unavailableOrZeroPriceCount)} helper="غير متاحة أو سعرها 0" icon={AlertTriangle} />
            <KpiCard title="الطاولات المشغولة" value={formatNumber(occupiedTableCount)} helper="طاولات فعالة عليها طلب مفتوح" icon={Table2} />
            <KpiCard title="الطاولات المتاحة" value={formatNumber(availableTableCount)} helper="طاولات فعالة جاهزة للاستخدام" icon={Table2} />
            <KpiCard title="الطاولات المعطلة" value={formatNumber(disabledTableCount)} helper="طاولات غير فعالة" icon={Table2} />
          </section>

          <OperationsAlerts alerts={alerts} />
          <ActivityChart data={activityPoints} />
          <AuditTable logs={auditLogs} />
        </>
      )}
    </div>
  );
}
