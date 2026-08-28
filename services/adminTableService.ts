"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { AdminRestaurantTable, AdminTableOrder, RestaurantTableStatus, TableDetailsInput, TableLayoutInput } from "@/types/adminTables";

type TableRow = {
  id: string;
  table_number: number;
  name: string | null;
  capacity: number | null;
  area: string | null;
  status: RestaurantTableStatus;
  is_active: boolean;
  layout_x: number | string | null;
  layout_y: number | string | null;
  layout_rotation: number | string | null;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  order_number: number;
  table_id: string;
  opened_at: string;
  total: number | string;
  captain: { full_name: string } | null;
};

const tableSelect = "id, table_number, name, capacity, area, status, is_active, layout_x, layout_y, layout_rotation, created_at, updated_at";

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowToOrder(row: OrderRow): AdminTableOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    openedAt: row.opened_at,
    captainName: row.captain?.full_name ?? "غير معروف",
    total: asNumber(row.total),
  };
}

function rowToTable(row: TableRow, currentOrder: AdminTableOrder | null): AdminRestaurantTable {
  return {
    id: row.id,
    tableNumber: row.table_number,
    name: row.name,
    capacity: row.capacity,
    area: row.area,
    status: row.status,
    isActive: row.is_active,
    layoutX: row.layout_x === null ? null : asNumber(row.layout_x),
    layoutY: row.layout_y === null ? null : asNumber(row.layout_y),
    layoutRotation: asNumber(row.layout_rotation),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentOrder,
  };
}

async function writeAudit(action: string, entityId: string, oldData: unknown, newData: unknown) {
  const supabase = createClient();
  const { error } = await supabase.rpc("write_audit_log" as never, {
    p_action: action,
    p_entity_type: "restaurant_tables",
    p_entity_id: entityId,
    p_old_data: oldData,
    p_new_data: newData,
  } as never);

  if (error) {
    logSupabaseError(`[audit write ${action}]`, error);
    throw error;
  }
}

export async function getAdminTables() {
  const supabase = createClient();
  const [{ data: tables, error: tablesError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from("restaurant_tables" as never).select(tableSelect).order("table_number", { ascending: true }),
    supabase
      .from("orders" as never)
      .select("id, order_number, table_id, opened_at, total, captain:profiles!orders_captain_id_fkey(full_name)")
      .not("status", "in", "(paid,cancelled)")
      .order("opened_at", { ascending: false }),
  ]);

  if (tablesError) {
    logSupabaseError("[admin restaurant_tables SELECT]", tablesError);
    throw tablesError;
  }
  if (ordersError) {
    logSupabaseError("[admin table orders SELECT]", ordersError);
    throw ordersError;
  }

  const orderByTable = new Map(((orders ?? []) as unknown as OrderRow[]).map((order) => [order.table_id, rowToOrder(order)]));
  return ((tables ?? []) as unknown as TableRow[]).map((table) => rowToTable(table, orderByTable.get(table.id) ?? null));
}

export async function createRestaurantTable(input: TableDetailsInput) {
  const supabase = createClient();
  const payload = {
    table_number: input.tableNumber,
    name: clean(input.name),
    capacity: input.capacity ?? null,
    area: clean(input.area),
    is_active: input.isActive,
    status: "available",
  };
  const { data, error } = await supabase.from("restaurant_tables" as never).insert(payload as never).select(tableSelect).single();

  if (error) {
    logSupabaseError("[restaurant_tables INSERT]", error);
    throw error;
  }

  const row = data as unknown as TableRow;
  await writeAudit("إضافة طاولة", row.id, null, row);
  return rowToTable(row, null);
}

export async function updateRestaurantTable(previous: AdminRestaurantTable, input: TableDetailsInput) {
  if (previous.status === "occupied" && !input.isActive) {
    throw new Error("لا يمكن تعطيل طاولة عليها طلب مفتوح.");
  }

  const supabase = createClient();
  const payload = {
    table_number: input.tableNumber,
    name: clean(input.name),
    capacity: input.capacity ?? null,
    area: clean(input.area),
    is_active: input.isActive,
  };
  const { data, error } = await supabase.from("restaurant_tables" as never).update(payload as never).eq("id", previous.id).select(tableSelect).single();

  if (error) {
    logSupabaseError("[restaurant_tables UPDATE]", error);
    throw error;
  }

  const row = data as unknown as TableRow;
  await writeAudit(previous.isActive !== row.is_active ? row.is_active ? "تفعيل طاولة" : "تعطيل طاولة" : "تعديل بيانات طاولة", previous.id, previous, row);
  return rowToTable(row, previous.currentOrder);
}

export async function saveTableLayout(changes: TableLayoutInput[], previousTables: AdminRestaurantTable[]) {
  const supabase = createClient();
  const updatedTables: AdminRestaurantTable[] = [];

  for (const change of changes) {
    const previous = previousTables.find((table) => table.id === change.id);
    const { data, error } = await supabase
      .from("restaurant_tables" as never)
      .update({
        layout_x: Number(change.layoutX.toFixed(2)),
        layout_y: Number(change.layoutY.toFixed(2)),
        layout_rotation: Number(change.layoutRotation.toFixed(2)),
      } as never)
      .eq("id", change.id)
      .select(tableSelect)
      .single();

    if (error) {
      logSupabaseError("[restaurant_tables layout UPDATE]", error);
      throw error;
    }

    const row = data as unknown as TableRow;
    await writeAudit("تغيير توزيع الطاولة", change.id, previous ?? null, row);
    updatedTables.push(rowToTable(row, previous?.currentOrder ?? null));
  }

  return updatedTables;
}
