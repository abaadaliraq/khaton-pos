"use client";

import clsx from "clsx";
import { BarChart3, Boxes, Home, Landmark, ShoppingCart, Truck, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/owner", label: "الرئيسية", icon: Home },
  { href: "/owner/finance", label: "الحسابات", icon: Landmark },
  { href: "/owner/purchases", label: "المشتريات", icon: ShoppingCart },
  { href: "/owner/suppliers", label: "الموردون", icon: Truck },
  { href: "/owner/staff", label: "العمال", icon: UsersRound },
  { href: "/owner/inventory", label: "المخزون", icon: Boxes },
  { href: "/owner/reports", label: "التقارير", icon: BarChart3 },
];

export function OwnerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-l border-white/5 bg-[#202020] lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={52} height={52} className="h-[52px] w-[52px] shrink-0 object-contain" priority />
          <div>
            <p className="text-sm font-bold text-white">مطعم وكافيه خاتون</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">نظام إدارة خاتون</p>
          </div>
        </div>

        <nav className="mt-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/owner" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group flex h-11 items-center gap-3 rounded-md border px-3 text-sm font-medium transition",
                  active
                    ? "border-[#ff5656]/35 bg-[#ff5656] text-white shadow-[0_14px_28px_rgba(255,86,86,0.18)]"
                    : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon size={18} className={active ? "text-white" : "text-[#ff5656] transition group-hover:text-[#ff7676]"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-md border border-white/10 bg-white/[0.04] p-3 text-xs leading-6 text-zinc-400 shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
          <p className="font-medium text-zinc-200">تم تطوير النظام خصيصاً لمطعم وكافيه خاتون</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
            <Image src="/brand/abaad-logo.png" alt="شعار أبعاد العراق" width={18} height={18} className="h-4 w-4 object-contain opacity-80" />
            <span>Developed by Abaad Iraq</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
