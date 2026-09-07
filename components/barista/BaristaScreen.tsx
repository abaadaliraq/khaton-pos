"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaristaHeader } from "@/components/barista/BaristaHeader";
import { BaristaInventoryRequestsDialog } from "@/components/barista/BaristaInventoryRequestsDialog";
import { BaristaToolbar } from "@/components/barista/BaristaToolbar";
import { BaristaWasteDialog } from "@/components/barista/BaristaWasteDialog";
import { InventoryRequisitionRequestDialog } from "@/components/inventory/InventoryRequisitionRequestDialog";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";
import { KitchenOrderDetails } from "@/components/kitchen/KitchenOrderDetails";
import { KitchenStats } from "@/components/kitchen/KitchenStats";
import { KitchenToast } from "@/components/kitchen/KitchenToast";
import { OperationalToast } from "@/components/operational/OperationalToast";
import { useOperationalNotifications } from "@/components/operational/useOperationalNotifications";
import { kitchenActiveStatuses } from "@/config/kitchen";
import { getTimestamp } from "@/lib/displayFormat";
import { isKitchenOrderLate, matchesKitchenFilter, matchesKitchenSearch } from "@/lib/kitchenOrders";
import { createClient } from "@/lib/supabase/client";
import { getBaristaOrders, updateBaristaOrderStatus } from "@/services/baristaService";
import { getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import type { UserSession } from "@/types/auth";
import type { KitchenFilter, KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type BaristaScreenProps = {
  session: UserSession;
};

function getBaristaStatusErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Station is not allowed")) {
    return "ليست لديك صلاحية التحكم بمحطة الباريستا.";
  }

  if (message.includes("INSUFFICIENT_INVENTORY")) {
    const [, itemName] = message.split(":");
    return `لا يمكن بدء التحضير: مخزون ${itemName || "إحدى المواد"} غير كافٍ.`;
  }

  if (message.includes("INVENTORY_RECIPE_MISSING") || message.includes("INVENTORY_RECIPE_EMPTY")) {
    const [, itemName] = message.split(":");
    return `لا يمكن بدء التحضير: يجب إعداد وصفة صالحة للصنف ${itemName || "المتتبع"}.`;
  }

  if (message.includes("Station items must be preparing before they can be marked ready") || message.includes("يجب بدء تحضير جميع الأصناف أولاً")) {
    return "لا يمكن تحويل الطلب إلى جاهز قبل بدء تحضير كل أصناف الباريستا.";
  }

  if (message.includes("Station items must be submitted before preparation can start")) {
    return "لا يمكن بدء التحضير لهذا الطلب من حالته الحالية.";
  }

  return "تعذر تحديث حالة طلب الباريستا في Supabase.";
}

function getSupabaseErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { code: undefined, message: String(error), details: undefined, hint: undefined };
  }

  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };

  return {
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    message: typeof maybeError.message === "string" ? maybeError.message : undefined,
    details: typeof maybeError.details === "string" ? maybeError.details : null,
    hint: typeof maybeError.hint === "string" ? maybeError.hint : null,
  };
}

export function BaristaScreen({ session }: BaristaScreenProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<KitchenFilter>("all");
  const [activeMobileStatus, setActiveMobileStatus] = useState<KitchenOrderStatus>("new");
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [toast, setToast] = useState("");
  const [pendingReceiptCount, setPendingReceiptCount] = useState(0);
  const [isMaterialRequestOpen, setIsMaterialRequestOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isWasteOpen, setIsWasteOpen] = useState(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const requisitionRefreshTimerRef = useRef<number | null>(null);
  const notifications = useOperationalNotifications({ role: "barista", station: "barista" });

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  const refreshOrders = useCallback(async () => {
    const nextOrders = await getBaristaOrders();
    setOrders(nextOrders);
    setNow(Date.now());
  }, []);

  const refreshRequisitions = useCallback(async () => {
    const nextRequisitions = await getInventoryRequisitions();
    setPendingReceiptCount(nextRequisitions.filter((request) => request.destination === "barista" && request.status === "issued").length);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      try {
        const nextOrders = await getBaristaOrders();

        if (!isMounted) {
          return;
        }

        setOrders(nextOrders);
        setNow(Date.now());
      } catch (error) {
        console.error("Failed to load barista orders", error);

        if (isMounted) {
          showToast("تعذر تحميل طلبات الباريستا من Supabase.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrders();
    const requisitionTimer = window.setTimeout(() => {
      void refreshRequisitions().catch((error) => {
        console.error("Failed to load barista requisition counter", error);
      });
    }, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      isMounted = false;
      window.clearTimeout(requisitionTimer);
      window.clearInterval(timer);
    };
  }, [refreshRequisitions]);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    function scheduleRefresh() {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        refreshOrders().catch((error) => {
          console.error("Failed to refresh barista orders after realtime change", error);
        });
      }, 200);
    }

    function scheduleRequisitionRefresh(payload?: { new?: { destination?: unknown; status?: unknown } }) {
      if (requisitionRefreshTimerRef.current) {
        window.clearTimeout(requisitionRefreshTimerRef.current);
      }

      if (payload?.new?.destination === "barista" && payload.new.status === "approved") {
        showToast("تم اعتماد طلب مواد الباريستا");
      }

      if (payload?.new?.destination === "barista" && payload.new.status === "issued") {
        showToast("تم صرف مواد الباريستا، يرجى تأكيد الاستلام");
      }

      requisitionRefreshTimerRef.current = window.setTimeout(() => {
        requisitionRefreshTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        refreshRequisitions().catch((error) => {
          console.error("Failed to refresh barista requisitions after realtime change", error);
        });
      }, 250);
    }

    const channel = supabase
      .channel("barista-order-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisitions" }, scheduleRequisitionRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisition_items" }, () => scheduleRequisitionRefresh())
      .subscribe((status, error) => {
        if (error) {
          console.error("Barista realtime subscription error", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Barista realtime subscription failed", { status });
        }
      });

    return () => {
      isMounted = false;

      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }

      if (requisitionRefreshTimerRef.current) {
        window.clearTimeout(requisitionRefreshTimerRef.current);
        requisitionRefreshTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [refreshOrders, refreshRequisitions]);

  const visibleOrders = useMemo(() => {
    return orders
      .filter((order) => kitchenActiveStatuses.includes(order.status))
      .filter((order) => matchesKitchenSearch(order, searchTerm))
      .filter((order) => matchesKitchenFilter(order, filter, now))
      .sort((first, second) => {
        const firstLate = isKitchenOrderLate(first, now) ? 1 : 0;
        const secondLate = isKitchenOrderLate(second, now) ? 1 : 0;
        const firstPriority = first.priority === "priority" ? 1 : 0;
        const secondPriority = second.priority === "priority" ? 1 : 0;

        return (
          secondLate - firstLate ||
          secondPriority - firstPriority ||
          (getTimestamp(first.timing.receivedAt) ?? 0) - (getTimestamp(second.timing.receivedAt) ?? 0)
        );
      });
  }, [filter, now, orders, searchTerm]);

  const stats = useMemo(() => ({
    newCount: orders.filter((order) => order.status === "new").length,
    preparingCount: orders.filter((order) => order.status === "preparing").length,
    readyCount: orders.filter((order) => order.status === "ready").length,
    lateCount: orders.filter((order) => isKitchenOrderLate(order, now)).length,
  }), [now, orders]);

  async function changeStatus(orderId: string, nextStatus: KitchenOrderStatus) {
    if (nextStatus !== "preparing" && nextStatus !== "ready") {
      return;
    }

    try {
      await updateBaristaOrderStatus(orderId, nextStatus);
      await refreshOrders();
      showToast(nextStatus === "preparing" ? "بدأ تحضير المشروبات" : "تم تجهيز مشروبات الطلب");
    } catch (error) {
      console.error("Failed to update barista status", getSupabaseErrorDetails(error));
      showToast(getBaristaStatusErrorMessage(error));
    }
  }

  async function refreshFromDatabase() {
    try {
      await refreshOrders();
      showToast("تم تحديث طلبات الباريستا");
    } catch (error) {
      console.error("Failed to refresh barista orders", error);
      showToast("تعذر تحديث شاشة الباريستا.");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#171513] text-[#FFF8EE]">
      <BaristaHeader
        session={session}
        pendingReceiptCount={pendingReceiptCount}
        onOpenMaterialRequest={() => setIsMaterialRequestOpen(true)}
        onOpenRequests={() => setIsRequestsOpen(true)}
        onOpenWaste={() => setIsWasteOpen(true)}
        onRefresh={() => {
          void Promise.all([refreshFromDatabase(), refreshRequisitions()]);
        }}
      />

      <main className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
        <KitchenStats {...stats} />
        <BaristaToolbar
          searchTerm={searchTerm}
          filter={filter}
          onSearchChange={setSearchTerm}
          onFilterChange={setFilter}
        />
        {isLoading ? (
          <section className="grid gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-lg border border-white/10 bg-[#24211E]">
                <div className="m-4 h-8 rounded bg-white/10" />
                <div className="mx-4 mt-8 h-20 rounded bg-white/5" />
                <div className="mx-4 mt-6 h-12 rounded bg-[#D88A3D]/20" />
              </div>
            ))}
          </section>
        ) : visibleOrders.length > 0 ? (
          <KitchenBoard
            orders={visibleOrders}
            activeMobileStatus={activeMobileStatus}
            now={now}
            onMobileStatusChange={setActiveMobileStatus}
            onStatusChange={changeStatus}
            onOpenDetails={setSelectedOrder}
          />
        ) : (
          <section className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#24211E] text-base text-[#C9BEB2]">
            لا توجد طلبات باريستا حالياً
          </section>
        )}
      </main>

      <KitchenOrderDetails order={selectedOrder} now={now} onClose={() => setSelectedOrder(null)} />
      <InventoryRequisitionRequestDialog
        isOpen={isMaterialRequestOpen}
        defaultDestination="barista"
        destinationLocked
        onClose={() => setIsMaterialRequestOpen(false)}
        onCreated={() => {
          void refreshRequisitions();
          showToast("تم إرسال طلب مواد الباريستا إلى المخزن");
        }}
      />
      <BaristaInventoryRequestsDialog
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
        onChanged={() => {
          void refreshRequisitions();
        }}
      />
      <BaristaWasteDialog
        isOpen={isWasteOpen}
        onClose={() => setIsWasteOpen(false)}
        onChanged={() => {
          void refreshRequisitions();
          showToast("تم تحديث سجل هدر الباريستا");
        }}
      />
      <KitchenToast message={toast} />
      <OperationalToast toast={notifications.toast} />
    </div>
  );
}
