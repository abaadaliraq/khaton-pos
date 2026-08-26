export type UserRole = "captain" | "cashier" | "kitchen" | "admin" | "storekeeper" | "accountant";

export type MockUser = {
  username: string;
  password: string;
  role: UserRole;
  name: string;
};

export type UserSession = {
  username: string;
  role: UserRole;
  name: string;
};
