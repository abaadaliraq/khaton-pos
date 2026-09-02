"use client";

import { createClient } from "@/lib/supabase/client";
import type { CashierOrder, CashierOrderRawStatus, CashierTable, CashierTableStatus, PaymentMethod } from "@/types/cashier";

type CashierOrderRow = {
  id: string;
  order_number: number;
  table_session_id: string;
  round_no: number;
  status: CashierOrderRawStatus;
  table_id: string;
  guest_count: number | null;
  opened_at: string;
  service_charge: number;
  discount_amount: number;
  table: { table_number: number; status: "available" | "occupied" | "cleaning" } | null;
  captain: { full_name: string } | null;
  order_items: {
    id: string;
    item_name_snapshot: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
  }[];
  payments: {
    id: string;
    method: Exclude<PaymentMethod, "mixed">;
    amount: number;
    reference: string | null;
    created_at: string;
  }[];
};

type RestaurantTableRow = {
  id: string;
  table_number: number;
  status: "available" | "occupied" | "cleaning";
};

type TableSessionRow = {
  id: string;
  table_id: string;
  status: "active" | "closed";
};

function statusForTable(status: RestaurantTableRow["status"]): CashierTableStatus {
  if (status === "available") {
    return "available";
  }

  if (status === "cleaning") {
    return "reserved";
  }

  return "occupied";
}

function statusForOrder(status: CashierOrderRow["status"]): Exclude<CashierTableStatus, "available" | "reserved"> {
  if (status === "paid") {
    return "paid";
  }

  if (status === "awaiting_payment") {
    return "waiting_payment";
  }

  return "occupied";
}

export async function getCashierTables(): Promise<CashierTable[]> {
  const supabase = createClient();
  const [
    { data: tables, error: tablesError },
    { data: sessions, error: sessionsError },
    { data: orders, error: ordersError },
  ] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("id, table_number, status")
      .eq("is_active", true)
      .order("table_number", { ascending: true }),
    supabase.from("table_sessions").select("id, table_id, status").eq("status", "active"),
    supabase
      .from("orders")
      .select(
        "id, order_number, table_session_id, round_no, status, table_id, guest_count, opened_at, service_charge, discount_amount, table:restaurant_tables(table_number, status), captain:profiles(full_name), order_items(id, item_name_snapshot, quantity, unit_price, notes), payments(id, method, amount, reference, created_at)",
      )
      .not("table_session_id", "is", null)
      .not("status", "in", "(cancelled)")
      .order("opened_at", { ascending: false }),
  ]);

  if (tablesError) {
    throw tablesError;
  }

  if (sessionsError) {
    throw sessionsError;
  }

  if (ordersError) {
    throw ordersError;
  }

  const activeSessionsByTableId = new Map<string, TableSessionRow>();
  const activeSessionIds = new Set<string>();
  for (const session of (sessions ?? []) as TableSessionRow[]) {
    activeSessionsByTableId.set(session.table_id, session);
    activeSessionIds.add(session.id);
  }

  const ordersBySessionId = new Map<string, CashierOrderRow[]>();
  for (const order of (orders ?? []) as unknown as CashierOrderRow[]) {
    if (!activeSessionIds.has(order.table_session_id)) {
      continue;
    }

    ordersBySessionId.set(order.table_session_id, [...(ordersBySessionId.get(order.table_session_id) ?? []), order]);
  }

  return ((tables ?? []) as RestaurantTableRow[]).map((table) => {
    const tableStatus = statusForTable(table.status);
    const activeSession = table.status === "occupied" ? activeSessionsByTableId.get(table.id) : undefined;
    const tableOrders = activeSession ? [...(ordersBySessionId.get(activeSession.id) ?? [])] : [];
    const sortedOrders = tableOrders.sort((first, second) => first.round_no - second.round_no);
    const unpaidOrders = sortedOrders.filter((order) => order.status !== "paid");
    const paidOrders = sortedOrders.filter((order) => order.status === "paid");
    const billingOrders = unpaidOrders.length ? unpaidOrders : paidOrders.slice(-1);

    if (billingOrders.length === 0) {
      return {
        id: table.table_number,
        databaseId: table.id,
        status: tableStatus,
      };
    }

    const mapOrder = (order: CashierOrderRow): CashierOrder => ({
      id: order.id,
      orderNumber: order.order_number,
      tableSessionId: order.table_session_id,
      roundNo: order.round_no,
      tableId: table.table_number,
      captainName: order.captain?.full_name ?? "غير معروف",
      openedAt: order.opened_at,
      guests: order.guest_count ?? undefined,
      status: statusForOrder(order.status),
      rawStatus: order.status,
      serviceFee: order.service_charge,
      discount: order.discount_amount > 0 ? { type: "fixed", value: order.discount_amount } : undefined,
      items: order.order_items.map((item) => ({
        id: item.id,
        name: item.item_name_snapshot,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        note: item.notes ?? undefined,
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference ?? undefined,
        createdAt: payment.created_at,
      })),
    });

    const cashierOrders = sortedOrders.map(mapOrder);
    const cashierUnpaidOrders = unpaidOrders.map(mapOrder);
    const cashierPaidOrders = paidOrders.map(mapOrder);
    const primaryOrder = mapOrder(billingOrders[0]);
    const billingStatus =
      unpaidOrders.some((order) => order.status === "submitted" || order.status === "preparing" || order.status === "ready")
        ? "blocked"
        : unpaidOrders.length > 0
          ? "payable"
          : paidOrders.length > 0
            ? "paid"
            : "empty";
    const cashierOrder: CashierOrder = {
      ...primaryOrder,
      id: billingOrders[0].id,
      orderNumber: billingOrders[0].order_number,
      rawStatus: billingStatus === "paid" ? "paid" : billingStatus === "payable" ? "awaiting_payment" : primaryOrder.rawStatus,
      status: billingStatus === "paid" ? "paid" : billingStatus === "payable" ? "waiting_payment" : "occupied",
      rounds: (unpaidOrders.length ? cashierUnpaidOrders : [primaryOrder]).map((round) => ({ ...round, rounds: undefined })),
    };

    return {
      id: table.table_number,
      databaseId: table.id,
      status: tableStatus === "occupied" ? cashierOrder.status : tableStatus,
      tableSessionId: cashierOrder.tableSessionId,
      orders: cashierOrders,
      unpaidOrders: cashierUnpaidOrders,
      paidOrders: cashierPaidOrders,
      billingStatus,
      hasBusyOrders: billingStatus === "blocked",
      order: cashierOrder,
    };
  });
}
