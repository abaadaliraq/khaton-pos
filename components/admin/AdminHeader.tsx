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
    <header className="border-b border-white/5 bg-[#202020]/95 text-white backdrop-blur">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div>
          <p className="text-xs font-semibold text-[#ff5656]">نظام خاتون</p>
          <h1 className="text-xl font-semibold text-white">لوحة الإدارة</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-300">
            <UserRound size={16} className="text-[#ff5656]" />
            {session.name}
          </div>
          <button type="button" onClick={() => router.refresh()} className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-300 hover:bg-white/[0.1] hover:text-white">
            <RefreshCw size={16} />
            تحديث
          </button>
          <Link href="/admin/settings" className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-300 hover:bg-white/[0.1] hover:text-white" aria-label="الإعدادات">
            <Settings size={16} />
          </Link>
          <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white hover:bg-[#ff7070]">
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
