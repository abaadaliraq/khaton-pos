"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatOrderLabel } from "@/lib/displayFormat";
import { getCashierTables } from "@/services/cashierService";
import { getRecentCashShifts } from "@/services/financeService";
import { getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import { getPurchaseRequests, getPurchases } from "@/services/purchaseService";
import type { Database } from "@/types/database.types";
import type { CashShift, PurchaseRequest } from "@/types/finance";
import type { InventoryRequisition, InventoryRequisitionDestination } from "@/types/inventory";
import type { OperationalToastState } from "@/components/operational/OperationalToast";

export type OperationalRole = "kitchen" | "barista" | "captain" | "cashier" | "storekeeper" | "admin" | "accountant" | "owner";
export type PreparationStation = "kitchen" | "barista" | "drinks" | "shisha";
export type OperationalPriority = "info" | "action" | "urgent";
export type OperationalEventType =
  | "kitchen-order-submitted"
  | "barista-order-submitted"
  | "captain-order-ready"
  | "cashier-awaiting-payment"
  | "inventory-requisition-created"
  | "purchase-request-created"
  | "purchase-request-decided"
  | "cash-shift-difference";

export type OperationalNotification = {
  id: string;
  type: OperationalEventType;
  title: string;
  message: string;
  roleTargets: OperationalRole[];
  entityType: "order" | "order_item" | "table_session" | "inventory_requisition" | "purchase_request" | "cash_shift";
  entityId: string;
  createdAt: string;
  priority: OperationalPriority;
  actionUrl?: string;
  sound: "new" | "ready" | "warning" | "none";
  badgeKey?: keyof OperationalBadgeCounts;
  tableLabel?: string;
};

export type OperationalBadgeCounts = {
  kitchenOrders: number;
  baristaOrders: number;
  captainReady: number;
  cashierAwaitingPayment: number;
  storekeeperRequisitions: number;
  managerPurchaseRequests: number;
  accountantPurchaseInfo: number;
  accountantCashDifferences: number;
  ownerPurchaseOversight: number;
  ownerCashDifferences: number;
};

type LegacyOperationalEventType = "new-order" | "order-ready" | "table-awaiting-payment";
type OrderStatusEventRow = Database["public"]["Tables"]["order_status_events"]["Row"];
type OrderItemStatusEventRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  preparation_station: PreparationStation;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
};

type UseOperationalNotificationsOptions = {
  role: OperationalRole;
  station?: PreparationStation;
  enabled?: boolean;
  visualOnly?: boolean;
  onRelevantEvent?: (event: { type: LegacyOperationalEventType; orderId: string; tableSessionId: string | null; roundNo: number | null }) => void;
  onBadgeCountsChange?: (badges: OperationalBadgeCounts) => void;
};

const emptyBadges: OperationalBadgeCounts = {
  kitchenOrders: 0,
  baristaOrders: 0,
  captainReady: 0,
  cashierAwaitingPayment: 0,
  storekeeperRequisitions: 0,
  managerPurchaseRequests: 0,
  accountantPurchaseInfo: 0,
  accountantCashDifferences: 0,
  ownerPurchaseOversight: 0,
  ownerCashDifferences: 0,
};

const soundPreferenceKey = "khatoun-operational-sound-preferred";
let sharedAudioContext: AudioContext | null = null;
type AudioRuntimeState = "none" | AudioContextState;
type SoundTestStatus = "idle" | "success" | "failed";

const destinationLabels: Record<InventoryRequisitionDestination, string> = {
  kitchen: "المطبخ",
  barista: "الباريستا",
  bar: "البار",
  service: "الخدمة",
  cleaning: "التنظيف",
  management: "الإدارة",
  other: "أخرى",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

function purchaseRequestCode(request: PurchaseRequest) {
  return `PR-${String(request.requestNumber).padStart(6, "0")}`;
}

function requisitionSummary(requisition: InventoryRequisition) {
  const names = requisition.items.map((item) => item.inventoryItemName).filter(Boolean);
  if (names.length === 0) return "مواد جديدة";
  if (names.length <= 3) return names.join("، ");
  return `${names.slice(0, 3).join("، ")} +${formatNumber(names.length - 3)}`;
}

function todayBaghdadKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
}

function storageKey(key: string) {
  return `khatoun-operational-event:${key}`;
}

function wasEventHandled(key: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(storageKey(key)) === "1";
}

function markEventHandled(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey(key), "1");
}

function soundLog(message: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof detail === "undefined") {
    console.info(`[sound] ${message}`);
    return;
  }
  console.info(`[sound] ${message}`, detail);
}

function orderEventTypeForRole(row: OrderStatusEventRow, role: OperationalRole): LegacyOperationalEventType | null {
  if (row.to_status === "submitted" && row.from_status === null && (role === "kitchen" || role === "barista")) return "new-order";
  if (row.to_status === "ready" && row.from_status !== "ready" && role === "captain") return "order-ready";
  if (row.to_status === "awaiting_payment" && row.from_status !== "awaiting_payment" && role === "cashier") return "table-awaiting-payment";
  return null;
}

function itemEventTypeForRole(row: OrderItemStatusEventRow, role: OperationalRole): LegacyOperationalEventType | null {
  if (row.to_status === "submitted" && row.from_status === null && ((role === "kitchen" && row.preparation_station === "kitchen") || (role === "barista" && row.preparation_station === "barista"))) return "new-order";
  return null;
}

function notificationFromOrderEvent(role: OperationalRole, type: LegacyOperationalEventType, orderId: string, info: { tableLabel: string; roundNo: number | null; tableSessionId: string | null }): OperationalNotification {
  const isAdditionalOrder = type === "new-order" && typeof info.roundNo === "number" && info.roundNo > 1;
  const stationLabel = role === "barista" ? "للباريستا" : "للمطبخ";

  if (type === "new-order") {
    return {
      id: `${role}:${type}:${orderId}:${Date.now()}`,
      type: role === "barista" ? "barista-order-submitted" : "kitchen-order-submitted",
      title: isAdditionalOrder ? `طلب إضافي ${stationLabel}` : `طلب جديد ${stationLabel}`,
      message: isAdditionalOrder ? `${info.tableLabel} — إضافة #${info.roundNo}` : `${info.tableLabel} — تم استلام طلب جديد`,
      tableLabel: info.tableLabel,
      roleTargets: [role],
      entityType: "order",
      entityId: orderId,
      createdAt: new Date().toISOString(),
      priority: "urgent",
      actionUrl: role === "barista" ? "/barista" : "/kitchen",
      sound: "new",
      badgeKey: role === "barista" ? "baristaOrders" : "kitchenOrders",
    };
  }

  if (type === "table-awaiting-payment") {
    return {
      id: `cashier:${type}:${orderId}:${Date.now()}`,
      type: "cashier-awaiting-payment",
      title: `${info.tableLabel} بانتظار الدفع`,
      message: "أصبحت الطاولة جاهزة للمحاسبة",
      tableLabel: info.tableLabel,
      roleTargets: ["cashier"],
      entityType: "table_session",
      entityId: info.tableSessionId ?? orderId,
      createdAt: new Date().toISOString(),
      priority: "action",
      actionUrl: "/cashier",
      sound: "ready",
      badgeKey: "cashierAwaitingPayment",
    };
  }

  return {
    id: `captain:${type}:${orderId}:${Date.now()}`,
    type: "captain-order-ready",
    title: `${info.tableLabel} جاهز للتقديم`,
    message: "يوجد طلب جاهز يحتاج متابعة الكابتن",
    tableLabel: info.tableLabel,
    roleTargets: ["captain"],
    entityType: "order",
    entityId: orderId,
    createdAt: new Date().toISOString(),
    priority: "action",
    actionUrl: "/captain",
    sound: "ready",
    badgeKey: "captainReady",
  };
}

function toastFromNotification(notification: OperationalNotification, showActivationHint: boolean): OperationalToastState {
  return {
    id: notification.id,
    title: notification.title,
    tableLabel: notification.tableLabel ?? "",
    message: showActivationHint ? `${notification.message} · اضغط لتفعيل صوت التنبيهات` : notification.message,
    tone: notification.sound === "ready" ? "ready" : "new",
    actionUrl: notification.actionUrl,
  };
}

async function loadStationSubmittedCount(station: PreparationStation) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_station_order_queue" as never, { p_station: station } as never);
  if (error) throw error;
  return ((data ?? []) as { status?: string }[]).filter((order) => order.status === "submitted").length;
}

async function loadCaptainReadyCount() {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready");
  if (error) throw error;
  return count ?? 0;
}

async function loadCashierAwaitingPaymentCount() {
  const tables = await getCashierTables();
  return new Set(tables.filter((table) => table.order?.rawStatus === "awaiting_payment").map((table) => table.tableSessionId ?? String(table.id))).size;
}

async function loadCashShiftDifferenceCount() {
  const today = todayBaghdadKey();
  const shifts = await getRecentCashShifts();
  return shifts.filter((shift) => shift.status === "closed" && shift.businessDate === today && typeof shift.cashDifference === "number" && shift.cashDifference !== 0).length;
}

async function loadRoleBadges(role: OperationalRole): Promise<OperationalBadgeCounts> {
  const badges = { ...emptyBadges };

  if (role === "kitchen") badges.kitchenOrders = await loadStationSubmittedCount("kitchen");
  if (role === "barista") badges.baristaOrders = await loadStationSubmittedCount("barista");
  if (role === "captain") badges.captainReady = await loadCaptainReadyCount();
  if (role === "cashier") badges.cashierAwaitingPayment = await loadCashierAwaitingPaymentCount();

  if (role === "storekeeper") {
    const requisitions = await getInventoryRequisitions();
    badges.storekeeperRequisitions = requisitions.filter((requisition) => requisition.status === "pending" || requisition.status === "approved").length;
  }

  if (role === "admin" || role === "accountant" || role === "owner") {
    const [requests, shifts] = await Promise.all([
      getPurchaseRequests(),
      role === "accountant" || role === "admin" || role === "owner" ? loadCashShiftDifferenceCount().catch(() => 0) : Promise.resolve(0),
    ]);
    const pendingPurchases = requests.filter((request) => request.status === "pending" || request.status === "decision_in_progress").length;
    if (role === "admin") {
      badges.managerPurchaseRequests = pendingPurchases;
      badges.accountantCashDifferences = shifts;
    }
    if (role === "accountant") {
      const purchases = await getPurchases().catch(() => []);
      badges.accountantPurchaseInfo = pendingPurchases + purchases.filter((purchase) => purchase.paymentStatus === "unpaid").length;
      badges.accountantCashDifferences = shifts;
    }
    if (role === "owner") {
      badges.ownerPurchaseOversight = pendingPurchases;
      badges.ownerCashDifferences = shifts;
    }
  }

  return badges;
}

export function useOperationalNotifications({ role, station, enabled = true, visualOnly, onRelevantEvent, onBadgeCountsChange }: UseOperationalNotificationsOptions) {
  const [audioState, setAudioState] = useState<AudioRuntimeState>(() => sharedAudioContext?.state ?? "none");
  const [soundPreferred, setSoundPreferred] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(soundPreferenceKey) === "true" : false));
  const [lastTestStatus, setLastTestStatus] = useState<SoundTestStatus>("idle");
  const [toast, setToast] = useState<OperationalToastState | null>(null);
  const [badges, setBadges] = useState<OperationalBadgeCounts>(emptyBadges);
  const audioContextRef = useRef<AudioContext | null>(null);
  const handledEventsRef = useRef(new Set<string>());
  const audioQueueRef = useRef(Promise.resolve());
  const toastTimerRef = useRef<number | null>(null);
  const reloadTimerRef = useRef<number | null>(null);
  const onRelevantEventRef = useRef(onRelevantEvent);
  const onBadgeCountsChangeRef = useRef(onBadgeCountsChange);
  const soundAvailable = enabled && !visualOnly && role !== "owner";

  useEffect(() => {
    onRelevantEventRef.current = onRelevantEvent;
    onBadgeCountsChangeRef.current = onBadgeCountsChange;
  }, [onRelevantEvent, onBadgeCountsChange]);

  const playWebAudioBeep = useCallback(async (sound: OperationalNotification["sound"], label: string) => {
    if (!soundAvailable || sound === "none") return false;
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      setLastTestStatus("failed");
      soundLog("error:", "AudioContext is not supported");
      return false;
    }

    try {
      if (!sharedAudioContext || sharedAudioContext.state === "closed") {
        sharedAudioContext = new AudioContextConstructor();
      }

      audioContextRef.current = sharedAudioContext;
      soundLog("context state:", sharedAudioContext.state);
      await sharedAudioContext.resume();
      soundLog("resume result:", sharedAudioContext.state);
      setAudioState(sharedAudioContext.state);

      if (sharedAudioContext.state !== "running") {
        setLastTestStatus("failed");
        return false;
      }

      soundLog(`test started ${label}`);
      const oscillator = sharedAudioContext.createOscillator();
      const gain = sharedAudioContext.createGain();
      const now = sharedAudioContext.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(sound === "new" ? 860 : sound === "warning" ? 740 : 700, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(sound === "new" ? 0.22 : 0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      oscillator.connect(gain);
      gain.connect(sharedAudioContext.destination);

      await new Promise<void>((resolve) => {
        oscillator.onended = () => {
          soundLog(`test ended ${label}`);
          resolve();
        };
        oscillator.start(now);
        oscillator.stop(now + 0.36);
      });

      setAudioState(sharedAudioContext.state);
      setLastTestStatus("success");
      return true;
    } catch (error) {
      setAudioState(sharedAudioContext?.state ?? "none");
      setLastTestStatus("failed");
      soundLog("error:", error);
      return false;
    }
  }, [soundAvailable]);

  const unlockAudio = useCallback(async () => {
    if (!soundAvailable) return false;
    const didPlay = await playWebAudioBeep("new", `${role}_unlock`);
    if (!didPlay || sharedAudioContext?.state !== "running") {
      return false;
    }

    window.localStorage.setItem(soundPreferenceKey, "true");
    setSoundPreferred(true);
    setAudioState(sharedAudioContext.state);
    soundLog("unlocked");
    return true;
  }, [playWebAudioBeep, role, soundAvailable]);

  const playSound = useCallback(
    (sound: OperationalNotification["sound"], label: string = sound) => {
      const context = sharedAudioContext ?? audioContextRef.current;
      if (!soundAvailable || sound === "none") return;
      if (!context || context.state !== "running") {
        setAudioState(context?.state ?? "none");
        soundLog("blocked", { label, state: context?.state ?? "none" });
        return;
      }

      soundLog(`play ${label}`);
      audioQueueRef.current = audioQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await playWebAudioBeep(sound, label);
        });
    },
    [playWebAudioBeep, soundAvailable],
  );

  const refreshBadges = useCallback(async () => {
    if (!enabled) return emptyBadges;
    const nextBadges = await loadRoleBadges(role);
    setBadges(nextBadges);
    onBadgeCountsChangeRef.current?.(nextBadges);
    return nextBadges;
  }, [enabled, role]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void refreshBadges().catch((error) => console.warn("تعذر تحديث عدادات التنبيهات التشغيلية", error));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, refreshBadges]);

  const emitNotification = useCallback(
    (notification: OperationalNotification) => {
      if (!notification.roleTargets.includes(role)) return;
      const context = sharedAudioContext ?? audioContextRef.current;
      const isRunning = context?.state === "running";
      const showActivationHint = soundAvailable && !isRunning;
      setToast(toastFromNotification(notification, showActivationHint));
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
      if (isRunning) {
        playSound(notification.sound, notification.type);
      }
    },
    [playSound, role, soundAvailable],
  );

  const resolveOrderNotificationInfo = useCallback(async (orderId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("order_number, table_session_id, round_no, table:restaurant_tables(table_number)")
      .eq("id", orderId)
      .maybeSingle();

    const row = data as unknown as {
      order_number: number | null;
      table_session_id: string | null;
      round_no: number | null;
      table: { table_number: number | null } | null;
    } | null;
    const tableNumber = row?.table?.table_number;
    return {
      tableLabel: typeof tableNumber === "number" ? `طاولة ${tableNumber}` : typeof row?.order_number === "number" ? formatOrderLabel(row.order_number) : "طلب جديد",
      tableSessionId: row?.table_session_id ?? null,
      roundNo: row?.round_no ?? null,
    };
  }, []);

  const orderMatchesStation = useCallback(async (orderId: string) => {
    if (!station || (role !== "kitchen" && role !== "barista")) return true;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("order_has_station_items" as never, {
      p_order_id: orderId,
      p_station: station,
    } as never);

    if (error) {
      console.warn("تعذر التحقق من محطة الطلب للتنبيه", error);
      return false;
    }

    return Boolean(data);
  }, [role, station]);

  const handleOrderStatusEvent = useCallback(
    async (row: OrderStatusEventRow) => {
      const type = orderEventTypeForRole(row, role);
      if (!type) return;
      if (type === "new-order" && !(await orderMatchesStation(row.order_id))) return;

      const info = await resolveOrderNotificationInfo(row.order_id);
      const dedupeEntity = type === "table-awaiting-payment" ? info.tableSessionId ?? row.order_id : row.order_id;
      const dedupeKey = `${role}:${type}:${dedupeEntity}:${row.to_status}:${row.id ?? row.created_at}`;
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;

      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      onRelevantEventRef.current?.({ type, orderId: row.order_id, tableSessionId: info.tableSessionId, roundNo: info.roundNo });
      emitNotification(notificationFromOrderEvent(role, type, row.order_id, info));
    },
    [emitNotification, orderMatchesStation, resolveOrderNotificationInfo, role],
  );

  const handleOrderItemStatusEvent = useCallback(
    async (row: OrderItemStatusEventRow) => {
      const type = itemEventTypeForRole(row, role);
      if (!type) return;

      const info = await resolveOrderNotificationInfo(row.order_id);
      const dedupeKey = `${role}:${type}:${row.order_id}:${row.order_item_id}:${row.to_status}:${row.id ?? row.created_at}`;
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;

      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      onRelevantEventRef.current?.({ type, orderId: row.order_id, tableSessionId: info.tableSessionId, roundNo: info.roundNo });
      emitNotification(notificationFromOrderEvent(role, type, row.order_id, info));
    },
    [emitNotification, resolveOrderNotificationInfo, role],
  );

  const handleRequisitionInsert = useCallback(
    async (requisitionId?: string) => {
      if (role !== "storekeeper" || !requisitionId) return;
      const requisitions = await getInventoryRequisitions();
      const requisition = requisitions.find((item) => item.id === requisitionId);
      if (!requisition || requisition.status !== "pending") return;
      const dedupeKey = `inventory-requisition:${requisition.id}:pending`;
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;
      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      emitNotification({
        id: `inventory-requisition:${requisition.id}:${Date.now()}`,
        type: "inventory-requisition-created",
        title: `طلب مواد جديد من ${destinationLabels[requisition.destination]}`,
        message: `${requisition.requestCode} — ${requisitionSummary(requisition)}`,
        tableLabel: requisition.requestCode,
        roleTargets: ["storekeeper"],
        entityType: "inventory_requisition",
        entityId: requisition.id,
        createdAt: requisition.requestedAt,
        priority: "action",
        actionUrl: "/inventory?section=requisitions",
        sound: "new",
        badgeKey: "storekeeperRequisitions",
      });
    },
    [emitNotification, role],
  );

  const handlePurchaseRequestInsert = useCallback(
    async (requestId?: string) => {
      if (!requestId || (role !== "admin" && role !== "accountant")) return;
      const requests = await getPurchaseRequests();
      const request = requests.find((item) => item.id === requestId);
      if (!request || request.status !== "pending") return;
      const dedupeKey = `${role}:purchase-request:${request.id}:pending`;
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;
      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      emitNotification({
        id: `${role}:purchase-request:${request.id}:${Date.now()}`,
        type: "purchase-request-created",
        title: role === "admin" ? "طلب شراء جديد يحتاج قرار المدير" : "طلب شراء جديد من المخزن",
        message: role === "admin" ? `${purchaseRequestCode(request)} — ${formatNumber(request.items.length)} مواد` : `${purchaseRequestCode(request)} — بانتظار قرار مدير النظام`,
        tableLabel: purchaseRequestCode(request),
        roleTargets: [role],
        entityType: "purchase_request",
        entityId: request.id,
        createdAt: request.createdAt,
        priority: role === "admin" ? "action" : "info",
        actionUrl: role === "admin" ? "/admin/purchases" : "/finance",
        sound: role === "admin" ? "new" : "none",
        badgeKey: role === "admin" ? "managerPurchaseRequests" : "accountantPurchaseInfo",
      });
    },
    [emitNotification, role],
  );

  const handlePurchaseRequestUpdate = useCallback(
    async (requestId?: string, status?: unknown) => {
      if (!requestId || (status !== "approved" && status !== "rejected") || (role !== "storekeeper" && role !== "accountant" && role !== "owner")) return;
      const requests = await getPurchaseRequests();
      const request = requests.find((item) => item.id === requestId);
      if (!request || (request.status !== "approved" && request.status !== "rejected")) return;
      const dedupeKey = `${role}:purchase-decision:${request.id}:${request.status}`;
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;
      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      const approved = request.status === "approved";
      const reason = !approved && request.rejectionReason ? ` — ${request.rejectionReason.slice(0, 70)}` : "";
      emitNotification({
        id: `${role}:purchase-decision:${request.id}:${Date.now()}`,
        type: "purchase-request-decided",
        title: approved ? "تمت الموافقة على طلب شراء" : "تم رفض طلب شراء",
        message: `${purchaseRequestCode(request)}${approved && role === "accountant" ? " — أصبح متاحاً للمتابعة" : reason}`,
        tableLabel: purchaseRequestCode(request),
        roleTargets: [role],
        entityType: "purchase_request",
        entityId: request.id,
        createdAt: request.decidedAt ?? new Date().toISOString(),
        priority: role === "owner" ? "info" : "action",
        actionUrl: role === "owner" ? "/owner/purchases" : role === "accountant" ? "/finance" : "/inventory?section=purchaseRequests",
        sound: role === "owner" ? "none" : "ready",
        badgeKey: role === "owner" ? "ownerPurchaseOversight" : role === "accountant" ? "accountantPurchaseInfo" : undefined,
      });
    },
    [emitNotification, role],
  );

  const handleCashShiftUpdate = useCallback(
    (shift: Partial<CashShift> & { id?: string; cash_difference?: number | string | null; cashDifference?: number | null; status?: string }) => {
      if (role !== "admin" && role !== "accountant" && role !== "owner") return;
      if (shift.status !== "closed") return;
      const difference = Number(shift.cashDifference ?? shift.cash_difference ?? 0);
      if (!Number.isFinite(difference) || difference === 0 || !shift.id) return;
      const dedupeKey = `${role}:cash-shift-difference:${shift.id}:${difference}`;
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;
      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      emitNotification({
        id: `${role}:cash-shift-difference:${shift.id}:${Date.now()}`,
        type: "cash-shift-difference",
        title: "تم إغلاق وردية صندوق بفرق",
        message: `فرق الصندوق ${formatCurrency(difference)}`,
        roleTargets: [role],
        entityType: "cash_shift",
        entityId: shift.id,
        createdAt: new Date().toISOString(),
        priority: "action",
        actionUrl: role === "owner" ? "/owner/cash-shifts" : role === "admin" ? "/admin/cash-shifts" : "/finance",
        sound: "none",
        badgeKey: role === "owner" ? "ownerCashDifferences" : "accountantCashDifferences",
      });
    },
    [emitNotification, role],
  );

  const scheduleBadgeRefresh = useCallback(() => {
    if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void refreshBadges().catch((error) => console.warn("تعذر تحديث عدادات التنبيهات التشغيلية", error));
    }, 350);
  }, [refreshBadges]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`operational-notifications-${role}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_events" }, (payload: RealtimePostgresInsertPayload<OrderStatusEventRow>) => {
        scheduleBadgeRefresh();
        void handleOrderStatusEvent(payload.new);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_item_status_events" }, (payload: RealtimePostgresInsertPayload<OrderItemStatusEventRow>) => {
        scheduleBadgeRefresh();
        void handleOrderItemStatusEvent(payload.new);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_requisitions" }, (payload) => {
        scheduleBadgeRefresh();
        void handleRequisitionInsert((payload.new as { id?: string }).id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inventory_requisitions" }, scheduleBadgeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisition_items" }, scheduleBadgeRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "purchase_requests" }, (payload) => {
        scheduleBadgeRefresh();
        void handlePurchaseRequestInsert((payload.new as { id?: string }).id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "purchase_requests" }, (payload: RealtimePostgresUpdatePayload<{ id?: string; status?: string }>) => {
        scheduleBadgeRefresh();
        void handlePurchaseRequestUpdate(payload.new.id, payload.new.status);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_request_items" }, scheduleBadgeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, scheduleBadgeRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cash_shifts" }, (payload) => {
        scheduleBadgeRefresh();
        handleCashShiftUpdate(payload.new as Partial<CashShift> & { id?: string; cash_difference?: number | string | null; status?: string });
      })
      .subscribe((status, error) => {
        if (error) console.warn("تعذر الاشتراك في التنبيهات التشغيلية", error);
        if (status === "SUBSCRIBED") scheduleBadgeRefresh();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("تعذر الاتصال اللحظي بالتنبيهات التشغيلية", { role, status });
      });

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
  }, [
    enabled,
    handleCashShiftUpdate,
    handleOrderItemStatusEvent,
    handleOrderStatusEvent,
    handlePurchaseRequestInsert,
    handlePurchaseRequestUpdate,
    handleRequisitionInsert,
    role,
    scheduleBadgeRefresh,
  ]);

  const activateSound = useCallback(() => {
    void unlockAudio();
  }, [unlockAudio]);

  const testSound = useCallback(() => {
    void playWebAudioBeep("new", `${role}_test`).then((didPlay) => {
      if (!didPlay || sharedAudioContext?.state !== "running") return;
      window.localStorage.setItem(soundPreferenceKey, "true");
      setSoundPreferred(true);
    });
  }, [playWebAudioBeep, role]);

  return useMemo(() => ({
    badges,
    soundEnabled: soundAvailable && audioState === "running",
    soundNeedsActivation: soundAvailable && audioState !== "running",
    soundPreferred,
    audioState,
    lastTestStatus,
    toast,
    toggleSound: activateSound,
    testSound,
  }), [activateSound, audioState, badges, lastTestStatus, soundAvailable, soundPreferred, testSound, toast]);
}
