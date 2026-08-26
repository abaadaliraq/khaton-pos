"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  AdminSalesReport,
  AdminSalesReportRange,
  DailyRevenuePoint,
  MenuItemSalesReport,
  OrderStatusCount,
  PaymentMethodRevenue,
  SalesReportSummary,
  SalesReportTrend,
} from "@/types/adminReports";

const paymentMethods = ["cash", "card", "transfer"] as const;
const orderStatuses = ["draft", "submitted", "preparing", "ready", "served", "awaiting_payment", "paid", "cancelled"] as const;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asDateString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function mapSummary(value: unknown): SalesReportSummary {
  const row = asRecord(value);
  const orderCount = asNumber(row.orderCount);
  const revenue = asNumber(row.revenue);

  return {
    revenue,
    orderCount,
    mealCount: asNumber(row.mealCount),
    averageOrderValue: orderCount > 0 ? asNumber(row.averageOrderValue) : 0,
  };
}

function mapDailyRevenue(value: unknown): DailyRevenuePoint[] {
  return asArray(value).map((entry) => {
    const row = asRecord(entry);
    return {
      date: asDateString(row.date, ""),
      revenue: asNumber(row.revenue),
    };
  });
}

function mapItemSales(value: unknown): MenuItemSalesReport[] {
  return asArray(value).map((entry) => {
    const row = asRecord(entry);
    return {
      name: typeof row.name === "string" && row.name.length > 0 ? row.name : "صنف غير معروف",
      quantity: asNumber(row.quantity),
      sales: asNumber(row.sales),
    };
  });
}

function mapPaymentMethods(value: unknown): PaymentMethodRevenue[] {
  return asArray(value)
    .map((entry) => {
      const row = asRecord(entry);
      const method = paymentMethods.find((candidate) => candidate === row.method);

      return method
        ? {
            method,
            revenue: asNumber(row.revenue),
          }
        : null;
    })
    .filter((entry): entry is PaymentMethodRevenue => Boolean(entry));
}

function mapOrderStatusCounts(value: unknown): OrderStatusCount[] {
  return asArray(value)
    .map((entry) => {
      const row = asRecord(entry);
      const status = orderStatuses.find((candidate) => candidate === row.status);

      return status
        ? {
            status,
            count: asNumber(row.count),
          }
        : null;
    })
    .filter((entry): entry is OrderStatusCount => Boolean(entry));
}

function mapTrend(value: unknown, fallbackFrom: string, fallbackTo: string): SalesReportTrend {
  const row = asRecord(value);
  return {
    from: asDateString(row.from, fallbackFrom),
    to: asDateString(row.to, fallbackTo),
    summary: mapSummary(row.summary),
    previousSummary: mapSummary(row.previousSummary),
    dailyRevenue: mapDailyRevenue(row.dailyRevenue),
  };
}

export async function getAdminSalesReport(range: AdminSalesReportRange): Promise<AdminSalesReport> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_admin_sales_report" as never, {
    p_period_from: range.from,
    p_period_to: range.to,
    p_today: range.today,
  } as never);

  if (error) {
    throw error;
  }

  const payload = asRecord(data);
  const period = asRecord(payload.period);
  const periodFrom = asDateString(period.from, range.from);
  const periodTo = asDateString(period.to, range.to);

  return {
    period: { from: periodFrom, to: periodTo },
    summary: mapSummary(payload.summary),
    previousSummary: mapSummary(payload.previousSummary),
    dailyRevenue: mapDailyRevenue(payload.dailyRevenue),
    week: mapTrend(payload.week, range.from, range.to),
    month: mapTrend(payload.month, range.from, range.to),
    topItems: mapItemSales(payload.topItems),
    leastItems: mapItemSales(payload.leastItems),
    paymentMethods: mapPaymentMethods(payload.paymentMethods),
    orderStatusCounts: mapOrderStatusCounts(payload.orderStatusCounts),
  };
}
