export type TableStatus = "available" | "occupied" | "reserved";
export type RestaurantOrderStatus = "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid" | "cancelled";

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
  };
  orders?: {
    id: string;
    orderNumber: number;
    roundNo: number;
    status: RestaurantOrderStatus;
  }[];
};

export type OrderItem = {
  item: MenuItem;
  quantity: number;
  note: string;
};
