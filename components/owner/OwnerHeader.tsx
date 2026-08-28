"use client";

import { LogOut, UserRound } from "lucide-react";
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
    <header className="border-b border-[#e4d8c8] bg-[#fffdfa]">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div>
          <p className="text-xs font-semibold text-[#a65f3f]">خاتون POS</p>
          <h1 className="text-xl font-semibold text-[#2f211c]">لوحة الشركاء</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34]">
            <UserRound size={16} />
            <span>
              <span className="block font-semibold text-[#2f211c]">{session.name}</span>
              <span className="block text-xs text-[#7c6b60]">مالك / شريك</span>
            </span>
          </div>
          <button type="button" onClick={logout} className="flex h-11 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-medium text-white hover:bg-[#463025]">
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
