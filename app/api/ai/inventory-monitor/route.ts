import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/supabaseError";
import type { AiInventoryMonitorAnalysis, AiInventoryMonitorResponse, AiOperationalAnalysis, AiOperationalMetrics, AiSpeedMetric } from "@/types/aiInventoryMonitor";

export const runtime = "nodejs";

type InventoryAnalyticsPayload = {
  range?: {
    start_date?: string;
    end_date?: string;
    period_days?: number | string;
    previous_start_date?: string;
    previous_end_date?: string;
    timezone?: string;
  };
  overview?: {
    inventory_value?: number | string;
    follow_up_count?: number | string;
    issue_cost_estimate?: number | string;
    actual_waste_quantity_events?: number | string;
    dish_quantity?: number | string;
    previous_dish_quantity?: number | string;
  };
  items?: InventoryAnalyticsItemPayload[];
};

type InventoryAnalyticsItemPayload = {
  name_ar?: string;
  item_type?: string;
  is_active?: boolean;
  base_unit_code?: string;
  base_unit_name?: string;
  stock_on_hand?: number | string;
  minimum_stock?: number | string;
  average_cost?: number | string;
  last_purchase_cost?: number | string;
  purchases?: {
    quantity?: number | string;
    count?: number | string;
    total?: number | string;
    average_unit_cost?: number | string;
    last_unit_cost?: number | string;
    min_unit_cost?: number | string;
    max_unit_cost?: number | string;
    last_purchase_at?: string | null;
    supplier_count?: number | string;
  };
  issues?: {
    quantity?: number | string;
    count?: number | string;
    average_quantity?: number | string;
    max_quantity?: number | string;
    last_issue_at?: string | null;
    department_breakdown?: Record<string, number | string>;
  };
  waste?: {
    warehouse_quantity?: number | string;
    department_quantity?: number | string;
    total_quantity?: number | string;
    count?: number | string;
    top_reason?: string | null;
    top_destination?: string | null;
    ratio_department_to_issued?: number | string | null;
  };
  recipe_consumption?: {
    quantity?: number | string;
    count?: number | string;
  };
  operations?: {
    daily_issue_rate?: number | string | null;
    coverage_days?: number | string | null;
    issue_per_100_dishes?: number | string | null;
    previous_issue_per_100_dishes?: number | string | null;
  };
  comparison?: {
    issue_quantity_percent?: number | string | null;
    waste_quantity_percent?: number | string | null;
    purchase_cost_percent?: number | string | null;
    issue_per_100_dishes_percent?: number | string | null;
  };
};

type SanitizedInventoryItem = {
  item: string;
  itemType: string;
  unit: string;
  isActive: boolean;
  stockOnHand: number;
  minimumStock: number;
  averageCost: number;
  lastPurchaseCost: number;
  coverageDays: number | null;
  dailyIssueRate: number | null;
  issuePer100Dishes: number | null;
  previousIssuePer100Dishes: number | null;
  consumption7: {
    quantity: number;
    events: number;
    changePercentVsPrevious: number | null;
    per100DishesChangePercent: number | null;
  };
  consumption30: {
    quantity: number;
    events: number;
    changePercentVsPrevious: number | null;
    departmentBreakdown: Record<string, number>;
  };
  purchases30: {
    quantity: number;
    events: number;
    total: number;
    averageUnitCost: number;
    lastUnitCost: number;
    minUnitCost: number;
    maxUnitCost: number;
    purchaseCostChangePercent: number | null;
    lastPurchaseAt: string | null;
    supplierCount: number;
  };
  waste30: {
    totalQuantity: number;
    warehouseQuantity: number;
    departmentQuantity: number;
    events: number;
    ratioDepartmentToIssued: number | null;
    changePercentVsPrevious: number | null;
    topReason: string | null;
    topDestination: string | null;
  };
  recipeConsumption30: {
    quantity: number;
    events: number;
  };
};

type TableSessionRow = {
  id: string;
  table_id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

type RestaurantTableRow = {
  id: string;
  table_number: number;
  name: string | null;
  is_active: boolean;
};

type OrderRow = {
  id: string;
  table_id: string;
  table_session_id: string | null;
  status: string;
  total: number | string;
  submitted_at: string | null;
  served_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type OrderItemRow = {
  order_id: string;
  preparation_station: string;
  status: string;
  sent_at: string;
  started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  created_at: string;
};

type OrderStatusEventRow = {
  order_id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
};

type PaymentRow = {
  method: string;
  amount: number | string;
  status: string;
  created_at: string;
};

type CashShiftRow = {
  business_date: string;
  opened_at: string;
  closed_at: string | null;
  expected_cash_snapshot: number | string | null;
  cash_difference: number | string | null;
  status: string;
  created_at: string;
};

type CashMovementRow = {
  direction: string;
  movement_type: string;
  event_type: string;
  amount: number | string;
  source_type: string;
  created_at: string;
  voided_at: string | null;
};

type PurchaseRow = {
  id: string;
  total_amount: number | string;
  payment_status?: string | null;
  created_at: string;
};

type PurchasePaymentRow = {
  purchase_id: string;
  amount: number | string;
  payment_method: string;
  created_at: string;
};

type ExpenseRow = {
  amount: number | string;
  category: string;
  expense_date: string;
  created_at: string;
};

type OperationalRawData = {
  tables: RestaurantTableRow[];
  sessions: TableSessionRow[];
  orders: OrderRow[];
  orderItems: OrderItemRow[];
  orderEvents: OrderStatusEventRow[];
  payments: PaymentRow[];
  cashShifts: CashShiftRow[];
  cashMovements: CashMovementRow[];
  purchases: PurchaseRow[];
  purchasePayments: PurchasePaymentRow[];
  expenses: ExpenseRow[];
};

const alertSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    item: { type: "string" },
    severity: { type: "string", enum: ["منخفضة", "متوسطة", "عالية", "حرجة"] },
    note: { type: "string" },
    dataReason: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["item", "severity", "note", "dataReason", "recommendation"],
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallStatus: { type: "string", enum: ["طبيعي", "يحتاج انتباه", "خطر"] },
    summary: { type: "string" },
    topAlerts: { type: "array", items: alertSchema },
    stockoutRisk: { type: "array", items: alertSchema },
    unusualConsumption: { type: "array", items: alertSchema },
    wasteFollowUp: { type: "array", items: alertSchema },
    supplierPriceChanges: { type: "array", items: alertSchema },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["overallStatus", "summary", "topAlerts", "stockoutRisk", "unusualConsumption", "wasteFollowUp", "supplierPriceChanges", "recommendations"],
};

const operationalAttentionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    area: { type: "string" },
    severity: { type: "string", enum: ["منخفضة", "متوسطة", "عالية", "حرجة"] },
    note: { type: "string" },
    dataReason: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["area", "severity", "note", "dataReason", "recommendation"],
};

const operationalInsightSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    severity: { type: "string", enum: ["منخفضة", "متوسطة", "عالية", "حرجة"] },
    insight: { type: "string" },
    dataReason: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["title", "severity", "insight", "dataReason", "recommendation"],
};

const operationalAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "array", items: operationalAttentionSchema },
    tableInsights: { type: "array", items: operationalInsightSchema },
    speedInsights: { type: "array", items: operationalInsightSchema },
    financialInsights: { type: "array", items: operationalInsightSchema },
    dataQuality: {
      type: "object",
      additionalProperties: false,
      properties: {
        confidence: { type: "string", enum: ["عالية", "متوسطة", "منخفضة"] },
        reason: { type: "string" },
      },
      required: ["confidence", "reason"],
    },
  },
  required: ["executiveSummary", "tableInsights", "speedInsights", "financialInsights", "dataQuality"],
};

const combinedAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    inventory: analysisSchema,
    operations: operationalAnalysisSchema,
  },
  required: ["inventory", "operations"],
};

function serverError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function baghdadToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00+03:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(date);
}

function startIso(dateValue: string) {
  return `${dateValue}T00:00:00+03:00`;
}

function endExclusiveIso(dateValue: string) {
  return `${addDays(dateValue, 1)}T00:00:00+03:00`;
}

function inRange(value: string | null | undefined, start: string, endExclusive: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(start).getTime() && time < new Date(endExclusive).getTime();
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return roundMetric(value);
}

function comparison(current: number, previous: number) {
  return {
    current: roundMetric(current),
    previous: roundMetric(previous),
    changePercent: percentChange(current, previous),
  };
}

function tableLabel(table: RestaurantTableRow | undefined, tableId: string) {
  if (!table) return `طاولة غير معرفة ${tableId.slice(0, 4)}`;
  return table.name?.trim() || `طاولة ${table.table_number}`;
}

function speedMetricNote(samples: number, suspiciousFastCount: number, outlierCount: number) {
  if (samples === 0) return "لا توجد عينات مكتملة لهذه المرحلة.";
  if (samples < 5) return "العينة قليلة ولا تكفي للحكم على الأداء.";
  if (suspiciousFastCount > 0) return "توجد مدد قصيرة جداً قد تكون نتيجة بيانات اختبار أو تحديث حالات سريع.";
  if (outlierCount > 0) return "يوجد طلب غير اعتيادي أثر على المتوسط؛ استخدم الوسيط لوصف الوقت المعتاد.";
  return "العينة كافية، والوسيط هو المؤشر الأفضل للوقت المعتاد.";
}

function speedDataQuality(samples: number, suspiciousFastCount: number) {
  if (samples === 0) return "غير كافية" as const;
  if (samples < 5) return "عينة قليلة" as const;
  if (suspiciousFastCount > 0) return "بيانات اختبار محتملة" as const;
  return "كافية" as const;
}

function durationMetric(
  label: string,
  stage: AiSpeedMetric["stage"],
  currentValues: number[],
  previousValues: number[],
  delayedThresholdMinutes: number,
): AiSpeedMetric {
  const currentAverage = average(currentValues);
  const previousAverage = average(previousValues);
  const currentMedian = median(currentValues);
  const previousMedian = median(previousValues);
  const maxValue = currentValues.length ? Math.max(...currentValues) : null;
  const minValue = currentValues.length ? Math.min(...currentValues) : null;
  const suspiciousFastCount = currentValues.filter((value) => value > 0 && value <= 0.0834).length;
  const outlierThreshold = currentMedian === null ? null : Math.max(delayedThresholdMinutes, currentMedian * 3);
  const outlierCount = outlierThreshold === null ? 0 : currentValues.filter((value) => value > outlierThreshold).length;
  return {
    label,
    stage,
    usualSource: "median",
    averageMinutes: currentAverage,
    medianMinutes: currentMedian,
    minMinutes: minValue === null ? null : roundMetric(minValue),
    maxMinutes: maxValue === null ? null : roundMetric(maxValue),
    samples: currentValues.length,
    delayedCount: currentValues.filter((value) => value > delayedThresholdMinutes).length,
    outlierCount,
    suspiciousFastCount,
    dataQuality: speedDataQuality(currentValues.length, suspiciousFastCount),
    note: speedMetricNote(currentValues.length, suspiciousFastCount, outlierCount),
    previousAverageMinutes: previousAverage,
    previousMedianMinutes: previousMedian,
    changePercent: currentMedian !== null && previousMedian !== null ? percentChange(currentMedian, previousMedian) : null,
  };
}

function emptyOperationalAnalysis(reason = "لا توجد بيانات تشغيل كافية للتحليل حالياً."): AiOperationalAnalysis {
  return {
    executiveSummary: [],
    tableInsights: [],
    speedInsights: [],
    financialInsights: [],
    dataQuality: { confidence: "منخفضة", reason },
  };
}

function buildDataQuality(raw: OperationalRawData): AiOperationalMetrics["dataQuality"] {
  const counts = {
    sessions: raw.sessions.length,
    orders: raw.orders.length,
    orderItems: raw.orderItems.length,
    payments: raw.payments.length,
    orderStatusEvents: raw.orderEvents.length,
    cashShifts: raw.cashShifts.length,
  };
  const availableSignals = Object.values(counts).filter((value) => value > 0).length;
  const confidence = availableSignals >= 5 ? "عالية" : availableSignals >= 3 ? "متوسطة" : "منخفضة";
  const reason =
    confidence === "عالية"
      ? "تتوفر بيانات كافية من الجلسات والطلبات والحركات المالية."
      : confidence === "متوسطة"
        ? "توجد بيانات تشغيلية مفيدة، لكن بعض الإشارات مثل أحداث الحالة أو الدفعات محدودة."
        : "البيانات المتاحة قليلة، لذلك تبقى قراءة المؤشرات محدودة.";
  return { confidence, reason, counts };
}

function buildTableMetrics(raw: OperationalRawData, currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): AiOperationalMetrics["tables"] {
  const tableById = new Map(raw.tables.map((table) => [table.id, table]));
  const currentSessions = raw.sessions.filter((session) => inRange(session.opened_at, currentStart, currentEnd));
  const previousSessions = raw.sessions.filter((session) => inRange(session.opened_at, previousStart, previousEnd));
  const currentOrders = raw.orders.filter((order) => order.status !== "cancelled" && inRange(order.created_at, currentStart, currentEnd));
  const previousOrders = raw.orders.filter((order) => order.status !== "cancelled" && inRange(order.created_at, previousStart, previousEnd));
  const currentSales = currentOrders.reduce((sum, order) => sum + asNumber(order.total), 0);
  const previousSales = previousOrders.reduce((sum, order) => sum + asNumber(order.total), 0);
  const currentDurations = currentSessions.map((session) => minutesBetween(session.opened_at, session.closed_at)).filter((value): value is number => value !== null);
  const previousDurations = previousSessions.map((session) => minutesBetween(session.opened_at, session.closed_at)).filter((value): value is number => value !== null);

  const salesByTable = new Map<string, number>();
  const sessionsByTable = new Map<string, number>();
  const previousSessionsByTable = new Map<string, number>();
  for (const session of currentSessions) sessionsByTable.set(session.table_id, (sessionsByTable.get(session.table_id) ?? 0) + 1);
  for (const session of previousSessions) previousSessionsByTable.set(session.table_id, (previousSessionsByTable.get(session.table_id) ?? 0) + 1);
  for (const order of currentOrders) salesByTable.set(order.table_id, (salesByTable.get(order.table_id) ?? 0) + asNumber(order.total));

  const tableRows = [...sessionsByTable.entries()].map(([tableId, sessions]) => ({
    table: tableLabel(tableById.get(tableId), tableId),
    sessions,
    sales: roundMetric(salesByTable.get(tableId) ?? 0),
  }));

  const allTableIds = new Set([...sessionsByTable.keys(), ...previousSessionsByTable.keys()]);
  const notableChanges = [...allTableIds]
    .map((tableId) => {
      const current = sessionsByTable.get(tableId) ?? 0;
      const previous = previousSessionsByTable.get(tableId) ?? 0;
      return {
        table: tableLabel(tableById.get(tableId), tableId),
        currentSessions: current,
        previousSessions: previous,
        changePercent: percentChange(current, previous),
      };
    })
    .filter((row) => row.changePercent !== null && Math.abs(row.changePercent) >= 25)
    .sort((first, second) => Math.abs(second.changePercent ?? 0) - Math.abs(first.changePercent ?? 0))
    .slice(0, 5);

  return {
    periodDays: 30,
    sessions: comparison(currentSessions.length, previousSessions.length),
    sales: comparison(currentSales, previousSales),
    averageBill: comparison(currentOrders.length ? currentSales / currentOrders.length : 0, previousOrders.length ? previousSales / previousOrders.length : 0),
    averageSessionMinutes: comparison(average(currentDurations) ?? 0, average(previousDurations) ?? 0),
    topTables: [...tableRows].sort((first, second) => second.sessions - first.sessions || second.sales - first.sales).slice(0, 5),
    lowTables: [...tableRows].filter((row) => row.sessions > 0).sort((first, second) => first.sessions - second.sessions || first.sales - second.sales).slice(0, 5),
    notableChanges,
  };
}

function firstEvent(events: OrderStatusEventRow[], status: string) {
  return events.filter((event) => event.to_status === status).sort((first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime())[0]?.created_at ?? null;
}

function buildSpeedMetrics(raw: OperationalRawData, currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): AiOperationalMetrics["speed"] {
  const currentItems = raw.orderItems.filter((item) => inRange(item.sent_at ?? item.created_at, currentStart, currentEnd));
  const previousItems = raw.orderItems.filter((item) => inRange(item.sent_at ?? item.created_at, previousStart, previousEnd));
  const stationValues = (items: OrderItemRow[], station: string, phase: "start" | "ready") =>
    items
      .filter((item) => item.preparation_station === station)
      .map((item) => (phase === "start" ? minutesBetween(item.sent_at, item.started_at) : minutesBetween(item.started_at, item.ready_at)))
      .filter((value): value is number => value !== null);

  const currentEventsByOrder = new Map<string, OrderStatusEventRow[]>();
  const previousEventsByOrder = new Map<string, OrderStatusEventRow[]>();
  for (const event of raw.orderEvents) {
    const bucket = inRange(event.created_at, currentStart, currentEnd) ? currentEventsByOrder : inRange(event.created_at, previousStart, previousEnd) ? previousEventsByOrder : null;
    if (!bucket) continue;
    bucket.set(event.order_id, [...(bucket.get(event.order_id) ?? []), event]);
  }

  const orderTransitionValues = (bucket: Map<string, OrderStatusEventRow[]>, fromStatus: string, toStatus: string) =>
    [...bucket.values()]
      .map((events) => minutesBetween(firstEvent(events, fromStatus), firstEvent(events, toStatus)))
      .filter((value): value is number => value !== null);

  return {
    kitchen: {
      metrics: [
        durationMetric("المطبخ: submitted → preparing / وقت بدء الاستجابة", "submitted_to_preparing", stationValues(currentItems, "kitchen", "start"), stationValues(previousItems, "kitchen", "start"), 10),
        durationMetric("المطبخ: preparing → ready / وقت التحضير", "preparing_to_ready", stationValues(currentItems, "kitchen", "ready"), stationValues(previousItems, "kitchen", "ready"), 25),
      ],
    },
    barista: {
      metrics: [
        durationMetric("الباريستا: submitted → preparing / وقت بدء الاستجابة", "submitted_to_preparing", stationValues(currentItems, "barista", "start"), stationValues(previousItems, "barista", "start"), 8),
        durationMetric("الباريستا: preparing → ready / وقت التحضير", "preparing_to_ready", stationValues(currentItems, "barista", "ready"), stationValues(previousItems, "barista", "ready"), 15),
      ],
    },
    captain: {
      metrics: [
        durationMetric("الكابتن: ready → awaiting_payment / انتظار تقديم الطلب للزبون", "ready_to_awaiting_payment", orderTransitionValues(currentEventsByOrder, "ready", "awaiting_payment"), orderTransitionValues(previousEventsByOrder, "ready", "awaiting_payment"), 12),
      ],
    },
    cashier: {
      metrics: [
        durationMetric("الكاشير: awaiting_payment → paid / انتظار الدفع", "awaiting_payment_to_paid", orderTransitionValues(currentEventsByOrder, "awaiting_payment", "paid"), orderTransitionValues(previousEventsByOrder, "awaiting_payment", "paid"), 10),
      ],
    },
  };
}

function sumByRange<T extends { created_at?: string; expense_date?: string; amount?: number | string; total_amount?: number | string }>(
  rows: T[],
  start: string,
  end: string,
  dateKey: "created_at" | "expense_date",
  amountKey: "amount" | "total_amount",
) {
  return rows.filter((row) => inRange(String(row[dateKey] ?? ""), start, end)).reduce((sum, row) => sum + asNumber(row[amountKey]), 0);
}

function buildFinanceMetrics(raw: OperationalRawData, currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): AiOperationalMetrics["finance"] {
  const completedPayments = raw.purchasePayments;
  const purchaseTotals = new Map(raw.purchases.map((purchase) => [purchase.id, asNumber(purchase.total_amount)]));
  const paidByPurchase = new Map<string, number>();
  for (const payment of completedPayments) paidByPurchase.set(payment.purchase_id, (paidByPurchase.get(payment.purchase_id) ?? 0) + asNumber(payment.amount));
  const estimatedOutstandingPayables = [...purchaseTotals.entries()].reduce((sum, [purchaseId, total]) => sum + Math.max(total - (paidByPurchase.get(purchaseId) ?? 0), 0), 0);
  const overdueCutoff = addDays(baghdadToday(), -7);
  const overdueSupplierBills = raw.purchases.filter((purchase) => {
    const unpaid = Math.max(asNumber(purchase.total_amount) - (paidByPurchase.get(purchase.id) ?? 0), 0);
    return unpaid > 0 && purchase.created_at < startIso(overdueCutoff);
  }).length;
  const activeCashMovements = raw.cashMovements.filter((movement) => !movement.voided_at && movement.event_type === "original");
  const cashInRows = activeCashMovements.filter((movement) => movement.direction === "in");
  const cashOutRows = activeCashMovements.filter((movement) => movement.direction === "out");
  const currentDifferences = raw.cashShifts.filter((shift) => inRange(shift.closed_at ?? shift.created_at, currentStart, currentEnd)).reduce((sum, shift) => sum + asNumber(shift.cash_difference), 0);
  const previousDifferences = raw.cashShifts.filter((shift) => inRange(shift.closed_at ?? shift.created_at, previousStart, previousEnd)).reduce((sum, shift) => sum + asNumber(shift.cash_difference), 0);

  return {
    purchases: comparison(sumByRange(raw.purchases, currentStart, currentEnd, "created_at", "total_amount"), sumByRange(raw.purchases, previousStart, previousEnd, "created_at", "total_amount")),
    supplierPayments: comparison(sumByRange(completedPayments, currentStart, currentEnd, "created_at", "amount"), sumByRange(completedPayments, previousStart, previousEnd, "created_at", "amount")),
    estimatedOutstandingPayables: roundMetric(estimatedOutstandingPayables),
    overdueSupplierBills,
    expenses: comparison(sumByRange(raw.expenses, currentStart, currentEnd, "expense_date", "amount"), sumByRange(raw.expenses, previousStart, previousEnd, "expense_date", "amount")),
    cashIn: comparison(sumByRange(cashInRows, currentStart, currentEnd, "created_at", "amount"), sumByRange(cashInRows, previousStart, previousEnd, "created_at", "amount")),
    cashOut: comparison(sumByRange(cashOutRows, currentStart, currentEnd, "created_at", "amount"), sumByRange(cashOutRows, previousStart, previousEnd, "created_at", "amount")),
    cashShiftDifferences: comparison(currentDifferences, previousDifferences),
    openCashShifts: raw.cashShifts.filter((shift) => shift.status === "open").length,
  };
}

function buildOperationalMetrics(raw: OperationalRawData, today: string): AiOperationalMetrics {
  const currentStart = startIso(addDays(today, -29));
  const currentEnd = endExclusiveIso(today);
  const previousStart = startIso(addDays(today, -59));
  const previousEnd = startIso(addDays(today, -29));
  return {
    tables: buildTableMetrics(raw, currentStart, currentEnd, previousStart, previousEnd),
    speed: buildSpeedMetrics(raw, currentStart, currentEnd, previousStart, previousEnd),
    finance: buildFinanceMetrics(raw, currentStart, currentEnd, previousStart, previousEnd),
    dataQuality: buildDataQuality(raw),
  };
}

function emptyAnalysis(summary = "لا توجد بيانات مخزون كافية للتحليل حالياً."): AiInventoryMonitorAnalysis {
  return {
    overallStatus: "طبيعي",
    summary,
    topAlerts: [],
    stockoutRisk: [],
    unusualConsumption: [],
    wasteFollowUp: [],
    supplierPriceChanges: [],
    recommendations: ["راجع إدخال حركات المخزون والمشتريات والهدر ثم أعد التحليل."],
  };
}

function departmentBreakdown(input: Record<string, number | string> | undefined) {
  return Object.fromEntries(Object.entries(input ?? {}).map(([key, value]) => [key, asNumber(value)]));
}

function itemKey(item: InventoryAnalyticsItemPayload) {
  return `${item.name_ar ?? ""}|${item.base_unit_code ?? ""}`;
}

function sanitizeAnalytics(analytics30: InventoryAnalyticsPayload, analytics7: InventoryAnalyticsPayload) {
  const sevenDayByItem = new Map((analytics7.items ?? []).map((item) => [itemKey(item), item]));

  const items: SanitizedInventoryItem[] = (analytics30.items ?? []).map((item) => {
    const item7 = sevenDayByItem.get(itemKey(item));

    return {
      item: item.name_ar ?? "مادة غير معروفة",
      itemType: item.item_type ?? "unknown",
      unit: item.base_unit_name ?? item.base_unit_code ?? "وحدة",
      isActive: Boolean(item.is_active),
      stockOnHand: asNumber(item.stock_on_hand),
      minimumStock: asNumber(item.minimum_stock),
      averageCost: asNumber(item.average_cost),
      lastPurchaseCost: asNumber(item.last_purchase_cost),
      coverageDays: optionalNumber(item.operations?.coverage_days),
      dailyIssueRate: optionalNumber(item.operations?.daily_issue_rate),
      issuePer100Dishes: optionalNumber(item.operations?.issue_per_100_dishes),
      previousIssuePer100Dishes: optionalNumber(item.operations?.previous_issue_per_100_dishes),
      consumption7: {
        quantity: asNumber(item7?.issues?.quantity),
        events: asNumber(item7?.issues?.count),
        changePercentVsPrevious: optionalNumber(item7?.comparison?.issue_quantity_percent),
        per100DishesChangePercent: optionalNumber(item7?.comparison?.issue_per_100_dishes_percent),
      },
      consumption30: {
        quantity: asNumber(item.issues?.quantity),
        events: asNumber(item.issues?.count),
        changePercentVsPrevious: optionalNumber(item.comparison?.issue_quantity_percent),
        departmentBreakdown: departmentBreakdown(item.issues?.department_breakdown),
      },
      purchases30: {
        quantity: asNumber(item.purchases?.quantity),
        events: asNumber(item.purchases?.count),
        total: asNumber(item.purchases?.total),
        averageUnitCost: asNumber(item.purchases?.average_unit_cost),
        lastUnitCost: asNumber(item.purchases?.last_unit_cost),
        minUnitCost: asNumber(item.purchases?.min_unit_cost),
        maxUnitCost: asNumber(item.purchases?.max_unit_cost),
        purchaseCostChangePercent: optionalNumber(item.comparison?.purchase_cost_percent),
        lastPurchaseAt: item.purchases?.last_purchase_at ?? null,
        supplierCount: asNumber(item.purchases?.supplier_count),
      },
      waste30: {
        totalQuantity: asNumber(item.waste?.total_quantity),
        warehouseQuantity: asNumber(item.waste?.warehouse_quantity),
        departmentQuantity: asNumber(item.waste?.department_quantity),
        events: asNumber(item.waste?.count),
        ratioDepartmentToIssued: optionalNumber(item.waste?.ratio_department_to_issued),
        changePercentVsPrevious: optionalNumber(item.comparison?.waste_quantity_percent),
        topReason: item.waste?.top_reason ?? null,
        topDestination: item.waste?.top_destination ?? null,
      },
      recipeConsumption30: {
        quantity: asNumber(item.recipe_consumption?.quantity),
        events: asNumber(item.recipe_consumption?.count),
      },
    };
  });

  return {
    dataSource: "get_inventory_analytics",
    privacy: "No UUIDs, staff names, phone numbers, or personal data are included. Supplier names are omitted.",
    range30: analytics30.range,
    range7: analytics7.range,
    overview30: {
      inventoryValue: asNumber(analytics30.overview?.inventory_value),
      followUpCount: asNumber(analytics30.overview?.follow_up_count),
      issueCostEstimate: asNumber(analytics30.overview?.issue_cost_estimate),
      actualWasteQuantityEvents: asNumber(analytics30.overview?.actual_waste_quantity_events),
      dishQuantity: asNumber(analytics30.overview?.dish_quantity),
      previousDishQuantity: asNumber(analytics30.overview?.previous_dish_quantity),
    },
    overview7: {
      issueCostEstimate: asNumber(analytics7.overview?.issue_cost_estimate),
      actualWasteQuantityEvents: asNumber(analytics7.overview?.actual_waste_quantity_events),
      dishQuantity: asNumber(analytics7.overview?.dish_quantity),
      previousDishQuantity: asNumber(analytics7.overview?.previous_dish_quantity),
    },
    items: items
      .sort((first, second) => {
        const firstRisk = (first.stockOnHand <= first.minimumStock ? 1000 : 0) + (first.coverageDays !== null && first.coverageDays <= 3 ? 500 : 0) + first.waste30.totalQuantity + first.consumption30.quantity;
        const secondRisk = (second.stockOnHand <= second.minimumStock ? 1000 : 0) + (second.coverageDays !== null && second.coverageDays <= 3 ? 500 : 0) + second.waste30.totalQuantity + second.consumption30.quantity;
        return secondRisk - firstRisk;
      })
      .slice(0, 80),
  };
}

async function getAnalytics(supabase: Awaited<ReturnType<typeof createClient>>, startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc("get_inventory_analytics" as never, {
    p_start_date: startDate,
    p_end_date: endDate,
    p_item_type: null,
  } as never);

  if (error) {
    logSupabaseError("[ai inventory analytics RPC]", error);
    throw error;
  }

  return (data ?? {}) as InventoryAnalyticsPayload;
}

async function readOptionalRows<T>(label: string, query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    logSupabaseError(label, error);
    return [];
  }
  return (Array.isArray(data) ? data : []) as T[];
}

async function loadOperationalRawData(supabase: Awaited<ReturnType<typeof createClient>>, oldestStart: string, currentEnd: string): Promise<OperationalRawData> {
  const [
    tables,
    sessions,
    orders,
    orderItems,
    orderEvents,
    payments,
    cashShifts,
    cashMovements,
    purchases,
    purchasePayments,
    expenses,
  ] = await Promise.all([
    readOptionalRows<RestaurantTableRow>("[ai operations restaurant_tables SELECT]", supabase.from("restaurant_tables").select("id, table_number, name, is_active")),
    readOptionalRows<TableSessionRow>("[ai operations table_sessions SELECT]", supabase.from("table_sessions").select("id, table_id, status, opened_at, closed_at").gte("opened_at", oldestStart).lt("opened_at", currentEnd).limit(5000)),
    readOptionalRows<OrderRow>("[ai operations orders SELECT]", supabase.from("orders").select("id, table_id, table_session_id, status, total, submitted_at, served_at, paid_at, created_at").gte("created_at", oldestStart).lt("created_at", currentEnd).limit(8000)),
    readOptionalRows<OrderItemRow>("[ai operations order_items SELECT]", supabase.from("order_items").select("order_id, preparation_station, status, sent_at, started_at, ready_at, served_at, created_at").gte("created_at", oldestStart).lt("created_at", currentEnd).limit(12000)),
    readOptionalRows<OrderStatusEventRow>("[ai operations order_status_events SELECT]", supabase.from("order_status_events").select("order_id, from_status, to_status, created_at").gte("created_at", oldestStart).lt("created_at", currentEnd).limit(12000)),
    readOptionalRows<PaymentRow>("[ai operations payments SELECT]", supabase.from("payments").select("method, amount, status, created_at").gte("created_at", oldestStart).lt("created_at", currentEnd).limit(8000)),
    readOptionalRows<CashShiftRow>("[ai operations cash_shifts SELECT]", supabase.from("cash_shifts").select("business_date, opened_at, closed_at, expected_cash_snapshot, cash_difference, status, created_at").gte("created_at", oldestStart).lt("created_at", currentEnd).limit(2000)),
    readOptionalRows<CashMovementRow>("[ai operations cash_movements SELECT]", supabase.from("cash_movements").select("direction, movement_type, event_type, amount, source_type, created_at, voided_at").gte("created_at", oldestStart).lt("created_at", currentEnd).limit(8000)),
    readOptionalRows<PurchaseRow>("[ai operations purchases SELECT]", supabase.from("purchases").select("id, total_amount, payment_status, created_at").limit(5000)),
    readOptionalRows<PurchasePaymentRow>("[ai operations purchase_payments SELECT]", supabase.from("purchase_payments" as never).select("purchase_id, amount, payment_method, created_at").limit(5000)),
    readOptionalRows<ExpenseRow>("[ai operations expenses SELECT]", supabase.from("expenses").select("amount, category, expense_date, created_at").gte("expense_date", oldestStart.slice(0, 10)).lt("expense_date", currentEnd.slice(0, 10)).limit(5000)),
  ]);

  return { tables, sessions, orders, orderItems, orderEvents, payments, cashShifts, cashMovements, purchases, purchasePayments, expenses };
}

function extractResponseText(payload: unknown) {
  const response = payload as { output_text?: unknown; output?: { content?: { text?: unknown; type?: string }[] }[] };
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function runOpenAiAnalysis(input: unknown, model: string): Promise<{ inventory: AiInventoryMonitorAnalysis; operations: AiOperationalAnalysis }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "أنت محلل تشغيلي لمطعم. الأرقام محسوبة مسبقاً من النظام وليست من عندك. ممنوع اختراع أي رقم أو مادة أو شخص. لا ترسل أحكاماً على الموظفين ولا تقترح تنفيذ عمليات داخل النظام. تجنب تكرار نفس التنبيه حرفياً بين الأقسام. أعد JSON عربي مطابق للـschema فقط.",
        },
        {
          role: "user",
          content:
            "حلل بيانات Khatoun POS التالية. المخزون والطاولات والسرعة والمالية كلها أرقام محسوبة داخل النظام، ودورك تفسير الأنماط والتنبيه والتوصية فقط. إذا كان الرقم غير موجود استخدم عبارة بيانات غير كافية داخل النص ولا تخترع رقماً. في السرعة التشغيلية: لا تسم مرحلة بطيئة إذا sample_count أقل من 5، واستخدم medianMinutes لوصف الوقت المعتاد، واذكر outlierCount أو suspiciousFastCount إذا ظهرت. اجعل Executive Summary أهم 5 أمور فقط وبدون تكرار.\n" +
            JSON.stringify(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "khatoun_operational_analytics_v2",
          strict: true,
          schema: combinedAnalysisSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`OpenAI inventory monitor failed: ${response.status} ${message.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = extractResponseText(payload);
  if (!text) throw new Error("OpenAI inventory monitor returned an empty response.");
  return JSON.parse(text) as { inventory: AiInventoryMonitorAnalysis; operations: AiOperationalAnalysis };
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return serverError("طلب غير مسموح", 403);

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return serverError("غير مصرح", 401);

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", authData.user.id)
    .maybeSingle();
  const profile = currentProfile as { role?: string; status?: string } | null;

  if (profileError || !profile || profile.status !== "active") return serverError("غير مصرح", 401);
  if (profile.role !== "admin" && profile.role !== "storekeeper" && profile.role !== "owner") {
    return serverError("هذه الخدمة متاحة للإدارة والمخزن فقط", 403);
  }

  const today = baghdadToday();
  const start30 = addDays(today, -29);
  const start7 = addDays(today, -6);
  const start60 = addDays(today, -59);
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
  const apiKeyConfigured = Boolean(process.env.OPENAI_API_KEY);

  const [analytics30, analytics7, operationalRaw] = await Promise.all([
    getAnalytics(supabase, start30, today),
    getAnalytics(supabase, start7, today),
    loadOperationalRawData(supabase, startIso(start60), endExclusiveIso(today)),
  ]);
  const sanitized = sanitizeAnalytics(analytics30, analytics7);
  const operationalMetrics = buildOperationalMetrics(operationalRaw, today);
  const operationalInput = {
    dataSource: "Khatoun POS deterministic operational metrics",
    privacy: "No UUIDs, employee names, phone numbers, or personal data are included. Analysis is by table number, station, role, and financial category only.",
    periodComparison: {
      current30Days: { startDate: start30, endDate: today },
      previous30Days: { startDate: start60, endDate: addDays(start30, -1) },
      timezone: "Asia/Baghdad",
    },
    metrics: operationalMetrics,
  };
  const dataSummary = {
    itemCount: sanitized.items.length,
    inventoryValue: sanitized.overview30.inventoryValue,
    followUpCount: sanitized.overview30.followUpCount,
    empty: sanitized.items.length === 0,
  };
  const dataWindow = {
    last7Days: { startDate: start7, endDate: today },
    last30Days: { startDate: start30, endDate: today },
    timezone: "Asia/Baghdad" as const,
  };

  if (!apiKeyConfigured) {
    const response: AiInventoryMonitorResponse = {
      configured: false,
      generatedAt: new Date().toISOString(),
      dataWindow,
      dataSummary,
      analysis: emptyAnalysis("خدمة التحليل الذكي غير مهيأة. أضف OPENAI_API_KEY على الخادم لتفعيل التحليل."),
      operationalAnalysis: emptyOperationalAnalysis("خدمة التحليل الذكي غير مهيأة. تظهر المقاييس الرقمية فقط بدون تفسير AI."),
      operationalMetrics,
    };
    return NextResponse.json(response, { status: 503 });
  }

  if (sanitized.items.length === 0 && operationalMetrics.dataQuality.counts.orders === 0 && operationalMetrics.dataQuality.counts.sessions === 0) {
    const response: AiInventoryMonitorResponse = {
      configured: true,
      generatedAt: new Date().toISOString(),
      model,
      dataWindow,
      dataSummary,
      analysis: emptyAnalysis("لا توجد مواد أو حركات مخزون كافية خلال فترة التحليل."),
      operationalAnalysis: emptyOperationalAnalysis(operationalMetrics.dataQuality.reason),
      operationalMetrics,
    };
    return NextResponse.json(response);
  }

  try {
    const combinedAnalysis = await runOpenAiAnalysis({ inventory: sanitized, operations: operationalInput }, model);
    const response: AiInventoryMonitorResponse = {
      configured: true,
      generatedAt: new Date().toISOString(),
      model,
      dataWindow,
      dataSummary,
      analysis: combinedAnalysis.inventory,
      operationalAnalysis: {
        ...combinedAnalysis.operations,
        executiveSummary: combinedAnalysis.operations.executiveSummary.slice(0, 5),
      },
      operationalMetrics,
    };
    return NextResponse.json(response);
  } catch (error) {
    logSupabaseError("[ai inventory monitor OpenAI]", error);
    return serverError("تعذر تشغيل التحليل الذكي حالياً.", 502);
  }
}
