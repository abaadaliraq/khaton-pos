import type { UserRole } from "@/types/auth";

const LEGACY_SESSION_KEY = "khatoun_pos_session";

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function getRoleRedirectPath(role: UserRole) {
  const paths: Record<UserRole, string> = {
    captain: "/captain",
    cashier: "/cashier",
    kitchen: "/kitchen",
    admin: "/admin",
    storekeeper: "/inventory",
    accountant: "/finance",
    owner: "/owner",
  };

  return paths[role];
}

export function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    captain: "الكابتن",
    cashier: "المحاسب",
    kitchen: "المطبخ",
    admin: "الإدارة",
    storekeeper: "مسؤول المخزن",
    accountant: "محاسب",
    owner: "مالك / شريك",
  };

  return labels[role];
}
