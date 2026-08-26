export type InventoryUnitCode = "g" | "kg" | "ml" | "l" | "piece" | "pack" | "bottle";
export type InventoryUnitFamily = "weight" | "volume" | "count";
export type InventoryMovementType =
  | "opening_balance"
  | "adjustment_in"
  | "adjustment_out"
  | "purchase"
  | "consumption"
  | "waste"
  | "return";

export type InventoryUnit = {
  id: string;
  code: InventoryUnitCode;
  nameAr: string;
  nameEn?: string;
  family: InventoryUnitFamily;
  factorToBase: number;
  isBaseUnit: boolean;
  sortOrder: number;
};

export type InventoryItem = {
  id: string;
  nameAr: string;
  nameEn?: string;
  baseUnitId: string;
  baseUnitCode: InventoryUnitCode;
  baseUnitName: string;
  stockOnHand: number;
  minimumStock: number;
  averageCost: number;
  lastPurchaseCost: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryMovement = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnitCode: InventoryUnitCode;
  movementType: InventoryMovementType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  totalCost: number;
  sourceType?: string;
  orderNumber?: number;
  notes?: string;
  createdByName?: string;
  createdAt: string;
};

export type RecipeItem = {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryBaseUnitId: string;
  inventoryBaseUnitCode: InventoryUnitCode;
  quantity: number;
  unitId: string;
  unitCode: InventoryUnitCode;
  wastePercent: number;
};

export type RecipeSummary = {
  recipeId?: string;
  menuItemId: string;
  menuItemName: string;
  sellingPrice: number;
  version?: number;
  isActive: boolean;
  ingredientCount: number;
  estimatedCost: number;
  inventoryTrackingEnabled: boolean;
};

export type ActiveRecipe = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  sellingPrice: number;
  version: number;
  yieldQuantity: number;
  items: RecipeItem[];
  estimatedCost: number;
};
