"use client";

import clsx from "clsx";
import { BarChart3, Boxes, Home, Landmark, ShoppingCart, Truck, UsersRound } from "lucide-react";
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
    <aside className="hidden w-72 shrink-0 border-l border-[#e4d8c8] bg-[#fbfaf7] lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <div className="flex items-center gap-3 border-b border-[#e4d8c8] pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#5d4032] text-lg font-bold text-white">خ</div>
          <div>
            <p className="text-sm font-bold text-[#2f211c]">خاتون POS</p>
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
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active ? "bg-[#5d4032] text-white" : "text-[#4a3b34] hover:bg-[#efe7dc]",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-md border border-[#e4d8c8] bg-white p-3 text-xs leading-6 text-[#7c6b60]">
        </div>
      </div>
    </aside>
  );
}
