"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddOrderDialog } from "@/components/cashier/AddOrderDialog";
import { BillPanel } from "@/components/cashier/BillPanel";
import { CashierFilters, type CashierFilter } from "@/components/cashier/CashierFilters";
import { CashierHeader } from "@/components/cashier/CashierHeader";
import { CashierStats } from "@/components/cashier/CashierStats";
import { CloseTableDialog } from "@/components/cashier/CloseTableDialog";
import { DiscountDialog } from "@/components/cashier/DiscountDialog";
import { OrderDetailsDialog } from "@/components/cashier/OrderDetailsDialog";
import { PaymentDialog } from "@/components/cashier/PaymentDialog";
import { PrintReceipt } from "@/components/cashier/PrintReceipt";
import { ShiftSummaryDialog } from "@/components/cashier/ShiftSummaryDialog";
import { TablesGrid } from "@/components/cashier/TablesGrid";
import { OperationalToast } from "@/components/operational/OperationalToast";
import { useOperationalNotifications } from "@/components/operational/useOperationalNotifications";
import { getBillTotals, getShiftSummary } from "@/lib/cashierCalculations";
import { getSupabaseErrorInfo } from "@/lib/supabaseError";
import { createClient } from "@/lib/supabase/client";
import { getCashierTables } from "@/services/cashierService";
import { getMenuCatalog } from "@/services/menuService";
import { createRestaurantOrder } from "@/services/orderService";
import { applyOrderDiscount, closePaidTable, recordTablePayment } from "@/services/paymentService";
import type { UserSession } from "@/types/auth";
import type { CashierOrder, CashierTable, DiscountData, PaymentRecord } from "@/types/cashier";
import type { MenuItem, OrderItem } from "@/types/pos";

type CashierPosAppProps = {
  session: UserSession;
};

const unreadAdditionsStorageKey = "khatoun-cashier-unread-additional-orders";

function loadUnreadAdditionIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const storedIds = JSON.parse(window.sessionStorage.getItem(unreadAdditionsStorageKey) ?? "[]");
    return new Set(Array.isArray(storedIds) ? storedIds.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function persistUnreadAdditionIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(unreadAdditionsStorageKey, JSON.stringify([...ids]));
}

export function CashierPosApp({ session }: CashierPosAppProps) {
  const [tables, setTables] = useState<CashierTable[]>([]);
  const [unreadAdditionIds, setUnreadAdditionIds] = useState<Set<string>>(() => loadUnreadAdditionIds());
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<CashierFilter>("all");
  const [message, setMessage] = useState("");
  const [isBillSheetOpen, setIsBillSheetOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCloseTableOpen, setIsCloseTableOpen] = useState(false);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<CashierOrder | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addOrderSearchTerm, setAddOrderSearchTerm] = useState("");
  const [addOrderItems, setAddOrderItems] = useState<OrderItem[]>([]);
  const [isSendingAdditionalOrder, setIsSendingAdditionalOrder] = useState(false);
  const [paymentSubmittingOrderId, setPaymentSubmittingOrderId] = useState<string | null>(null);
  const realtimeReloadTimerRef = useRef<number | null>(null);
  const paymentSubmittingOrderRef = useRef<string | null>(null);
  const notifications = useOperationalNotifications({
    role: "cashier",
    onRelevantEvent: (event) => {
      if (event.type !== "new-order" || !event.roundNo || event.roundNo <= 1) {
        return;
      }

      setUnreadAdditionIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(event.orderId);
        persistUnreadAdditionIds(nextIds);
        return nextIds;
      });
    },
  });

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3200);
  }

  const reloadTables = useCallback(async () => {
    const nextTables = await getCashierTables();
    setTables(nextTables);
    setSelectedTableId(
      (currentId) =>
        nextTables.find((table) => table.id === currentId)?.id ??
        nextTables.find((table) => table.order)?.id ??
        nextTables[0]?.id ??
        null,
    );
  }, []);
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [nextTables, catalog] = await Promise.all([getCashierTables(), getMenuCatalog()]);

        if (!isMounted) {
          return;
        }

        setTables(nextTables);
        setMenuItems(catalog.menuItems);
        setSelectedTableId(nextTables.find((table) => table.order)?.id ?? nextTables[0]?.id ?? null);
      } catch (error) {
        console.error("Failed to load cashier data", error);

        if (isMounted) {
          showMessage("تعذر تحميل بيانات المحاسب من Supabase.");
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    function scheduleReload() {
      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
      }

      realtimeReloadTimerRef.current = window.setTimeout(() => {
        realtimeReloadTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        reloadTables().catch((error) => {
          console.error("Failed to reload cashier data after realtime change", error);
        });
      }, 200);
    }

    const channel = supabase
      .channel("cashier-order-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, scheduleReload)
      .subscribe((status, error) => {
        if (error) {
          console.error("Cashier realtime subscription error", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Cashier realtime subscription failed", { status });
        }
      });

    return () => {
      isMounted = false;

      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [reloadTables]);

  const tablesWithUnreadAdditions = useMemo(
    () =>
      tables.map((table) => {
        if (!table.order?.rounds?.length) {
          return table;
        }

        const rounds = table.order.rounds.map((round) => ({
          ...round,
          isNewAddition: round.roundNo > 1 && unreadAdditionIds.has(round.id),
        }));

        return {
          ...table,
          order: {
            ...table.order,
            rounds,
          },
          orders: table.orders?.map((order) => ({
            ...order,
            isNewAddition: order.roundNo > 1 && unreadAdditionIds.has(order.id),
          })),
          unpaidOrders: table.unpaidOrders?.map((order) => ({
            ...order,
            isNewAddition: order.roundNo > 1 && unreadAdditionIds.has(order.id),
          })),
          paidOrders: table.paidOrders?.map((order) => ({
            ...order,
            isNewAddition: order.roundNo > 1 && unreadAdditionIds.has(order.id),
          })),
        };
      }),
    [tables, unreadAdditionIds],
  );

  const selectedTable = useMemo(
    () => tablesWithUnreadAdditions.find((table) => table.id === selectedTableId) ?? null,
    [selectedTableId, tablesWithUnreadAdditions],
  );

  const selectedOrder = selectedTable?.order ?? null;

  const filteredAddOrderItems = useMemo(() => {
    const normalizedSearch = addOrderSearchTerm.trim().toLowerCase();

    return menuItems.filter((item) => normalizedSearch.length === 0 || item.name.toLowerCase().includes(normalizedSearch) || item.description?.toLowerCase().includes(normalizedSearch));
  }, [addOrderSearchTerm, menuItems]);

  const filteredTables = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tablesWithUnreadAdditions.filter((table) => {
      const filterMatches = activeFilter === "all" || table.status === activeFilter;
      const searchMatches =
        normalizedSearch.length === 0 ||
        String(table.id).includes(normalizedSearch) ||
        table.order?.id.toLowerCase().includes(normalizedSearch);

      return filterMatches && searchMatches;
    });
  }, [activeFilter, searchTerm, tablesWithUnreadAdditions]);

  const stats = useMemo(() => {
    const summary = getShiftSummary(tablesWithUnreadAdditions);
    const unpaid = tablesWithUnreadAdditions.reduce((total, table) => {
      if (!table.order || table.status === "paid") {
        return total;
      }

      return total + getBillTotals(table.order).remainingAmount;
    }, 0);

    return {
      openTables: summary.openTables,
      paidInvoices: summary.paidInvoices,
      sales: summary.totalSales,
      unpaid,
      summary,
    };
  }, [tablesWithUnreadAdditions]);

  function selectTable(table: CashierTable) {
    if (!table.order) {
      showMessage("لا يوجد طلب مفتوح على هذه الطاولة");
      return;
    }

    setSelectedTableId(table.id);
    const unreadRoundIds = table.order.rounds?.filter((round) => round.isNewAddition).map((round) => round.id) ?? [];

    if (unreadRoundIds.length > 0) {
      setUnreadAdditionIds((currentIds) => {
        const nextIds = new Set(currentIds);
        unreadRoundIds.forEach((id) => nextIds.delete(id));
        persistUnreadAdditionIds(nextIds);
        return nextIds;
      });
    }

    setIsBillSheetOpen(true);
  }

  async function applyDiscount(discount: DiscountData) {
    if (!selectedOrder) {
      return;
    }

    const subtotal = getBillTotals(selectedOrder).subtotal;
    const discountAmount = discount.type === "percent" ? Math.round((subtotal * discount.value) / 100) : discount.value;

    try {
      await applyOrderDiscount(selectedOrder.id, discountAmount, "خصم من واجهة المحاسب");
      await reloadTables();
      showMessage("تم تطبيق الخصم بنجاح");
    } catch (error) {
      console.error("Failed to apply discount", error);
      showMessage("تعذر تطبيق الخصم في Supabase.");
    }
  }

  async function removeDiscount() {
    if (!selectedOrder) {
      return;
    }

    try {
      await applyOrderDiscount(selectedOrder.id, 0, "إزالة الخصم من واجهة المحاسب");
      await reloadTables();
      showMessage("تمت إزالة الخصم");
    } catch (error) {
      console.error("Failed to remove discount", error);
      showMessage("تعذر إزالة الخصم في Supabase.");
    }
  }

  async function confirmPayment(payment: PaymentRecord) {
    if (!selectedOrder) {
      showMessage("اختر طلباً مفتوحاً قبل تسجيل الدفع.");
      return false;
    }

    if (payment.method === "mixed") {
      showMessage("الدفع المختلط يحتاج تمرير تفاصيل كل وسيلة دفع.");
      return false;
    }

    if (selectedTable?.billingStatus !== "payable") {
      showMessage("لا يمكن تسجيل الدفع لأن الطلب ليس جاهزاً للدفع.");
      return false;
    }

    if (paymentSubmittingOrderRef.current === selectedOrder.id) {
      return false;
    }

    paymentSubmittingOrderRef.current = selectedOrder.id;
    setPaymentSubmittingOrderId(selectedOrder.id);

    try {
      await recordTablePayment(selectedOrder.tableSessionId, [
        {
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        },
      ]);
      await reloadTables();
      showMessage("تم تسجيل الدفع بنجاح");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        const totals = getBillTotals(selectedOrder);
        const info = getSupabaseErrorInfo(error);
        console.warn("Payment failed", {
          orderId: selectedOrder.id,
          tableId: selectedOrder.tableId,
          status: selectedOrder.rawStatus,
          totalAmount: totals.total,
          remainingAmount: totals.remainingAmount,
          paymentAmount: payment.amount,
          paymentMethod: payment.method,
          message: info.message,
          code: info.code,
          details: info.details,
          hint: info.hint,
          raw: error,
        });
      }

      showMessage("تعذر تسجيل الدفع. لم يتم إجراء أي تغيير.");
      return false;
    } finally {
      paymentSubmittingOrderRef.current = null;
      setPaymentSubmittingOrderId(null);
    }
  }

  function resetAddOrder() {
    setAddOrderItems([]);
    setAddOrderSearchTerm("");
    setIsAddOrderOpen(false);
  }

  function addAdditionalItem(item: MenuItem) {
    if (item.price <= 0) {
      return;
    }

    setAddOrderItems((currentItems) => {
      const existingItem = currentItems.find((orderItem) => orderItem.item.id === item.id);

      if (existingItem) {
        return currentItems.map((orderItem) =>
          orderItem.item.id === item.id ? { ...orderItem, quantity: orderItem.quantity + 1 } : orderItem,
        );
      }

      return [...currentItems, { item, quantity: 1, note: "" }];
    });
  }

  function updateAdditionalQuantity(itemId: string, direction: "increase" | "decrease") {
    setAddOrderItems((currentItems) =>
      currentItems.map((orderItem) =>
        orderItem.item.id === itemId
          ? { ...orderItem, quantity: direction === "increase" ? orderItem.quantity + 1 : Math.max(1, orderItem.quantity - 1) }
          : orderItem,
      ),
    );
  }

  async function submitAdditionalOrder() {
    if (!selectedTable?.databaseId || selectedTable.status === "available" || !addOrderItems.length || isSendingAdditionalOrder) {
      return;
    }

    setIsSendingAdditionalOrder(true);

    try {
      await createRestaurantOrder({
        table: {
          id: selectedTable.id,
          databaseId: selectedTable.databaseId,
          status: "occupied",
        },
        items: addOrderItems,
      });
      await reloadTables();
      resetAddOrder();
      showMessage("تم إرسال الطلب الإضافي للمطبخ");
    } catch (error) {
      console.error("Failed to create additional order", error);
      showMessage("تعذر إرسال الطلب الإضافي إلى Supabase.");
    } finally {
      setIsSendingAdditionalOrder(false);
    }
  }

  function printReceipt() {
    if (!selectedOrder) {
      return;
    }

    setPrintOrder(selectedOrder);
    window.setTimeout(() => window.print(), 50);
  }

  async function closeTable() {
    if (!selectedTable?.order) {
      return;
    }

    if (getBillTotals(selectedTable.order).remainingAmount > 0) {
      showMessage("لا يمكن إغلاق الطاولة قبل اكتمال الدفع");
      setIsCloseTableOpen(false);
      return;
    }

    try {
      await closePaidTable(selectedTable.order.id);
      await reloadTables();
      setIsBillSheetOpen(false);
      setIsCloseTableOpen(false);
      showMessage("تم إغلاق الطاولة بنجاح");
    } catch (error) {
      console.error("Failed to close table", error);
      showMessage("تعذر إغلاق الطاولة في Supabase.");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F1E8] text-[#2C211D]">
      <CashierHeader
        session={session}
        soundEnabled={notifications.soundEnabled}
        soundNeedsActivation={notifications.soundNeedsActivation}
        onToggleSound={notifications.toggleSound}
        onOpenShiftSummary={() => setIsShiftOpen(true)}
      />

      <main className="cashier-no-print mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <CashierStats
            openTables={stats.openTables}
            paidInvoices={stats.paidInvoices}
            sales={stats.sales}
            unpaid={stats.unpaid}
          />
          <CashierFilters
            searchTerm={searchTerm}
            activeFilter={activeFilter}
            onSearchChange={setSearchTerm}
            onFilterChange={setActiveFilter}
          />
          <TablesGrid tables={filteredTables} selectedTableId={selectedTableId} onSelect={selectTable} />
        </div>

        <BillPanel
          table={selectedTable}
          isMobileOpen={isBillSheetOpen}
          onMobileClose={() => setIsBillSheetOpen(false)}
          onOpenDetails={() => setIsDetailsOpen(true)}
          onOpenDiscount={() => setIsDiscountOpen(true)}
          onRemoveDiscount={removeDiscount}
          onOpenPayment={() => setIsPaymentOpen(true)}
          onPrint={printReceipt}
          onOpenAddOrder={() => setIsAddOrderOpen(true)}
          onOpenCloseTable={() => setIsCloseTableOpen(true)}
          isPaymentSubmitting={paymentSubmittingOrderId === selectedOrder?.id}
        />
      </main>

      {message ? (
        <div className="cashier-no-print fixed left-4 right-4 top-20 z-[60] mx-auto max-w-md rounded-lg border border-[#3B8F8B]/25 bg-[#3B8F8B]/10 px-4 py-3 text-center font-medium text-[#2f7470] shadow-sm">
          {message}
        </div>
      ) : null}
      <OperationalToast toast={notifications.toast} />

      <DiscountDialog order={selectedOrder} isOpen={isDiscountOpen} onClose={() => setIsDiscountOpen(false)} onApply={applyDiscount} />
      <PaymentDialog
        order={selectedOrder}
        isOpen={isPaymentOpen}
        isSubmitting={paymentSubmittingOrderId === selectedOrder?.id}
        onClose={() => setIsPaymentOpen(false)}
        onConfirm={confirmPayment}
      />
      <ShiftSummaryDialog isOpen={isShiftOpen} summary={stats.summary} onClose={() => setIsShiftOpen(false)} />
      <OrderDetailsDialog order={selectedOrder} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
      <CloseTableDialog isOpen={isCloseTableOpen} onClose={() => setIsCloseTableOpen(false)} onConfirm={closeTable} />
      <PrintReceipt order={printOrder ?? selectedOrder} session={session} />
      <AddOrderDialog
        table={selectedTable}
        items={filteredAddOrderItems}
        orderItems={addOrderItems}
        searchTerm={addOrderSearchTerm}
        isOpen={isAddOrderOpen}
        isSubmitting={isSendingAdditionalOrder}
        onSearchChange={setAddOrderSearchTerm}
        onAddItem={addAdditionalItem}
        onIncrease={(itemId) => updateAdditionalQuantity(itemId, "increase")}
        onDecrease={(itemId) => updateAdditionalQuantity(itemId, "decrease")}
        onRemove={(itemId) => setAddOrderItems((currentItems) => currentItems.filter((orderItem) => orderItem.item.id !== itemId))}
        onClose={resetAddOrder}
        onSubmit={submitAdditionalOrder}
      />
    </div>
  );
}
