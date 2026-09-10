import type { CashShift, ExpensePaymentMethod, PurchasePaymentStatus } from "@/types/finance";
import type { InventoryItemType, InventoryRequisitionDestination, InventoryUnitCode, InventoryWasteContext, InventoryWasteReason } from "@/types/inventory";

export type ReportType = "financial" | "inventory" | "material_consumption" | "waste" | "purchases" | "cash_shifts" | "table_performance";
export type ReportPeriodType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export type ReportRange = {
  periodType: ReportPeriodType;
  startDate: string;
  endDate: string;
  timezone: "Asia/Baghdad";
};

export type ReportTableColumn = {
  key: string;
  label: string;
  align?: "right" | "center" | "left";
};

export type ReportTableRow = Record<string, string | number | null | undefined>;

export type ReportSection = {
  title: string;
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
};

export type GeneratedReport = {
  reportType: ReportType;
  title: string;
  range: ReportRange;
  mode: "live" | "saved";
  generatedAt: string;
  generatedByName?: string;
  reportReference?: string;
  version?: number;
  summary: Record<string, string | number>;
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  sections: ReportSection[];
  payload: Record<string, unknown>;
  calculationVersion: string;
  notes: string[];
};

export type ReportSnapshot = {
  id: string;
  reportNumber: number;
  reportReference: string;
  reportType: ReportType;
  periodType: ReportPeriodType;
  periodStart: string;
  periodEnd: string;
  businessTimezone: string;
  generatedAt: string;
  generatedByName: string;
  version: number;
  schemaVersion: number;
  calculationVersion: string;
  summary: Record<string, string | number>;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type FinancialDetailRow = {
  id: string;
  createdAt: string;
  operationType: "customer_payment" | "expense" | "purchase" | "supplier_payment";
  reference: string;
  description: string;
  amount: number;
  method?: ExpensePaymentMethod;
  userName?: string;
  source: string;
};

export type InventoryReportRow = {
  itemName: string;
  itemType: InventoryItemType;
  unitCode: InventoryUnitCode;
  unitName: string;
  stockOnHand: number;
  minimumStock: number;
  status: "available" | "low" | "out" | "inactive";
  averageCost: number;
  lastPurchaseCost: number;
  stockValue: number;
  latestMovement: string;
};

export type MaterialConsumptionReportRow = {
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  unitCode: InventoryUnitCode;
  unitName: string;
  purchased: number;
  recipeConsumption: number;
  issuedToDepartments: number;
  warehouseWaste: number;
  departmentWaste: number;
  adjustmentIn: number;
  adjustmentOut: number;
  centralStockDelta: number;
  stockOnHand: number;
  averageCost: number;
};

export type WasteReportRow = {
  reportCode: string;
  postedAt: string;
  itemName: string;
  itemType: InventoryItemType;
  quantity: number;
  unitCode: InventoryUnitCode;
  unitName: string;
  context: InventoryWasteContext;
  destination?: InventoryRequisitionDestination;
  reason: InventoryWasteReason;
  userName: string;
  requisitionCode?: string;
  reference: string;
};

export type PurchaseReportRow = {
  purchaseNumber: number;
  createdAt: string;
  supplierName: string;
  itemCount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PurchasePaymentStatus;
  userName: string;
  invoiceNumber: string | null;
};

export type CashShiftReportRow = CashShift & {
  cashIn: number;
  cashOut: number;
};
