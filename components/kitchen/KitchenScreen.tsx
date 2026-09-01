"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompletedOrdersDialog } from "@/components/kitchen/CompletedOrdersDialog";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";
import { KitchenHeader } from "@/components/kitchen/KitchenHeader";
import { KitchenOrderDetails } from "@/components/kitchen/KitchenOrderDetails";
import { KitchenStats } from "@/components/kitchen/KitchenStats";
import { KitchenToast } from "@/components/kitchen/KitchenToast";
import { KitchenToolbar } from "@/components/kitchen/KitchenToolbar";
import { OperationalToast } from "@/components/operational/OperationalToast";
import { useOperationalNotifications } from "@/components/operational/useOperationalNotifications";
import { kitchenActiveStatuses } from "@/config/kitchen";
import { isKitchenOrderLate, matchesKitchenFilter, matchesKitchenSearch } from "@/lib/kitchenOrders";
import { createClient } from "@/lib/supabase/client";
import { getKitchenOrders, updateKitchenOrderStatus } from "@/services/kitchenService";
import type { UserSession } from "@/types/auth";
import type { KitchenFilter, KitchenOrder, KitchenOrderStatus } from "@/types/kitchen";

type KitchenScreenProps = {
  session: UserSession;
};

function getKitchenStatusErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("INSUFFICIENT_INVENTORY")) {
    const [, itemName] = message.split(":");
    return `لا يمكن بدء التحضير: مخزون ${itemName || "إحدى المواد"} غير كافٍ.`;
  }

  if (message.includes("INVENTORY_RECIPE_MISSING") || message.includes("INVENTORY_RECIPE_EMPTY")) {
    const [, itemName] = message.split(":");
    return `لا يمكن بدء التحضير: يجب إعداد وصفة صالحة للصنف ${itemName || "المتتبع"}.`;
  }

  return "تعذر تحديث حالة الطلب في Supabase.";
}

export function KitchenScreen({ session }: KitchenScreenProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [now, setNow] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<KitchenFilter>("all");
  const [activeMobileStatus, setActiveMobileStatus] = useState<KitchenOrderStatus>("new");
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [toast, setToast] = useState("");
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const notifications = useOperationalNotifications({ role: "kitchen" });

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  const refreshOrders = useCallback(async () => {
    const nextOrders = await getKitchenOrders();
    setOrders(nextOrders);
    setNow(Date.now());
  }, []);
  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      try {
        const nextOrders = await getKitchenOrders();

        if (!isMounted) {
          return;
        }

        setOrders(nextOrders);
        setNow(Date.now());
      } catch (error) {
        console.error("Failed to load kitchen orders", error);

        if (isMounted) {
          showToast("تعذر تحميل طلبات المطبخ من Supabase.");
        }
      }
    }

    void loadOrders();
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

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
          console.error("Failed to refresh kitchen orders after realtime change", error);
        });
      }, 200);
    }

    const channel = supabase
      .channel("kitchen-order-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleRefresh)
      .subscribe((status, error) => {
        if (error) {
          console.error("Kitchen realtime subscription error", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Kitchen realtime subscription failed", { status });
        }
      });

    return () => {
      isMounted = false;

      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [refreshOrders]);

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
          new Date(first.timing.receivedAt).getTime() - new Date(second.timing.receivedAt).getTime()
        );
      });
  }, [filter, now, orders, searchTerm]);

  const stats = useMemo(() => {
    return {
      newCount: orders.filter((order) => order.status === "new").length,
      preparingCount: orders.filter((order) => order.status === "preparing").length,
      readyCount: orders.filter((order) => order.status === "ready").length,
      lateCount: orders.filter((order) => isKitchenOrderLate(order, now)).length,
    };
  }, [now, orders]);

  async function changeStatus(orderId: string, nextStatus: KitchenOrderStatus) {
    if (nextStatus === "new" || nextStatus === "cancelled") {
      return;
    }

    try {
      await updateKitchenOrderStatus(orderId, nextStatus);
      await refreshOrders();
      showToast(nextStatus === "preparing" ? "بدأ التحضير" : nextStatus === "ready" ? "تم تحويل الطلب إلى جاهز" : "تم تسليم الطلب");
    } catch (error) {
      console.error("Failed to update kitchen status", error);
      showToast(getKitchenStatusErrorMessage(error));
    }
  }

  async function refreshFromDatabase() {
    try {
      await refreshOrders();
      showToast("تم تحديث طلبات المطبخ");
    } catch (error) {
      console.error("Failed to refresh kitchen orders", error);
      showToast("تعذر تحديث شاشة المطبخ.");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#171513] text-[#FFF8EE]">
      <KitchenHeader
        session={session}
        soundEnabled={notifications.soundEnabled}
        soundNeedsActivation={notifications.soundNeedsActivation}
        onToggleSound={notifications.toggleSound}
        onOpenCompleted={() => setIsCompletedOpen(true)}
        onAddDemoOrder={refreshFromDatabase}
        onResetDemoData={refreshFromDatabase}
      />

      <main className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
        <KitchenStats {...stats} />
        <KitchenToolbar
          searchTerm={searchTerm}
          filter={filter}
          onSearchChange={setSearchTerm}
          onFilterChange={setFilter}
          onRefresh={() => {
            void refreshFromDatabase();
          }}
        />
        <KitchenBoard
          orders={visibleOrders}
          activeMobileStatus={activeMobileStatus}
          now={now}
          onMobileStatusChange={setActiveMobileStatus}
          onStatusChange={changeStatus}
          onOpenDetails={setSelectedOrder}
        />
      </main>

      <KitchenOrderDetails order={selectedOrder} now={now} onClose={() => setSelectedOrder(null)} />
      <CompletedOrdersDialog orders={orders} isOpen={isCompletedOpen} onClose={() => setIsCompletedOpen(false)} />
      <KitchenToast message={toast} />
      <OperationalToast toast={notifications.toast} />
    </div>
  );
}
