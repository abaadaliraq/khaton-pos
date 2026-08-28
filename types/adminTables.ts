export type RestaurantTableStatus = "available" | "occupied" | "cleaning";

export type AdminTableOrder = {
  id: string;
  orderNumber: number;
  openedAt: string;
  captainName: string;
  total: number;
};

export type AdminRestaurantTable = {
  id: string;
  tableNumber: number;
  name: string | null;
  capacity: number | null;
  area: string | null;
  status: RestaurantTableStatus;
  isActive: boolean;
  layoutX: number | null;
  layoutY: number | null;
  layoutRotation: number;
  createdAt: string;
  updatedAt: string;
  currentOrder: AdminTableOrder | null;
};

export type TableDetailsInput = {
  tableNumber: number;
  name?: string;
  capacity?: number | null;
  area?: string;
  isActive: boolean;
};

export type TableLayoutInput = {
  id: string;
  layoutX: number;
  layoutY: number;
  layoutRotation: number;
};
