"use client";

import { createClient } from "@/lib/supabase/client";
import type { RestaurantOrderStatus, RestaurantTable, TableStatus } from "@/types/pos";

type RestaurantTableRow = {
  id: string;
  table_number: number;
  status: "available" | "occupied" | "cleaning";
};

type ActiveOrderRow = {
  id: string;
  order_number: number;
  table_session_id: string;
  round_no: number;
  table_id: string;
  captain_id: string;
  status: RestaurantOrderStatus;
};

type TableSessionRow = {
  id: string;
  table_id: string;
  captain_id: string;
  status: "active" | "closed";
};

function mapTableStatus(status: "available" | "occupied" | "cleaning"): TableStatus {
  return status === "cleaning" ? "reserved" : status;
}

export async function getRestaurantTables(): Promise<RestaurantTable[]> {
  const supabase = createClient();
  const [
    { data: tables, error: tablesError },
    { data: sessions, error: sessionsError },
    { data: orders, error: ordersError },
    { data: authData },
  ] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("id, table_number, status")
      .eq("is_active", true)
      .order("table_number", { ascending: true }),
    supabase.from("table_sessions").select("id, table_id, captain_id, status").eq("status", "active"),
    supabase
      .from("orders")
      .select("id, order_number, table_session_id, round_no, table_id, captain_id, status")
      .not("table_session_id", "is", null)
      .not("status", "in", "(cancelled)")
      .order("opened_at", { ascending: false }),
    supabase.auth.getUser(),
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

  const ordersBySessionId = new Map<string, ActiveOrderRow[]>();
  for (const order of (orders ?? []) as unknown as ActiveOrderRow[]) {
    if (!activeSessionIds.has(order.table_session_id)) {
      continue;
    }

    ordersBySessionId.set(order.table_session_id, [...(ordersBySessionId.get(order.table_session_id) ?? []), order]);
  }

  return ((tables ?? []) as RestaurantTableRow[]).map((table) => {
    const activeSession = table.status === "occupied" ? activeSessionsByTableId.get(table.id) : undefined;
    const tableOrders = activeSession ? (ordersBySessionId.get(activeSession.id) ?? []) : [];
    const orderedRounds = [...tableOrders].sort((first, second) => first.round_no - second.round_no);
    const currentOrder =
      tableOrders.find((order) => order.status === "ready") ??
      tableOrders.find((order) => order.status === "submitted" || order.status === "preparing") ??
      tableOrders.find((order) => order.status === "awaiting_payment") ??
      tableOrders.find((order) => order.status === "paid") ??
      null;
    const hasBusyOrders = tableOrders.some((order) => order.status === "submitted" || order.status === "preparing" || order.status === "ready");
    const unpaidOrderCount = tableOrders.filter((order) => order.status !== "paid").length;
    const allPaid = tableOrders.length > 0 && tableOrders.every((order) => order.status === "paid");
    const sessionCaptainId = activeSession?.captain_id;

    return {
      id: table.table_number,
      databaseId: table.id,
      status: mapTableStatus(table.status),
      tableSessionId: activeSession?.id,
      sessionCaptainId,
      sessionOrderCount: tableOrders.length,
      unpaidOrderCount,
      hasBusyOrders,
      canAddOrder: table.status === "available" || sessionCaptainId === authData.user?.id,
      canRelease: allPaid,
      currentOrder: currentOrder
        ? {
            id: currentOrder.id,
            orderNumber: currentOrder.order_number,
            roundNo: currentOrder.round_no,
            status: currentOrder.status,
          }
        : undefined,
      orders: orderedRounds.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        roundNo: order.round_no,
        status: order.status,
      })),
    };
  });
}
