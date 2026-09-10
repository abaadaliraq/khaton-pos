export type AiInventorySituation = "طبيعي" | "يحتاج انتباه" | "خطر";
export type AiInventorySeverity = "منخفضة" | "متوسطة" | "عالية" | "حرجة";

export type AiInventoryAlert = {
  item: string;
  severity: AiInventorySeverity;
  note: string;
  dataReason: string;
  recommendation: string;
};

export type AiInventoryMonitorAnalysis = {
  overallStatus: AiInventorySituation;
  summary: string;
  topAlerts: AiInventoryAlert[];
  stockoutRisk: AiInventoryAlert[];
  unusualConsumption: AiInventoryAlert[];
  wasteFollowUp: AiInventoryAlert[];
  supplierPriceChanges: AiInventoryAlert[];
  recommendations: string[];
};

export type AiOperationalAttention = {
  area: string;
  severity: AiInventorySeverity;
  note: string;
  dataReason: string;
  recommendation: string;
};

export type AiOperationalSectionInsight = {
  title: string;
  severity: AiInventorySeverity;
  insight: string;
  dataReason: string;
  recommendation: string;
};

export type AiOperationalAnalysis = {
  executiveSummary: AiOperationalAttention[];
  tableInsights: AiOperationalSectionInsight[];
  speedInsights: AiOperationalSectionInsight[];
  financialInsights: AiOperationalSectionInsight[];
  dataQuality: {
    confidence: "عالية" | "متوسطة" | "منخفضة";
    reason: string;
  };
};

export type AiMetricComparison = {
  current: number;
  previous: number;
  changePercent: number | null;
};

export type AiOperationalMetrics = {
  tables: {
    periodDays: number;
    sessions: AiMetricComparison;
    sales: AiMetricComparison;
    averageBill: AiMetricComparison;
    averageSessionMinutes: AiMetricComparison;
    topTables: Array<{ table: string; sessions: number; sales: number }>;
    lowTables: Array<{ table: string; sessions: number; sales: number }>;
    notableChanges: Array<{ table: string; currentSessions: number; previousSessions: number; changePercent: number | null }>;
  };
  speed: {
    kitchen: AiSpeedMetricGroup;
    barista: AiSpeedMetricGroup;
    captain: AiSpeedMetricGroup;
    cashier: AiSpeedMetricGroup;
  };
  finance: {
    purchases: AiMetricComparison;
    supplierPayments: AiMetricComparison;
    estimatedOutstandingPayables: number;
    overdueSupplierBills: number;
    expenses: AiMetricComparison;
    cashIn: AiMetricComparison;
    cashOut: AiMetricComparison;
    cashShiftDifferences: AiMetricComparison;
    openCashShifts: number;
  };
  dataQuality: {
    confidence: "عالية" | "متوسطة" | "منخفضة";
    reason: string;
    counts: {
      sessions: number;
      orders: number;
      orderItems: number;
      payments: number;
      orderStatusEvents: number;
      cashShifts: number;
    };
  };
};

export type AiSpeedMetric = {
  label: string;
  averageMinutes: number | null;
  medianMinutes: number | null;
  samples: number;
  delayedCount: number;
  previousAverageMinutes: number | null;
  changePercent: number | null;
};

export type AiSpeedMetricGroup = {
  metrics: AiSpeedMetric[];
};

export type AiInventoryMonitorResponse = {
  configured: boolean;
  generatedAt: string;
  model?: string;
  dataWindow: {
    last7Days: { startDate: string; endDate: string };
    last30Days: { startDate: string; endDate: string };
    timezone: "Asia/Baghdad";
  };
  dataSummary: {
    itemCount: number;
    inventoryValue: number;
    followUpCount: number;
    empty: boolean;
  };
  analysis: AiInventoryMonitorAnalysis;
  operationalAnalysis?: AiOperationalAnalysis;
  operationalMetrics?: AiOperationalMetrics;
};
