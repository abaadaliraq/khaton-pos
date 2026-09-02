"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { formatOrderLabel } from "@/lib/displayFormat";
import type { Database } from "@/types/database.types";
import type { OperationalToastState } from "@/components/operational/OperationalToast";

type OperationalRole = "kitchen" | "captain" | "cashier";
type OperationalEventType = "new-order" | "order-ready";
type OrderStatusEventRow = Database["public"]["Tables"]["order_status_events"]["Row"];

type UseOperationalNotificationsOptions = {
  role: OperationalRole;
  onRelevantEvent?: (event: { type: OperationalEventType; orderId: string; tableSessionId: string | null; roundNo: number | null }) => void;
};

const soundPreferenceKey = "khatoun-operational-sound-enabled";
const soundSources: Record<OperationalEventType, string> = {
  "new-order": "/sounds/new-order.mp3",
  "order-ready": "/sounds/order-ready.mp3",
};

const eventRoles: Record<OperationalEventType, OperationalRole[]> = {
  "new-order": ["kitchen", "cashier"],
  "order-ready": ["captain", "cashier"],
};

function isRelevantStatusEvent(row: OrderStatusEventRow): OperationalEventType | null {
  if (row.to_status === "submitted" && row.from_status === null) return "new-order";
  if (row.to_status === "ready" && row.from_status !== "ready") return "order-ready";
  return null;
}

type OrderNotificationInfo = {
  tableLabel: string;
  tableSessionId: string | null;
  roundNo: number | null;
};

function notificationText(type: OperationalEventType, info: OrderNotificationInfo): OperationalToastState {
  const isAdditionalOrder = type === "new-order" && typeof info.roundNo === "number" && info.roundNo > 1;

  if (type === "new-order") {
    return {
      id: `${type}:${info.tableLabel}:${Date.now()}`,
      title: isAdditionalOrder ? "طلب إضافي جديد" : "طلب جديد",
      tableLabel: info.tableLabel,
      message: isAdditionalOrder ? `${info.tableLabel} أضافت طلباً جديداً - إضافة #${info.roundNo}` : "تم استلام طلب جديد",
      tone: "new",
    };
  }

  return {
    id: `${type}:${info.tableLabel}:${Date.now()}`,
    title: "الطلب جاهز",
    tableLabel: info.tableLabel,
    message: "أصبح الطلب جاهزاً للتقديم",
    tone: "ready",
  };
}

function wasEventHandled(key: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`khatoun-operational-event:${key}`) === "1";
}

function markEventHandled(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`khatoun-operational-event:${key}`, "1");
}

function dedupeKeyForStatusEvent(role: OperationalRole, type: OperationalEventType, row: OrderStatusEventRow) {
  return row.id ? `${role}:${type}:${row.id}` : `${role}:${type}:${row.order_id}:${row.to_status}:${row.created_at}`;
}

export function useOperationalNotifications({ role, onRelevantEvent }: UseOperationalNotificationsOptions) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [toast, setToast] = useState<OperationalToastState | null>(null);
  const audioRefs = useRef<Partial<Record<OperationalEventType, HTMLAudioElement>>>({});
  const handledEventsRef = useRef(new Set<string>());
  const audioQueueRef = useRef(Promise.resolve());
  const toastTimerRef = useRef<number | null>(null);
  const onRelevantEventRef = useRef(onRelevantEvent);

  useEffect(() => {
    onRelevantEventRef.current = onRelevantEvent;
  }, [onRelevantEvent]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSoundEnabled(window.localStorage.getItem(soundPreferenceKey) === "true");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    audioRefs.current = {
      "new-order": new Audio(soundSources["new-order"]),
      "order-ready": new Audio(soundSources["order-ready"]),
    };

    Object.values(audioRefs.current).forEach((audio) => {
      if (!audio) return;
      audio.preload = "auto";
      audio.addEventListener("error", () => undefined);
    });
  }, []);

  const unlockAudio = useCallback(() => {
    const unlockAttempts = Object.values(audioRefs.current).map(async (audio) => {
      if (!audio) return;

      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch {
        audio.muted = false;
      }
    });

    void Promise.allSettled(unlockAttempts).then(() => setIsAudioUnlocked(true));
  }, []);

  useEffect(() => {
    if (!soundEnabled || isAudioUnlocked) return;

    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [isAudioUnlocked, soundEnabled, unlockAudio]);

  const playSound = useCallback(
    (type: OperationalEventType) => {
      if (!soundEnabled || !isAudioUnlocked) return;

      audioQueueRef.current = audioQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const audio = audioRefs.current[type];
          if (!audio) return;

          try {
            audio.currentTime = 0;
            await audio.play();
            await new Promise((resolve) => window.setTimeout(resolve, 350));
          } catch {
            return;
          }
        });
    },
    [isAudioUnlocked, soundEnabled],
  );

  const resolveOrderNotificationInfo = useCallback(async (orderId: string): Promise<OrderNotificationInfo> => {
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
    const tableLabel = typeof tableNumber === "number" ? `طاولة ${tableNumber}` : typeof row?.order_number === "number" ? formatOrderLabel(row.order_number) : "طلب جديد";

    return {
      tableLabel,
      tableSessionId: row?.table_session_id ?? null,
      roundNo: row?.round_no ?? null,
    };
  }, []);

  const emitNotification = useCallback(
    async (type: OperationalEventType, orderId: string) => {
      const info = await resolveOrderNotificationInfo(orderId);
      onRelevantEventRef.current?.({ type, orderId, tableSessionId: info.tableSessionId, roundNo: info.roundNo });
      const nextToast = notificationText(type, info);
      setToast(nextToast);

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
      playSound(type);
    },
    [playSound, resolveOrderNotificationInfo],
  );

  const handleStatusEvent = useCallback(
    (row: OrderStatusEventRow) => {
      const type = isRelevantStatusEvent(row);
      if (!type || !eventRoles[type].includes(role)) return;

      const dedupeKey = dedupeKeyForStatusEvent(role, type, row);
      if (handledEventsRef.current.has(dedupeKey) || wasEventHandled(dedupeKey)) return;

      handledEventsRef.current.add(dedupeKey);
      markEventHandled(dedupeKey);
      void emitNotification(type, row.order_id);
    },
    [emitNotification, role],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`operational-notifications-${role}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_events" },
        (payload: RealtimePostgresInsertPayload<OrderStatusEventRow>) => handleStatusEvent(payload.new),
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("Operational notification subscription error", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Operational notification subscription failed", { role, status });
        }
      });

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [handleStatusEvent, role]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(soundPreferenceKey, String(next));
      if (next) {
        unlockAudio();
      }
      return next;
    });
  }, [unlockAudio]);

  return {
    soundEnabled,
    soundNeedsActivation: soundEnabled && !isAudioUnlocked,
    toast,
    toggleSound,
  };
}
