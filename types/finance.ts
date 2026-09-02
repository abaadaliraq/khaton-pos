export type ExpenseCategory = "electricity" | "water" | "internet" | "generator" | "maintenance" | "cleaning" | "transport" | "marketing" | "external_services" | "other";
export type ExpensePaymentMethod = "cash" | "card" | "transfer";
export type PurchaseRequestStatus = "pending" | "approved" | "rejected" | "received" | "cancelled";
export type PurchasePaymentStatus = "unpaid" | "paid";

export type Expense = {
  id: string;
  expenseNumber: number;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  receiptNumber: string | null;
  description: string;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

export type CreateExpenseInput = {
  amount: number;
  category: ExpenseCategory;
  paymentMethod: ExpensePaymentMethod;
  receiptNumber?: string;
  description: string;
  notes?: string;
};

export type ExpenseSummary = {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  todayCount: number;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupplierInput = {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type PurchaseItem = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unitId: string;
  unitCode: string;
  unitPrice: number;
  lineTotal: number;
  quantityBase: number;
  unitCostBase: number;
};

export type PurchaseRequestItem = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unitId: string;
  unitCode: string;
  notes: string | null;
};

export type PurchaseRequest = {
  id: string;
  requestNumber: number;
  status: PurchaseRequestStatus;
  notes: string | null;
  decisionNotes: string | null;
  requestedBy: string;
  requestedByName: string;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseRequestItem[];
};

export type Purchase = {
  id: string;
  purchaseNumber: number;
  purchaseRequestId: string | null;
  purchaseRequestNumber: number | null;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber: string | null;
  supplierInvoiceDate: string | null;
  totalAmount: number;
  paymentStatus: PurchasePaymentStatus;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  items: PurchaseItem[];
};

export type PurchasePayment = {
  id: string;
  paymentNumber: number | null;
  purchaseId: string;
  purchaseNumber: number | null;
  supplierInvoiceNumber: string | null;
  supplierInvoiceDate: string | null;
  purchaseCreatedAt: string | null;
  purchaseCreatedByName: string | null;
  supplierName: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  paidBy: string;
  paidByName: string;
  createdAt: string;
};

export type CreatePurchaseItemInput = {
  inventoryItemId: string;
  quantity: number;
  unitId: string;
  unitPrice: number;
};

export type CreatePurchaseInput = {
  clientRequestId: string;
  purchaseRequestId?: string;
  supplierId: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  notes?: string;
  items: CreatePurchaseItemInput[];
};

export type CreatePurchaseRequestItemInput = {
  inventoryItemId: string;
  quantity: number;
  unitId: string;
  notes?: string;
};

export type CreatePurchaseRequestInput = {
  notes?: string;
  items: CreatePurchaseRequestItemInput[];
};

export type PurchaseDecisionInput = {
  requestId: string;
  decision: "approved" | "rejected";
  decisionNotes?: string;
};

export type PayPurchaseInput = {
  purchaseId: string;
  paymentMethod: ExpensePaymentMethod;
  referenceNumber?: string;
  notes?: string;
};

export type PurchaseSummary = {
  todayTotal: number;
  monthTotal: number;
  todayCount: number;
  latestPurchaseNumber: number | null;
};

export type CustomerPayment = {
  id: string;
  orderId: string;
  orderNumber: number | null;
  tableNumber: number | null;
  amount: number;
  method: ExpensePaymentMethod;
  status: "completed" | "voided";
  createdAt: string;
};

export type FinanceOpenOrdersSummary = {
  count: number;
  total: number;
};

export type FinanceSalesSummary = {
  salesToday: number;
  receivedToday: number;
  openOrders: FinanceOpenOrdersSummary;
  customerPaymentsToday: CustomerPayment[];
};

export type CashShiftStatus = "open" | "closed";

export type CashShift = {
  id: string;
  cashierId: string;
  businessDate: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  countedCash: number | null;
  expectedCashSnapshot: number | null;
  cashDifference: number | null;
  status: CashShiftStatus;
  openingNote: string | null;
  closingNote: string | null;
  openedBy: string;
  closedBy: string | null;
  createdAt: string;
};

export type OpenCashShiftInput = {
  openingCash: number;
  openingNote?: string;
};

export type CloseCashShiftInput = {
  countedCash: number;
  closingNote?: string;
};

export type ExpectedCashBreakdown = {
  shiftId: string;
  businessDate: string;
  openedAt: string;
  cutoffAt: string;
  openingCash: number;
  cashSales: number;
  cashExpenses: number;
  cashSupplierPayments: number;
  expectedCash: number;
  sources: {
    cashSalesAvailable: boolean;
    cashExpensesAvailable: boolean;
    cashSupplierPaymentsAvailable: boolean;
  };
};

export type CashShiftSummary = {
  shift: CashShift;
  expected: ExpectedCashBreakdown;
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
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

export const expensePaymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  cash: "نقدي",
  card: "بطاقة",
  transfer: "تحويل",
};

export const purchaseRequestStatusLabels: Record<PurchaseRequestStatus, string> = {
  pending: "بانتظار الموافقة",
  approved: "معتمد",
  rejected: "مرفوض",
  received: "تم الاستلام",
  cancelled: "ملغي",
};

export const purchasePaymentStatusLabels: Record<PurchasePaymentStatus, string> = {
  unpaid: "بانتظار الدفع",
  paid: "مدفوع",
};
