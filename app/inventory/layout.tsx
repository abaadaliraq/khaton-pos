"use client";

import { BarChart3, Boxes, ClipboardList, CookingPot, LogOut, PackageCheck, ShoppingCart, ShieldCheck } from "lucide-react";
import Image from "next/image";
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
    <div dir="rtl" className="management-shell min-h-screen bg-[#292929] text-white">
      <header className="border-b border-white/5 bg-[#202020]/95 text-white backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" priority />
            <div>
              <p className="text-xs font-semibold text-[#ff5656]">مطعم وكافيه خاتون</p>
              <h1 className="text-xl font-semibold text-white">إدارة المخزن</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.role === "admin" ? (
              <Link href="/admin" className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-300 hover:bg-white/[0.1] hover:text-white">
                <ShieldCheck size={16} />
                العودة إلى الإدارة
              </Link>
            ) : null}
            <div className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm">
              <p className="font-semibold text-white">{session.name}</p>
              <p className="text-xs text-zinc-400">{session.role === "admin" ? "مدير النظام" : "مسؤول المخزن"}</p>
            </div>
            <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white hover:bg-[#ff7070]">
              <LogOut size={16} />
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="management-content grid w-full gap-4 px-4 py-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-md border border-white/10 bg-[#202020] p-3 shadow-[0_18px_34px_rgba(0,0,0,0.14)]">
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
                <Link key={item.id} href={item.href} className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium ${activeSection === item.id ? "border-[#ff5656]/35 bg-[#ff5656] text-white shadow-[0_14px_28px_rgba(255,86,86,0.18)]" : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"}`}>
                  <Icon size={17} className={activeSection === item.id ? "text-white" : "text-[#ff5656]"} />
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
