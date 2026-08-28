import type { Json } from "@/types/database.types";

export type AuditProfile = {
  fullName: string;
  username: string;
  role: string;
};

export type AuditLog = {
  id: string;
  userId: string | null;
  user: AuditProfile | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: Json | null;
  newData: Json | null;
  createdAt: string;
};

export type AuditFilters = {
  period: "all" | "today" | "week" | "month";
  user: string;
  section: string;
  action: string;
  search: string;
};
