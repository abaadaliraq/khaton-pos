export type KitchenOrderStatus = "new" | "preparing" | "ready" | "served" | "cancelled";

export type KitchenOrderPriority = "normal" | "priority";

export type KitchenFilter = "all" | "normal" | "late" | "priority";

export type KitchenOrderTiming = {
  receivedAt: string;
  startedAt?: string;
  readyAt?: string;
  servedAt?: string;
};

export type KitchenOrderItem = {
  id: string;
  name: string;
  quantity: number;
  note?: string;
};

export type KitchenOrder = {
  id: string;
  tableId: number;
  captainName: string;
  status: KitchenOrderStatus;
  priority: KitchenOrderPriority;
  timing: KitchenOrderTiming;
  items: KitchenOrderItem[];
};

export type KitchenOrderSeed = Omit<KitchenOrder, "timing"> & {
  receivedMinutesAgo: number;
  startedMinutesAgo?: number;
  readyMinutesAgo?: number;
  servedMinutesAgo?: number;
};
