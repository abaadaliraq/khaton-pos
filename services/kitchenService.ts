"use client";

import { createClient } from "@/lib/supabase/client";
import type { KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type OrderRow = {
  id: string;
  order_number: number;
  round_no: number;
  table_id: number;
  captain_name: string;
  order_status: "submitted" | "preparing" | "ready";
  status: "submitted" | "preparing" | "ready";
  received_at: string;
  started_at: string | null;
  ready_at: string | null;
  general_notes: string | null;
  has_other_station_pending: boolean;
  items: {
    id: string;
    menu_item_id: string;
    name: string;
    quantity: number;
    note: string | null;
    status: "submitted" | "preparing" | "ready";
    preparation_station: "kitchen" | "barista" | "drinks" | "shisha";
    sent_at: string;
    started_at: string | null;
    ready_at: string | null;
  }[];
};

const kitchenStation = "kitchen";

function mapKitchenStatus(status: OrderRow["status"]): Exclude<KitchenOrderStatus, "served" | "cancelled"> {
  if (status === "submitted") {
    return "new";
  }

  return status;
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_station_order_queue" as never, { p_station: kitchenStation } as never);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as OrderRow[])
    .map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      roundNo: order.round_no,
      tableId: order.table_id,
      captainName: order.captain_name,
      status: mapKitchenStatus(order.status),
      aggregateStatus: order.order_status,
      hasOtherStationPending: order.has_other_station_pending,
      generalNotes: order.general_notes ?? undefined,
      priority: "normal",
      timing: {
        receivedAt: order.received_at,
        startedAt: order.started_at ?? undefined,
        readyAt: order.ready_at ?? undefined,
      },
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        note: item.note ?? undefined,
        status: item.status,
        preparationStation: item.preparation_station,
      })),
    }));
}

export async function updateKitchenOrderStatus(orderId: string, status: "preparing" | "ready") {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_station_order_items_status" as never, {
    p_order_id: orderId,
    p_station: kitchenStation,
    p_next_status: status,
  } as never);

  if (error) {
    throw error;
  }
}
