"use client";

import { LogOut, UserRound } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FullscreenButton } from "@/components/ui/FullscreenButton";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

export function OwnerHeader({ session }: { session: UserSession }) {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b bg-[var(--kh-surface)] text-[var(--kh-text)] backdrop-blur">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" priority />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--kh-accent)]">مطعم وكافيه خاتون</p>
            <h1 className="truncate text-xl font-semibold text-[var(--kh-text)]">نظام إدارة خاتون</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="management-action-button h-11">
            <UserRound size={16} className="text-[var(--kh-accent)]" />
            <span>
              <span className="block font-semibold text-[var(--kh-text)]">{session.name}</span>
              <span className="block text-xs text-[var(--kh-muted)]">مالك / شريك</span>
            </span>
          </div>
          <FullscreenButton />
          <button type="button" onClick={logout} className="flex h-11 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(255,86,86,0.18)] transition hover:bg-[#ff7070]">
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
