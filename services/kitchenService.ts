"use client";

import { createClient } from "@/lib/supabase/client";
import type { KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type OrderRow = {
  id: string;
  table_id: number;
  captain_name: string;
  status: "submitted" | "preparing" | "ready" | "served" | "awaiting_payment";
  received_at: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    note: string | null;
  }[];
};

function mapKitchenStatus(status: OrderRow["status"]): KitchenOrderStatus {
  if (status === "submitted") {
    return "new";
  }

  if (status === "awaiting_payment") {
    return "served";
  }

  return status;
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_kitchen_order_queue");

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as OrderRow[]).map((order) => ({
    id: order.id,
    tableId: order.table_id,
    captainName: order.captain_name,
    status: mapKitchenStatus(order.status),
    priority: "normal",
    timing: {
      receivedAt: order.received_at,
    },
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      note: item.note ?? undefined,
    })),
  }));
}

export async function updateKitchenOrderStatus(orderId: string, status: Exclude<KitchenOrderStatus, "new" | "cancelled">) {
  const supabase = createClient();
  const nextStatus = status === "served" ? "served" : status;
  const { error } = await supabase.rpc("update_kitchen_order_status", {
    p_order_id: orderId,
    p_next_status: nextStatus,
  } as never);

  if (error) {
    throw error;
  }
}
