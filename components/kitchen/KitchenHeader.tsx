"use client";

import { ChefHat, Clock, LogOut, Maximize, Minimize, Volume2, VolumeX, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

type KitchenHeaderProps = {
  session: UserSession;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenCompleted: () => void;
  onAddDemoOrder: () => void;
  onResetDemoData: () => void;
};

function getDateTime() {
  const now = new Date();
  return {
    time: new Intl.DateTimeFormat("ar-IQ", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Baghdad",
    }).format(now),
    date: new Intl.DateTimeFormat("ar-IQ", {
      dateStyle: "medium",
      timeZone: "Asia/Baghdad",
    }).format(now),
  };
}

export function KitchenHeader({
  session,
  soundEnabled,
  onToggleSound,
  onOpenCompleted,
  onAddDemoOrder,
  onResetDemoData,
}: KitchenHeaderProps) {
  const router = useRouter();
  const [clock, setClock] = useState({ time: "", date: "" });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setClock(getDateTime()), 0);
    const timer = window.setInterval(() => setClock(getDateTime()), 1000);
    const fullscreenListener = () => setIsFullscreen(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", fullscreenListener);

    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
      document.removeEventListener("fullscreenchange", fullscreenListener);
    };
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenEnabled) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#171513]">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#D88A3D] text-[#171513]">
            <ChefHat size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#D88A3D]">خاتون / KHATOUN</p>
            <h1 className="text-2xl font-semibold text-[#FFF8EE]">شاشة المطبخ</h1>
            <p className="text-sm text-[#C9BEB2]">{session.name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm text-[#FFF8EE] md:flex">
            <Clock size={17} />
            <span>{clock.time || "..."}</span>
            <span className="text-[#C9BEB2]">{clock.date}</span>
          </div>
          <span className="flex h-11 items-center gap-2 rounded-lg border border-[#3E8B65]/35 bg-[#3E8B65]/15 px-3 text-sm font-medium text-[#8de0b8]">
            <Wifi size={17} />
            المطبخ متصل
          </span>
          <button type="button" onClick={onOpenCompleted} className="h-11 rounded-lg bg-[#302B27] px-3 text-sm font-medium text-[#FFF8EE] hover:bg-[#3b3631]">
            الطلبات المكتملة
          </button>
          <button type="button" onClick={onToggleSound} className="flex h-11 items-center gap-2 rounded-lg bg-[#302B27] px-3 text-sm text-[#FFF8EE] hover:bg-[#3b3631]">
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            {soundEnabled ? "الصوت مفعل" : "الصوت مكتوم"}
          </button>
          <button type="button" onClick={toggleFullscreen} className="flex h-11 items-center gap-2 rounded-lg bg-[#D88A3D] px-3 text-sm font-semibold text-[#171513] hover:bg-[#e29b54]">
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            ملء الشاشة
          </button>
          <button type="button" onClick={logout} className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm text-[#FFF8EE] hover:bg-[#302B27]">
            <LogOut size={17} />
            خروج
          </button>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2 px-4 pb-3">
        <span className="text-xs text-[#C9BEB2]">أدوات التجربة</span>
        <button type="button" onClick={onAddDemoOrder} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#FFF8EE] hover:bg-[#24211E]">
          إضافة طلب تجريبي
        </button>
        <button type="button" onClick={onResetDemoData} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#FFF8EE] hover:bg-[#24211E]">
          إعادة البيانات التجريبية
        </button>
      </div>
    </header>
  );
}
