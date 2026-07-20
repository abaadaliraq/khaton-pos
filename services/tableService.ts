"use client";

import { createClient } from "@/lib/supabase/client";
import type { RestaurantTable, TableStatus } from "@/types/pos";

type RestaurantTableRow = {
  id: string;
  table_number: number;
  status: "available" | "occupied" | "cleaning";
};

function mapTableStatus(status: "available" | "occupied" | "cleaning"): TableStatus {
  return status === "cleaning" ? "reserved" : status;
}

export async function getRestaurantTables(): Promise<RestaurantTable[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, status")
    .eq("is_active", true)
    .order("table_number", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RestaurantTableRow[]).map((table) => ({
    id: table.table_number,
    databaseId: table.id,
    status: mapTableStatus(table.status),
  }));
}
