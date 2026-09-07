"use client";

import { BarChart3, Boxes, ClipboardList, CookingPot, LogOut, PackageCheck, Recycle, ScrollText, ShoppingCart, ShieldCheck, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OperationalToast } from "@/components/operational/OperationalToast";
import type { OperationalToastState } from "@/components/operational/OperationalToast";
import { FullscreenButton } from "@/components/ui/FullscreenButton";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/services/authService";
import { getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import type { UserSession } from "@/types/auth";
import type { InventoryRequisition, InventoryRequisitionDestination } from "@/types/inventory";

const requisitionActionStatuses = new Set(["pending", "approved"]);
const storekeeperRequisitionSound = "/sounds/new-order.mp3";
const destinationLabels: Record<InventoryRequisitionDestination, string> = {
  kitchen: "المطبخ",
  barista: "الباريستا",
  bar: "البار",
  service: "الخدمة",
  cleaning: "التنظيف",
  management: "الإدارة",
  other: "أخرى",
};

function materialSummary(requisition: InventoryRequisition) {
  const names = requisition.items.map((item) => item.inventoryItemName).filter(Boolean);
  if (names.length === 0) return "مواد جديدة";
  if (names.length <= 3) return names.join("، ");
  return `${names.slice(0, 3).join("، ")} +${names.length - 3}`;
}

function wasRequisitionNotified(id: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`khatoun-storekeeper-requisition:${id}`) === "1";
}

function markRequisitionNotified(id: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`khatoun-storekeeper-requisition:${id}`, "1");
}

function InventoryShell({ session, children }: { session: UserSession; children: ReactNode }) {
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("section") ?? "overview";
  const [requisitionActionCount, setRequisitionActionCount] = useState(0);
  const [toast, setToast] = useState<OperationalToastState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isAudioUnlockedRef = useRef(false);
  const reloadTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const navGroups = [
    {
      label: "الرئيسية",
      items: [{ id: "overview", label: "نظرة عامة", icon: BarChart3, href: "/inventory" }],
    },
    {
      label: "إدارة المخزون",
      items: [
        { id: "items", label: "المواد", icon: Boxes, href: "/inventory?section=items" },
        { id: "requisitions", label: "طلبات الصرف", icon: ScrollText, href: "/inventory?section=requisitions" },
        { id: "movements", label: "الحركات", icon: ClipboardList, href: "/inventory?section=movements" },
        { id: "waste", label: "الهدر والتلف", icon: Recycle, href: "/inventory?section=waste" },
      ],
    },
    {
      label: "المشتريات",
      items: [
        { id: "purchaseRequests", label: "طلبات الشراء", icon: ShoppingCart, href: "/inventory?section=purchaseRequests" },
        { id: "receiving", label: "المشتريات / الاستلام", icon: PackageCheck, href: "/inventory?section=receiving" },
      ],
    },
    {
      label: "الرقابة والتحليل",
      items: [{ id: "analytics", label: "تحليل المخزون", icon: BarChart3, href: "/inventory?section=analytics" }],
    },
    {
      label: "الإعداد",
      items: [{ id: "recipes", label: "الوصفات", icon: CookingPot, href: "/inventory?section=recipes" }],
    },
    {
      label: "الأصول",
      items: [{ id: "equipment", label: "المعدات والصيانة", icon: Wrench, href: "/inventory?section=equipment" }],
    },
  ];

  async function logout() {
    await signOut();
    window.location.replace("/inventory/login");
  }

  const unlockAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isAudioUnlockedRef.current) return;

    audio.muted = true;
    void audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        isAudioUnlockedRef.current = true;
      })
      .catch(() => {
        audio.muted = false;
      });
  }, []);

  const playAlertSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isAudioUnlockedRef.current) return;

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  function showRequisitionToast(requisition: InventoryRequisition) {
    const title = `طلب مواد جديد من ${destinationLabels[requisition.destination]}`;
    const nextToast: OperationalToastState = {
      id: `storekeeper-requisition:${requisition.id}:${Date.now()}`,
      title,
      tableLabel: requisition.requestCode,
      message: isAudioUnlockedRef.current ? materialSummary(requisition) : `${materialSummary(requisition)} · اضغط مرة واحدة لتفعيل تنبيهات النظام`,
      tone: "new",
    };

    setToast(nextToast);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
  }

  const loadRequisitionActionCount = useCallback(async (notifyRequisitionId?: string) => {
    const requisitions = await getInventoryRequisitions();
    setRequisitionActionCount(requisitions.filter((requisition) => requisitionActionStatuses.has(requisition.status)).length);

    if (!notifyRequisitionId || wasRequisitionNotified(notifyRequisitionId)) {
      return;
    }

    const requisition = requisitions.find((request) => request.id === notifyRequisitionId);
    if (!requisition || requisition.status !== "pending") {
      return;
    }

    markRequisitionNotified(requisition.id);
    showRequisitionToast(requisition);
    playAlertSound();
  }, [playAlertSound]);

  useEffect(() => {
    audioRef.current = new Audio(storekeeperRequisitionSound);
    audioRef.current.preload = "auto";

    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const timer = window.setTimeout(() => {
      void loadRequisitionActionCount().catch((error) => {
        console.error("Failed to load inventory requisition badge", error);
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audioRef.current = null;
    };
  }, [loadRequisitionActionCount, unlockAudio]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleReload(notifyRequisitionId?: string) {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadRequisitionActionCount(notifyRequisitionId).catch((error) => {
          console.error("Failed to refresh inventory requisition badge", error);
        });
      }, 600);
    }

    const channel = supabase
      .channel("inventory-shell-requisition-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_requisitions" }, (payload) => {
        const row = payload.new as { id?: string };
        scheduleReload(row.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inventory_requisitions" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisition_items" }, () => scheduleReload())
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [loadRequisitionActionCount]);

  return (
    <div dir="rtl" className="management-shell min-h-screen overflow-x-hidden">
      <header className="border-b bg-[var(--kh-surface)] text-[var(--kh-text)] backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" priority />
            <div>
              <p className="text-xs font-semibold text-[var(--kh-accent)]">مطعم وكافيه خاتون</p>
              <h1 className="text-xl font-semibold text-[var(--kh-text)]">إدارة المخزن</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.role === "admin" ? (
              <Link href="/admin" className="management-action-button">
                <ShieldCheck size={16} />
                العودة إلى الإدارة
              </Link>
            ) : null}
            <div className="rounded-md border border-[var(--kh-border)] bg-[var(--kh-surface)] px-3 py-2 text-sm">
              <p className="font-semibold text-[var(--kh-text)]">{session.name}</p>
              <p className="text-xs text-[var(--kh-muted)]">{session.role === "admin" ? "مدير النظام" : "مسؤول المخزن"}</p>
            </div>
            <FullscreenButton />
            <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white hover:bg-[#ff7070]">
              <LogOut size={16} />
              خروج
            </button>
          </div>
        </div>
      </header>

      <nav className="management-top-nav sticky top-0 z-40 border-b px-3 py-2 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {navGroups.flatMap((group) => group.items).map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Link key={item.id} href={item.href} className={`management-nav-link ${isActive ? "is-active" : ""}`}>
                <Icon size={15} />
                <span className="truncate">{item.label}</span>
                {item.id === "requisitions" && requisitionActionCount > 0 ? (
                  <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${isActive ? "bg-white text-[#ff5656]" : "bg-[#ff5656] text-white"}`}>
                    {requisitionActionCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="management-content w-full min-w-0 px-3 py-3 lg:px-4">
        <main className="min-w-0 overflow-x-hidden pb-8">{children}</main>
      </div>
      <OperationalToast toast={toast} />
    </div>
  );
}

export default function InventoryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/inventory/login") {
    return <>{children}</>;
  }

  return (
    <AuthGuard allowedRole={["admin", "storekeeper"]} loginPath="/inventory/login">
      {(session) => <InventoryShell session={session}>{children}</InventoryShell>}
    </AuthGuard>
  );
}
