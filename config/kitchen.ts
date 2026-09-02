import type { KitchenOrderStatus } from "@/types/kitchen";

export const kitchenActiveStatuses: KitchenOrderStatus[] = ["new", "preparing", "ready"];

export const kitchenStatusLabels: Record<KitchenOrderStatus, string> = {
  new: "طلب جديد",
  preparing: "قيد التحضير",
  ready: "جاهز للتقديم",
  served: "تم التقديم",
  cancelled: "ملغي",
};

export const kitchenStatusColumns: { status: KitchenOrderStatus; title: string; shortTitle: string }[] = [
  { status: "new", title: "طلبات جديدة", shortTitle: "جديد" },
  { status: "preparing", title: "قيد التحضير", shortTitle: "تحضير" },
  { status: "ready", title: "جاهزة للتقديم", shortTitle: "جاهز" },
];

export const lateOrderMinutes = 18;
