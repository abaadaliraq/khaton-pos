"use client";

import { BarChart3, Boxes, ClipboardList, CookingPot, LogOut, PackageCheck, ShoppingCart, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

function InventoryShell({ session, children }: { session: UserSession; children: ReactNode }) {
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("section") ?? "overview";
  async function logout() {
    await signOut();
    window.location.replace("/inventory/login");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8f3ed] text-[#2f211c]">
      <header className="border-b border-[#e4d8c8] bg-[#fffdfa]">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#5d4032] text-lg font-bold text-white">خ</div>
            <div>
              <p className="text-xs font-semibold text-[#a65f3f]">خاتون POS</p>
              <h1 className="text-xl font-semibold text-[#2f211c]">إدارة المخزن</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.role === "admin" ? (
              <Link href="/admin" className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
                <ShieldCheck size={16} />
                العودة إلى الإدارة
              </Link>
            ) : null}
            <div className="rounded-md border border-[#e4d8c8] bg-white px-3 py-2 text-sm">
              <p className="font-semibold text-[#2f211c]">{session.name}</p>
              <p className="text-xs text-[#7c6b60]">{session.role === "admin" ? "مدير النظام" : "مسؤول المخزن"}</p>
            </div>
            <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-medium text-white hover:bg-[#463025]">
              <LogOut size={16} />
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 shadow-sm">
          <nav className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { id: "overview", label: "نظرة عامة", icon: BarChart3, href: "/inventory" },
              { id: "items", label: "المواد", icon: Boxes, href: "/inventory?section=items" },
              { id: "purchaseRequests", label: "طلبات الشراء", icon: ShoppingCart, href: "/inventory?section=purchaseRequests" },
              { id: "receiving", label: "المشتريات / الاستلام", icon: PackageCheck, href: "/inventory?section=receiving" },
              { id: "recipes", label: "الوصفات", icon: CookingPot, href: "/inventory?section=recipes" },
              { id: "movements", label: "الحركات", icon: ClipboardList, href: "/inventory?section=movements" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href} className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${activeSection === item.id ? "bg-[#5d4032] text-white" : "text-[#4a3b34] hover:bg-[#f5eee6]"}`}>
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
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
