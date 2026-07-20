export type TableStatus = "available" | "occupied" | "reserved";

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
};

export type OrderItem = {
  item: MenuItem;
  quantity: number;
  note: string;
};
