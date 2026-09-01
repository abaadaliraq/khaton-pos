"use client";

import { BarChart3, Clock, LogOut, UserRound, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OperationalBrand } from "@/components/operational/OperationalBrand";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

type CashierHeaderProps = {
  session: UserSession;
  soundEnabled: boolean;
  soundNeedsActivation: boolean;
  onToggleSound: () => void;
  onOpenShiftSummary: () => void;
};

function getTime() {
  return new Intl.DateTimeFormat("ar-IQ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Baghdad",
  }).format(new Date());
}

export function CashierHeader({ session, soundEnabled, soundNeedsActivation, onToggleSound, onOpenShiftSummary }: CashierHeaderProps) {
  const router = useRouter();
  const [time, setTime] = useState("");

  useEffect(() => {
    const firstTick = window.setTimeout(() => setTime(getTime()), 0);
    const timer = window.setInterval(() => setTime(getTime()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="cashier-no-print border-b border-[#d8c9b7] bg-[#F7F1E8]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <OperationalBrand title="نقطة البيع" subtitle="واجهة المحاسب" meta={session.name} variant="light" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-[#d8c9b7] bg-white px-3 text-sm text-[#2C211D] shadow-sm">
            <UserRound size={16} />
            <span>{session.name}</span>
          </div>
          <div className="hidden h-10 items-center gap-2 rounded-lg border border-[#d8c9b7] bg-white px-3 text-sm text-[#2C211D] shadow-sm sm:flex">
            <Clock size={16} />
            <span className="tabular-nums">{time || "..."}</span>
          </div>
          <span className="h-10 rounded-lg border border-[#3B8F8B]/25 bg-[#3B8F8B]/10 px-3 py-2 text-sm font-medium text-[#2f7470]">
            الوردية مفتوحة
          </span>
          <button
            type="button"
            onClick={onToggleSound}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#d8c9b7] bg-white px-3 text-sm font-medium text-[#2C211D] shadow-sm hover:bg-[#E8DCCB]"
          >
            {soundEnabled ? <Volume2 size={16} className="text-[#ff5656]" /> : <VolumeX size={16} />}
            {soundNeedsActivation ? "اضغط لتفعيل الصوت" : soundEnabled ? "الصوت مفعل" : "الصوت مكتوم"}
          </button>
          <button
            type="button"
            onClick={onOpenShiftSummary}
            className="flex h-10 items-center gap-2 rounded-lg bg-[#B85F4A] px-3 text-sm font-medium text-white hover:bg-[#7B3F32]"
          >
            <BarChart3 size={16} />
            ملخص الوردية
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#d8c9b7] bg-white px-3 text-sm font-medium text-[#2C211D] shadow-sm hover:bg-[#E8DCCB]"
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
