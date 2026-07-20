"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { getRoleLabel } from "@/lib/auth";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

type AppHeaderProps = {
  title: string;
  session: UserSession;
};

export function AppHeader({ title, session }: AppHeaderProps) {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-stone-200 bg-[#fbfaf6]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">خاتون / KHATOUN</p>
          <h1 className="mt-1 text-xl font-semibold text-stone-950">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm">
            <UserRound size={16} />
            <span>{session.name}</span>
            <span className="text-stone-400">/</span>
            <span>{getRoleLabel(session.role)}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
