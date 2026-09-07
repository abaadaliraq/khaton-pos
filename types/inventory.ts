export type InventoryUnitCode = "g" | "kg" | "ml" | "l" | "piece" | "pack" | "bottle";
export type InventoryUnitFamily = "weight" | "volume" | "count";
export type InventoryItemType = "food_recipe" | "food_indirect" | "packaging" | "cleaning" | "operational_consumable";
export type InventoryMovementType =
  | "opening_balance"
  | "adjustment_in"
  | "adjustment_out"
  | "purchase"
  | "consumption"
  | "waste"
  | "return"
  | "stock_issue";

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
  itemType: InventoryItemType;
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

export type InventoryItemConversion = {
  id: string;
  inventoryItemId: string;
  packagingUnitNameAr: string;
  packagingUnitNameEn?: string;
  quantityInBaseUnit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryRequisitionDestination = "kitchen" | "barista" | "bar" | "service" | "cleaning" | "management" | "other";
export type InventoryRequisitionStatus = "pending" | "approved" | "issued" | "received" | "rejected" | "cancelled";
export type InventoryRequisitionItemStatus = "pending" | "approved" | "rejected" | "issued" | "received";
export type InventoryWasteContext = "warehouse" | "issued_department";
export type InventoryWasteReason =
  | "expired"
  | "spoiled"
  | "damaged"
  | "contaminated"
  | "broken"
  | "preparation_error"
  | "overproduction"
  | "oil_disposal"
  | "other";
export type InventoryWasteStatus = "posted";

export type InventoryRequisitionItem = {
  id: string;
  requisitionId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnitCode: InventoryUnitCode;
  baseUnitName: string;
  stockOnHand: number;
  requestedQuantity: number;
  requestedUnitId?: string;
  requestedConversionId?: string;
  requestedUnitLabel: string;
  requestedQuantityBase: number;
  approvedQuantityBase?: number;
  issuedQuantityBase?: number;
  status: InventoryRequisitionItemStatus;
  notes?: string;
};

export type InventoryRequisition = {
  id: string;
  requestNumber: number;
  requestCode: string;
  destination: InventoryRequisitionDestination;
  status: InventoryRequisitionStatus;
  note?: string;
  rejectionReason?: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  approvedByName?: string;
  approvedAt?: string;
  issuedByName?: string;
  issuedAt?: string;
  receivedByName?: string;
  receivedAt?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  items: InventoryRequisitionItem[];
};

export type InventoryRequisitionCatalogItem = {
  id: string;
  nameAr: string;
  itemType: InventoryItemType;
  baseUnitId: string;
  baseUnitCode: InventoryUnitCode;
  baseUnitName: string;
  stockOnHand: number;
};

export type InventoryRequisitionCatalogConversion = {
  id: string;
  inventoryItemId: string;
  packagingUnitNameAr: string;
  quantityInBaseUnit: number;
};

export type InventoryRequisitionCatalog = {
  items: InventoryRequisitionCatalogItem[];
  units: InventoryUnit[];
  conversions: InventoryRequisitionCatalogConversion[];
};

export type InventoryWasteReportItem = {
  id: string;
  reportId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  itemType: InventoryItemType;
  baseUnitCode: InventoryUnitCode;
  baseUnitName: string;
  quantity: number;
  unitId?: string;
  conversionId?: string;
  unitLabel: string;
  quantityBase: number;
  reason: InventoryWasteReason;
  notes?: string;
  requisitionId?: string;
  requisitionItemId?: string;
  requisitionCode?: string;
  remainingWasteBase?: number;
};

export type InventoryWasteReport = {
  id: string;
  reportNumber: number;
  reportCode: string;
  context: InventoryWasteContext;
  destination?: InventoryRequisitionDestination;
  status: InventoryWasteStatus;
  note?: string;
  postedByName: string;
  postedAt: string;
  items: InventoryWasteReportItem[];
};

export type InventoryWasteIssuedItem = {
  requisitionId: string;
  requisitionItemId: string;
  requisitionCode: string;
  destination: InventoryRequisitionDestination;
  inventoryItemId: string;
  inventoryItemName: string;
  baseUnitId: string;
  baseUnitCode: InventoryUnitCode;
  baseUnitName: string;
  issuedQuantityBase: number;
  wastedQuantityBase: number;
  remainingWasteBase: number;
};

export type InventoryWasteCatalog = {
  items: InventoryRequisitionCatalogItem[];
  issuedItems: InventoryWasteIssuedItem[];
  units: InventoryUnit[];
  conversions: InventoryRequisitionCatalogConversion[];
};

export type InventoryAnalyticsRange = {
  startDate: string;
  endDate: string;
  periodDays: number;
  previousStartDate?: string;
  previousEndDate?: string;
  timezone: string;
};

export type InventoryAnalyticsTimelineType = "purchase" | "stock_issue" | "warehouse_waste" | "department_waste" | "recipe_consumption";

export type InventoryAnalyticsTimelineEvent = {
  date: string;
  type: InventoryAnalyticsTimelineType;
  label: string;
  quantityBase: number;
  unitCost?: number;
  supplierName?: string;
  destination?: InventoryRequisitionDestination;
  reason?: InventoryWasteReason;
  reference?: string;
};

export type InventoryAnalyticsPurchaseHistory = {
  date: string;
  supplierName: string;
  quantity: number;
  quantityBase: number;
  unitPrice: number;
  unitCostBase: number;
  lineTotal: number;
  reference: string;
};

export type InventoryAnalyticsItem = {
  id: string;
  nameAr: string;
  itemType: InventoryItemType;
  isActive: boolean;
  baseUnitCode: InventoryUnitCode;
  baseUnitName: string;
  stockOnHand: number;
  minimumStock: number;
  averageCost: number;
  lastPurchaseCost: number;
  purchases: {
    quantity: number;
    count: number;
    total: number;
    averageUnitCost: number;
    lastUnitCost: number;
    minUnitCost: number;
    maxUnitCost: number;
    lastSupplierName?: string;
    lastPurchaseAt?: string;
    supplierCount: number;
    history: InventoryAnalyticsPurchaseHistory[];
  };
  issues: {
    quantity: number;
    count: number;
    averageQuantity: number;
    maxQuantity: number;
    lastIssueAt?: string;
    averageDaysBetween?: number;
    departmentBreakdown: Partial<Record<InventoryRequisitionDestination, number>>;
  };
  waste: {
    warehouseQuantity: number;
    departmentQuantity: number;
    totalQuantity: number;
    count: number;
    topReason?: InventoryWasteReason;
    topDestination?: InventoryRequisitionDestination;
    ratioDepartmentToIssued?: number;
  };
  recipeConsumption: {
    quantity: number;
    count: number;
  };
  operations: {
    dailyIssueRate?: number;
    coverageDays?: number;
    issuePer100Dishes?: number;
    previousIssuePer100Dishes?: number;
  };
  comparison: {
    issueQuantityPercent?: number;
    wasteQuantityPercent?: number;
    purchaseCostPercent?: number;
    issuePer100DishesPercent?: number;
  };
  timeline: InventoryAnalyticsTimelineEvent[];
};

export type InventoryAnalytics = {
  range: InventoryAnalyticsRange;
  overview: {
    inventoryValue: number;
    followUpCount: number;
    issueCostEstimate: number;
    actualWasteQuantityEvents: number;
    dishQuantity: number;
    previousDishQuantity: number;
  };
  items: InventoryAnalyticsItem[];
};

export type EquipmentCategory = "refrigeration" | "cooking" | "coffee" | "beverage" | "ventilation" | "electrical" | "cleaning_equipment" | "pos_it" | "other";
export type EquipmentLocation = "kitchen" | "bar" | "barista" | "warehouse" | "dining_hall" | "management" | "outdoor" | "other";
export type EquipmentStatus = "operational" | "needs_maintenance" | "under_maintenance" | "out_of_service" | "retired";
export type EquipmentMaintenanceType = "preventive" | "corrective" | "breakdown" | "inspection" | "cleaning_service" | "installation" | "other";
export type EquipmentMaintenanceStatus = "reported" | "scheduled" | "in_progress" | "completed" | "cancelled";

export type EquipmentMaintenanceRecord = {
  id: string;
  equipmentId: string;
  maintenanceType: EquipmentMaintenanceType;
  status: EquipmentMaintenanceStatus;
  reportedAt: string;
  startedAt?: string;
  completedAt?: string;
  problemDescription?: string;
  workPerformed?: string;
  technicianName?: string;
  serviceProvider?: string;
  cost: number;
  invoiceReference?: string;
  nextMaintenanceDate?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentAsset = {
  id: string;
  assetCode: string;
  nameAr: string;
  nameEn?: string;
  category: EquipmentCategory;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location: EquipmentLocation;
  status: EquipmentStatus;
  purchaseDate?: string;
  purchaseCost?: number;
  supplierId?: string;
  supplierName?: string;
  warrantyStartDate?: string;
  warrantyExpiryDate?: string;
  installationDate?: string;
  notes?: string;
  isActive: boolean;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  maintenanceRecords: EquipmentMaintenanceRecord[];
};

export type EquipmentSummary = {
  total: number;
  operational: number;
  needsMaintenance: number;
  underMaintenance: number;
  overdueMaintenance: number;
  followUpCount: number;
  totalMaintenanceCost: number;
};

export type EquipmentOverview = {
  assets: EquipmentAsset[];
  summary: EquipmentSummary;
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
  requisitionCode?: string;
  wasteCode?: string;
  destination?: InventoryRequisitionDestination;
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
  preparationStation: "kitchen" | "barista" | "drinks" | "shisha";
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
