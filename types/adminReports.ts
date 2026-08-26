export type ReportPeriodPreset = "today" | "week" | "month" | "custom";

export type SalesReportSummary = {
  revenue: number;
  orderCount: number;
  mealCount: number;
  averageOrderValue: number;
};

export type DailyRevenuePoint = {
  date: string;
  revenue: number;
};

export type MenuItemSalesReport = {
  name: string;
  quantity: number;
  sales: number;
};

export type PaymentMethodRevenue = {
  method: "cash" | "card" | "transfer";
  revenue: number;
};

export type OrderStatusCount = {
  status: "draft" | "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid" | "cancelled";
  count: number;
};

export type SalesReportTrend = {
  from: string;
  to: string;
  summary: SalesReportSummary;
  previousSummary: SalesReportSummary;
  dailyRevenue: DailyRevenuePoint[];
};

export type AdminSalesReport = {
  period: { from: string; to: string };
  summary: SalesReportSummary;
  previousSummary: SalesReportSummary;
  dailyRevenue: DailyRevenuePoint[];
  week: SalesReportTrend;
  month: SalesReportTrend;
  topItems: MenuItemSalesReport[];
  leastItems: MenuItemSalesReport[];
  paymentMethods: PaymentMethodRevenue[];
  orderStatusCounts: OrderStatusCount[];
};

export type AdminSalesReportRange = {
  from: string;
  to: string;
  today: string;
};
