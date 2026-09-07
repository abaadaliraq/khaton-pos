"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { Json } from "@/types/database.types";
import type { AuditLog } from "@/types/audit";

type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Json | null;
  new_data: Json | null;
  created_at: string;
  user_profile: {
    full_name: string;
    username: string;
    role: string;
  } | null;
};

const auditSelect = `id, user_id, action, entity_type, entity_id, old_data, new_data, created_at,
  user_profile:profiles!audit_logs_user_id_fkey(full_name, username, role)`;

function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    userId: row.user_id,
    user: row.user_profile ? {
      fullName: row.user_profile.full_name,
      username: row.user_profile.username,
      role: row.user_profile.role,
    } : null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldData: row.old_data,
    newData: row.new_data,
    references: {},
    createdAt: row.created_at,
  };
}

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function collectUuidValues(value: Json | null | undefined, ids: Set<string>) {
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    ids.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUuidValues(item, ids));
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectUuidValues(item, ids));
  }
}

function mergeReferenceMaps(logs: AuditLog[], references: Record<string, string>) {
  return logs.map((log) => ({
    ...log,
    references,
  }));
}

async function resolveAuditReferences(logs: AuditLog[]) {
  const ids = new Set<string>();
  logs.forEach((log) => {
    if (log.entityId) ids.add(log.entityId);
    collectUuidValues(log.oldData, ids);
    collectUuidValues(log.newData, ids);
  });
  const idList = [...ids];
  if (idList.length === 0) return logs;

  const supabase = createClient();
  const references: Record<string, string> = {};
  const settled = await Promise.allSettled([
    supabase.from("profiles" as never).select("id, full_name, username").in("id" as never, idList as never),
    supabase.from("inventory_requisitions" as never).select("id, request_number, destination").in("id" as never, idList as never),
    supabase.from("inventory_waste_reports" as never).select("id, report_number, destination, context").in("id" as never, idList as never),
    supabase.from("purchases" as never).select("id, purchase_number, supplier:suppliers(name)").in("id" as never, idList as never),
    supabase.from("purchase_requests" as never).select("id, request_number").in("id" as never, idList as never),
    supabase.from("orders" as never).select("id, order_number").in("id" as never, idList as never),
    supabase.from("cash_shifts" as never).select("id, business_date, cashier:profiles!cash_shifts_cashier_id_fkey(full_name, username)").in("id" as never, idList as never),
    supabase.from("inventory_items" as never).select("id, name_ar").in("id" as never, idList as never),
    supabase.from("suppliers" as never).select("id, name").in("id" as never, idList as never),
    supabase.from("table_sessions" as never).select("id, opened_at, table:restaurant_tables(table_number)").in("id" as never, idList as never),
  ]);

  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const { data, error } = result.value as { data: unknown[] | null; error: { message?: string } | null };
    if (error || !Array.isArray(data)) return;
    data.forEach((row) => {
      const item = row as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : null;
      if (!id) return;
      if ("full_name" in item || "username" in item) references[id] = String(item.full_name ?? item.username ?? "مستخدم غير معروف");
      else if ("request_number" in item && "destination" in item) references[id] = `REQ-${String(item.request_number).padStart(4, "0")}`;
      else if ("report_number" in item) references[id] = `WST-${String(item.report_number).padStart(4, "0")}`;
      else if ("purchase_number" in item) references[id] = `شراء #${item.purchase_number}`;
      else if ("order_number" in item) references[id] = `طلب #${item.order_number}`;
      else if ("business_date" in item) references[id] = `وردية صندوق ${item.business_date}`;
      else if ("name_ar" in item) references[id] = String(item.name_ar);
      else if ("name" in item) references[id] = String(item.name);
      else if ("opened_at" in item) references[id] = `جلسة طاولة ${item.opened_at ? String(item.opened_at).slice(0, 10) : ""}`.trim();
    });
  });

  return mergeReferenceMaps(logs, references);
}

export async function getAuditLogs(page = 0, pageSize = 50) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_logs" as never)
    .select(auditSelect)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    logSupabaseError("[audit_logs SELECT]", error);
    throw error;
  }

  return resolveAuditReferences(((data ?? []) as unknown as AuditLogRow[]).map(rowToAuditLog));
}
