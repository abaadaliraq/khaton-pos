"use client";

import { ClipboardList, Clock, LogOut, Maximize, Minimize, PackagePlus, RefreshCw, Trash2, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OperationalBrand } from "@/components/operational/OperationalBrand";
import { signOut } from "@/services/authService";
import type { UserSession } from "@/types/auth";

type BaristaHeaderProps = {
  session: UserSession;
  pendingReceiptCount: number;
  onOpenMaterialRequest: () => void;
  onOpenRequests: () => void;
  onOpenWaste: () => void;
  onRefresh: () => void;
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

export function BaristaHeader({
  session,
  pendingReceiptCount,
  onOpenMaterialRequest,
  onOpenRequests,
  onOpenWaste,
  onRefresh,
}: BaristaHeaderProps) {
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
        <OperationalBrand title="شاشة الباريستا" subtitle="محطة المشروبات" meta={session.name} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm text-[#FFF8EE] md:flex">
            <Clock size={17} />
            <span>{clock.time || "..."}</span>
            <span className="text-[#C9BEB2]">{clock.date}</span>
          </div>
          <span className="flex h-11 items-center gap-2 rounded-lg border border-[#3E8B65]/35 bg-[#3E8B65]/15 px-3 text-sm font-medium text-[#8de0b8]">
            <Wifi size={17} />
            الباريستا متصل
          </span>
          <button type="button" onClick={onOpenMaterialRequest} className="flex h-11 items-center gap-2 rounded-lg bg-[#D88A3D] px-3 text-sm font-semibold text-[#171513] hover:bg-[#e29b54]">
            <PackagePlus size={17} />
            طلب مواد
          </button>
          <button type="button" onClick={onOpenRequests} className="relative flex h-11 items-center gap-2 rounded-lg bg-[#302B27] px-3 text-sm text-[#FFF8EE] hover:bg-[#3b3631]">
            <ClipboardList size={17} />
            طلباتي
            {pendingReceiptCount > 0 ? <span className="absolute -top-1 -left-1 rounded-full bg-[#ff5656] px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingReceiptCount}</span> : null}
          </button>
          <button type="button" onClick={onOpenWaste} className="flex h-11 items-center gap-2 rounded-lg bg-[#302B27] px-3 text-sm text-[#FFF8EE] hover:bg-[#3b3631]">
            <Trash2 size={17} />
            الهدر والتلف
          </button>
          <button type="button" onClick={onRefresh} className="flex h-11 items-center gap-2 rounded-lg bg-[#302B27] px-3 text-sm text-[#FFF8EE] hover:bg-[#3b3631]">
            <RefreshCw size={17} />
            تحديث
          </button>
          <button type="button" onClick={toggleFullscreen} className="flex h-11 items-center gap-2 rounded-lg bg-[#D88A3D] px-3 text-sm font-semibold text-[#171513] hover:bg-[#e29b54]">
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            {isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
          </button>
          <button type="button" onClick={logout} className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#24211E] px-3 text-sm text-[#FFF8EE] hover:bg-[#302B27]">
            <LogOut size={17} />
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
