"use client";

import { LogOut, RefreshCw, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

export function AdminHeader({ session }: { session: UserSession }) {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-[#e4d8c8] bg-[#fffdfa]">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div>
          <p className="text-xs font-semibold text-[#a65f3f]">نظام خاتون</p>
          <h1 className="text-xl font-semibold text-[#2f211c]">لوحة الإدارة</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34]">
            <UserRound size={16} />
            {session.name}
          </div>
          <button type="button" onClick={() => router.refresh()} className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
            <RefreshCw size={16} />
            تحديث
          </button>
          <Link href="/admin/settings" className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]" aria-label="الإعدادات">
            <Settings size={16} />
          </Link>
          <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-medium text-white hover:bg-[#463025]">
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
