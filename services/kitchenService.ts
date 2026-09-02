"use client";

import { createClient } from "@/lib/supabase/client";
import type { KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type OrderRow = {
  id: string;
  order_number: number;
  round_no: number;
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

function mapKitchenStatus(status: Exclude<OrderRow["status"], "served" | "awaiting_payment">): Exclude<KitchenOrderStatus, "served" | "cancelled"> {
  if (status === "submitted") {
    return "new";
  }

  return status;
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_kitchen_order_queue");

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as OrderRow[])
    .filter((order): order is OrderRow & { status: "submitted" | "preparing" | "ready" } =>
      order.status === "submitted" || order.status === "preparing" || order.status === "ready",
    )
    .map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      roundNo: order.round_no,
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

export async function updateKitchenOrderStatus(orderId: string, status: "preparing" | "ready") {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_kitchen_order_status", {
    p_order_id: orderId,
    p_next_status: status,
  } as never);

  if (error) {
    throw error;
  }
}
