"use client";

import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ManagementTopNav } from "@/components/ui/ManagementTopNav";
import { BarChart3, BrainCircuit, ClipboardList, Home, Settings, ShoppingCart, Table2, Trash2, UsersRound, Utensils, WalletCards } from "lucide-react";
import { OperationalToast } from "@/components/operational/OperationalToast";
import { useOperationalNotifications } from "@/components/operational/useOperationalNotifications";

const baseNavItems = [
  { href: "/admin", label: "الرئيسية", icon: Home },
  { href: "/admin/menu", label: "المنيو", icon: Utensils },
  { href: "/admin/staff", label: "العمال", icon: UsersRound },
  { href: "/admin/tables", label: "الطاولات", icon: Table2 },
  { href: "/admin/purchases", label: "طلبات الشراء", icon: ShoppingCart },
  { href: "/admin/waste", label: "الهدر والتلف", icon: Trash2 },
  { href: "/admin/cash-shifts", label: "ورديات الصندوق", icon: WalletCards },
  { href: "/admin/reports", label: "التقارير", icon: BarChart3 },
  { href: "/admin/ai", label: "التحليل الذكي", icon: BrainCircuit },
  { href: "/admin/audit", label: "سجل العمليات", icon: ClipboardList },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const notifications = useOperationalNotifications({ role: "admin" });

  const navItems = baseNavItems.map((item) =>
    item.href === "/admin/purchases" ? { ...item, badge: notifications.badges.managerPurchaseRequests, badgeLabel: "طلبات شراء بانتظار قرار مدير النظام" } : item,
  );

  return (
    <AuthGuard allowedRole="admin">
      {(session) => (
        <div dir="rtl" className="management-shell min-h-screen overflow-x-hidden">
          <AdminHeader session={session} />
          <ManagementTopNav items={navItems} />
          <main className="management-content w-full space-y-4 px-4 py-4 lg:px-6">{children}</main>
          <OperationalToast toast={notifications.toast} />
        </div>
      )}
    </AuthGuard>
  );
}
