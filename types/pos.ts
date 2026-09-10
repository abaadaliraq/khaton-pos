export type TableStatus = "available" | "occupied" | "reserved";
export type RestaurantOrderStatus = "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid" | "cancelled";
export type PreparationStation = "kitchen" | "barista" | "drinks" | "shisha" | "unknown";

export type Category = {
  id: string;
  name: string;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
};

export type RestaurantTable = {
  id: number;
  databaseId?: string;
  status: TableStatus;
  tableSessionId?: string;
  sessionCaptainId?: string;
  sessionOrderCount?: number;
  unpaidOrderCount?: number;
  hasBusyOrders?: boolean;
  canAddOrder?: boolean;
  canRelease?: boolean;
  currentOrder?: {
    id: string;
    orderNumber: number;
    roundNo: number;
    status: RestaurantOrderStatus;
    total?: number;
    openedAt?: string;
    itemCount?: number;
    stationStatuses?: StationOrderStatus[];
    readyItems?: RestaurantTableOrderItem[];
  };
  orders?: {
    id: string;
    orderNumber: number;
    roundNo: number;
    status: RestaurantOrderStatus;
    total?: number;
    openedAt?: string;
    itemCount?: number;
    stationStatuses?: StationOrderStatus[];
    items?: RestaurantTableOrderItem[];
    readyItems?: RestaurantTableOrderItem[];
  }[];
};

export type RestaurantTableOrderItem = {
  id: string;
  name: string;
  quantity: number;
  status: RestaurantOrderStatus;
  preparationStation: PreparationStation;
};

export type StationOrderStatus = {
  station: PreparationStation;
  label: string;
  status: RestaurantOrderStatus;
  itemCount: number;
  readyCount: number;
};

export type OrderItem = {
  item: MenuItem;
  quantity: number;
  note: string;
};
