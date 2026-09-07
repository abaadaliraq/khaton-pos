"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type ManagementTopNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function ManagementTopNav({ items }: { items: ManagementTopNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="management-top-nav sticky top-0 z-40 border-b px-4 py-2 lg:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/admin" && item.href !== "/owner" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={clsx("management-nav-link", active && "is-active")}>
              <Icon size={15} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
