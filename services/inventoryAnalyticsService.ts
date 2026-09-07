"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { InventoryAnalytics, InventoryAnalyticsItem, InventoryItemType, InventoryRequisitionDestination, InventoryWasteReason } from "@/types/inventory";

type AnalyticsPayload = {
  range?: {
    start_date?: string;
    end_date?: string;
    period_days?: number | string;
    previous_start_date?: string;
    previous_end_date?: string;
    timezone?: string;
  };
  overview?: {
    inventory_value?: number | string;
    follow_up_count?: number | string;
    issue_cost_estimate?: number | string;
    actual_waste_quantity_events?: number | string;
    dish_quantity?: number | string;
    previous_dish_quantity?: number | string;
  };
  items?: AnalyticsItemPayload[];
};

type AnalyticsItemPayload = {
  id: string;
  name_ar: string;
  item_type: InventoryItemType;
  is_active: boolean;
  base_unit_code: InventoryAnalyticsItem["baseUnitCode"];
  base_unit_name: string;
  stock_on_hand: number | string;
  minimum_stock: number | string;
  average_cost: number | string;
  last_purchase_cost: number | string;
  purchases?: {
    quantity?: number | string;
    count?: number | string;
    total?: number | string;
    average_unit_cost?: number | string;
    last_unit_cost?: number | string;
    min_unit_cost?: number | string;
    max_unit_cost?: number | string;
    last_supplier_name?: string | null;
    last_purchase_at?: string | null;
    supplier_count?: number | string;
    history?: {
      date: string;
      supplier_name: string;
      quantity: number | string;
      quantity_base: number | string;
      unit_price: number | string;
      unit_cost_base: number | string;
      line_total: number | string;
      reference: string;
    }[];
  };
  issues?: {
    quantity?: number | string;
    count?: number | string;
    average_quantity?: number | string;
    max_quantity?: number | string;
    last_issue_at?: string | null;
    average_days_between?: number | string | null;
    department_breakdown?: Record<string, number | string>;
  };
  waste?: {
    warehouse_quantity?: number | string;
    department_quantity?: number | string;
    total_quantity?: number | string;
    count?: number | string;
    top_reason?: InventoryWasteReason | null;
    top_destination?: InventoryRequisitionDestination | null;
    ratio_department_to_issued?: number | string | null;
  };
  recipe_consumption?: {
    quantity?: number | string;
    count?: number | string;
  };
  operations?: {
    daily_issue_rate?: number | string | null;
    coverage_days?: number | string | null;
    issue_per_100_dishes?: number | string | null;
    previous_issue_per_100_dishes?: number | string | null;
  };
  comparison?: {
    issue_quantity_percent?: number | string | null;
    waste_quantity_percent?: number | string | null;
    purchase_cost_percent?: number | string | null;
    issue_per_100_dishes_percent?: number | string | null;
  };
  timeline?: {
    date: string;
    type: InventoryAnalyticsItem["timeline"][number]["type"];
    label: string;
    quantity_base: number | string;
    unit_cost?: number | string | null;
    supplier_name?: string | null;
    destination?: InventoryRequisitionDestination | null;
    reason?: InventoryWasteReason | null;
    reference?: string | null;
  }[];
};

export type InventoryAnalyticsRangeInput = {
  startDate: string;
  endDate: string;
  itemType?: InventoryItemType | "all";
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapItem(item: AnalyticsItemPayload): InventoryAnalyticsItem {
  return {
    id: item.id,
    nameAr: item.name_ar,
    itemType: item.item_type,
    isActive: item.is_active,
    baseUnitCode: item.base_unit_code,
    baseUnitName: item.base_unit_name,
    stockOnHand: asNumber(item.stock_on_hand),
    minimumStock: asNumber(item.minimum_stock),
    averageCost: asNumber(item.average_cost),
    lastPurchaseCost: asNumber(item.last_purchase_cost),
    purchases: {
      quantity: asNumber(item.purchases?.quantity),
      count: asNumber(item.purchases?.count),
      total: asNumber(item.purchases?.total),
      averageUnitCost: asNumber(item.purchases?.average_unit_cost),
      lastUnitCost: asNumber(item.purchases?.last_unit_cost),
      minUnitCost: asNumber(item.purchases?.min_unit_cost),
      maxUnitCost: asNumber(item.purchases?.max_unit_cost),
      lastSupplierName: item.purchases?.last_supplier_name ?? undefined,
      lastPurchaseAt: item.purchases?.last_purchase_at ?? undefined,
      supplierCount: asNumber(item.purchases?.supplier_count),
      history: (item.purchases?.history ?? []).map((history) => ({
        date: history.date,
        supplierName: history.supplier_name,
        quantity: asNumber(history.quantity),
        quantityBase: asNumber(history.quantity_base),
        unitPrice: asNumber(history.unit_price),
        unitCostBase: asNumber(history.unit_cost_base),
        lineTotal: asNumber(history.line_total),
        reference: history.reference,
      })),
    },
    issues: {
      quantity: asNumber(item.issues?.quantity),
      count: asNumber(item.issues?.count),
      averageQuantity: asNumber(item.issues?.average_quantity),
      maxQuantity: asNumber(item.issues?.max_quantity),
      lastIssueAt: item.issues?.last_issue_at ?? undefined,
      averageDaysBetween: optionalNumber(item.issues?.average_days_between),
      departmentBreakdown: Object.fromEntries(Object.entries(item.issues?.department_breakdown ?? {}).map(([key, value]) => [key, asNumber(value)])),
    },
    waste: {
      warehouseQuantity: asNumber(item.waste?.warehouse_quantity),
      departmentQuantity: asNumber(item.waste?.department_quantity),
      totalQuantity: asNumber(item.waste?.total_quantity),
      count: asNumber(item.waste?.count),
      topReason: item.waste?.top_reason ?? undefined,
      topDestination: item.waste?.top_destination ?? undefined,
      ratioDepartmentToIssued: optionalNumber(item.waste?.ratio_department_to_issued),
    },
    recipeConsumption: {
      quantity: asNumber(item.recipe_consumption?.quantity),
      count: asNumber(item.recipe_consumption?.count),
    },
    operations: {
      dailyIssueRate: optionalNumber(item.operations?.daily_issue_rate),
      coverageDays: optionalNumber(item.operations?.coverage_days),
      issuePer100Dishes: optionalNumber(item.operations?.issue_per_100_dishes),
      previousIssuePer100Dishes: optionalNumber(item.operations?.previous_issue_per_100_dishes),
    },
    comparison: {
      issueQuantityPercent: optionalNumber(item.comparison?.issue_quantity_percent),
      wasteQuantityPercent: optionalNumber(item.comparison?.waste_quantity_percent),
      purchaseCostPercent: optionalNumber(item.comparison?.purchase_cost_percent),
      issuePer100DishesPercent: optionalNumber(item.comparison?.issue_per_100_dishes_percent),
    },
    timeline: (item.timeline ?? []).map((event) => ({
      date: event.date,
      type: event.type,
      label: event.label,
      quantityBase: asNumber(event.quantity_base),
      unitCost: optionalNumber(event.unit_cost),
      supplierName: event.supplier_name ?? undefined,
      destination: event.destination ?? undefined,
      reason: event.reason ?? undefined,
      reference: event.reference ?? undefined,
    })),
  };
}

export async function getInventoryAnalytics(input: InventoryAnalyticsRangeInput): Promise<InventoryAnalytics> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_inventory_analytics" as never, {
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_item_type: input.itemType && input.itemType !== "all" ? input.itemType : null,
  } as never);

  if (error) {
    logSupabaseError("[inventory analytics RPC]", error);
    throw error;
  }

  const payload = data as AnalyticsPayload | null;
  return {
    range: {
      startDate: payload?.range?.start_date ?? input.startDate,
      endDate: payload?.range?.end_date ?? input.endDate,
      periodDays: asNumber(payload?.range?.period_days),
      previousStartDate: payload?.range?.previous_start_date,
      previousEndDate: payload?.range?.previous_end_date,
      timezone: payload?.range?.timezone ?? "Asia/Baghdad",
    },
    overview: {
      inventoryValue: asNumber(payload?.overview?.inventory_value),
      followUpCount: asNumber(payload?.overview?.follow_up_count),
      issueCostEstimate: asNumber(payload?.overview?.issue_cost_estimate),
      actualWasteQuantityEvents: asNumber(payload?.overview?.actual_waste_quantity_events),
      dishQuantity: asNumber(payload?.overview?.dish_quantity),
      previousDishQuantity: asNumber(payload?.overview?.previous_dish_quantity),
    },
    items: (payload?.items ?? []).map(mapItem),
  };
}
