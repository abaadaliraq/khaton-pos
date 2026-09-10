"use client";

import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OwnerHeader } from "@/components/owner/OwnerHeader";
import { OperationalToast } from "@/components/operational/OperationalToast";
import { useOperationalNotifications } from "@/components/operational/useOperationalNotifications";
import { ManagementTopNav } from "@/components/ui/ManagementTopNav";
import { BarChart3, Boxes, BrainCircuit, Home, Landmark, ShoppingCart, Trash2, Truck, UsersRound, WalletCards } from "lucide-react";

const baseNavItems = [
  { href: "/owner", label: "الرئيسية", icon: Home },
  { href: "/owner/finance", label: "الحسابات", icon: Landmark },
  { href: "/owner/purchases", label: "المشتريات", icon: ShoppingCart },
  { href: "/owner/suppliers", label: "الموردون", icon: Truck },
  { href: "/owner/staff", label: "العمال", icon: UsersRound },
  { href: "/owner/inventory", label: "المخزون", icon: Boxes },
  { href: "/owner/waste", label: "الهدر والتلف", icon: Trash2 },
  { href: "/owner/cash-shifts", label: "ورديات الصندوق", icon: WalletCards },
  { href: "/owner/reports", label: "التقارير", icon: BarChart3 },
  { href: "/owner/ai", label: "التحليل الذكي", icon: BrainCircuit },
];

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const notifications = useOperationalNotifications({ role: "owner", visualOnly: true });
  const navItems = baseNavItems.map((item) => {
    if (item.href === "/owner/purchases") {
      return { ...item, badge: notifications.badges.ownerPurchaseOversight, badgeLabel: "طلبات شراء بانتظار قرار المدير" };
    }
    if (item.href === "/owner/cash-shifts") {
      return { ...item, badge: notifications.badges.ownerCashDifferences, badgeLabel: "ورديات صندوق مغلقة بفرق اليوم" };
    }
    return item;
  });

  return (
    <AuthGuard allowedRole="owner">
      {(session) => (
        <div dir="rtl" className="management-shell owner-shell min-h-screen overflow-x-hidden">
          <OwnerHeader session={session} />
          <ManagementTopNav items={navItems} />
          <main className="management-content owner-content w-full space-y-4 px-4 py-4 lg:px-6">{children}</main>
          <OperationalToast toast={notifications.toast} />
        </div>
      )}
    </AuthGuard>
  );
}
