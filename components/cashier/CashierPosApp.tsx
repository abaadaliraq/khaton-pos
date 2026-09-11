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
import { formatCurrency } from "@/lib/formatCurrency";
import { getSupabaseErrorInfo } from "@/lib/supabaseError";
import { createClient } from "@/lib/supabase/client";
import { getCashierDailyKpis, getCashierTables } from "@/services/cashierService";
import { closeCashShift, getExpectedCashForShift, getOpenCashShift, openCashShift } from "@/services/financeService";
import { getMenuCatalog } from "@/services/menuService";
import { createRestaurantOrder } from "@/services/orderService";
import { applyOrderDiscount, closePaidTable, recordTablePayment } from "@/services/paymentService";
import type { UserSession } from "@/types/auth";
import type { CashierDailyKpis, CashierOrder, CashierTable, DiscountData, PaymentRecord } from "@/types/cashier";
import type { CashShift, ExpectedCashBreakdown } from "@/types/finance";
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

function paymentErrorMessage(error: unknown) {
  const text = JSON.stringify(error).toLowerCase();
  if (text.includes("stale_cash_shift_must_close")) {
    return "يوجد صندوق مفتوح من يوم سابق. يجب إغلاقه قبل تسجيل دفع نقدي جديد.";
  }
  if (text.includes("cash_shift_required")) {
    return "لا توجد وردية صندوق مفتوحة لهذا الكاشير. افتح ورديتك من واجهة الكاشير.";
  }
  return "تعذر تسجيل الدفع. لم يتم إجراء أي تغيير.";
}

function parseCashInput(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatShiftDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} دقيقة`;
  return `${hours} ساعة و${minutes} دقيقة`;
}

function shiftMinimumCloseAt(openedAt: string) {
  return new Date(new Date(openedAt).getTime() + 15 * 60 * 60 * 1000);
}

function shiftCloseErrorMessage(error: unknown) {
  const text = JSON.stringify(error);
  if (text.includes("لا يمكن إغلاق الوردية قبل إكمال 15 ساعة")) {
    const start = text.indexOf("لا يمكن إغلاق الوردية قبل إكمال 15 ساعة");
    const end = text.indexOf("\"", start);
    return text.slice(start, end > start ? end : undefined);
  }
  if (text.toLowerCase().includes("no open cash shift")) return "لا توجد وردية مفتوحة لإغلاقها.";
  return "تعذر إغلاق الوردية.";
}

function CashierShiftPanel({
  shift,
  expectedCash,
  openingCash,
  countedCash,
  isSaving,
  onOpeningCashChange,
  onCountedCashChange,
  onOpenShift,
  onCloseShift,
  nowMs,
}: {
  shift: CashShift | null;
  expectedCash: ExpectedCashBreakdown | null;
  openingCash: string;
  countedCash: string;
  isSaving: boolean;
  nowMs: number;
  onOpeningCashChange: (value: string) => void;
  onCountedCashChange: (value: string) => void;
  onOpenShift: () => void;
  onCloseShift: () => void;
}) {
  const minimumCloseAt = shift ? shiftMinimumCloseAt(shift.openedAt) : null;
  const elapsed = shift ? nowMs - new Date(shift.openedAt).getTime() : 0;
  const remaining = minimumCloseAt ? minimumCloseAt.getTime() - nowMs : 0;

  return (
    <section className="cashier-no-print overflow-hidden rounded-lg border border-[#E1D3C2] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#E9DDCE] bg-[#FFF9F1] px-3 py-2">
        <div>
          <p className="text-xs font-bold text-[#B34038]">وردية الصندوق</p>
          <h2 className="text-sm font-black text-[#2C211D]">فتح وإغلاق الوردية من الكاشير فقط</h2>
        </div>
        <span className={`rounded-md border px-2 py-1 text-xs font-bold ${shift ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {shift ? "مفتوحة" : "لا توجد وردية"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-right text-xs">
          <thead className="bg-[#2B2421] text-white">
            <tr>
              <th className="border border-[#463D38] px-3 py-2">الحالة</th>
              <th className="border border-[#463D38] px-3 py-2">وقت الفتح</th>
              <th className="border border-[#463D38] px-3 py-2">مضى</th>
              <th className="border border-[#463D38] px-3 py-2">الحد الأدنى للإغلاق</th>
              <th className="border border-[#463D38] px-3 py-2">النقد المتوقع</th>
              <th className="border border-[#463D38] px-3 py-2">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white align-middle text-[#181818]">
              <td className="border border-[#E9DDCE] px-3 py-2 font-bold">{shift ? "مفتوحة" : "مغلقة"}</td>
              <td className="border border-[#E9DDCE] px-3 py-2">{shift ? formatShiftDateTime(shift.openedAt) : "-"}</td>
              <td className="border border-[#E9DDCE] px-3 py-2">{shift ? formatDuration(elapsed) : "-"}</td>
              <td className="border border-[#E9DDCE] px-3 py-2">
                {minimumCloseAt ? `${formatShiftDateTime(minimumCloseAt.toISOString())}${remaining > 0 ? ` — متبقي ${formatDuration(remaining)}` : ""}` : "15 ساعة من وقت الفتح"}
              </td>
              <td className="border border-[#E9DDCE] px-3 py-2 font-black">{shift ? formatCurrency(expectedCash?.expectedCash ?? shift.openingCash) : "-"}</td>
              <td className="border border-[#E9DDCE] px-3 py-2">
                {shift ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={countedCash} onChange={(event) => onCountedCashChange(event.target.value)} inputMode="decimal" placeholder="النقد المعدود" className="h-9 w-32 rounded-md border border-[#D8C8B7] bg-[#FFFDF9] px-2 text-sm outline-none focus:border-[#B34038]" />
                    <button type="button" disabled={isSaving} onClick={onCloseShift} className="h-9 rounded-md bg-[#B34038] px-3 text-xs font-bold text-white disabled:opacity-60">إغلاق الوردية</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={openingCash} onChange={(event) => onOpeningCashChange(event.target.value)} inputMode="decimal" placeholder="الرصيد الافتتاحي" className="h-9 w-36 rounded-md border border-[#D8C8B7] bg-[#FFFDF9] px-2 text-sm outline-none focus:border-[#B34038]" />
                    <button type="button" disabled={isSaving} onClick={onOpenShift} className="h-9 rounded-md bg-[#2F211C] px-3 text-xs font-bold text-white disabled:opacity-60">فتح الوردية</button>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
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
  const [dailyKpis, setDailyKpis] = useState<CashierDailyKpis>({ salesToday: 0, tipsToday: 0, paidInvoicesToday: 0 });
  const [cashShift, setCashShift] = useState<CashShift | null>(null);
  const [cashShiftExpected, setCashShiftExpected] = useState<ExpectedCashBreakdown | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [isShiftSaving, setIsShiftSaving] = useState(false);
  const [shiftClockNow, setShiftClockNow] = useState(() => Date.now());
  const realtimeReloadTimerRef = useRef<number | null>(null);
  const shiftReloadTimerRef = useRef<number | null>(null);
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
    const [nextTables, nextDailyKpis] = await Promise.all([getCashierTables(), getCashierDailyKpis()]);
    setTables(nextTables);
    setDailyKpis(nextDailyKpis);
    setSelectedTableId(
      (currentId) =>
        nextTables.find((table) => table.id === currentId)?.id ??
        nextTables.find((table) => table.order)?.id ??
        nextTables[0]?.id ??
        null,
    );
  }, []);

  const reloadCashShift = useCallback(async () => {
    const nextShift = await getOpenCashShift();
    const nextExpected = nextShift ? await getExpectedCashForShift(nextShift.id) : null;
    setCashShift(nextShift);
    setCashShiftExpected(nextExpected);
    setCountedCash((current) => current || (nextExpected ? String(Math.round(nextExpected.expectedCash)) : ""));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [nextTables, nextDailyKpis, catalog, nextShift] = await Promise.all([getCashierTables(), getCashierDailyKpis(), getMenuCatalog(), getOpenCashShift()]);
        const nextExpected = nextShift ? await getExpectedCashForShift(nextShift.id) : null;

        if (!isMounted) {
          return;
        }

        setTables(nextTables);
        setDailyKpis(nextDailyKpis);
        setMenuItems(catalog.menuItems);
        setCashShift(nextShift);
        setCashShiftExpected(nextExpected);
        setCountedCash(nextExpected ? String(Math.round(nextExpected.expectedCash)) : "");
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
    const timer = window.setInterval(() => setShiftClockNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
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

    function scheduleShiftReload() {
      if (shiftReloadTimerRef.current) {
        window.clearTimeout(shiftReloadTimerRef.current);
      }

      shiftReloadTimerRef.current = window.setTimeout(() => {
        shiftReloadTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        reloadCashShift().catch((error) => {
          console.error("Failed to reload cashier cash shift after realtime change", error);
        });
      }, 200);
    }

    const channel = supabase
      .channel("cashier-order-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_events" }, scheduleReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_item_status_events" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_tips" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_shifts" }, scheduleShiftReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, scheduleShiftReload)
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

      if (shiftReloadTimerRef.current) {
        window.clearTimeout(shiftReloadTimerRef.current);
        shiftReloadTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [reloadCashShift, reloadTables]);

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
      paidInvoices: dailyKpis.paidInvoicesToday,
      sales: dailyKpis.salesToday,
      tips: dailyKpis.tipsToday,
      unpaid,
      summary,
    };
  }, [dailyKpis.paidInvoicesToday, dailyKpis.salesToday, dailyKpis.tipsToday, tablesWithUnreadAdditions]);

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
          tipAmount: payment.tipAmount,
          reference: payment.reference,
        },
      ]);
      await reloadTables();
      await reloadCashShift();
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

      showMessage(paymentErrorMessage(error));
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

  async function handleOpenCashShift() {
    const parsedOpeningCash = parseCashInput(openingCash || "0");
    if (parsedOpeningCash === null) {
      showMessage("أدخل الرصيد الافتتاحي بشكل صحيح.");
      return;
    }

    setIsShiftSaving(true);
    try {
      const createdShift = await openCashShift({ openingCash: parsedOpeningCash });
      const nextExpected = await getExpectedCashForShift(createdShift.id);
      setCashShift(createdShift);
      setCashShiftExpected(nextExpected);
      setOpeningCash("");
      setCountedCash(String(Math.round(nextExpected.expectedCash)));
      showMessage("تم فتح وردية الصندوق.");
    } catch (error) {
      console.error("Failed to open cashier cash shift", error);
      showMessage(error instanceof Error ? error.message : "تعذر فتح الوردية.");
    } finally {
      setIsShiftSaving(false);
    }
  }

  async function handleCloseCashShift() {
    const parsedCountedCash = parseCashInput(countedCash);
    if (parsedCountedCash === null) {
      showMessage("أدخل النقد المعدود بشكل صحيح.");
      return;
    }

    setIsShiftSaving(true);
    try {
      await closeCashShift({ countedCash: parsedCountedCash });
      setCashShift(null);
      setCashShiftExpected(null);
      setCountedCash("");
      await reloadCashShift();
      showMessage("تم إغلاق وردية الصندوق.");
    } catch (error) {
      console.error("Failed to close cashier cash shift", error);
      showMessage(shiftCloseErrorMessage(error));
    } finally {
      setIsShiftSaving(false);
    }
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
    <div dir="rtl" className="cashier-shell min-h-screen bg-[#F7F1E8] text-[#2C211D]">
      <CashierHeader
        session={session}
        soundEnabled={notifications.soundEnabled}
        soundNeedsActivation={notifications.soundNeedsActivation}
        audioState={notifications.audioState}
        lastTestStatus={notifications.lastTestStatus}
        awaitingPaymentCount={notifications.badges.cashierAwaitingPayment}
        onToggleSound={notifications.toggleSound}
        onTestSound={notifications.testSound}
        onOpenShiftSummary={() => setIsShiftOpen(true)}
      />

      <main className="cashier-no-print mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <CashierStats
            openTables={stats.openTables}
            paidInvoices={stats.paidInvoices}
            sales={stats.sales}
            tips={stats.tips}
            unpaid={stats.unpaid}
          />
          <CashierShiftPanel
            shift={cashShift}
            expectedCash={cashShiftExpected}
            openingCash={openingCash}
            countedCash={countedCash}
            isSaving={isShiftSaving}
            nowMs={shiftClockNow}
            onOpeningCashChange={setOpeningCash}
            onCountedCashChange={setCountedCash}
            onOpenShift={() => void handleOpenCashShift()}
            onCloseShift={() => void handleCloseCashShift()}
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
