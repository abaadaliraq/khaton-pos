"use client";

import { LogOut, RefreshCw, Settings, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FullscreenButton } from "@/components/ui/FullscreenButton";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

export function AdminHeader({ session }: { session: UserSession }) {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b bg-[var(--kh-surface)] text-[var(--kh-text)] backdrop-blur">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={46} height={46} className="h-11 w-11 shrink-0 object-contain" priority />
          <div>
            <p className="text-xs font-semibold text-[var(--kh-accent)]">نظام خاتون</p>
            <h1 className="text-xl font-semibold text-[var(--kh-text)]">لوحة الإدارة</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="management-action-button">
            <UserRound size={16} className="text-[var(--kh-accent)]" />
            {session.name}
          </div>
          <button type="button" onClick={() => router.refresh()} className="management-action-button">
            <RefreshCw size={16} />
            تحديث
          </button>
          <FullscreenButton />
          <Link href="/admin/settings" className="management-action-button" aria-label="الإعدادات">
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
