"use client";

import { createClient } from "@/lib/supabase/client";
import type { PreparationStation, RestaurantOrderStatus, RestaurantTable, RestaurantTableOrderItem, StationOrderStatus, TableStatus } from "@/types/pos";

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
  total: number | null;
  opened_at: string | null;
  order_items?: {
    id: string;
    item_name_snapshot: string | null;
    quantity: number | null;
    status: RestaurantOrderStatus | null;
    preparation_station: PreparationStation | null;
  }[];
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

function getStationLabel(station: PreparationStation) {
  const labels: Record<PreparationStation, string> = {
    kitchen: "المطبخ",
    barista: "الباريستا",
    drinks: "المشروبات",
    shisha: "الأركيلة",
    unknown: "غير محدد",
  };

  return labels[station] ?? labels.unknown;
}

function getStationDisplayStatus(items: RestaurantTableOrderItem[]): RestaurantOrderStatus {
  if (items.length === 0) {
    return "submitted";
  }

  if (items.every((item) => item.status === "ready" || item.status === "served" || item.status === "awaiting_payment" || item.status === "paid")) {
    return "ready";
  }

  if (items.some((item) => item.status === "preparing")) {
    return "preparing";
  }

  if (items.some((item) => item.status === "submitted")) {
    return "submitted";
  }

  return items[0]?.status ?? "submitted";
}

function mapOrderItems(order: ActiveOrderRow): RestaurantTableOrderItem[] {
  return (order.order_items ?? []).map((item) => ({
    id: item.id,
    name: item.item_name_snapshot || "صنف غير محدد",
    quantity: item.quantity ?? 0,
    status: item.status ?? order.status,
    preparationStation: item.preparation_station ?? "unknown",
  }));
}

function buildStationStatuses(items: RestaurantTableOrderItem[]): StationOrderStatus[] {
  const groupedItems = new Map<PreparationStation, RestaurantTableOrderItem[]>();

  for (const item of items) {
    groupedItems.set(item.preparationStation, [...(groupedItems.get(item.preparationStation) ?? []), item]);
  }

  return Array.from(groupedItems.entries()).map(([station, stationItems]) => ({
    station,
    label: getStationLabel(station),
    status: getStationDisplayStatus(stationItems),
    itemCount: stationItems.reduce((total, item) => total + item.quantity, 0),
    readyCount: stationItems
      .filter((item) => item.status === "ready" || item.status === "served" || item.status === "awaiting_payment" || item.status === "paid")
      .reduce((total, item) => total + item.quantity, 0),
  }));
}

function mapOrderForTable(order: ActiveOrderRow) {
  const items = mapOrderItems(order);

  return {
    id: order.id,
    orderNumber: order.order_number,
    roundNo: order.round_no,
    status: order.status,
    total: order.total ?? 0,
    openedAt: order.opened_at ?? undefined,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    stationStatuses: buildStationStatuses(items),
    items,
    readyItems: items.filter((item) => item.status === "ready"),
  };
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
      .select("id, order_number, table_session_id, round_no, table_id, captain_id, status, total, opened_at, order_items(id, item_name_snapshot, quantity, status, preparation_station)")
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
    const mappedRounds = orderedRounds.map(mapOrderForTable);
    const currentOrder =
      tableOrders.find((order) => order.status === "ready") ??
      tableOrders.find((order) => order.status === "submitted" || order.status === "preparing") ??
      tableOrders.find((order) => order.status === "awaiting_payment") ??
      tableOrders.find((order) => order.status === "paid") ??
      null;
    const mappedCurrentOrder = currentOrder ? mapOrderForTable(currentOrder) : null;
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
      currentOrder: mappedCurrentOrder
        ? {
            id: mappedCurrentOrder.id,
            orderNumber: mappedCurrentOrder.orderNumber,
            roundNo: mappedCurrentOrder.roundNo,
            status: mappedCurrentOrder.status,
            total: mappedCurrentOrder.total,
            openedAt: mappedCurrentOrder.openedAt,
            itemCount: mappedCurrentOrder.itemCount,
            stationStatuses: mappedCurrentOrder.stationStatuses,
            readyItems: mappedCurrentOrder.readyItems,
          }
        : undefined,
      orders: mappedRounds,
    };
  });
}
