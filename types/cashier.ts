export type CashierTableStatus = "available" | "occupied" | "waiting_payment" | "paid" | "reserved";

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
  tableId: number;
  captainName: string;
  openedAt: string;
  guests?: number;
  status: Exclude<CashierTableStatus, "available" | "reserved">;
  items: CashierOrderItem[];
  discount?: DiscountData;
  serviceFee: number;
  payments: PaymentRecord[];
};

export type CashierTable = {
  id: number;
  databaseId?: string;
  status: CashierTableStatus;
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
