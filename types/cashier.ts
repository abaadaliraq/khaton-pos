export type CashierTableStatus = "available" | "occupied" | "waiting_payment" | "paid" | "reserved";
export type CashierOrderRawStatus = "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid";

export type PaymentMethod = "cash" | "card" | "transfer" | "mixed";

export type DiscountType = "fixed" | "percent";

export type DiscountData = {
  type: DiscountType;
  value: number;
};

export type PaymentRecord = {
  id: string;
  method: PaymentMethod;
  amount: number;
  receivedAmount?: number;
  changeAmount?: number;
  reference?: string;
  createdAt: string;
};

export type CashierOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  note?: string;
};

export type CashierOrder = {
  id: string;
  orderNumber: number;
  tableSessionId: string;
  roundNo: number;
  tableId: number;
  captainName: string;
  openedAt: string;
  guests?: number;
  status: Exclude<CashierTableStatus, "available" | "reserved">;
  rawStatus: CashierOrderRawStatus;
  items: CashierOrderItem[];
  discount?: DiscountData;
  serviceFee: number;
  payments: PaymentRecord[];
  rounds?: CashierOrder[];
  isNewAddition?: boolean;
};

export type CashierTableBillingStatus = "blocked" | "payable" | "paid" | "empty";

export type CashierTable = {
  id: number;
  databaseId?: string;
  status: CashierTableStatus;
  tableSessionId?: string;
  orders?: CashierOrder[];
  unpaidOrders?: CashierOrder[];
  paidOrders?: CashierOrder[];
  billingStatus?: CashierTableBillingStatus;
  hasBusyOrders?: boolean;
  order?: CashierOrder;
};

export type ShiftSummary = {
  cashSales: number;
  cardSales: number;
  transferSales: number;
  totalSales: number;
  paidInvoices: number;
  openTables: number;
};

export type BillTotals = {
  subtotal: number;
  discountAmount: number;
  serviceFee: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
};
