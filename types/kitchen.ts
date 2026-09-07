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
  status: "submitted" | "preparing" | "ready";
  preparationStation: "kitchen" | "barista" | "drinks" | "shisha";
};

export type KitchenOrder = {
  id: string;
  orderNumber: number;
  roundNo: number;
  tableId: number;
  captainName: string;
  status: KitchenOrderStatus;
  aggregateStatus: "submitted" | "preparing" | "ready";
  hasOtherStationPending: boolean;
  generalNotes?: string;
  priority: KitchenOrderPriority;
  timing: KitchenOrderTiming;
  items: KitchenOrderItem[];
};

export type KitchenOrderSeed = Omit<KitchenOrder, "timing" | "roundNo" | "aggregateStatus" | "hasOtherStationPending" | "items"> & {
  roundNo?: number;
  aggregateStatus?: "submitted" | "preparing" | "ready";
  hasOtherStationPending?: boolean;
  items: (Omit<KitchenOrderItem, "status" | "preparationStation"> & Partial<Pick<KitchenOrderItem, "status" | "preparationStation">>)[];
  receivedMinutesAgo: number;
  startedMinutesAgo?: number;
  readyMinutesAgo?: number;
  servedMinutesAgo?: number;
};
