"use client";

import { createClient } from "@/lib/supabase/client";
import type { CashierOrder, CashierTable, CashierTableStatus, PaymentMethod } from "@/types/cashier";

type CashierOrderRow = {
  id: string;
  status: "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid";
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

function statusForOrder(status: CashierOrderRow["status"]): Exclude<CashierTableStatus, "available" | "reserved"> {
  if (status === "paid") {
    return "paid";
  }

  if (status === "awaiting_payment" || status === "served" || status === "ready") {
    return "waiting_payment";
  }

  return "occupied";
}

export async function getCashierTables(): Promise<CashierTable[]> {
  const supabase = createClient();
  const [{ data: tables, error: tablesError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("id, table_number, status")
      .eq("is_active", true)
      .order("table_number", { ascending: true }),
    supabase
      .from("orders")
      .select(
        "id, status, table_id, guest_count, opened_at, service_charge, discount_amount, table:restaurant_tables(table_number, status), captain:profiles(full_name), order_items(id, item_name_snapshot, quantity, unit_price, notes), payments(id, method, amount, reference, created_at)",
      )
      .not("status", "in", "(cancelled)")
      .order("opened_at", { ascending: false }),
  ]);

  if (tablesError) {
    throw tablesError;
  }

  if (ordersError) {
    throw ordersError;
  }

  const activeOrders = ((orders ?? []) as unknown as CashierOrderRow[]).filter((order) => order.status !== "paid");
  const ordersByTableId = new Map(activeOrders.map((order) => [order.table_id, order]));

  return ((tables ?? []) as RestaurantTableRow[]).map((table) => {
    const order = ordersByTableId.get(table.id);

    if (!order) {
      return {
        id: table.table_number,
        databaseId: table.id,
        status: "available",
      };
    }

    const cashierOrder: CashierOrder = {
      id: order.id,
      tableId: table.table_number,
      captainName: order.captain?.full_name ?? "غير معروف",
      openedAt: order.opened_at,
      guests: order.guest_count ?? undefined,
      status: statusForOrder(order.status),
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
    };

    return {
      id: table.table_number,
      databaseId: table.id,
      status: cashierOrder.status,
      order: cashierOrder,
    };
  });
}
