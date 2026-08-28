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
    createdAt: row.created_at,
  };
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

  return ((data ?? []) as unknown as AuditLogRow[]).map(rowToAuditLog);
}
