"use client";

import { BarChart3, Boxes, ClipboardList, CookingPot, LogOut, PackageCheck, Recycle, ScrollText, ShoppingCart, ShieldCheck, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OperationalToast } from "@/components/operational/OperationalToast";
import { useOperationalNotifications } from "@/components/operational/useOperationalNotifications";
import { FullscreenButton } from "@/components/ui/FullscreenButton";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

function InventoryShell({ session, children }: { session: UserSession; children: ReactNode }) {
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("section") ?? "overview";
  const notifications = useOperationalNotifications({ role: "storekeeper" });
  const navGroups = [
    {
      label: "الرئيسية",
      items: [{ id: "overview", label: "نظرة عامة", icon: BarChart3, href: "/inventory" }],
    },
    {
      label: "إدارة المخزون",
      items: [
        { id: "items", label: "المواد", icon: Boxes, href: "/inventory?section=items" },
        { id: "requisitions", label: "طلبات الصرف", icon: ScrollText, href: "/inventory?section=requisitions" },
        { id: "movements", label: "الحركات", icon: ClipboardList, href: "/inventory?section=movements" },
        { id: "waste", label: "الهدر والتلف", icon: Recycle, href: "/inventory?section=waste" },
      ],
    },
    {
      label: "المشتريات",
      items: [
        { id: "purchaseRequests", label: "طلبات الشراء", icon: ShoppingCart, href: "/inventory?section=purchaseRequests" },
        { id: "receiving", label: "المشتريات / الاستلام", icon: PackageCheck, href: "/inventory?section=receiving" },
      ],
    },
    {
      label: "الرقابة والتحليل",
      items: [{ id: "analytics", label: "تحليل المخزون", icon: BarChart3, href: "/inventory?section=analytics" }],
    },
    {
      label: "الإعداد",
      items: [{ id: "recipes", label: "الوصفات", icon: CookingPot, href: "/inventory?section=recipes" }],
    },
    {
      label: "الأصول",
      items: [{ id: "equipment", label: "المعدات والصيانة", icon: Wrench, href: "/inventory?section=equipment" }],
    },
  ];

  async function logout() {
    await signOut();
    window.location.replace("/inventory/login");
  }

  return (
    <div dir="rtl" className="management-shell min-h-screen overflow-x-hidden">
      <header className="border-b bg-[var(--kh-surface)] text-[var(--kh-text)] backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" priority />
            <div>
              <p className="text-xs font-semibold text-[var(--kh-accent)]">مطعم وكافيه خاتون</p>
              <h1 className="text-xl font-semibold text-[var(--kh-text)]">إدارة المخزن</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.role === "admin" ? (
              <Link href="/admin" className="management-action-button">
                <ShieldCheck size={16} />
                العودة إلى الإدارة
              </Link>
            ) : null}
            <div className="rounded-md border border-[var(--kh-border)] bg-[var(--kh-surface)] px-3 py-2 text-sm">
              <p className="font-semibold text-[var(--kh-text)]">{session.name}</p>
              <p className="text-xs text-[var(--kh-muted)]">{session.role === "admin" ? "مدير النظام" : "مسؤول المخزن"}</p>
            </div>
            <FullscreenButton />
            <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white hover:bg-[#ff7070]">
              <LogOut size={16} />
              خروج
            </button>
          </div>
        </div>
      </header>

      <nav className="management-top-nav sticky top-0 z-40 border-b px-3 py-2 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {navGroups.flatMap((group) => group.items).map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Link key={item.id} href={item.href} className={`management-nav-link ${isActive ? "is-active" : ""}`}>
                <Icon size={15} />
                <span className="truncate">{item.label}</span>
                {item.id === "requisitions" && notifications.badges.storekeeperRequisitions > 0 ? (
                  <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${isActive ? "bg-white text-[#ff5656]" : "bg-[#ff5656] text-white"}`}>
                    {notifications.badges.storekeeperRequisitions > 99 ? "99+" : notifications.badges.storekeeperRequisitions}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="management-content w-full min-w-0 px-3 py-3 lg:px-4">
        <main className="min-w-0 overflow-x-hidden pb-8">{children}</main>
      </div>
      <OperationalToast toast={notifications.toast} />
    </div>
  );
}

export default function InventoryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/inventory/login") {
    return <>{children}</>;
  }

  return (
    <AuthGuard allowedRole={["admin", "storekeeper"]} loginPath="/inventory/login">
      {(session) => <InventoryShell session={session}>{children}</InventoryShell>}
    </AuthGuard>
  );
}
