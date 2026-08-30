"use client";

import { LogOut, UserRound } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

export function OwnerHeader({ session }: { session: UserSession }) {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-white/5 bg-[#202020]/95 text-white backdrop-blur">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={48} height={48} className="h-12 w-12 shrink-0 object-contain lg:hidden" priority />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#ff5656]">مطعم وكافيه خاتون</p>
            <h1 className="truncate text-xl font-semibold text-white">نظام إدارة خاتون</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-300 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <UserRound size={16} className="text-[#ff5656]" />
            <span>
              <span className="block font-semibold text-white">{session.name}</span>
              <span className="block text-xs text-zinc-400">مالك / شريك</span>
            </span>
          </div>
          <button type="button" onClick={logout} className="flex h-11 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(255,86,86,0.18)] transition hover:bg-[#ff7070]">
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
