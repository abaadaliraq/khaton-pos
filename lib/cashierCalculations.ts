import type {
  BillTotals,
  CashierOrder,
  CashierTable,
  DiscountData,
  PaymentMethod,
  ShiftSummary,
} from "@/types/cashier";

export function getOrderSubtotal(order: CashierOrder): number {
  if (order.rounds?.length) {
    return order.rounds.reduce((total, round) => total + getOrderSubtotal(round), 0);
  }

  return order.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
}

export function getDiscountAmount(subtotal: number, discount?: DiscountData): number {
  if (!discount) {
    return 0;
  }

  if (discount.type === "percent") {
    return Math.min(subtotal, Math.round((subtotal * discount.value) / 100));
  }

  return Math.min(subtotal, discount.value);
}

export function getPaidAmount(order: CashierOrder): number {
  if (order.rounds?.length) {
    return order.rounds.reduce((total, round) => total + getPaidAmount(round), 0);
  }

  return order.payments.reduce((total, payment) => total + payment.amount, 0);
}

export function getBillTotals(order: CashierOrder): BillTotals {
  if (order.rounds?.length) {
    const subtotal = order.rounds.reduce((total, round) => total + getOrderSubtotal(round), 0);
    const discountAmount = order.rounds.reduce((total, round) => total + getDiscountAmount(getOrderSubtotal(round), round.discount), 0);
    const serviceFee = order.rounds.reduce((total, round) => total + round.serviceFee, 0);
    const total = Math.max(0, subtotal - discountAmount + serviceFee);
    const paidAmount = order.rounds.reduce((totalPaid, round) => totalPaid + getPaidAmount(round), 0);

    return {
      subtotal,
      discountAmount,
      serviceFee,
      total,
      paidAmount,
      remainingAmount: Math.max(0, total - paidAmount),
    };
  }

  const subtotal = getOrderSubtotal(order);
  const discountAmount = getDiscountAmount(subtotal, order.discount);
  const serviceFee = order.serviceFee;
  const total = Math.max(0, subtotal - discountAmount + serviceFee);
  const paidAmount = getPaidAmount(order);

  return {
    subtotal,
    discountAmount,
    serviceFee,
    total,
    paidAmount,
    remainingAmount: Math.max(0, total - paidAmount),
  };
}

export function getPaymentLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    cash: "نقدي",
    card: "بطاقة",
    transfer: "تحويل",
    mixed: "دفع مختلط",
  };

  return labels[method];
}

export function getShiftSummary(tables: CashierTable[]): ShiftSummary {
  const paidOrders = tables.map((table) => table.order).filter((order): order is CashierOrder => Boolean(order));
  const cashSales = paidOrders.flatMap((order) => order.payments).reduce((total, payment) => {
    if (payment.method === "cash" || payment.method === "mixed") {
      return total + payment.amount;
    }

    return total;
  }, 0);
  const cardSales = paidOrders.flatMap((order) => order.payments).reduce((total, payment) => {
    if (payment.method === "card") {
      return total + payment.amount;
    }

    return total;
  }, 0);
  const transferSales = paidOrders.flatMap((order) => order.payments).reduce((total, payment) => {
    if (payment.method === "transfer") {
      return total + payment.amount;
    }

    return total;
  }, 0);

  return {
    cashSales,
    cardSales,
    transferSales,
    totalSales: cashSales + cardSales + transferSales,
    paidInvoices: tables.filter((table) => table.status === "paid").length,
    openTables: tables.filter((table) => table.status === "occupied" || table.status === "waiting_payment").length,
  };
}
