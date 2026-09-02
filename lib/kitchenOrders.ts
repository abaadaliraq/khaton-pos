import { lateOrderMinutes } from "@/config/kitchen";
import { getTimestamp } from "@/lib/displayFormat";
import type { KitchenFilter, KitchenOrder, KitchenOrderSeed, KitchenOrderStatus } from "@/types/kitchen";

function minutesAgo(minutes: number, now: number) {
  return new Date(now - minutes * 60_000).toISOString();
}

export function createKitchenOrdersFromSeeds(seeds: KitchenOrderSeed[], now = Date.now()): KitchenOrder[] {
  return seeds.map((seed) => ({
    id: seed.id,
    orderNumber: seed.orderNumber,
    roundNo: seed.roundNo ?? 1,
    tableId: seed.tableId,
    captainName: seed.captainName,
    status: seed.status,
    priority: seed.priority,
    items: seed.items,
    timing: {
      receivedAt: minutesAgo(seed.receivedMinutesAgo, now),
      startedAt: seed.startedMinutesAgo ? minutesAgo(seed.startedMinutesAgo, now) : undefined,
      readyAt: seed.readyMinutesAgo ? minutesAgo(seed.readyMinutesAgo, now) : undefined,
      servedAt: seed.servedMinutesAgo ? minutesAgo(seed.servedMinutesAgo, now) : undefined,
    },
  }));
}

export function isKitchenOrderLate(order: KitchenOrder, now = Date.now()) {
  if (order.status === "ready" || order.status === "served" || order.status === "cancelled") {
    return false;
  }

  const receivedAt = getTimestamp(order.timing.receivedAt);
  if (receivedAt === null) {
    return false;
  }

  const minutes = Math.floor((now - receivedAt) / 60000);
  return minutes >= lateOrderMinutes;
}

export function matchesKitchenFilter(order: KitchenOrder, filter: KitchenFilter, now = Date.now()) {
  if (filter === "all") {
    return true;
  }

  if (filter === "late") {
    return isKitchenOrderLate(order, now);
  }

  return order.priority === filter;
}

export function matchesKitchenSearch(order: KitchenOrder, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    String(order.tableId).includes(normalized) ||
    String(order.orderNumber).includes(normalized) ||
    order.id.toLowerCase().includes(normalized) ||
    order.captainName.toLowerCase().includes(normalized) ||
    order.items.some((item) => item.name.toLowerCase().includes(normalized))
  );
}

export function updateKitchenOrderStatus(
  orders: KitchenOrder[],
  orderId: string,
  nextStatus: KitchenOrderStatus,
  now = new Date().toISOString(),
) {
  return orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    return {
      ...order,
      status: nextStatus,
      timing: {
        ...order.timing,
        startedAt: nextStatus === "preparing" ? order.timing.startedAt ?? now : order.timing.startedAt,
        readyAt: nextStatus === "ready" ? order.timing.readyAt ?? now : order.timing.readyAt,
        servedAt: nextStatus === "served" ? order.timing.servedAt ?? now : order.timing.servedAt,
      },
    };
  });
}

export function getPreparationMinutes(order: KitchenOrder) {
  const startedAt = getTimestamp(order.timing.startedAt);
  const readyAt = getTimestamp(order.timing.readyAt);

  if (startedAt === null || readyAt === null) {
    return null;
  }

  return Math.max(0, Math.round((readyAt - startedAt) / 60000));
}
