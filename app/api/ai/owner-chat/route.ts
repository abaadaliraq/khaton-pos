import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/supabaseError";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolName =
  | "menu_catalog"
  | "equipment_summary"
  | "table_activity"
  | "inventory_analytics"
  | "finance_summary"
  | "operational_timing"
  | "purchases_supplier_summary"
  | "cash_shift_summary"
  | "executive_snapshot";
type PeriodName = "today" | "last7" | "last30" | "thisMonth" | "previousMonth";

type ToolPlan = {
  tools: ToolName[];
  period: PeriodName;
  reason: string;
};

type Range = {
  label: string;
  startDate: string;
  endDate: string;
  startIso: string;
  endIsoExclusive: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const allowedTools: ToolName[] = [
  "menu_catalog",
  "equipment_summary",
  "table_activity",
  "inventory_analytics",
  "finance_summary",
  "operational_timing",
  "purchases_supplier_summary",
  "cash_shift_summary",
  "executive_snapshot",
];

const toolPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tools: {
      type: "array",
      items: {
        type: "string",
        enum: ["menu_catalog", "equipment_summary", "table_activity", "inventory_analytics", "finance_summary", "operational_timing", "purchases_supplier_summary", "cash_shift_summary", "executive_snapshot"],
      },
    },
    period: { type: "string", enum: ["today", "last7", "last30", "thisMonth", "previousMonth"] },
    reason: { type: "string" },
  },
  required: ["tools", "period", "reason"],
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

function round(value: number) {
  return Math.round(value * 100) / 100;
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

function dateRange(period: PeriodName): Range {
  const today = baghdadToday();
  if (period === "today") return { label: "اليوم", startDate: today, endDate: today, startIso: startIso(today), endIsoExclusive: endExclusiveIso(today) };
  if (period === "last7") {
    const startDate = addDays(today, -6);
    return { label: "آخر 7 أيام", startDate, endDate: today, startIso: startIso(startDate), endIsoExclusive: endExclusiveIso(today) };
  }
  if (period === "thisMonth") {
    const startDate = `${today.slice(0, 8)}01`;
    return { label: "هذا الشهر", startDate, endDate: today, startIso: startIso(startDate), endIsoExclusive: endExclusiveIso(today) };
  }
  if (period === "previousMonth") {
    const currentMonthStart = `${today.slice(0, 8)}01`;
    const previousMonthEnd = addDays(currentMonthStart, -1);
    const startDate = `${previousMonthEnd.slice(0, 8)}01`;
    return { label: "الشهر السابق", startDate, endDate: previousMonthEnd, startIso: startIso(startDate), endIsoExclusive: endExclusiveIso(previousMonthEnd) };
  }
  const startDate = addDays(today, -29);
  return { label: "آخر 30 يوم", startDate, endDate: today, startIso: startIso(startDate), endIsoExclusive: endExclusiveIso(today) };
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function inferIntent(question: string): { tools: ToolName[]; period?: PeriodName } {
  const normalized = question.toLowerCase();
  const tools: ToolName[] = [];

  if (includesAny(normalized, ["منيو", "menu", "صنف", "اصناف", "أصناف", "حلويات", "حلو", "مشروبات", "مشروب", "اطعمة", "أطعمة", "اكل", "أكل", "سعر", "اسعار", "أسعار"])) tools.push("menu_catalog");
  if (includesAny(normalized, ["معدات", "معدة", "جهاز", "اجهزة", "أجهزة", "ثلاجة", "صيانة", "عطل", "اعطال", "أعطال"])) tools.push("equipment_summary");
  if (includesAny(normalized, ["طاولة", "طاولات", "جلسة", "جلسات", "انشغلت", "مشغولة", "استخدام", "استخدمت"])) tools.push("table_activity");
  if (includesAny(normalized, ["مخزون", "هدر", "تلف", "استهلاك", "مادة", "مواد", "كلينكس", "نفاد"])) tools.push("inventory_analytics");
  if (includesAny(normalized, ["مطبخ", "باريستا", "كابتن", "كاشير", "سرعة", "تأخير", "تاخير", "الخدمة"])) tools.push("operational_timing");
  if (includesAny(normalized, ["حسابات", "مالية", "مصروف", "مصروفات", "صندوق", "وردية", "ورديات", "مورد", "موردين", "دفعات", "مدفوعات", "مستحقات"])) tools.push("finance_summary");

  const period = includesAny(normalized, ["الشهر الفات", "الشهر الماضي", "الشهر السابق"]) ? "previousMonth" : includesAny(normalized, ["هذا الشهر"]) ? "thisMonth" : includesAny(normalized, ["اليوم"]) ? "today" : includesAny(normalized, ["اسبوع", "أسبوع", "٧", "7 أيام", "سبعة"]) ? "last7" : undefined;

  if (tools.length === 0 && includesAny(normalized, ["مشاكل", "مشكلة", "انتبه", "ملخص", "وضع"])) tools.push("executive_snapshot");
  return { tools: [...new Set(tools)], period };
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]);
}

function timingMetric(label: string, stage: string, currentValues: number[], previousValues: number[], thresholdMinutes: number) {
  const currentMedian = median(currentValues);
  const previousMedian = median(previousValues);
  const suspiciousFastCount = currentValues.filter((value) => value > 0 && value <= 0.0834).length;
  const outlierThreshold = currentMedian === null ? null : Math.max(thresholdMinutes, currentMedian * 3);
  const outlierCount = outlierThreshold === null ? 0 : currentValues.filter((value) => value > outlierThreshold).length;
  const quality = currentValues.length === 0 ? "غير كافية" : currentValues.length < 5 ? "عينة قليلة" : suspiciousFastCount > 0 ? "بيانات اختبار محتملة" : "كافية";
  const note =
    currentValues.length === 0
      ? "لا توجد عينات مكتملة لهذه المرحلة."
      : currentValues.length < 5
        ? "العينة قليلة ولا تكفي للحكم."
        : suspiciousFastCount > 0
          ? "توجد مدد قصيرة جداً قد تكون بيانات اختبار أو تحديث حالات سريع."
          : outlierCount > 0
            ? "يوجد طلب غير اعتيادي أثر على المتوسط؛ الوسيط أدق للوقت المعتاد."
            : "العينة كافية، والوسيط يصف الوقت المعتاد.";
  return {
    label,
    stage,
    usualSource: "median",
    averageMinutes: average(currentValues),
    medianMinutes: currentMedian,
    minMinutes: currentValues.length ? round(Math.min(...currentValues)) : null,
    maxMinutes: currentValues.length ? round(Math.max(...currentValues)) : null,
    sample_count: currentValues.length,
    previousMedianMinutes: previousMedian,
    changePercent: currentMedian !== null && previousMedian !== null && previousMedian !== 0 ? round(((currentMedian - previousMedian) / Math.abs(previousMedian)) * 100) : null,
    outlierCount,
    suspiciousFastCount,
    quality,
    note,
  };
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

async function callOpenAi(input: unknown, model: string, schema?: object) {
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
      input,
      ...(schema
        ? {
            text: {
              format: {
                type: "json_schema",
                name: "ask_khatoun_owner_tool_plan",
                strict: true,
                schema,
              },
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`OpenAI owner chat failed: ${response.status} ${message.slice(0, 300)}`);
  }

  return extractResponseText(await response.json());
}

async function getInventoryAnalytics(supabase: SupabaseServerClient, range: Range) {
  const { data, error } = await supabase.rpc("get_inventory_analytics" as never, {
    p_start_date: range.startDate,
    p_end_date: range.endDate,
    p_item_type: null,
  } as never);
  if (error) throw error;
  const payload = (data ?? {}) as {
    overview?: Record<string, number | string>;
    items?: Array<{
      name_ar?: string;
      base_unit_name?: string;
      stock_on_hand?: number | string;
      minimum_stock?: number | string;
      issues?: { quantity?: number | string; count?: number | string };
      waste?: { total_quantity?: number | string; count?: number | string };
      operations?: { coverage_days?: number | string | null };
      comparison?: { issue_quantity_percent?: number | string | null; waste_quantity_percent?: number | string | null };
    }>;
  };
  return {
    tool: "inventory_analytics",
    range: range.label,
    overview: payload.overview ?? {},
    topItems: (payload.items ?? [])
      .map((item) => ({
        item: item.name_ar ?? "مادة غير معروفة",
        unit: item.base_unit_name ?? "وحدة",
        stockOnHand: asNumber(item.stock_on_hand),
        minimumStock: asNumber(item.minimum_stock),
        issueQuantity: asNumber(item.issues?.quantity),
        wasteQuantity: asNumber(item.waste?.total_quantity),
        coverageDays: item.operations?.coverage_days ?? null,
        issueChangePercent: item.comparison?.issue_quantity_percent ?? null,
        wasteChangePercent: item.comparison?.waste_quantity_percent ?? null,
      }))
      .sort((first, second) => second.issueQuantity + second.wasteQuantity - (first.issueQuantity + first.wasteQuantity))
      .slice(0, 12),
  };
}

function categoryLabel(category: string | null | undefined) {
  return category?.trim() || "قسم غير محدد";
}

async function getMenuCatalog(supabase: SupabaseServerClient) {
  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("menu_categories").select("id, name_ar, name_en, is_active, sort_order").order("sort_order", { ascending: true }),
    supabase.from("menu_items").select("id, category_id, name_ar, price, preparation_station, is_available").order("sort_order", { ascending: true }).limit(2000),
  ]);
  if (categoriesError) throw categoriesError;
  if (itemsError) throw itemsError;

  const categoryRows = (categories ?? []) as Array<{ id: string; name_ar: string; name_en: string | null; is_active: boolean }>;
  const itemRows = (items ?? []) as Array<{ category_id: string; name_ar: string; price: number | string | null; preparation_station: string; is_available: boolean }>;
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const byCategory = categoryRows.map((category) => {
    const categoryItems = itemRows.filter((item) => item.category_id === category.id);
    return {
      category: category.name_ar,
      categoryEn: category.name_en,
      activeCategory: category.is_active,
      totalItems: categoryItems.length,
      availableItems: categoryItems.filter((item) => item.is_available).length,
      unavailableItems: categoryItems.filter((item) => !item.is_available).length,
      priceRange: {
        min: categoryItems.length ? Math.min(...categoryItems.map((item) => asNumber(item.price))) : 0,
        max: categoryItems.length ? Math.max(...categoryItems.map((item) => asNumber(item.price))) : 0,
      },
      items: categoryItems.slice(0, 20).map((item) => ({ name: item.name_ar, price: asNumber(item.price), available: item.is_available, station: item.preparation_station })),
    };
  });
  return {
    tool: "menu_catalog",
    scope: "menu_items + menu_categories",
    totalItems: itemRows.length,
    availableItems: itemRows.filter((item) => item.is_available).length,
    unavailableItems: itemRows.filter((item) => !item.is_available).length,
    byCategory,
    uncategorizedItems: itemRows.filter((item) => !categoryById.has(item.category_id)).length,
  };
}

async function getEquipmentSummary(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("equipment_assets" as never)
    .select("asset_code, name_ar, category, location, status, is_active, equipment_maintenance_records(maintenance_type, status, reported_at, completed_at, next_maintenance_date, problem_description)")
    .limit(2000);
  if (error) throw error;

  const assets = (data ?? []) as unknown as Array<{
    asset_code: string;
    name_ar: string;
    category: string;
    location: string;
    status: string;
    is_active: boolean;
    equipment_maintenance_records: Array<{ maintenance_type: string; status: string; reported_at: string; completed_at: string | null; next_maintenance_date: string | null; problem_description: string | null }> | null;
  }>;
  const activeAssets = assets.filter((asset) => asset.is_active);
  const today = baghdadToday();
  const groupCount = (key: "category" | "location" | "status") =>
    Object.fromEntries(
      [...new Set(activeAssets.map((asset) => asset[key]))].map((value) => [categoryLabel(value), activeAssets.filter((asset) => asset[key] === value).length]),
    );
  const maintenanceRows = activeAssets.flatMap((asset) => (asset.equipment_maintenance_records ?? []).map((record) => ({ asset: asset.name_ar, ...record })));
  return {
    tool: "equipment_summary",
    scope: "equipment_assets + equipment_maintenance_records",
    totalActive: activeAssets.length,
    byCategory: groupCount("category"),
    byLocation: groupCount("location"),
    byStatus: groupCount("status"),
    kitchenAssets: activeAssets.filter((asset) => asset.location === "kitchen").map((asset) => ({ code: asset.asset_code, name: asset.name_ar, category: asset.category, status: asset.status })),
    electricalKitchenAssets: activeAssets.filter((asset) => asset.location === "kitchen" && asset.category === "electrical").map((asset) => ({ code: asset.asset_code, name: asset.name_ar, status: asset.status })),
    maintenanceFollowUp: maintenanceRows
      .filter((record) => ["reported", "scheduled", "in_progress"].includes(record.status) || (record.next_maintenance_date ? record.next_maintenance_date < today : false))
      .slice(0, 20),
  };
}

async function getTableActivity(supabase: SupabaseServerClient, range: Range) {
  const [{ data: tables, error: tablesError }, { data: sessions, error: sessionsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from("restaurant_tables").select("id, table_number, name"),
    supabase.from("table_sessions").select("id, table_id, status, opened_at, closed_at").gte("opened_at", range.startIso).lt("opened_at", range.endIsoExclusive).limit(5000),
    supabase.from("orders").select("table_id, status, total, created_at, submitted_at, paid_at").gte("created_at", range.startIso).lt("created_at", range.endIsoExclusive).limit(8000),
  ]);
  if (tablesError) throw tablesError;
  if (sessionsError) throw sessionsError;
  if (ordersError) throw ordersError;

  const tableById = new Map(((tables ?? []) as Array<{ id: string; table_number: number; name: string | null }>).map((table) => [table.id, table]));
  const sessionRows = (sessions ?? []) as Array<{ table_id: string; status: string; opened_at: string; closed_at: string | null }>;
  const orderRows = ((orders ?? []) as Array<{ table_id: string; status: string; total: number | string; paid_at: string | null }>).filter((order) => order.status !== "cancelled");
  const salesByTable = new Map<string, number>();
  const sessionsByTable = new Map<string, number>();
  const ordersByTable = new Map<string, number>();
  for (const session of sessionRows) sessionsByTable.set(session.table_id, (sessionsByTable.get(session.table_id) ?? 0) + 1);
  for (const order of orderRows) {
    ordersByTable.set(order.table_id, (ordersByTable.get(order.table_id) ?? 0) + 1);
    if (order.status === "paid" || order.paid_at) salesByTable.set(order.table_id, (salesByTable.get(order.table_id) ?? 0) + asNumber(order.total));
  }
  const usedTableIds = new Set([...sessionsByTable.keys(), ...ordersByTable.keys()]);
  const rows = [...usedTableIds].map((tableId) => {
    const table = tableById.get(tableId);
    return {
      table: table?.name?.trim() || (table ? `طاولة ${table.table_number}` : "طاولة غير معروفة"),
      sessions: sessionsByTable.get(tableId) ?? 0,
      orders: ordersByTable.get(tableId) ?? 0,
      sales: round(salesByTable.get(tableId) ?? 0),
    };
  });
  const durations = sessionRows.map((session) => minutesBetween(session.opened_at, session.closed_at)).filter((value): value is number => value !== null);
  return {
    tool: "table_activity",
    range: range.label,
    definition: "طاولة مستخدمة = وجود جلسة table_session أو طلب order غير ملغى على الطاولة خلال الفترة. لا يشترط الدفع أو الإغلاق.",
    usedDistinctTables: usedTableIds.size,
    sessions: sessionRows.length,
    completedSessions: sessionRows.filter((session) => session.closed_at || session.status === "closed").length,
    orders: orderRows.length,
    paidSales: round(orderRows.filter((order) => order.status === "paid" || order.paid_at).reduce((sum, order) => sum + asNumber(order.total), 0)),
    averageBill: orderRows.length ? round(orderRows.reduce((sum, order) => sum + asNumber(order.total), 0) / orderRows.length) : 0,
    averageSessionMinutes: average(durations),
    mostUsedTables: [...rows].sort((first, second) => second.sessions + second.orders - (first.sessions + first.orders)).slice(0, 8),
    topSalesTables: [...rows].sort((first, second) => second.sales - first.sales).slice(0, 8),
    lowestUseTables: [...rows].filter((row) => row.sessions > 0).sort((first, second) => first.sessions - second.sessions).slice(0, 8),
  };
}

async function getOperationalTiming(supabase: SupabaseServerClient, range: Range) {
  const previousStartDate = addDays(range.startDate, -Math.max(1, Math.round((new Date(range.endIsoExclusive).getTime() - new Date(range.startIso).getTime()) / 86400000)));
  const previousRange = { startIso: startIso(previousStartDate), endIsoExclusive: range.startIso };
  const [{ data: items, error: itemsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("order_items").select("order_id, preparation_station, sent_at, started_at, ready_at, created_at").gte("created_at", previousRange.startIso).lt("created_at", range.endIsoExclusive).limit(12000),
    supabase.from("order_status_events").select("order_id, to_status, created_at").gte("created_at", previousRange.startIso).lt("created_at", range.endIsoExclusive).limit(12000),
  ]);
  if (itemsError) throw itemsError;
  if (eventsError) throw eventsError;
  const itemRows = (items ?? []) as Array<{ preparation_station: string; sent_at: string; started_at: string | null; ready_at: string | null; created_at: string }>;
  const rangeItems = (start: string, end: string, station: string) => itemRows.filter((item) => item.preparation_station === station && item.created_at >= start && item.created_at < end);
  const stationMetric = (station: string, label: string) => {
    const currentRows = rangeItems(range.startIso, range.endIsoExclusive, station);
    const previousRows = rangeItems(previousRange.startIso, previousRange.endIsoExclusive, station);
    const currentStartValues = currentRows.map((item) => minutesBetween(item.sent_at, item.started_at)).filter((value): value is number => value !== null);
    const previousStartValues = previousRows.map((item) => minutesBetween(item.sent_at, item.started_at)).filter((value): value is number => value !== null);
    const currentReadyValues = currentRows.map((item) => minutesBetween(item.started_at, item.ready_at)).filter((value): value is number => value !== null);
    const previousReadyValues = previousRows.map((item) => minutesBetween(item.started_at, item.ready_at)).filter((value): value is number => value !== null);
    return {
      station,
      metrics: [
        timingMetric(`${label}: submitted → preparing / وقت بدء الاستجابة`, "submitted_to_preparing", currentStartValues, previousStartValues, station === "barista" ? 8 : 10),
        timingMetric(`${label}: preparing → ready / وقت التحضير`, "preparing_to_ready", currentReadyValues, previousReadyValues, station === "barista" ? 15 : 25),
      ],
    };
  };
  const eventBucket = (start: string, end: string) => {
    const bucket = new Map<string, Array<{ to_status: string; created_at: string }>>();
    for (const event of (events ?? []) as Array<{ order_id: string; to_status: string; created_at: string }>) {
      if (event.created_at < start || event.created_at >= end) continue;
      bucket.set(event.order_id, [...(bucket.get(event.order_id) ?? []), event]);
    }
    return bucket;
  };
  const transitionValues = (bucket: Map<string, Array<{ to_status: string; created_at: string }>>, from: string, to: string) =>
    [...bucket.values()]
      .map((orderEvents) => {
        const sorted = orderEvents.sort((first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime());
        return minutesBetween(sorted.find((event) => event.to_status === from)?.created_at, sorted.find((event) => event.to_status === to)?.created_at);
      })
      .filter((value): value is number => value !== null);
  const currentEvents = eventBucket(range.startIso, range.endIsoExclusive);
  const previousEvents = eventBucket(previousRange.startIso, previousRange.endIsoExclusive);
  const captainCurrent = transitionValues(currentEvents, "ready", "awaiting_payment");
  const captainPrevious = transitionValues(previousEvents, "ready", "awaiting_payment");
  const cashierCurrent = transitionValues(currentEvents, "awaiting_payment", "paid");
  const cashierPrevious = transitionValues(previousEvents, "awaiting_payment", "paid");
  const kitchen = stationMetric("kitchen", "المطبخ");
  const barista = stationMetric("barista", "الباريستا");
  const captain = { metrics: [timingMetric("الكابتن: ready → awaiting_payment / انتظار تقديم الطلب للزبون", "ready_to_awaiting_payment", captainCurrent, captainPrevious, 12)] };
  const cashier = { metrics: [timingMetric("الكاشير: awaiting_payment → paid / انتظار الدفع", "awaiting_payment_to_paid", cashierCurrent, cashierPrevious, 10)] };
  const allMetrics = [
    ...kitchen.metrics,
    ...barista.metrics,
    ...captain.metrics,
    ...cashier.metrics,
  ];
  const reliableMetrics = allMetrics.filter((metric) => metric.sample_count >= 5);
  const biggestWait = [...(reliableMetrics.length ? reliableMetrics : allMetrics)].sort((first, second) => (second.medianMinutes ?? -1) - (first.medianMinutes ?? -1))[0] ?? null;

  return {
    tool: "operational_timing",
    range: range.label,
    definitions: {
      kitchenBaristaSubmittedToPreparing: "submitted → preparing = وقت بدء الاستجابة",
      kitchenBaristaPreparingToReady: "preparing → ready = وقت التحضير",
      captain: "ready → awaiting_payment = وقت انتظار تقديم الطلب للزبون",
      cashier: "awaiting_payment → paid = وقت انتظار الدفع",
    },
    guidance: "لا تعتبر أي مرحلة تأخيراً إذا sample_count أقل من 5. استخدم median لوصف الوقت المعتاد، واذكر outlierCount إذا رفع المتوسط.",
    biggestWait,
    kitchen,
    barista,
    captain,
    cashier,
  };
}

async function getFinanceSummary(supabase: SupabaseServerClient, range: Range) {
  const [{ data: payments, error: paymentsError }, { data: expenses, error: expensesError }, { data: purchases, error: purchasesError }, { data: purchasePayments, error: purchasePaymentsError }] = await Promise.all([
    supabase.from("payments").select("method, amount, status, created_at").gte("created_at", range.startIso).lt("created_at", range.endIsoExclusive).limit(5000),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", range.startDate).lte("expense_date", range.endDate).limit(3000),
    supabase.from("purchases").select("id, total_amount, created_at").limit(5000),
    supabase.from("purchase_payments" as never).select("purchase_id, amount, payment_method, created_at").limit(5000),
  ]);
  if (paymentsError) throw paymentsError;
  if (expensesError) throw expensesError;
  if (purchasesError) throw purchasesError;
  if (purchasePaymentsError) throw purchasePaymentsError;
  const paymentRows = ((payments ?? []) as Array<{ method: string; amount: number | string; status: string }>).filter((payment) => payment.status === "completed");
  const purchaseRows = (purchases ?? []) as Array<{ id: string; total_amount: number | string; created_at: string }>;
  const purchasePaymentRows = (purchasePayments ?? []) as unknown as Array<{ purchase_id: string; amount: number | string; payment_method: string; created_at: string }>;
  const paidByPurchase = new Map<string, number>();
  for (const payment of purchasePaymentRows) paidByPurchase.set(payment.purchase_id, (paidByPurchase.get(payment.purchase_id) ?? 0) + asNumber(payment.amount));
  const payables = purchaseRows.reduce((sum, purchase) => sum + Math.max(asNumber(purchase.total_amount) - (paidByPurchase.get(purchase.id) ?? 0), 0), 0);
  return {
    tool: "finance_summary",
    range: range.label,
    salesReceived: round(paymentRows.reduce((sum, payment) => sum + asNumber(payment.amount), 0)),
    byPaymentMethod: Object.fromEntries(["cash", "card", "transfer"].map((method) => [method, round(paymentRows.filter((payment) => payment.method === method).reduce((sum, payment) => sum + asNumber(payment.amount), 0))])),
    expenses: round(((expenses ?? []) as Array<{ amount: number | string }>).reduce((sum, expense) => sum + asNumber(expense.amount), 0)),
    supplierPayments: round(purchasePaymentRows.filter((payment) => payment.created_at >= range.startIso && payment.created_at < range.endIsoExclusive).reduce((sum, payment) => sum + asNumber(payment.amount), 0)),
    estimatedSupplierPayables: round(payables),
  };
}

async function getPurchasesSupplierSummary(supabase: SupabaseServerClient, range: Range) {
  const { data, error } = await supabase
    .from("purchases")
    .select("total_amount, created_at, supplier:suppliers!purchases_supplier_id_fkey(name)")
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIsoExclusive)
    .limit(3000);
  if (error) throw error;
  const bySupplier = new Map<string, { invoices: number; total: number }>();
  for (const row of (data ?? []) as unknown as Array<{ total_amount: number | string; supplier: { name: string } | null }>) {
    const supplier = row.supplier?.name ?? "مورد غير معروف";
    const current = bySupplier.get(supplier) ?? { invoices: 0, total: 0 };
    current.invoices += 1;
    current.total += asNumber(row.total_amount);
    bySupplier.set(supplier, current);
  }
  return {
    tool: "purchases_supplier_summary",
    range: range.label,
    suppliers: [...bySupplier.entries()]
      .map(([supplier, value]) => ({ supplier, invoices: value.invoices, total: round(value.total) }))
      .sort((first, second) => second.total - first.total)
      .slice(0, 10),
  };
}

async function getCashShiftSummary(supabase: SupabaseServerClient, range: Range) {
  const [{ data: shifts, error: shiftsError }, { data: movements, error: movementsError }] = await Promise.all([
    supabase.from("cash_shifts").select("business_date, status, opening_cash, expected_cash_snapshot, counted_cash, cash_difference, opened_at, closed_at").gte("created_at", range.startIso).lt("created_at", range.endIsoExclusive).limit(1000),
    supabase.from("cash_movements").select("direction, amount, event_type, voided_at, created_at").gte("created_at", range.startIso).lt("created_at", range.endIsoExclusive).limit(5000),
  ]);
  if (shiftsError) throw shiftsError;
  if (movementsError) throw movementsError;
  const shiftRows = (shifts ?? []) as Array<{ status: string; cash_difference: number | string | null }>;
  const activeMovements = ((movements ?? []) as Array<{ direction: string; amount: number | string; event_type: string; voided_at: string | null }>).filter((movement) => movement.event_type === "original" && !movement.voided_at);
  return {
    tool: "cash_shift_summary",
    range: range.label,
    shifts: shiftRows.length,
    openShifts: shiftRows.filter((shift) => shift.status === "open").length,
    totalDifference: round(shiftRows.reduce((sum, shift) => sum + asNumber(shift.cash_difference), 0)),
    cashIn: round(activeMovements.filter((movement) => movement.direction === "in").reduce((sum, movement) => sum + asNumber(movement.amount), 0)),
    cashOut: round(activeMovements.filter((movement) => movement.direction === "out").reduce((sum, movement) => sum + asNumber(movement.amount), 0)),
  };
}

async function executeTool(name: ToolName, supabase: SupabaseServerClient, range: Range) {
  if (name === "menu_catalog") return getMenuCatalog(supabase);
  if (name === "equipment_summary") return getEquipmentSummary(supabase);
  if (name === "table_activity") return getTableActivity(supabase, range);
  if (name === "inventory_analytics") return getInventoryAnalytics(supabase, range);
  if (name === "operational_timing") return getOperationalTiming(supabase, range);
  if (name === "finance_summary") return getFinanceSummary(supabase, range);
  if (name === "purchases_supplier_summary") return getPurchasesSupplierSummary(supabase, range);
  if (name === "cash_shift_summary") return getCashShiftSummary(supabase, range);
  const [menu, equipment, inventory, tables, timing, finance, purchases, cashShifts] = await Promise.all([
    getMenuCatalog(supabase),
    getEquipmentSummary(supabase),
    getInventoryAnalytics(supabase, range),
    getTableActivity(supabase, range),
    getOperationalTiming(supabase, range),
    getFinanceSummary(supabase, range),
    getPurchasesSupplierSummary(supabase, range),
    getCashShiftSummary(supabase, range),
  ]);
  return { tool: "executive_snapshot", range: range.label, menu, equipment, inventory, tables, timing, finance, purchases, cashShifts };
}

function cleanMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message): message is ChatMessage => {
      const maybe = message as ChatMessage;
      return (maybe.role === "user" || maybe.role === "assistant") && typeof maybe.content === "string" && maybe.content.trim().length > 0;
    })
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 1200) }));
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return serverError("طلب غير مسموح", 403);

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return serverError("غير مصرح", 401);

  const { data: currentProfile, error: profileError } = await supabase.from("profiles").select("role, status").eq("id", authData.user.id).maybeSingle();
  const profile = currentProfile as { role?: string; status?: string } | null;
  if (profileError || !profile || profile.status !== "active") return serverError("غير مصرح", 401);
  if (profile.role !== "owner") return serverError("اسأل خاتون متاح للمالك فقط حالياً", 403);

  const body = (await request.json().catch(() => ({}))) as { messages?: unknown };
  const messages = cleanMessages(body.messages);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return serverError("اكتب سؤالاً أولاً");
  if (!process.env.OPENAI_API_KEY) return serverError("خدمة اسأل خاتون غير مهيأة", 503);

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";

  try {
    const inferred = inferIntent(lastUserMessage.content);
    const planText = await callOpenAi(
      [
        {
          role: "system",
          content:
            "اختر أدوات قراءة فقط للإجابة على سؤال مالك مطعم خاتون. لا تطلب SQL ولا تعديلات. اختر من الأدوات المسموحة فقط. قواعد مهمة: سؤال المنيو/الأصناف/الحلويات/المشروبات يستخدم menu_catalog. سؤال المعدات/الثلاجة/الصيانة يستخدم equipment_summary. سؤال الطاولات/الجلسات/الاستخدام يستخدم table_activity. المخزون والهدر يستخدم inventory_analytics. السرعة تستخدم operational_timing. المالية والصندوق والموردون تستخدم finance_summary. أعد JSON فقط.",
        },
        {
          role: "user",
          content: JSON.stringify({ conversation: messages, allowedTools }),
        },
      ],
      model,
      toolPlanSchema,
    );
    const parsedPlan = JSON.parse(planText) as ToolPlan;
    const selectedTools = [...new Set([...(inferred.tools.length > 0 ? inferred.tools : parsedPlan.tools), ...parsedPlan.tools])].filter((tool): tool is ToolName => allowedTools.includes(tool));
    const fallbackTools: ToolName[] = ["executive_snapshot"];
    const safeTools = (selectedTools.length > 0 ? selectedTools : fallbackTools).slice(0, 3);
    const range = dateRange(inferred.period ?? parsedPlan.period ?? "last30");
    const toolResults = await Promise.all(safeTools.map((tool) => executeTool(tool, supabase, range)));

    const answerText = await callOpenAi(
      [
        {
          role: "system",
          content:
            "أنت Ask Khatoun، مساعد تحليلي عربي للمالك. أجب اعتماداً على بيانات الأدوات فقط. ممنوع اختراع أرقام أو نسب. لا تقل لا توجد بيانات قبل الاعتماد على نتائج الأداة المرسلة. إذا كانت النتيجة صفر فاشرح تعريف القياس والفترة. في operational_timing رتب الجواب حسب أكبر medianMinutes، واعرض الوقت المعتاد Median والمتوسط وعدد الطلبات والمقارنة، ولا تسم أي مرحلة تأخيراً إذا sample_count أقل من 5 أو quality ليست كافية. اذكر outlierCount/suspiciousFastCount إذا وجدت. لا تقترح أو تنفذ دفع، موافقة، تعديل مخزون، تعديل موظفين، أو SQL. لا تذكر UUIDs. اجعل الرد مختصراً وعملياً، واذكر في آخر سطر المصدر والفترة.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question: lastUserMessage.content,
            conversation: messages,
            selectedTools: safeTools,
            deterministicIntent: inferred,
            plannerReason: parsedPlan.reason,
            range,
            readOnlyToolResults: toolResults,
          }),
        },
      ],
      model,
    );

    return NextResponse.json({
      answer: answerText || "لا توجد بيانات كافية للإجابة حالياً.",
      usedTools: safeTools,
      period: range.label,
    });
  } catch (error) {
    logSupabaseError("[ask khatoun owner chat]", error);
    return serverError("تعذر تشغيل اسأل خاتون حالياً.", 502);
  }
}
