"use client";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { getAdminSalesReport } from "@/services/adminReportService";
import { getCashShiftMovementSummaries, getExpenses, getRecentCashShifts } from "@/services/financeService";
import { getInventoryAnalytics } from "@/services/inventoryAnalyticsService";
import { getInventoryOverview } from "@/services/inventoryService";
import { getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import { getInventoryWasteReports } from "@/services/inventoryWasteService";
import { getPurchasePayments, getPurchaseRequests, getPurchases } from "@/services/purchaseService";
import type { ExpensePaymentMethod } from "@/types/finance";
import type { InventoryItem, InventoryItemType, InventoryMovementType, InventoryRequisitionDestination, InventoryUnitCode, InventoryWasteContext, InventoryWasteReason } from "@/types/inventory";
import type { GeneratedReport, ReportPeriodType, ReportRange, ReportSection, ReportSnapshot, ReportTableColumn, ReportTableRow, ReportType } from "@/types/reports";

type JsonRecord = Record<string, unknown>;
type ProfileNameRow = { full_name: string | null; username: string | null };

type PaymentRow = {
  id: string;
  order_id: string;
  method: ExpensePaymentMethod;
  amount: number | string;
  status: "completed" | "voided";
  reference: string | null;
  created_at: string;
  order: { order_number: number | null } | null;
  cashier_profile: ProfileNameRow | null;
};

type RestaurantTableReportRow = {
  id: string;
  table_number: number;
  name: string | null;
  status: "available" | "occupied" | "cleaning";
  is_active: boolean;
};

type TableSessionReportRow = {
  id: string;
  table_id: string;
  captain_id: string;
  status: "active" | "closed";
  opened_at: string;
  closed_at: string | null;
  captain_profile: ProfileNameRow | null;
};

type TableOrderReportRow = {
  id: string;
  order_number: number;
  table_session_id: string | null;
  round_no: number | null;
  captain_id: string;
  status: "draft" | "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid" | "cancelled";
  total: number | string;
  opened_at: string;
  submitted_at: string | null;
  paid_at: string | null;
  payments: { amount: number | string; status: "completed" | "voided" }[] | null;
  order_items: { quantity: number | string }[] | null;
};

type TablePerformancePayloadRow = {
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  tableName: string | null;
  tableStatus: string;
  sessionCount: number;
  completedSessionCount: number;
  activeSessionCount: number;
  orderCount: number;
  additionalOrderCount: number;
  paidSales: number;
  averageSessionValue: number;
  averageDurationMinutes: number | null;
  firstUseAt: string | null;
  lastUseAt: string | null;
  lastPreviousUseAt: string | null;
  note: string;
};

type TablePerformanceSessionDetail = {
  sessionId: string;
  tableId: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  durationMinutes: number | null;
  orderCount: number;
  additionalOrderCount: number;
  paidSales: number;
  captainName: string;
  orders: {
    orderId: string;
    roundNo: number;
    orderNumber: number;
    itemCount: number;
    total: number;
    paidSales: number;
    status: string;
  }[];
};

type SnapshotRow = {
  id: string;
  report_number: number;
  report_reference: string;
  report_type: ReportType;
  period_type: ReportPeriodType;
  period_start: string;
  period_end: string;
  business_timezone: string;
  generated_at: string;
  generated_by_profile: ProfileNameRow | null;
  version: number;
  schema_version: number;
  calculation_version: string;
  summary: JsonRecord;
  payload: JsonRecord;
  created_at: string;
};

const baghdadTimeZone = "Asia/Baghdad";
const calculationVersion = "reports_phase_1_v1" as const;
const tablePerformanceCalculationVersion = "reports_phase_2_table_performance_v1" as const;

const reportTitles: Record<ReportType, string> = {
  financial: "تقرير الحسابات",
  inventory: "تقرير المخزن",
  material_consumption: "تقرير استهلاك المواد",
  waste: "تقرير الهدر والتلف",
  purchases: "تقرير المشتريات",
  cash_shifts: "تقرير ورديات الصندوق",
  table_performance: "تقرير أداء الطاولات",
};

export const reportTypeLabels: Record<ReportType, string> = {
  financial: "الحسابات",
  inventory: "المخزن",
  material_consumption: "استهلاك المواد",
  waste: "الهدر والتلف",
  purchases: "المشتريات",
  cash_shifts: "ورديات الصندوق",
  table_performance: "أداء الطاولات",
};

export const periodTypeLabels: Record<ReportPeriodType, string> = {
  daily: "اليوم",
  weekly: "هذا الأسبوع",
  monthly: "هذا الشهر",
  yearly: "هذه السنة",
  custom: "فترة مخصصة",
};

export const itemTypeLabels: Record<InventoryItemType, string> = {
  food_recipe: "مادة وصفة",
  food_indirect: "مادة غذائية غير مباشرة",
  packaging: "تغليف",
  cleaning: "مواد تنظيف",
  operational_consumable: "مستهلك تشغيلي",
};

const unitLabels: Record<InventoryUnitCode, string> = {
  g: "غرام",
  kg: "كيلوغرام",
  ml: "مل",
  l: "لتر",
  piece: "قطعة",
  pack: "علبة",
  bottle: "قنينة",
};

const destinationLabels: Record<InventoryRequisitionDestination, string> = {
  kitchen: "المطبخ",
  barista: "الباريستا",
  bar: "البار",
  service: "الخدمة",
  cleaning: "التنظيف",
  management: "الإدارة",
  other: "أخرى",
};

const wasteContextLabels: Record<InventoryWasteContext, string> = {
  warehouse: "هدر مخزن",
  issued_department: "هدر قسم",
};

const wasteReasonLabels: Record<InventoryWasteReason, string> = {
  expired: "انتهاء صلاحية",
  spoiled: "تلف",
  damaged: "ضرر",
  contaminated: "تلوث",
  broken: "كسر",
  preparation_error: "خطأ تحضير",
  overproduction: "إنتاج زائد",
  oil_disposal: "التخلص من زيت مستخدم",
  other: "أخرى",
};

const movementLabels: Record<InventoryMovementType, string> = {
  opening_balance: "رصيد افتتاحي",
  adjustment_in: "تسوية داخلة",
  adjustment_out: "تسوية خارجة",
  purchase: "شراء",
  consumption: "استهلاك وصفة",
  waste: "هدر مخزن",
  return: "مرتجع",
  stock_issue: "صرف داخلي",
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileName(profile: ProfileNameRow | null | undefined) {
  return profile?.full_name ?? profile?.username ?? "مستخدم غير معروف";
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: baghdadTimeZone }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatQuantity(value: number, unit: InventoryUnitCode) {
  return `${formatNumber(value)} ${unitLabels[unit]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: baghdadTimeZone, dateStyle: "short" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: baghdadTimeZone, timeStyle: "short" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return `${formatDate(value)} ${formatTime(value)}`;
}

function formatMethod(method: ExpensePaymentMethod | "-") {
  if (method === "cash") return "نقد";
  if (method === "card") return "بطاقة";
  if (method === "transfer") return "تحويل";
  return "-";
}

function formatSource(source: string) {
  if (source === "payments") return "مدفوعات الزبائن";
  if (source === "expenses") return "المصروفات";
  if (source === "purchases") return "المشتريات";
  if (source === "purchase_payments") return "دفعات الموردين";
  if (source === "cash_movements") return "حركات الصندوق";
  if (source === "inventory_movements") return "حركات المخزون";
  return source;
}

function formatDestinationKey(destination: string | undefined) {
  if (!destination || destination === "warehouse") return "المخزن";
  return destinationLabels[destination as InventoryRequisitionDestination] ?? destination;
}

function todayKey() {
  return localDate(new Date().toISOString());
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(dateKey: string) {
  return dateKey.slice(0, 8) + "01";
}

function startOfYear(dateKey: string) {
  return dateKey.slice(0, 4) + "-01-01";
}

function endOfYear(dateKey: string) {
  return dateKey.slice(0, 4) + "-12-31";
}

function endOfMonth(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function resolveReportRange(periodType: ReportPeriodType, customStart?: string, customEnd?: string): ReportRange {
  const today = todayKey();
  if (periodType === "daily") return { periodType, startDate: today, endDate: today, timezone: baghdadTimeZone };
  if (periodType === "weekly") {
    const start = startOfWeek(today);
    return { periodType, startDate: start, endDate: addDays(start, 6), timezone: baghdadTimeZone };
  }
  if (periodType === "monthly") return { periodType, startDate: startOfMonth(today), endDate: endOfMonth(today), timezone: baghdadTimeZone };
  if (periodType === "yearly") return { periodType, startDate: startOfYear(today), endDate: endOfYear(today), timezone: baghdadTimeZone };
  return { periodType, startDate: customStart || today, endDate: customEnd || customStart || today, timezone: baghdadTimeZone };
}

function rangeToIso(range: ReportRange) {
  return {
    start: `${range.startDate}T00:00:00+03:00`,
    endExclusive: `${addDays(range.endDate, 1)}T00:00:00+03:00`,
  };
}

function inRangeByDateTime(value: string, range: ReportRange) {
  const key = localDate(value);
  return key >= range.startDate && key <= range.endDate;
}

function inRangeByDate(value: string | null | undefined, range: ReportRange) {
  return Boolean(value && value >= range.startDate && value <= range.endDate);
}

function stockStatus(item: InventoryItem) {
  if (!item.isActive) return "inactive";
  if (item.stockOnHand <= 0) return "out";
  if (item.stockOnHand <= item.minimumStock) return "low";
  return "available";
}

function makeReport(reportType: ReportType, range: ReportRange, summary: Record<string, string | number>, columns: ReportTableColumn[], rows: ReportTableRow[], payload: Record<string, unknown>, notes: string[], sections: ReportSection[] = [], version: string = calculationVersion): GeneratedReport {
  return {
    reportType,
    title: reportTitles[reportType],
    range,
    mode: "live",
    generatedAt: new Date().toISOString(),
    summary,
    columns,
    rows,
    sections,
    payload,
    calculationVersion: version,
    notes,
  };
}

async function getCompletedPayments(range: ReportRange) {
  const supabase = createClient();
  const { start, endExclusive } = rangeToIso(range);
  const { data, error } = await supabase
    .from("payments" as never)
    .select("id, order_id, method, amount, status, reference, created_at, order:orders(order_number), cashier_profile:profiles!payments_cashier_id_fkey(full_name, username)")
    .eq("status", "completed")
    .gte("created_at", start)
    .lt("created_at", endExclusive)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PaymentRow[];
}

function tableLabel(table: Pick<RestaurantTableReportRow, "table_number">) {
  return `طاولة ${table.table_number}`;
}

function tableStatusLabel(status: RestaurantTableReportRow["status"], isActive: boolean) {
  if (!isActive) return "معطلة";
  if (status === "available") return "متاحة";
  if (status === "occupied") return "مشغولة";
  return "تنظيف";
}

function orderStatusLabel(status: TableOrderReportRow["status"]) {
  const labels: Record<TableOrderReportRow["status"], string> = {
    draft: "مسودة",
    submitted: "مرسل",
    preparing: "قيد التحضير",
    ready: "جاهز",
    served: "تم التقديم",
    awaiting_payment: "بانتظار الدفع",
    paid: "مدفوع",
    cancelled: "ملغى",
  };
  return labels[status];
}

function sessionStatusLabel(status: TableSessionReportRow["status"]) {
  return status === "closed" ? "مغلقة" : "نشطة";
}

function formatDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "-";
  if (minutes < 60) return `${Math.round(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining > 0 ? `${hours} ساعة و${remaining} دقيقة` : `${hours} ساعة`;
}

function sessionDurationMinutes(session: TableSessionReportRow) {
  if (!session.closed_at) return null;
  const opened = Date.parse(session.opened_at);
  const closed = Date.parse(session.closed_at);
  if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed < opened) return null;
  return Math.round((closed - opened) / 60000);
}

function paidOrderSales(order: Pick<TableOrderReportRow, "payments">) {
  return (order.payments ?? []).filter((payment) => payment.status === "completed").reduce((total, payment) => total + asNumber(payment.amount), 0);
}

function orderItemCount(order: Pick<TableOrderReportRow, "order_items">) {
  return (order.order_items ?? []).reduce((total, item) => total + asNumber(item.quantity), 0);
}

function makeRankingRows(rows: TablePerformancePayloadRow[], mode: "sessions" | "sales" | "average", limit = 5) {
  const sorted = [...rows]
    .filter((row) => row.sessionCount > 0)
    .sort((first, second) => {
      if (mode === "sessions") return second.sessionCount - first.sessionCount || first.tableNumber - second.tableNumber;
      if (mode === "average") return second.averageSessionValue - first.averageSessionValue || first.tableNumber - second.tableNumber;
      return second.paidSales - first.paidSales || first.tableNumber - second.tableNumber;
    })
    .slice(0, limit);

  return sorted.map((row, index) => ({
    rank: index + 1,
    table: row.tableLabel,
    sessions: `${row.sessionCount} جلسة`,
    sales: formatCurrency(row.paidSales),
    average: formatCurrency(row.averageSessionValue),
  }));
}

function makeLowUsageRows(rows: TablePerformancePayloadRow[], limit = 5) {
  return [...rows]
    .filter((row) => row.sessionCount > 0)
    .sort((first, second) => first.sessionCount - second.sessionCount || first.paidSales - second.paidSales || first.tableNumber - second.tableNumber)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      table: row.tableLabel,
      sessions: `${row.sessionCount} جلسة`,
      sales: formatCurrency(row.paidSales),
      status: row.tableStatus,
    }));
}

function makeLowestRevenueRows(rows: TablePerformancePayloadRow[], limit = 5) {
  return [...rows]
    .filter((row) => row.sessionCount > 0)
    .sort((first, second) => first.paidSales - second.paidSales || first.tableNumber - second.tableNumber)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      table: row.tableLabel,
      sessions: `${row.sessionCount} جلسة`,
      sales: formatCurrency(row.paidSales),
      status: row.tableStatus,
    }));
}

export async function generateTablePerformanceReport(range: ReportRange): Promise<GeneratedReport> {
  const supabase = createClient();
  const { start, endExclusive } = rangeToIso(range);
  const [
    { data: tables, error: tablesError },
    { data: sessions, error: sessionsError },
    { data: legacyOrders, error: legacyOrdersError },
  ] = await Promise.all([
    supabase
      .from("restaurant_tables" as never)
      .select("id, table_number, name, status, is_active")
      .order("table_number", { ascending: true }),
    supabase
      .from("table_sessions" as never)
      .select("id, table_id, captain_id, status, opened_at, closed_at, captain_profile:profiles!table_sessions_captain_id_fkey(full_name, username)")
      .gte("opened_at" as never, start as never)
      .lt("opened_at" as never, endExclusive as never)
      .order("opened_at", { ascending: true }),
    supabase
      .from("orders" as never)
      .select("id")
      .is("table_session_id" as never, null)
      .gte("opened_at" as never, start as never)
      .lt("opened_at" as never, endExclusive as never)
      .neq("status" as never, "cancelled" as never),
  ]);

  if (tablesError) throw tablesError;
  if (sessionsError) throw sessionsError;
  if (legacyOrdersError) throw legacyOrdersError;

  const tableRows = (tables ?? []) as unknown as RestaurantTableReportRow[];
  const sessionRows = (sessions ?? []) as unknown as TableSessionReportRow[];
  const sessionIds = sessionRows.map((session) => session.id);
  let orderRows: TableOrderReportRow[] = [];

  if (sessionIds.length > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from("orders" as never)
      .select("id, order_number, table_session_id, round_no, captain_id, status, total, opened_at, submitted_at, paid_at, payments(amount, status), order_items(quantity)")
      .in("table_session_id" as never, sessionIds as never)
      .order("round_no", { ascending: true });

    if (ordersError) throw ordersError;
    orderRows = (orders ?? []) as unknown as TableOrderReportRow[];
  }

  const sessionsByTable = new Map<string, TableSessionReportRow[]>();
  const ordersBySession = new Map<string, TableOrderReportRow[]>();
  const previousUseByTable = new Map<string, string>();

  for (const session of sessionRows) {
    sessionsByTable.set(session.table_id, [...(sessionsByTable.get(session.table_id) ?? []), session]);
  }

  for (const order of orderRows) {
    if (order.table_session_id) ordersBySession.set(order.table_session_id, [...(ordersBySession.get(order.table_session_id) ?? []), order]);
  }

  if (tableRows.length > 0) {
    const { data: previousSessions } = await supabase
      .from("table_sessions" as never)
      .select("table_id, opened_at")
      .lt("opened_at" as never, start as never)
      .order("opened_at", { ascending: false });
    for (const row of (previousSessions ?? []) as unknown as { table_id: string; opened_at: string }[]) {
      if (!previousUseByTable.has(row.table_id)) previousUseByTable.set(row.table_id, row.opened_at);
    }
  }

  const sessionDetails: TablePerformanceSessionDetail[] = [];
  const trendByTable = new Map<string, Map<string, { sessions: number; sales: number; additions: number }>>();

  const payloadRows: TablePerformancePayloadRow[] = tableRows.map((table) => {
    const tableSessions = sessionsByTable.get(table.id) ?? [];
    const tableSessionDetails = tableSessions.map((session) => {
      const sessionOrders = ordersBySession.get(session.id) ?? [];
      const validOrders = sessionOrders.filter((order) => order.status !== "cancelled");
      const paidSales = validOrders.reduce((total, order) => total + paidOrderSales(order), 0);
      const durationMinutes = sessionDurationMinutes(session);
      const detail: TablePerformanceSessionDetail = {
        sessionId: session.id,
        tableId: table.id,
        openedAt: session.opened_at,
        closedAt: session.closed_at,
        status: sessionStatusLabel(session.status),
        durationMinutes,
        orderCount: validOrders.length,
        additionalOrderCount: validOrders.filter((order) => (order.round_no ?? 1) > 1).length,
        paidSales,
        captainName: profileName(session.captain_profile),
        orders: validOrders.map((order) => ({
          orderId: order.id,
          roundNo: order.round_no ?? 1,
          orderNumber: order.order_number,
          itemCount: orderItemCount(order),
          total: asNumber(order.total),
          paidSales: paidOrderSales(order),
          status: orderStatusLabel(order.status),
        })),
      };
      sessionDetails.push(detail);
      const day = localDate(session.opened_at);
      const tableTrend = trendByTable.get(table.id) ?? new Map<string, { sessions: number; sales: number; additions: number }>();
      const trend = tableTrend.get(day) ?? { sessions: 0, sales: 0, additions: 0 };
      tableTrend.set(day, { sessions: trend.sessions + 1, sales: trend.sales + paidSales, additions: trend.additions + detail.additionalOrderCount });
      trendByTable.set(table.id, tableTrend);
      return detail;
    });
    const completedSessions = tableSessionDetails.filter((session) => session.closedAt);
    const paidSales = tableSessionDetails.reduce((total, session) => total + session.paidSales, 0);
    const totalDuration = completedSessions.reduce((total, session) => total + (session.durationMinutes ?? 0), 0);
    const durationCount = completedSessions.filter((session) => session.durationMinutes !== null).length;
    const firstUseAt = tableSessions[0]?.opened_at ?? null;
    const lastUseAt = tableSessions[tableSessions.length - 1]?.opened_at ?? null;
    const note =
      tableSessionDetails.length === 0
        ? table.is_active ? "لم تُستخدم خلال الفترة" : "طاولة معطلة"
        : tableSessionDetails.some((session) => session.status === "نشطة")
          ? "توجد جلسة نشطة"
          : "جلسات مكتملة";

    return {
      tableId: table.id,
      tableNumber: table.table_number,
      tableLabel: tableLabel(table),
      tableName: table.name,
      tableStatus: tableStatusLabel(table.status, table.is_active),
      sessionCount: tableSessionDetails.length,
      completedSessionCount: completedSessions.length,
      activeSessionCount: tableSessionDetails.filter((session) => session.status === "نشطة").length,
      orderCount: tableSessionDetails.reduce((total, session) => total + session.orderCount, 0),
      additionalOrderCount: tableSessionDetails.reduce((total, session) => total + session.additionalOrderCount, 0),
      paidSales,
      averageSessionValue: completedSessions.length > 0 ? paidSales / completedSessions.length : 0,
      averageDurationMinutes: durationCount > 0 ? totalDuration / durationCount : null,
      firstUseAt,
      lastUseAt,
      lastPreviousUseAt: previousUseByTable.get(table.id) ?? null,
      note,
    };
  });

  const usedRows = payloadRows.filter((row) => row.sessionCount > 0);
  const activeUnusedRows = payloadRows.filter((row) => row.sessionCount === 0 && row.tableStatus !== "معطلة");
  const totalPaidSales = payloadRows.reduce((total, row) => total + row.paidSales, 0);
  const totalSessions = payloadRows.reduce((total, row) => total + row.sessionCount, 0);
  const totalCompletedSessions = payloadRows.reduce((total, row) => total + row.completedSessionCount, 0);
  const totalOrders = payloadRows.reduce((total, row) => total + row.orderCount, 0);
  const totalAdditionalOrders = payloadRows.reduce((total, row) => total + row.additionalOrderCount, 0);
  const durationValues = sessionDetails.map((session) => session.durationMinutes).filter((value): value is number => typeof value === "number");
  const topUsage = [...usedRows].sort((first, second) => second.sessionCount - first.sessionCount || first.tableNumber - second.tableNumber)[0];
  const topSales = [...usedRows].sort((first, second) => second.paidSales - first.paidSales || first.tableNumber - second.tableNumber)[0];

  const rows: ReportTableRow[] = payloadRows
    .sort((first, second) => first.tableNumber - second.tableNumber)
    .map((row) => ({
      tableId: row.tableId,
      tableNumberRaw: row.tableNumber,
      sessionCountRaw: row.sessionCount,
      salesRaw: row.paidSales,
      averageSessionValueRaw: row.averageSessionValue,
      table: row.tableLabel,
      name: row.tableName ?? "-",
      sessions: row.sessionCount,
      orders: row.orderCount,
      additionalOrders: row.additionalOrderCount,
      sales: formatCurrency(row.paidSales),
      averageSessionValue: formatCurrency(row.averageSessionValue),
      averageDuration: formatDuration(row.averageDurationMinutes),
      firstUse: row.firstUseAt ? formatDateTime(row.firstUseAt) : "-",
      lastUse: row.lastUseAt ? formatDateTime(row.lastUseAt) : "-",
      status: `${row.tableStatus} / ${row.note}`,
    }));

  const unusedRows: ReportTableRow[] = activeUnusedRows.map((row) => ({
    table: row.tableLabel,
    status: row.tableStatus,
    lastUse: row.lastPreviousUseAt ? formatDateTime(row.lastPreviousUseAt) : "لا يوجد استخدام سابق",
  }));

  const tableDetails = payloadRows.map((row) => {
    const trend = [...(trendByTable.get(row.tableId) ?? new Map()).entries()].map(([date, value]) => ({
      date,
      sessions: value.sessions,
      sales: formatCurrency(value.sales),
      additionalOrders: value.additions,
    }));
    return {
      ...row,
      sessions: sessionDetails.filter((session) => session.tableId === row.tableId),
      trend,
    };
  });

  return makeReport(
    "table_performance",
    range,
    {
      "إجمالي مبيعات الطاولات": formatCurrency(totalPaidSales),
      "إجمالي الجلسات": totalSessions,
      "إجمالي الطلبات": totalOrders,
      "إجمالي الطلبات الإضافية": totalAdditionalOrders,
      "متوسط قيمة الجلسة": formatCurrency(totalCompletedSessions > 0 ? totalPaidSales / totalCompletedSessions : 0),
      "متوسط مدة الجلسة": formatDuration(durationValues.length > 0 ? durationValues.reduce((total, value) => total + value, 0) / durationValues.length : null),
      "أكثر طاولة استخداماً": topUsage?.tableLabel ?? "لا توجد بيانات",
      "أعلى طاولة مبيعات": topSales?.tableLabel ?? "لا توجد بيانات",
    },
    [
      { key: "table", label: "رقم الطاولة" },
      { key: "name", label: "اسم الطاولة" },
      { key: "sessions", label: "عدد الجلسات" },
      { key: "orders", label: "عدد الطلبات" },
      { key: "additionalOrders", label: "الطلبات الإضافية" },
      { key: "sales", label: "إجمالي المبيعات" },
      { key: "averageSessionValue", label: "متوسط قيمة الجلسة" },
      { key: "averageDuration", label: "متوسط مدة الجلسة" },
      { key: "firstUse", label: "أول استخدام بالفترة" },
      { key: "lastUse", label: "آخر استخدام بالفترة" },
      { key: "status", label: "الحالة / الملاحظة" },
    ],
    rows,
    {
      summaryRows: payloadRows,
      tableDetails,
      rankings: {
        topPerformance: makeRankingRows(payloadRows, "sessions"),
        topRevenue: makeRankingRows(payloadRows, "sales"),
        lowUsage: makeLowUsageRows(payloadRows),
        lowRevenue: makeLowestRevenueRows(payloadRows),
        topAverage: makeRankingRows(payloadRows, "average"),
        unused: unusedRows,
      },
      legacyOrdersWithoutSession: ((legacyOrders ?? []) as unknown[]).length,
    },
    [
      "مبيعات الطاولة تعتمد على المدفوعات المكتملة فقط داخل جلسات الطاولات.",
      "الطلبات القديمة غير المرتبطة بجلسة طاولة لا تدخل في مؤشرات الجلسات حتى لا يتم اختراع جلسات غير مؤكدة.",
    ],
    [
      {
        title: "أعلى الطاولات أداءً",
        columns: [
          { key: "rank", label: "الترتيب" },
          { key: "table", label: "الطاولة" },
          { key: "sessions", label: "عدد الجلسات" },
          { key: "sales", label: "المبيعات" },
        ],
        rows: makeRankingRows(payloadRows, "sessions"),
      },
      {
        title: "أعلى طاولة مبيعات",
        columns: [
          { key: "rank", label: "الترتيب" },
          { key: "table", label: "الطاولة" },
          { key: "sessions", label: "عدد الجلسات" },
          { key: "sales", label: "المبيعات" },
        ],
        rows: makeRankingRows(payloadRows, "sales"),
      },
      {
        title: "أقل الطاولات استخداماً",
        columns: [
          { key: "rank", label: "الترتيب" },
          { key: "table", label: "الطاولة" },
          { key: "sessions", label: "عدد الجلسات" },
          { key: "sales", label: "المبيعات" },
          { key: "status", label: "الحالة" },
        ],
        rows: makeLowUsageRows(payloadRows),
      },
      {
        title: "أقل طاولة مبيعات",
        columns: [
          { key: "rank", label: "الترتيب" },
          { key: "table", label: "الطاولة" },
          { key: "sessions", label: "عدد الجلسات" },
          { key: "sales", label: "المبيعات" },
          { key: "status", label: "الحالة" },
        ],
        rows: makeLowestRevenueRows(payloadRows),
      },
      {
        title: "طاولات لم تُستخدم خلال الفترة",
        columns: [
          { key: "table", label: "الطاولة" },
          { key: "status", label: "الحالة" },
          { key: "lastUse", label: "آخر استخدام سابق" },
        ],
        rows: unusedRows,
      },
    ],
    tablePerformanceCalculationVersion,
  );
}

export async function generateReport(reportType: ReportType, range: ReportRange): Promise<GeneratedReport> {
  if (reportType === "financial") return generateFinancialReport(range);
  if (reportType === "inventory") return generateInventoryReport(range);
  if (reportType === "material_consumption") return generateMaterialConsumptionReport(range);
  if (reportType === "waste") return generateWasteReport(range);
  if (reportType === "purchases") return generatePurchasesReport(range);
  if (reportType === "table_performance") return generateTablePerformanceReport(range);
  return generateCashShiftReport(range);
}

async function generateFinancialReport(range: ReportRange): Promise<GeneratedReport> {
  const [salesReport, payments, expenses, purchases, supplierPayments] = await Promise.all([
    getAdminSalesReport({ from: range.startDate, to: range.endDate, today: todayKey() }),
    getCompletedPayments(range),
    getExpenses(),
    getPurchases(),
    getPurchasePayments(),
  ]);

  const periodExpenses = expenses.filter((expense) => inRangeByDate(expense.expenseDate, range));
  const periodPurchases = purchases.filter((purchase) => inRangeByDateTime(purchase.createdAt, range));
  const periodSupplierPayments = supplierPayments.filter((payment) => inRangeByDateTime(payment.createdAt, range));
  const collections = payments.reduce((total, payment) => total + asNumber(payment.amount), 0);
  const byMethod = {
    cash: payments.filter((payment) => payment.method === "cash").reduce((total, payment) => total + asNumber(payment.amount), 0),
    card: payments.filter((payment) => payment.method === "card").reduce((total, payment) => total + asNumber(payment.amount), 0),
    transfer: payments.filter((payment) => payment.method === "transfer").reduce((total, payment) => total + asNumber(payment.amount), 0),
  };
  const expenseTotal = periodExpenses.reduce((total, expense) => total + expense.amount, 0);
  const purchaseTotal = periodPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);
  const supplierPaymentTotal = periodSupplierPayments.reduce((total, payment) => total + payment.amount, 0);
  const paymentMethodRows: ReportTableRow[] = (["cash", "card", "transfer"] as const).map((method) => {
    const methodPayments = payments.filter((payment) => payment.method === method);
    return {
      method: formatMethod(method),
      count: methodPayments.length,
      total: formatCurrency(methodPayments.reduce((total, payment) => total + asNumber(payment.amount), 0)),
    };
  });
  const userActivity = new Map<string, { operations: number; collected: number; spent: number }>();
  function addUserActivity(user: string, collected: number, spent: number) {
    const current = userActivity.get(user) ?? { operations: 0, collected: 0, spent: 0 };
    userActivity.set(user, { operations: current.operations + 1, collected: current.collected + collected, spent: current.spent + spent });
  }

  const rows: ReportTableRow[] = [
    ...payments.map((payment) => ({
      date: formatDate(payment.created_at),
      time: formatTime(payment.created_at),
      sortAt: payment.created_at,
      type: "دفع زبون",
      reference: payment.order?.order_number ? `ORD-${payment.order.order_number}` : payment.id.slice(0, 8),
      description: "مقبوضات طلب",
      amount: formatCurrency(asNumber(payment.amount)),
      method: formatMethod(payment.method),
      user: profileName(payment.cashier_profile),
      source: formatSource("payments"),
    })),
    ...periodExpenses.map((expense) => ({
      date: formatDate(expense.createdAt),
      time: formatTime(expense.createdAt),
      sortAt: expense.createdAt,
      type: "مصروف",
      reference: `EXP-${expense.expenseNumber}`,
      description: expense.description,
      amount: formatCurrency(expense.amount),
      method: formatMethod(expense.paymentMethod),
      user: expense.createdByName,
      source: formatSource("expenses"),
    })),
    ...periodPurchases.map((purchase) => ({
      date: formatDate(purchase.createdAt),
      time: formatTime(purchase.createdAt),
      sortAt: purchase.createdAt,
      type: "شراء",
      reference: `PUR-${purchase.purchaseNumber}`,
      description: purchase.supplierName,
      amount: formatCurrency(purchase.totalAmount),
      method: "-",
      user: purchase.createdByName,
      source: formatSource("purchases"),
    })),
    ...periodSupplierPayments.map((payment) => ({
      date: formatDate(payment.createdAt),
      time: formatTime(payment.createdAt),
      sortAt: payment.createdAt,
      type: "دفع مورد",
      reference: payment.paymentNumber ? `SP-${payment.paymentNumber}` : payment.id.slice(0, 8),
      description: payment.supplierName,
      amount: formatCurrency(payment.amount),
      method: formatMethod(payment.paymentMethod),
      user: payment.paidByName,
      source: formatSource("purchase_payments"),
    })),
  ].sort((a, b) => Date.parse(String(b.sortAt)) - Date.parse(String(a.sortAt)));
  payments.forEach((payment) => addUserActivity(profileName(payment.cashier_profile), asNumber(payment.amount), 0));
  periodExpenses.forEach((expense) => addUserActivity(expense.createdByName, 0, expense.amount));
  periodSupplierPayments.forEach((payment) => addUserActivity(payment.paidByName, 0, payment.amount));
  const userActivityRows: ReportTableRow[] = [...userActivity.entries()].map(([user, activity]) => ({
    user,
    operations: activity.operations,
    collected: formatCurrency(activity.collected),
    spent: formatCurrency(activity.spent),
  }));

  return makeReport(
    "financial",
    range,
    {
      "إجمالي المبيعات": formatCurrency(salesReport.summary.revenue),
      "إجمالي المقبوضات": formatCurrency(collections),
      "المقبوض نقداً": formatCurrency(byMethod.cash),
      "المقبوض بالبطاقة": formatCurrency(byMethod.card),
      "المقبوض بالتحويل": formatCurrency(byMethod.transfer),
      "المصروفات": formatCurrency(expenseTotal),
      "المشتريات": formatCurrency(purchaseTotal),
      "دفعات الموردين": formatCurrency(supplierPaymentTotal),
      "صافي النقد": formatCurrency(byMethod.cash - expenseTotal - periodSupplierPayments.filter((payment) => payment.paymentMethod === "cash").reduce((total, payment) => total + payment.amount, 0)),
    },
    [
      { key: "date", label: "التاريخ" },
      { key: "time", label: "الوقت" },
      { key: "type", label: "نوع العملية" },
      { key: "reference", label: "المرجع" },
      { key: "description", label: "البيان" },
      { key: "amount", label: "المبلغ" },
      { key: "method", label: "طريقة الدفع" },
      { key: "user", label: "المستخدم" },
      { key: "source", label: "المصدر" },
    ],
    rows,
    { salesReport, byMethod, rows, paymentMethodRows, userActivityRows },
    [],
    [
      {
        title: "تحليل حسب طريقة الدفع",
        columns: [
          { key: "method", label: "طريقة الدفع" },
          { key: "count", label: "عدد العمليات" },
          { key: "total", label: "إجمالي المبلغ" },
        ],
        rows: paymentMethodRows,
      },
      {
        title: "نشاط المستخدمين",
        columns: [
          { key: "user", label: "المستخدم" },
          { key: "operations", label: "عدد العمليات" },
          { key: "collected", label: "إجمالي المقبوض" },
          { key: "spent", label: "إجمالي المصروف/المدفوع" },
        ],
        rows: userActivityRows,
      },
    ],
  );
}

async function generateInventoryReport(range: ReportRange): Promise<GeneratedReport> {
  const [inventory, requisitions, purchaseRequests, wasteReports] = await Promise.all([getInventoryOverview(), getInventoryRequisitions(), getPurchaseRequests(), getInventoryWasteReports()]);
  const activeItems = inventory.items.filter((item) => item.isActive);
  const rows = inventory.items.map((item) => {
    const latestMovement = inventory.movements.find((movement) => movement.inventoryItemId === item.id);
    return {
      item: item.nameAr,
      type: itemTypeLabels[item.itemType],
      unit: item.baseUnitName,
      stock: formatQuantity(item.stockOnHand, item.baseUnitCode),
      minimum: formatQuantity(item.minimumStock, item.baseUnitCode),
      status: stockStatus(item) === "out" ? "نافد" : stockStatus(item) === "low" ? "منخفض" : stockStatus(item) === "inactive" ? "متوقف" : "متوفر",
      averageCost: formatCurrency(item.averageCost),
      lastCost: formatCurrency(item.lastPurchaseCost),
      value: formatCurrency(item.stockOnHand * item.averageCost),
      latestMovement: latestMovement ? `${movementLabels[latestMovement.movementType]} / ${formatDate(latestMovement.createdAt)} ${formatTime(latestMovement.createdAt)}` : "-",
    };
  });

  return makeReport(
    "inventory",
    range,
    {
      "عدد المواد": activeItems.length,
      "قيمة المخزون الحالية": formatCurrency(activeItems.reduce((total, item) => total + item.stockOnHand * item.averageCost, 0)),
      "مواد منخفضة": activeItems.filter((item) => stockStatus(item) === "low").length,
      "مواد نافدة": activeItems.filter((item) => stockStatus(item) === "out").length,
      "طلبات صرف معلقة": requisitions.filter((request) => request.status === "pending").length,
      "طلبات شراء معلقة": purchaseRequests.filter((request) => request.status === "pending").length,
      "عمليات هدر بالفترة": wasteReports.filter((report) => inRangeByDateTime(report.postedAt, range)).length,
    },
    [
      { key: "item", label: "اسم المادة" },
      { key: "type", label: "نوع المادة" },
      { key: "unit", label: "الوحدة الأساسية" },
      { key: "stock", label: "الرصيد" },
      { key: "minimum", label: "الحد الأدنى" },
      { key: "status", label: "الحالة" },
      { key: "averageCost", label: "متوسط الكلفة" },
      { key: "lastCost", label: "آخر كلفة" },
      { key: "value", label: "قيمة الرصيد" },
      { key: "latestMovement", label: "آخر حركة" },
    ],
    rows,
    { rows },
    ["رصيد المخزون يعرض الحالة الحالية وقت إنشاء التقرير."],
  );
}

async function generateMaterialConsumptionReport(range: ReportRange): Promise<GeneratedReport> {
  const [analytics, inventory] = await Promise.all([
    getInventoryAnalytics({ startDate: range.startDate, endDate: range.endDate }),
    getInventoryOverview(),
  ]);
  const periodMovements = inventory.movements.filter((movement) => inRangeByDateTime(movement.createdAt, range));
  const rows = analytics.items.map((item) => {
    const itemMovements = periodMovements.filter((movement) => movement.inventoryItemId === item.id);
    const adjustmentIn = itemMovements.filter((movement) => movement.movementType === "adjustment_in").reduce((total, movement) => total + Math.abs(movement.quantityDelta), 0);
    const adjustmentOut = itemMovements.filter((movement) => movement.movementType === "adjustment_out").reduce((total, movement) => total + Math.abs(movement.quantityDelta), 0);
    const kitchenIssued = asNumber(item.issues.departmentBreakdown.kitchen);
    const baristaIssued = asNumber(item.issues.departmentBreakdown.barista);
    const serviceIssued = asNumber(item.issues.departmentBreakdown.service);
    const cleaningIssued = asNumber(item.issues.departmentBreakdown.cleaning);
    const otherIssued = Math.max(item.issues.quantity - kitchenIssued - baristaIssued - serviceIssued - cleaningIssued, 0);
    return {
      itemId: item.id,
      item: item.nameAr,
      type: itemTypeLabels[item.itemType],
      unit: item.baseUnitName,
      purchased: formatQuantity(item.purchases.quantity, item.baseUnitCode),
      recipeConsumption: formatQuantity(item.recipeConsumption.quantity, item.baseUnitCode),
      kitchenIssued: formatQuantity(kitchenIssued, item.baseUnitCode),
      baristaIssued: formatQuantity(baristaIssued, item.baseUnitCode),
      serviceIssued: formatQuantity(serviceIssued, item.baseUnitCode),
      cleaningIssued: formatQuantity(cleaningIssued, item.baseUnitCode),
      otherIssued: formatQuantity(otherIssued, item.baseUnitCode),
      warehouseWaste: formatQuantity(item.waste.warehouseQuantity, item.baseUnitCode),
      departmentWaste: formatQuantity(item.waste.departmentQuantity, item.baseUnitCode),
      adjustmentIn: formatQuantity(adjustmentIn, item.baseUnitCode),
      adjustmentOut: formatQuantity(adjustmentOut, item.baseUnitCode),
      centralDelta: formatQuantity(item.purchases.quantity - item.recipeConsumption.quantity - item.issues.quantity - item.waste.warehouseQuantity + adjustmentIn - adjustmentOut, item.baseUnitCode),
      stock: formatQuantity(item.stockOnHand, item.baseUnitCode),
      averageCost: formatCurrency(item.averageCost),
    };
  });

  return makeReport(
    "material_consumption",
    range,
    { "عدد المواد": rows.length, "أحداث الهدر": analytics.overview.actualWasteQuantityEvents, "قيمة المخزون الحالية": formatCurrency(analytics.overview.inventoryValue) },
    [
      { key: "item", label: "اسم المادة" },
      { key: "type", label: "نوع المادة" },
      { key: "unit", label: "الوحدة" },
      { key: "purchased", label: "الوارد بالشراء" },
      { key: "recipeConsumption", label: "استهلاك الوصفات" },
      { key: "kitchenIssued", label: "المصروف للمطبخ" },
      { key: "baristaIssued", label: "المصروف للباريستا" },
      { key: "serviceIssued", label: "المصروف للخدمة" },
      { key: "cleaningIssued", label: "المصروف للتنظيف" },
      { key: "otherIssued", label: "المصروف لأقسام أخرى" },
      { key: "warehouseWaste", label: "هدر المخزن" },
      { key: "departmentWaste", label: "هدر الأقسام" },
      { key: "adjustmentIn", label: "التسويات الداخلة" },
      { key: "adjustmentOut", label: "التسويات الخارجة" },
      { key: "stock", label: "الرصيد الحالي" },
    ],
    rows,
    { analytics, adjustmentMovements: periodMovements.filter((movement) => movement.movementType === "adjustment_in" || movement.movementType === "adjustment_out") },
    ["كل مادة تعرض بوحدتها الأساسية، وهدر الأقسام يظهر منفصلاً عن هدر المخزن."],
  );
}

async function generateWasteReport(range: ReportRange): Promise<GeneratedReport> {
  const reports = (await getInventoryWasteReports()).filter((report) => inRangeByDateTime(report.postedAt, range));
  const rows = reports.flatMap((report) =>
    report.items.map((item) => ({
      reportCode: report.reportCode,
      date: formatDate(report.postedAt),
      time: formatTime(report.postedAt),
      item: item.inventoryItemName,
      type: itemTypeLabels[item.itemType],
      quantity: formatQuantity(item.quantityBase, item.baseUnitCode),
      unit: item.baseUnitName,
      context: wasteContextLabels[report.context],
      destination: report.destination ? destinationLabels[report.destination] : "المخزن",
      reason: wasteReasonLabels[item.reason],
      user: report.postedByName,
      requisition: item.requisitionCode ?? "-",
      reference: item.id.slice(0, 8),
    })),
  );
  const destinationCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  reports.forEach((report) => {
    destinationCounts.set(report.destination ?? "warehouse", (destinationCounts.get(report.destination ?? "warehouse") ?? 0) + report.items.length);
    report.items.forEach((item) => itemCounts.set(item.inventoryItemName, (itemCounts.get(item.inventoryItemName) ?? 0) + 1));
  });
  const reasonRows: ReportTableRow[] = [...reports.reduce((map, report) => {
    report.items.forEach((item) => {
      const reason = wasteReasonLabels[item.reason];
      map.set(reason, (map.get(reason) ?? 0) + 1);
    });
    return map;
  }, new Map<string, number>()).entries()].map(([reason, count]) => ({ reason, count }));

  return makeReport(
    "waste",
    range,
    {
      "عدد عمليات الهدر": reports.length,
      "هدر مخزن": reports.filter((report) => report.context === "warehouse").length,
      "هدر مطبخ": reports.filter((report) => report.destination === "kitchen").length,
      "هدر باريستا": reports.filter((report) => report.destination === "barista").length,
      "أكثر مادة تكرر هدرها": [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "لا توجد بيانات",
      "أكثر قسم لديه هدر": formatDestinationKey([...destinationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]),
    },
    [
      { key: "reportCode", label: "رقم العملية" },
      { key: "date", label: "التاريخ" },
      { key: "time", label: "الوقت" },
      { key: "item", label: "المادة" },
      { key: "type", label: "نوع المادة" },
      { key: "quantity", label: "الكمية" },
      { key: "unit", label: "الوحدة" },
      { key: "context", label: "نوع الهدر" },
      { key: "destination", label: "القسم" },
      { key: "reason", label: "السبب" },
      { key: "user", label: "المستخدم" },
      { key: "requisition", label: "طلب الصرف المرتبط" },
      { key: "reference", label: "المرجع" },
    ],
    rows,
    { reports, reasonRows },
    ["لا يتم جمع كميات الهدر المختلفة في رقم واحد لأن الوحدات قد تختلف من مادة إلى أخرى."],
    [
      {
        title: "ملخص أسباب الهدر",
        columns: [
          { key: "reason", label: "سبب الهدر" },
          { key: "count", label: "عدد العمليات" },
        ],
        rows: reasonRows,
      },
    ],
  );
}

async function generatePurchasesReport(range: ReportRange): Promise<GeneratedReport> {
  const [purchases, payments] = await Promise.all([getPurchases(), getPurchasePayments()]);
  const periodPurchases = purchases.filter((purchase) => inRangeByDateTime(purchase.createdAt, range));
  const periodPayments = payments.filter((payment) => inRangeByDateTime(payment.createdAt, range));
  const rows = periodPurchases.map((purchase) => {
    const paid = payments.filter((payment) => payment.purchaseId === purchase.id).reduce((total, payment) => total + payment.amount, 0);
    return {
      number: `PUR-${purchase.purchaseNumber}`,
      date: purchase.createdAt,
      supplier: purchase.supplierName,
      itemCount: purchase.items.length,
      total: formatCurrency(purchase.totalAmount),
      paid: formatCurrency(paid),
      remaining: formatCurrency(Math.max(purchase.totalAmount - paid, 0)),
      status: purchase.paymentStatus === "paid" ? "مدفوع" : "بانتظار الدفع",
      user: purchase.createdByName,
      invoice: purchase.supplierInvoiceNumber ?? "-",
    };
  });
  const supplierTotals = new Map<string, number>();
  const supplierPaid = new Map<string, number>();
  const supplierCounts = new Map<string, number>();
  periodPurchases.forEach((purchase) => supplierTotals.set(purchase.supplierName, (supplierTotals.get(purchase.supplierName) ?? 0) + purchase.totalAmount));
  periodPurchases.forEach((purchase) => supplierCounts.set(purchase.supplierName, (supplierCounts.get(purchase.supplierName) ?? 0) + 1));
  periodPayments.forEach((payment) => supplierPaid.set(payment.supplierName, (supplierPaid.get(payment.supplierName) ?? 0) + payment.amount));
  const supplierRows: ReportTableRow[] = [...supplierTotals.entries()].map(([supplier, total]) => {
    const paid = supplierPaid.get(supplier) ?? 0;
    return {
      supplier,
      count: supplierCounts.get(supplier) ?? 0,
      total: formatCurrency(total),
      paid: formatCurrency(paid),
      remaining: formatCurrency(Math.max(total - paid, 0)),
    };
  });

  return makeReport(
    "purchases",
    range,
    {
      "عدد عمليات الشراء": periodPurchases.length,
      "إجمالي قيمة المشتريات": formatCurrency(periodPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0)),
      "إجمالي مدفوع للموردين": formatCurrency(periodPayments.reduce((total, payment) => total + payment.amount, 0)),
      "المتبقي للموردين": formatCurrency(periodPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0) - periodPayments.reduce((total, payment) => total + payment.amount, 0)),
      "عدد الموردين": new Set(periodPurchases.map((purchase) => purchase.supplierId)).size,
      "أكثر مورد شراءً منه": [...supplierTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "لا توجد بيانات",
    },
    [
      { key: "number", label: "رقم الشراء" },
      { key: "date", label: "التاريخ" },
      { key: "supplier", label: "المورد" },
      { key: "itemCount", label: "عدد المواد" },
      { key: "total", label: "القيمة" },
      { key: "paid", label: "المدفوع" },
      { key: "remaining", label: "المتبقي" },
      { key: "status", label: "حالة الدفع" },
      { key: "user", label: "المستخدم" },
      { key: "invoice", label: "رقم الفاتورة" },
    ],
    rows,
    { purchases: periodPurchases, supplierRows },
    [],
    [
      {
        title: "ملخص الموردين",
        columns: [
          { key: "supplier", label: "المورد" },
          { key: "count", label: "عدد عمليات الشراء" },
          { key: "total", label: "إجمالي الشراء" },
          { key: "paid", label: "المدفوع" },
          { key: "remaining", label: "المتبقي" },
        ],
        rows: supplierRows,
      },
    ],
  );
}

async function generateCashShiftReport(range: ReportRange): Promise<GeneratedReport> {
  const shifts = (await getRecentCashShifts()).filter((shift) => inRangeByDateTime(shift.openedAt, range));
  const summaries = await getCashShiftMovementSummaries(shifts.map((shift) => shift.id));
  const summaryByShift = new Map(summaries.map((summary) => [summary.shiftId, summary]));
  const rows = shifts.map((shift) => {
    const summary = summaryByShift.get(shift.id) ?? { cashIn: 0, cashOut: 0 };
    return {
      date: shift.businessDate,
      cashier: shift.cashierName ?? shift.cashierId.slice(0, 8),
      openedAt: shift.openedAt,
      openedBy: shift.openedByName ?? shift.openedBy.slice(0, 8),
      openingCash: formatCurrency(shift.openingCash),
      cashIn: formatCurrency(summary.cashIn),
      cashOut: formatCurrency(summary.cashOut),
      expected: typeof shift.expectedCashSnapshot === "number" ? formatCurrency(shift.expectedCashSnapshot) : "-",
      counted: typeof shift.countedCash === "number" ? formatCurrency(shift.countedCash) : "-",
      difference: typeof shift.cashDifference === "number" ? formatCurrency(shift.cashDifference) : "-",
      differenceStatus: typeof shift.cashDifference !== "number" ? "-" : shift.cashDifference === 0 ? "متطابق" : shift.cashDifference > 0 ? "زيادة" : "نقص",
      closedAt: shift.closedAt ?? "-",
      closedBy: shift.closedByName ?? shift.closedBy?.slice(0, 8) ?? "-",
      status: shift.status === "open" ? "مفتوحة" : "مغلقة",
    };
  });
  const differenceShifts = shifts.filter((shift) => typeof shift.cashDifference === "number" && shift.cashDifference !== 0);
  const positiveDifference = shifts.filter((shift) => (shift.cashDifference ?? 0) > 0).reduce((total, shift) => total + (shift.cashDifference ?? 0), 0);
  const negativeDifference = shifts.filter((shift) => (shift.cashDifference ?? 0) < 0).reduce((total, shift) => total + Math.abs(shift.cashDifference ?? 0), 0);

  return makeReport(
    "cash_shifts",
    range,
    {
      "عدد الورديات": shifts.length,
      "الورديات المفتوحة": shifts.filter((shift) => shift.status === "open").length,
      "الورديات المغلقة": shifts.filter((shift) => shift.status === "closed").length,
      "ورديات فيها فرق": differenceShifts.length,
      "إجمالي الزيادة": formatCurrency(positiveDifference),
      "إجمالي النقص": formatCurrency(negativeDifference),
    },
    [
      { key: "date", label: "التاريخ" },
      { key: "cashier", label: "الكاشير" },
      { key: "openedAt", label: "وقت الفتح" },
      { key: "openedBy", label: "فتح بواسطة" },
      { key: "openingCash", label: "الرصيد الافتتاحي" },
      { key: "cashIn", label: "النقد الداخل" },
      { key: "cashOut", label: "النقد الخارج" },
      { key: "expected", label: "الرصيد المتوقع" },
      { key: "counted", label: "النقد المعدود" },
      { key: "difference", label: "الفرق" },
      { key: "differenceStatus", label: "حالة الفرق" },
      { key: "closedAt", label: "وقت الإغلاق" },
      { key: "closedBy", label: "أغلق بواسطة" },
      { key: "status", label: "الحالة" },
    ],
    rows,
    { shifts, movementSummaries: summaries },
    [],
  );
}

function rowToSnapshot(row: SnapshotRow): ReportSnapshot {
  return {
    id: row.id,
    reportNumber: row.report_number,
    reportReference: row.report_reference,
    reportType: row.report_type,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    businessTimezone: row.business_timezone,
    generatedAt: row.generated_at,
    generatedByName: profileName(row.generated_by_profile),
    version: row.version,
    schemaVersion: row.schema_version,
    calculationVersion: row.calculation_version,
    summary: row.summary as Record<string, string | number>,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export async function getReportSnapshots(): Promise<ReportSnapshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("report_snapshots" as never)
    .select("id, report_number, report_reference, report_type, period_type, period_start, period_end, business_timezone, generated_at, generated_by_profile:profiles!report_snapshots_generated_by_fkey(full_name, username), version, schema_version, calculation_version, summary, payload, created_at")
    .order("generated_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return ((data ?? []) as unknown as SnapshotRow[]).map(rowToSnapshot);
}

export async function saveReportSnapshot(report: GeneratedReport): Promise<ReportSnapshot> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_report_snapshot" as never, {
    p_report_type: report.reportType,
    p_period_type: report.range.periodType,
    p_period_start: report.range.startDate,
    p_period_end: report.range.endDate,
    p_business_timezone: report.range.timezone,
    p_schema_version: 1,
    p_calculation_version: report.calculationVersion,
    p_summary: report.summary,
    p_payload: {
      ...report.payload,
      reportType: report.reportType,
      title: report.title,
      range: report.range,
      generatedAt: report.generatedAt,
      summary: report.summary,
      columns: report.columns,
      rows: report.rows,
      sections: report.sections,
      notes: report.notes,
    },
  } as never);

  if (error) throw error;
  return rowToSnapshot(data as unknown as SnapshotRow);
}

export function snapshotToGeneratedReport(snapshot: ReportSnapshot): GeneratedReport {
  const payload = snapshot.payload;
  return {
    reportType: snapshot.reportType,
    title: typeof payload.title === "string" ? payload.title : reportTitles[snapshot.reportType],
    range: (payload.range as ReportRange | undefined) ?? {
      periodType: snapshot.periodType,
      startDate: snapshot.periodStart,
      endDate: snapshot.periodEnd,
      timezone: "Asia/Baghdad",
    },
    mode: "saved",
    generatedAt: snapshot.generatedAt,
    generatedByName: snapshot.generatedByName,
    reportReference: snapshot.reportReference,
    version: snapshot.version,
    summary: snapshot.summary,
    columns: Array.isArray(payload.columns) ? (payload.columns as ReportTableColumn[]) : [],
    rows: Array.isArray(payload.rows) ? (payload.rows as ReportTableRow[]) : [],
    sections: Array.isArray(payload.sections) ? (payload.sections as ReportSection[]) : [],
    payload,
    calculationVersion: snapshot.calculationVersion,
    notes: Array.isArray(payload.notes) ? (payload.notes as string[]) : [],
  };
}
