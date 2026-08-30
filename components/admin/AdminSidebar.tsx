"use client";

import clsx from "clsx";
import { ClipboardList, Home, ReceiptText, Settings, Table2, UsersRound, Utensils } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "الرئيسية", icon: Home },
  { href: "/admin/menu", label: "المنيو", icon: Utensils },
  { href: "/admin/staff", label: "العمال", icon: UsersRound },
  { href: "/admin/tables", label: "الطاولات", icon: Table2 },
  { href: "/admin/audit", label: "سجل العمليات", icon: ClipboardList },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-l border-white/5 bg-[#202020] lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={52} height={52} className="h-[52px] w-[52px] shrink-0 object-contain" priority />
          <div>
            <p className="text-sm font-bold text-white">مطعم وكافيه خاتون</p>
            <p className="text-xs text-zinc-400">لوحة الإدارة</p>
          </div>
        </div>

        <nav className="mt-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex h-11 items-center gap-3 rounded-md border px-3 text-sm font-medium transition",
                  active ? "border-[#ff5656]/35 bg-[#ff5656] text-white shadow-[0_14px_28px_rgba(255,86,86,0.18)]" : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon size={18} className={active ? "text-white" : "text-[#ff5656]"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-md border border-white/10 bg-white/[0.04] p-3 text-xs text-zinc-400 shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
          <ReceiptText className="mb-2 text-[#ff5656]" size={18} />
          إدارة العمال والموظفين مرتبطة بقاعدة Supabase مباشرة.
        </div>
      </div>
    </aside>
  );
}
