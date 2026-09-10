export type ExpenseCategory = "electricity" | "water" | "internet" | "generator" | "maintenance" | "cleaning" | "transport" | "marketing" | "external_services" | "other";
export type ExpensePaymentMethod = "cash" | "card" | "transfer";
export type PurchaseRequestStatus = "pending" | "decision_in_progress" | "partially_approved" | "approved" | "partially_received" | "rejected" | "received" | "cancelled";
export type PurchaseRequestItemDecisionStatus = "pending" | "approved" | "rejected";
export type PurchaseRequestItemReceivingStatus = "pending_receipt" | "partially_received" | "received";
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
  receivedQuantity: number;
  remainingQuantity: number;
  unitId: string;
  unitCode: string;
  receivingStatus: PurchaseRequestItemReceivingStatus;
  receivingHistory: PurchaseReceivingHistoryEntry[];
  decisionStatus: PurchaseRequestItemDecisionStatus;
  decisionByName: string | null;
  decisionAt: string | null;
  rejectionReason: string | null;
  stockOnHand?: number;
  minimumStock?: number;
  lastPurchaseCost?: number;
  lastSupplierName?: string | null;
  notes: string | null;
};

export type PurchaseReceivingHistoryEntry = {
  id: string;
  purchaseId: string;
  purchaseNumber: number;
  quantity: number;
  unitCode: string;
  receivedBy: string;
  receivedAt: string;
  reference: string;
};

export type PurchaseRequest = {
  id: string;
  requestNumber: number;
  status: PurchaseRequestStatus;
  notes: string | null;
  decisionNotes: string | null;
  rejectionReason: string | null;
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
  rejectionReason?: string;
};

export type PurchaseRequestItemDecisionInput = {
  requestItemId: string;
  decision: "approved" | "rejected";
  rejectionReason?: string;
};

export type PayPurchaseInput = {
  purchaseId: string;
  paymentMethod: ExpensePaymentMethod;
  cashShiftId?: string;
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
export type CashMovementDirection = "in" | "out";
export type CashMovementType = "customer_payment" | "expense" | "supplier_payment" | "manual_cash_in" | "manual_cash_out";

export type CashShift = {
  id: string;
  cashierId: string;
  cashierName?: string;
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
  openedByName?: string;
  closedBy: string | null;
  closedByName?: string;
  createdAt: string;
};

export type CashShiftMovement = {
  id: string;
  shiftId: string;
  direction: CashMovementDirection;
  movementType: CashMovementType;
  amount: number;
  sourceType: "payment" | "expense" | "purchase_payment" | "manual";
  sourceId: string | null;
  description: string | null;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  voidedAt: string | null;
};

export type CashierOption = {
  id: string;
  name: string;
  username: string;
};

export type OpenCashShiftInput = {
  cashierId?: string;
  openingCash: number;
  openingNote?: string;
};

export type CloseCashShiftInput = {
  cashierId?: string;
  countedCash: number;
  closingNote?: string;
};

export type EmergencyCloseCashShiftInput = {
  shiftId: string;
  countedCash: number;
  reason: string;
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

export type CashShiftMovementSummary = {
  shiftId: string;
  cashIn: number;
  cashOut: number;
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
  pending: "بانتظار قرار مدير النظام",
  decision_in_progress: "بانتظار استكمال القرار",
  partially_approved: "موافقة جزئية",
  approved: "بانتظار الاستلام",
  partially_received: "مستلم جزئياً",
  rejected: "مرفوض",
  received: "مكتمل الاستلام",
  cancelled: "ملغي",
};

export const purchaseRequestItemDecisionStatusLabels: Record<PurchaseRequestItemDecisionStatus, string> = {
  pending: "بانتظار القرار",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};

export const purchasePaymentStatusLabels: Record<PurchasePaymentStatus, string> = {
  unpaid: "بانتظار الدفع",
  paid: "مدفوع",
};
