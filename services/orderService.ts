"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";
import type { OrderItem, RestaurantTable } from "@/types/pos";

type CreateOrderResult = {
  order_id: string;
  order_number: number;
  total: number;
};

export async function createRestaurantOrder(params: {
  table: RestaurantTable;
  items: OrderItem[];
  guestCount?: number | null;
  generalNotes?: string | null;
}): Promise<CreateOrderResult> {
  if (!params.table.databaseId) {
    throw new Error("الطاولة غير مربوطة بقاعدة البيانات.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_restaurant_order", {
    p_table_id: params.table.databaseId,
    p_items: params.items.map((orderItem) => ({
      menu_item_id: orderItem.item.id,
      quantity: orderItem.quantity,
      notes: orderItem.note,
    })) as Json,
    p_guest_count: params.guestCount ?? null,
    p_general_notes: params.generalNotes ?? null,
  } as never);

  if (error) {
    throw error;
  }

  return data as CreateOrderResult;
}
