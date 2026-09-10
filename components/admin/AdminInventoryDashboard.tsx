"use client";

import { FormEvent, type ElementType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, ClipboardList, CookingPot, Edit3, PackagePlus, Plus, RefreshCw, Save, Search, SlidersHorizontal, Trash2, Wrench, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  adjustInventoryStock,
  createInventoryItem,
  deactivateInventoryItemConversion,
  getInventoryOverview,
  updateInventoryItem,
  upsertInventoryItemConversion,
  type AdjustInventoryInput,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  type UpsertInventoryItemConversionInput,
} from "@/services/inventoryService";
import { createClient } from "@/lib/supabase/client";
import { EquipmentMaintenancePanel } from "@/components/inventory/EquipmentMaintenancePanel";
import { AiInventoryMonitorPanel } from "@/components/inventory/AiInventoryMonitorPanel";
import { InventoryAnalyticsPanel } from "@/components/inventory/InventoryAnalyticsPanel";
import { InventoryRequisitionsPanel } from "@/components/inventory/InventoryRequisitionsPanel";
import { InventoryWastePanel } from "@/components/inventory/InventoryWastePanel";
import { PurchaseRequestsPanel } from "@/components/inventory/PurchaseRequestsPanel";
import { getEquipmentOverview } from "@/services/equipmentMaintenanceService";
import { getInventoryRequisitions } from "@/services/inventoryRequisitionService";
import { getInventoryWasteReports } from "@/services/inventoryWasteService";
import { getPurchaseRequests } from "@/services/purchaseService";
import { deleteRecipeItem, getActiveRecipe, getCompatibleUnits, getOrCreateActiveRecipe, getRecipeSummaries, updateMenuItemInventoryTracking, upsertRecipeItem } from "@/services/recipeService";
import { formatCurrency } from "@/lib/formatCurrency";
import { purchaseRequestItemsSummary } from "@/lib/purchaseRequestDisplay";
import type { ActiveRecipe, EquipmentAsset, InventoryItem, InventoryItemConversion, InventoryItemType, InventoryMovement, InventoryMovementType, InventoryRequisition, InventoryRequisitionDestination, InventoryUnit, InventoryWasteReport, RecipeItem, RecipeSummary } from "@/types/inventory";
import type { PurchaseRequest } from "@/types/finance";

type ActiveTab = "overview" | "items" | "analytics" | "equipment" | "requisitions" | "waste" | "purchaseRequests" | "receiving" | "movements" | "recipes";
type StockFilter = "all" | "low" | "out";
type ItemTypeFilter = InventoryItemType | "all";
type MovementDirectionFilter = "all" | "in" | "out";
type MovementDestinationFilter = "all" | InventoryRequisitionDestination;
type RecipeStationFilter = "all" | RecipeSummary["preparationStation"];
type InventoryAuditMovementType = InventoryMovementType | "department_waste";
type InventoryAuditMovement = Omit<InventoryMovement, "movementType" | "quantityBefore" | "quantityAfter"> & {
  movementType: InventoryAuditMovementType;
  quantityBefore?: number;
  quantityAfter?: number;
  isStockAffecting: boolean;
};
type OverviewIssue = { id: string; title: string; helper: string; priority: number; tab: ActiveTab };
type OverviewActivity = { id: string; title: string; helper: string; at: string; tab: ActiveTab };

const itemTypeLabels: Record<InventoryItemType, string> = {
  food_recipe: "مادة وصفة",
  food_indirect: "غذائي غير مباشر",
  packaging: "تغليف",
  cleaning: "تنظيف",
  operational_consumable: "مستهلك تشغيلي",
};

const itemTypeOptions: { value: InventoryItemType; label: string }[] = [
  { value: "food_recipe", label: "مادة وصفة" },
  { value: "food_indirect", label: "مادة غذائية غير مباشرة" },
  { value: "packaging", label: "تغليف" },
  { value: "cleaning", label: "تنظيف" },
  { value: "operational_consumable", label: "مستهلك تشغيلي" },
];

const standardBaseUnitCodes: InventoryUnit["code"][] = ["g", "kg", "ml", "l", "piece"];
const packagingUnitSuggestions = ["باكيت", "برطمان", "قنينة", "شيشة", "علبة", "صندوق", "كيس", "كارتون"];

const movementLabels: Record<InventoryAuditMovementType, string> = {
  opening_balance: "رصيد افتتاحي",
  adjustment_in: "تسوية إضافة",
  adjustment_out: "تسوية إخراج",
  purchase: "شراء",
  consumption: "استهلاك",
  waste: "هدر",
  return: "مرتجع",
  stock_issue: "صرف داخلي",
  department_waste: "هدر قسم",
};

const destinationLabels: Record<InventoryRequisitionDestination, string> = {
  kitchen: "المطبخ",
  barista: "الكوفي / الباريستا",
  bar: "البار",
  service: "الخدمة",
  cleaning: "التنظيف",
  management: "الإدارة",
  other: "أخرى",
};

const recipeStationLabels: Record<RecipeSummary["preparationStation"], string> = {
  kitchen: "المطبخ",
  barista: "الباريستا",
  drinks: "مشروبات",
  shisha: "شيشة",
};

const tabs: { id: ActiveTab; label: string }[] = [
  { id: "overview", label: "الملخص" },
  { id: "items", label: "المواد" },
  { id: "analytics", label: "تحليل المخزون" },
  { id: "equipment", label: "المعدات والصيانة" },
  { id: "requisitions", label: "طلبات الصرف" },
  { id: "waste", label: "الهدر والتلف" },
  { id: "purchaseRequests", label: "طلبات الشراء" },
  { id: "receiving", label: "المشتريات / الاستلام" },
  { id: "movements", label: "الحركات" },
  { id: "recipes", label: "الوصفات" },
];

function isActiveTab(value: string | null): value is ActiveTab {
  return tabs.some((tab) => tab.id === value);
}

const emptyItemForm = {
  nameAr: "",
  itemType: "operational_consumable" as InventoryItemType,
  baseUnitId: "",
  minimumStock: "0",
  openingQuantity: "",
  openingUnitId: "",
};

const emptyConversionForm = {
  packagingUnitNameAr: "",
  quantityInBaseUnit: "",
};

const emptyAdjustmentForm = {
  quantityDelta: "",
  unitId: "",
  notes: "",
};

const emptyRecipeItemForm = {
  inventoryItemId: "",
  quantity: "",
  unitId: "",
  wastePercent: "0",
};

const emptyQuickItemForm = {
  nameAr: "",
  itemType: "food_recipe" as InventoryItemType,
  baseUnitId: "",
  minimumStock: "",
  openingQuantity: "",
  openingUnitId: "",
};

function normalizeInventoryName(value: string) {
  return value
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar-IQ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(value);
}

function formatQuantity(quantity: number, unitCode: InventoryUnit["code"]) {
  const absolute = Math.abs(quantity);
  const sign = quantity < 0 ? "-" : "";

  if (unitCode === "g" && absolute >= 1000) {
    return `${sign}${formatNumber(absolute / 1000)} كغم`;
  }

  if (unitCode === "ml" && absolute >= 1000) {
    return `${sign}${formatNumber(absolute / 1000)} لتر`;
  }

  const labels: Record<InventoryUnit["code"], string> = {
    g: "غرام",
    kg: "كغم",
    ml: "مل",
    l: "لتر",
    piece: "قطعة",
    pack: "علبة",
    bottle: "قنينة",
  };

  return `${sign}${formatNumber(absolute)} ${labels[unitCode]}`;
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function itemAvailability(item: InventoryItem) {
  if (!item.isActive) return { label: "متوقفة", className: "border-[#e4d8c8] bg-[#fbfaf7] text-[#9a8779]" };
  if (item.stockOnHand === 0) return { label: "نافد", className: "border-rose-200 bg-rose-50 text-rose-700" };
  if (item.stockOnHand <= item.minimumStock) return { label: "منخفض", className: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "متوفر", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
}

function latestEquipmentNextMaintenance(asset: EquipmentAsset) {
  return asset.maintenanceRecords
    .filter((record) => record.status === "completed" && record.nextMaintenanceDate)
    .map((record) => record.nextMaintenanceDate as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function daysBetweenDates(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00+03:00`) - Date.parse(`${fromIso}T00:00:00+03:00`)) / 86400000);
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

function movementDirection(movement: InventoryAuditMovement) {
  if (movement.quantityDelta > 0) return "in";
  if (movement.quantityDelta < 0) return "out";
  return "all";
}

function movementSourceLabel(sourceType?: string) {
  const labels: Record<string, string> = {
    purchase: "استلام / شراء",
    purchase_request: "طلب شراء",
    requisition: "طلب صرف",
    inventory_requisition: "طلب صرف",
    waste: "هدر",
    department_waste: "هدر قسم",
    inventory_waste: "سجل الهدر",
    recipe: "وصفة",
    adjustment: "تسوية",
  };
  return sourceType ? labels[sourceType] ?? sourceType : "-";
}

function textOrDash(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function InventoryStat({ title, value, helper, icon, onClick }: { title: string; value: string; helper: string; icon: ElementType; onClick?: () => void }) {
  const Icon = icon;
  const className = "rounded-md border border-[#e4d8c8] bg-white p-3 text-right shadow-sm";
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-[#7c6b60]">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-[#2f211c]">{value}</p>
        <p className="mt-1 text-xs text-[#9a8779]">{helper}</p>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#e4d8c8] bg-[#fbfaf7] text-[#ff5656]">
        <Icon size={17} />
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} transition hover:-translate-y-0.5 hover:border-[#ff5656]/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5656]/35`}>
        {content}
      </button>
    );
  }

  return (
    <section className={className}>
      {content}
    </section>
  );
}

function SectionHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e4d8c8] bg-white px-4 py-3 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-[#2f211c]">{title}</h2>
        <p className="mt-1 text-xs text-[#7c6b60]">{subtitle}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </section>
  );
}

export function AdminInventoryDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemConversions, setItemConversions] = useState<InventoryItemConversion[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [recipeSummaries, setRecipeSummaries] = useState<RecipeSummary[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<ActiveRecipe | null>(null);
  const [selectedRecipeMenuItemId, setSelectedRecipeMenuItemId] = useState<string | null>(null);
  const [editingRecipeItem, setEditingRecipeItem] = useState<RecipeItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustmentForm);
  const [itemStockFilter, setItemStockFilter] = useState<StockFilter>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [itemSearch, setItemSearch] = useState("");
  const [conversionForm, setConversionForm] = useState(emptyConversionForm);
  const [editingConversion, setEditingConversion] = useState<InventoryItemConversion | null>(null);
  const [movementItemFilter, setMovementItemFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryAuditMovementType | "all">("all");
  const [movementDirectionFilter, setMovementDirectionFilter] = useState<MovementDirectionFilter>("all");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementSourceFilter, setMovementSourceFilter] = useState("all");
  const [movementDestinationFilter, setMovementDestinationFilter] = useState<MovementDestinationFilter>("all");
  const [movementUserFilter, setMovementUserFilter] = useState("");
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");
  const [recipeStationFilter, setRecipeStationFilter] = useState<RecipeStationFilter>("all");
  const [recipeItemForm, setRecipeItemForm] = useState(emptyRecipeItemForm);
  const [isQuickItemDialogOpen, setIsQuickItemDialogOpen] = useState(false);
  const [quickItemForm, setQuickItemForm] = useState(emptyQuickItemForm);
  const [equipmentFollowUpCount, setEquipmentFollowUpCount] = useState(0);
  const [overviewRequisitions, setOverviewRequisitions] = useState<InventoryRequisition[]>([]);
  const [overviewPurchaseRequests, setOverviewPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [overviewWasteReports, setOverviewWasteReports] = useState<InventoryWasteReport[]>([]);
  const [overviewEquipmentAssets, setOverviewEquipmentAssets] = useState<EquipmentAsset[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const realtimeReloadTimerRef = useRef<number | null>(null);

  const baseUnits = useMemo(() => units.filter((unit) => standardBaseUnitCodes.includes(unit.code)), [units]);
  const selectedBaseUnit = units.find((unit) => unit.id === itemForm.baseUnitId);
  const openingUnits = selectedBaseUnit ? units.filter((unit) => unit.family === selectedBaseUnit.family) : [];
  const selectedQuickBaseUnit = units.find((unit) => unit.id === quickItemForm.baseUnitId);
  const quickOpeningUnits = selectedQuickBaseUnit ? units.filter((unit) => unit.family === selectedQuickBaseUnit.family) : [];
  const activeItems = items.filter((item) => item.isActive);
  const lowStockItems = activeItems.filter((item) => item.stockOnHand > 0 && item.stockOnHand <= item.minimumStock);
  const outOfStockItems = activeItems.filter((item) => item.stockOnHand === 0);
  const filteredItems = items.filter((item) => {
    const stockMatches =
      itemStockFilter === "low"
        ? lowStockItems.some((lowItem) => lowItem.id === item.id)
        : itemStockFilter === "out"
          ? outOfStockItems.some((outItem) => outItem.id === item.id)
          : true;
    const typeMatches = itemTypeFilter === "all" || item.itemType === itemTypeFilter;
    const query = normalizeInventoryName(itemSearch);
    const searchMatches = !query || normalizeInventoryName(item.nameAr).includes(query);
    return stockMatches && typeMatches && searchMatches;
  });
  const inventoryValue = items.reduce((total, item) => total + item.stockOnHand * item.averageCost, 0);
  const pendingRequisitions = overviewRequisitions.filter((requisition) => requisition.status === "pending");
  const pendingIssueRequisitions = overviewRequisitions.filter((requisition) => requisition.status === "approved");
  const pendingPurchaseRequests = overviewPurchaseRequests.filter((request) => request.status === "pending" || request.status === "decision_in_progress");
  const approvedPurchaseRequests = overviewPurchaseRequests.filter((request) => request.status === "approved" || request.status === "partially_approved");
  const wasteTodayCount = overviewWasteReports.filter((report) => new Date(report.postedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }) === todayIso()).length;
  const overdueEquipment = overviewEquipmentAssets.filter((asset) => {
    const nextDate = latestEquipmentNextMaintenance(asset);
    return asset.isActive && nextDate ? nextDate < todayIso() : false;
  });
  const followUpIssues: OverviewIssue[] = [
    ...outOfStockItems.slice(0, 3).map((item) => ({ id: `out-${item.id}`, title: item.nameAr, helper: `${formatQuantity(item.stockOnHand, item.baseUnitCode)} / نافد`, priority: 1, tab: "items" as ActiveTab })),
    ...lowStockItems.slice(0, 3).map((item) => ({ id: `low-${item.id}`, title: item.nameAr, helper: `${formatQuantity(item.stockOnHand, item.baseUnitCode)} / حد أدنى ${formatQuantity(item.minimumStock, item.baseUnitCode)}`, priority: 2, tab: "items" as ActiveTab })),
    ...pendingRequisitions.slice(0, 2).map((request) => ({ id: `req-${request.id}`, title: request.requestCode, helper: `طلب صرف من ${request.requestedByName}`, priority: 3, tab: "requisitions" as ActiveTab })),
    ...pendingPurchaseRequests.slice(0, 2).map((request) => ({ id: `pur-${request.id}`, title: `طلب شراء #${request.requestNumber}`, helper: "بانتظار الموافقة", priority: 4, tab: "purchaseRequests" as ActiveTab })),
    ...pendingIssueRequisitions.slice(0, 2).map((request) => ({ id: `issue-${request.id}`, title: request.requestCode, helper: "معتمد وينتظر الصرف", priority: 5, tab: "requisitions" as ActiveTab })),
    ...overdueEquipment.slice(0, 2).map((asset) => ({ id: `eq-overdue-${asset.id}`, title: `${asset.assetCode} - ${asset.nameAr}`, helper: `صيانة متأخرة ${formatNumber(Math.abs(daysBetweenDates(todayIso(), latestEquipmentNextMaintenance(asset) ?? todayIso())))} يوم`, priority: 6, tab: "equipment" as ActiveTab })),
    ...overviewEquipmentAssets.filter((asset) => asset.status === "needs_maintenance" || asset.status === "out_of_service" || asset.status === "under_maintenance").slice(0, 2).map((asset) => ({ id: `eq-${asset.id}`, title: `${asset.assetCode} - ${asset.nameAr}`, helper: asset.status === "under_maintenance" ? "تحت الصيانة" : asset.status === "out_of_service" ? "خارج الخدمة" : "يحتاج صيانة", priority: 7, tab: "equipment" as ActiveTab })),
  ].sort((a, b) => a.priority - b.priority).slice(0, 8);
  const recentActivities: OverviewActivity[] = [
    ...movements.slice(0, 6).map((movement) => ({ id: `move-${movement.id}`, title: movementLabels[movement.movementType], helper: `${movement.inventoryItemName} / ${formatQuantity(movement.quantityDelta, movement.baseUnitCode)}`, at: movement.createdAt, tab: "movements" as ActiveTab })),
    ...overviewWasteReports.slice(0, 3).map((report) => ({ id: `waste-${report.id}`, title: "هدر / تلف", helper: `${report.reportCode} / ${formatNumber(report.items.length)} مواد`, at: report.postedAt, tab: "waste" as ActiveTab })),
    ...overviewRequisitions.slice(0, 3).map((request) => ({ id: `requisition-${request.id}`, title: "طلب صرف", helper: `${request.requestCode} / ${request.items.length} مواد`, at: request.requestedAt, tab: "requisitions" as ActiveTab })),
    ...overviewPurchaseRequests.slice(0, 3).map((request) => ({ id: `purchase-${request.id}`, title: "طلب شراء", helper: `#${request.requestNumber} / ${purchaseRequestItemsSummary(request)}`, at: request.createdAt, tab: "purchaseRequests" as ActiveTab })),
    ...overviewEquipmentAssets.flatMap((asset) =>
      asset.maintenanceRecords.slice(0, 2).map((record) => ({ id: `maintenance-${record.id}`, title: record.maintenanceType === "breakdown" ? "عطل معدات" : "صيانة معدات", helper: `${asset.assetCode} / ${asset.nameAr}`, at: record.completedAt ?? record.startedAt ?? record.reportedAt, tab: "equipment" as ActiveTab })),
    ),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8);
  const selectedRecipeItem = items.find((item) => item.id === recipeItemForm.inventoryItemId);
  const recipeUnitOptions = useMemo(
    () => (selectedRecipeItem ? getCompatibleUnits(selectedRecipeItem, units).filter((unit) => standardBaseUnitCodes.includes(unit.code)) : []),
    [selectedRecipeItem, units],
  );
  const itemHasMovements = editingItem ? movements.some((movement) => movement.inventoryItemId === editingItem.id) : false;
  const editingItemConversions = editingItem ? itemConversions.filter((conversion) => conversion.inventoryItemId === editingItem.id) : [];
  const auditMovements = useMemo<InventoryAuditMovement[]>(() => {
    const stockRows: InventoryAuditMovement[] = movements.map((movement) => ({
      ...movement,
      isStockAffecting: true,
    }));

    const departmentWasteRows: InventoryAuditMovement[] = overviewWasteReports.flatMap((report) => {
      if (report.context !== "issued_department") return [];
      return report.items.map((item) => ({
        id: `department-waste-${report.id}-${item.id}`,
        inventoryItemId: item.inventoryItemId,
        inventoryItemName: item.inventoryItemName,
        movementType: "department_waste",
        quantityDelta: -Math.abs(item.quantityBase),
        baseUnitCode: item.baseUnitCode,
        quantityBefore: undefined,
        quantityAfter: undefined,
        unitCost: 0,
        totalCost: 0,
        sourceType: "inventory_waste",
        orderNumber: undefined,
        requisitionCode: item.requisitionCode,
        wasteCode: report.reportCode,
        destination: report.destination,
        notes: item.notes ?? report.note ?? "هدر قسم بعد صرف المادة",
        createdByName: report.postedByName,
        createdAt: report.postedAt,
        isStockAffecting: false,
      }));
    });

    return [...stockRows, ...departmentWasteRows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [movements, overviewWasteReports]);

  const movementSourceOptions = Array.from(new Set(auditMovements.map((movement) => movement.sourceType).filter(Boolean))).sort() as string[];
  const filteredRecipeSummaries = recipeSummaries.filter((summary) => recipeStationFilter === "all" || summary.preparationStation === recipeStationFilter);

  const filteredMovements = auditMovements.filter((movement) => {
    const itemMatches = movementItemFilter === "all" || movement.inventoryItemId === movementItemFilter;
    const typeMatches = movementTypeFilter === "all" || movement.movementType === movementTypeFilter;
    const directionMatches = movementDirectionFilter === "all" || movementDirection(movement) === movementDirectionFilter;
    const sourceMatches = movementSourceFilter === "all" || movement.sourceType === movementSourceFilter;
    const destinationMatches = movementDestinationFilter === "all" || movement.destination === movementDestinationFilter;
    const query = normalizeInventoryName(movementSearch);
    const searchMatches = !query || normalizeInventoryName(`${movement.inventoryItemName} ${movement.notes ?? ""} ${movement.orderNumber ?? ""} ${movement.requisitionCode ?? ""} ${movement.wasteCode ?? ""}`).includes(query);
    const userQuery = normalizeInventoryName(movementUserFilter);
    const userMatches = !userQuery || normalizeInventoryName(movement.createdByName ?? "").includes(userQuery);
    const movementDate = movement.createdAt.slice(0, 10);
    const dateFromMatches = !movementDateFrom || movementDate >= movementDateFrom;
    const dateToMatches = !movementDateTo || movementDate <= movementDateTo;
    return itemMatches && typeMatches && directionMatches && sourceMatches && destinationMatches && searchMatches && userMatches && dateFromMatches && dateToMatches;
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [inventoryData, recipesData, equipmentData, requisitionsData, purchaseRequestsData, wasteReportsData] = await Promise.all([
        getInventoryOverview(),
        getRecipeSummaries(),
        getEquipmentOverview().catch((equipmentError) => {
          console.warn("Equipment overview is not available yet", equipmentError);
          return null;
        }),
        getInventoryRequisitions().catch((requisitionsError) => {
          console.warn("Inventory requisitions overview is not available yet", requisitionsError);
          return [];
        }),
        getPurchaseRequests().catch((purchaseError) => {
          console.warn("Purchase requests overview is not available yet", purchaseError);
          return [];
        }),
        getInventoryWasteReports().catch((wasteError) => {
          console.warn("Inventory waste overview is not available yet", wasteError);
          return [];
        }),
      ]);
      setUnits(inventoryData.units);
      setItems(inventoryData.items);
      setItemConversions(inventoryData.itemConversions);
      setMovements(inventoryData.movements);
      setRecipeSummaries(recipesData);
      setEquipmentFollowUpCount(equipmentData?.summary.followUpCount ?? 0);
      setOverviewEquipmentAssets(equipmentData?.assets ?? []);
      setOverviewRequisitions(requisitionsData);
      setOverviewPurchaseRequests(purchaseRequestsData);
      setOverviewWasteReports(wasteReportsData);
      setLastUpdatedAt(new Date().toISOString());

      const firstBaseUnit = inventoryData.units.find((unit) => unit.isBaseUnit);
      setItemForm((current) =>
        current.baseUnitId ? current : { ...current, baseUnitId: firstBaseUnit?.id ?? "", openingUnitId: firstBaseUnit?.id ?? "" },
      );
    } catch (loadError) {
      console.error("Failed to load inventory", loadError);
      setError("تعذر تحميل بيانات المخزن من Supabase.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const section = searchParams.get("section");
      setActiveTab(isActiveTab(section) ? section : "overview");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    function scheduleReload() {
      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
      }

      realtimeReloadTimerRef.current = window.setTimeout(() => {
        realtimeReloadTimerRef.current = null;

        if (!isMounted) {
          return;
        }

        loadData().catch((realtimeError) => {
          console.error("Failed to reload inventory after realtime change", realtimeError);
        });
      }, 250);
    }

    const channel = supabase
      .channel("inventory-admin-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_item_conversions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisitions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requisition_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_waste_reports" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_waste_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_request_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_assets" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_maintenance_records" }, scheduleReload)
      .subscribe();

    return () => {
      isMounted = false;

      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function selectTab(tabId: ActiveTab) {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "overview") {
      params.delete("section");
    } else {
      params.set("section", tabId);
    }
    const query = params.toString();
    router.replace(query ? `/inventory?${query}` : "/inventory", { scroll: false });
  }

  function openFilteredItems(filter: StockFilter) {
    setItemStockFilter(filter);
    selectTab("items");
  }

  function resetItemForm() {
    const firstBaseUnit = baseUnits[0];
    setEditingItem(null);
    setEditingConversion(null);
    setConversionForm(emptyConversionForm);
    setItemForm({ ...emptyItemForm, baseUnitId: firstBaseUnit?.id ?? "", openingUnitId: firstBaseUnit?.id ?? "" });
    setIsItemFormOpen(true);
  }

  function startEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemForm({
      nameAr: item.nameAr,
      itemType: item.itemType,
      baseUnitId: item.baseUnitId,
      minimumStock: String(item.minimumStock),
      openingQuantity: "",
      openingUnitId: item.baseUnitId,
    });
    setEditingConversion(null);
    setConversionForm(emptyConversionForm);
    setActiveTab("items");
    setIsItemFormOpen(true);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      if (editingItem) {
        const payload: UpdateInventoryItemInput = {
          id: editingItem.id,
          nameAr: itemForm.nameAr,
          nameEn: editingItem.nameEn,
          itemType: itemForm.itemType,
          baseUnitId: itemForm.baseUnitId,
          minimumStock: parseNonNegativeNumber(itemForm.minimumStock),
          isActive: editingItem.isActive,
        };
        await updateInventoryItem(payload);
        showMessage("تم تعديل المادة");
      } else {
        const openingQuantity = parsePositiveNumber(itemForm.openingQuantity);
        const payload: CreateInventoryItemInput = {
          nameAr: itemForm.nameAr,
          itemType: itemForm.itemType,
          baseUnitId: itemForm.baseUnitId,
          minimumStock: parseNonNegativeNumber(itemForm.minimumStock),
          openingBalance: openingQuantity
            ? {
                quantity: openingQuantity,
                unitId: itemForm.openingUnitId || itemForm.baseUnitId,
              }
            : undefined,
        };
        await createInventoryItem(payload);
        showMessage("تمت إضافة المادة");
      }

      resetItemForm();
      setIsItemFormOpen(false);
      await loadData();
    } catch (saveError) {
      console.error("Failed to save inventory item", saveError);
      setError("تعذر حفظ المادة. تحقق من البيانات أو الصلاحيات.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleItemStatus(item: InventoryItem) {
    setIsSaving(true);
    setError("");

    try {
      await updateInventoryItem({ ...item, id: item.id, nameAr: item.nameAr, nameEn: item.nameEn, itemType: item.itemType, baseUnitId: item.baseUnitId, minimumStock: item.minimumStock, isActive: !item.isActive });
      await loadData();
      showMessage(item.isActive ? "تم إيقاف المادة" : "تم تفعيل المادة");
    } catch (statusError) {
      console.error("Failed to update inventory item status", statusError);
      setError("تعذر تغيير حالة المادة.");
    } finally {
      setIsSaving(false);
    }
  }

  function openAdjustment(item: InventoryItem) {
    setAdjustingItem(item);
    setAdjustmentForm({ ...emptyAdjustmentForm, unitId: item.baseUnitId });
  }

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustingItem) return;

    setIsSaving(true);
    setError("");

    try {
      const payload: AdjustInventoryInput = {
        itemId: adjustingItem.id,
        quantityDelta: Number(adjustmentForm.quantityDelta),
        unitId: adjustmentForm.unitId,
        notes: adjustmentForm.notes,
      };
      await adjustInventoryStock(payload);
      setAdjustingItem(null);
      setAdjustmentForm(emptyAdjustmentForm);
      await loadData();
      showMessage("تم تسجيل التسوية");
    } catch (adjustError) {
      console.error("Failed to adjust inventory stock", adjustError);
      setError("تعذر تسجيل التسوية. لا يمكن أن يصبح الرصيد سالباً والسبب مطلوب.");
    } finally {
      setIsSaving(false);
    }
  }

  function editConversion(conversion: InventoryItemConversion) {
    setEditingConversion(conversion);
    setConversionForm({
      packagingUnitNameAr: conversion.packagingUnitNameAr,
      quantityInBaseUnit: String(conversion.quantityInBaseUnit),
    });
  }

  function resetConversionForm() {
    setEditingConversion(null);
    setConversionForm(emptyConversionForm);
  }

  async function submitConversion() {
    if (!editingItem) return;

    if (!conversionForm.packagingUnitNameAr.trim()) {
      setError("اكتب اسم وحدة التعبئة أولاً.");
      return;
    }

    const quantityInBaseUnit = parsePositiveNumber(conversionForm.quantityInBaseUnit);
    if (!quantityInBaseUnit) {
      setError("قيمة التحويل يجب أن تكون أكبر من صفر.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload: UpsertInventoryItemConversionInput = {
        id: editingConversion?.id,
        inventoryItemId: editingItem.id,
        packagingUnitNameAr: conversionForm.packagingUnitNameAr,
        packagingUnitNameEn: editingConversion?.packagingUnitNameEn,
        quantityInBaseUnit,
      };
      await upsertInventoryItemConversion(payload);
      resetConversionForm();
      await loadData();
      showMessage(editingConversion ? "تم تعديل وحدة التعبئة" : "تمت إضافة وحدة التعبئة");
    } catch (conversionError) {
      console.error("Failed to save inventory item conversion", conversionError);
      setError("تعذر حفظ وحدة التعبئة. لا يمكن تكرار نفس الاسم لنفس المادة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivateConversion(conversion: InventoryItemConversion) {
    setIsSaving(true);
    setError("");

    try {
      await deactivateInventoryItemConversion(conversion.id);
      if (editingConversion?.id === conversion.id) {
        resetConversionForm();
      }
      await loadData();
      showMessage("تم تعطيل وحدة التعبئة");
    } catch (conversionError) {
      console.error("Failed to deactivate inventory item conversion", conversionError);
      setError("تعذر تعطيل وحدة التعبئة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function openRecipe(menuItemId: string) {
    setIsSaving(true);
    setError("");

    try {
      await getOrCreateActiveRecipe(menuItemId);
      const recipe = await getActiveRecipe(menuItemId);
      setSelectedRecipeMenuItemId(menuItemId);
      setActiveRecipe(recipe);
      setRecipeItemForm(emptyRecipeItemForm);
      setEditingRecipeItem(null);
    } catch (recipeError) {
      console.error("Failed to open recipe", recipeError);
      setError("تعذر فتح الوصفة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function reloadActiveRecipe() {
    if (!selectedRecipeMenuItemId) return;
    const recipe = await getActiveRecipe(selectedRecipeMenuItemId);
    setActiveRecipe(recipe);
    setRecipeSummaries(await getRecipeSummaries());
  }

  function editRecipeItem(item: RecipeItem) {
    setEditingRecipeItem(item);
    setRecipeItemForm({
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      unitId: item.unitId,
      wastePercent: String(item.wastePercent),
    });
  }

  function openQuickItemDialog() {
    const firstBaseUnit = baseUnits[0];
    setQuickItemForm({ ...emptyQuickItemForm, baseUnitId: firstBaseUnit?.id ?? "", openingUnitId: firstBaseUnit?.id ?? "" });
    setIsQuickItemDialogOpen(true);
  }

  function selectRecipeInventoryItem(item: InventoryItem) {
    setRecipeItemForm((current) => ({ ...current, inventoryItemId: item.id, unitId: item.baseUnitId }));
  }

  async function submitQuickItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = normalizeInventoryName(quickItemForm.nameAr);

    if (!normalizedName) {
      setError("اكتب اسم المادة أولاً.");
      return;
    }

    const existingItem = items.find((item) => normalizeInventoryName(item.nameAr) === normalizedName);
    if (existingItem) {
      if (!existingItem.isActive) {
        setError("هذه المادة موجودة مسبقاً لكنها متوقفة. فعّلها من قسم المواد بدلاً من إنشائها مرة ثانية.");
        return;
      }

      selectRecipeInventoryItem(existingItem);
      setIsQuickItemDialogOpen(false);
      showMessage("هذه المادة موجودة مسبقاً وتم اختيارها في الوصفة.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const openingQuantity = parsePositiveNumber(quickItemForm.openingQuantity);
      await createInventoryItem({
        nameAr: quickItemForm.nameAr,
        itemType: quickItemForm.itemType,
        baseUnitId: quickItemForm.baseUnitId,
        minimumStock: parseNonNegativeNumber(quickItemForm.minimumStock),
        openingBalance: openingQuantity
          ? {
              quantity: openingQuantity,
              unitId: quickItemForm.openingUnitId || quickItemForm.baseUnitId,
            }
          : undefined,
      });

      const inventoryData = await getInventoryOverview();
      setUnits(inventoryData.units);
      setItems(inventoryData.items);
      setMovements(inventoryData.movements);

      const createdItem = inventoryData.items.find((item) => normalizeInventoryName(item.nameAr) === normalizedName);
      if (createdItem) {
        selectRecipeInventoryItem(createdItem);
      }

      setQuickItemForm(emptyQuickItemForm);
      setIsQuickItemDialogOpen(false);
      showMessage("تمت إضافة المادة واختيارها في الوصفة");
    } catch (quickItemError) {
      console.error("Failed to create inventory item from recipe editor", quickItemError);
      setError("تعذر إضافة المادة من محرر الوصفة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitRecipeItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRecipe) return;

    setIsSaving(true);
    setError("");

    try {
      await upsertRecipeItem({
        id: editingRecipeItem?.id,
        recipeId: activeRecipe.id,
        inventoryItemId: recipeItemForm.inventoryItemId,
        quantity: parsePositiveNumber(recipeItemForm.quantity),
        unitId: recipeItemForm.unitId,
        wastePercent: parseNonNegativeNumber(recipeItemForm.wastePercent),
      });
      setRecipeItemForm(emptyRecipeItemForm);
      setEditingRecipeItem(null);
      await reloadActiveRecipe();
      showMessage("تم حفظ مكوّن الوصفة");
    } catch (recipeItemError) {
      console.error("Failed to save recipe item", recipeItemError);
      setError("تعذر حفظ المكوّن. لا يمكن تكرار نفس المادة داخل الوصفة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRecipeItem(itemId: string) {
    setIsSaving(true);
    setError("");

    try {
      await deleteRecipeItem(itemId);
      await reloadActiveRecipe();
      showMessage("تم حذف المكوّن");
    } catch (deleteError) {
      console.error("Failed to delete recipe item", deleteError);
      setError("تعذر حذف المكوّن.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleRecipeTracking(summary: RecipeSummary) {
    if (!summary.inventoryTrackingEnabled && (!summary.recipeId || summary.ingredientCount === 0)) {
      setError("يجب إعداد وصفة للصنف قبل تفعيل خصم المخزون.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await updateMenuItemInventoryTracking(summary.menuItemId, !summary.inventoryTrackingEnabled);
      setRecipeSummaries(await getRecipeSummaries());
      showMessage(summary.inventoryTrackingEnabled ? "تم تعطيل خصم المخزون لهذا الصنف" : "تم تفعيل خصم المخزون لهذا الصنف");
    } catch (trackingError) {
      console.error("Failed to toggle inventory tracking", trackingError);
      setError("يجب إعداد وصفة للصنف قبل تفعيل خصم المخزون.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <DashboardHero
        className="rounded-md"
        image="/images/dashboard/inventory-dashboard-hero.jpg"
        eyebrow="Inventory Control"
        title="إدارة المخزن"
        description="المواد، الصرف، الهدر، المشتريات، المعدات والرقابة التشغيلية"
        height="clamp(96px, 9vw, 118px)"
      />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e4d8c8] bg-white px-3 py-2 shadow-sm">
        <div>
          <p className="text-xs text-[#7c6b60]">آخر تحديث</p>
          <p className="mt-1 text-sm font-semibold text-[#2f211c]">{lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "لم يتم التحديث بعد"}</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">
          <RefreshCw size={17} />
          تحديث
        </button>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-md border border-[#e4d8c8] bg-white shadow-sm" />)}
        </div>
      ) : null}

      {!isLoading && activeTab === "overview" ? (
        <div className="space-y-3">
          <SectionHeader title="ملخص المخزن" subtitle="مركز تشغيل سريع للمواد والطلبات والهدر والمعدات" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InventoryStat title="إجمالي المواد" value={formatNumber(activeItems.length)} helper="المواد النشطة فقط" icon={Boxes} />
            <InventoryStat title="قيمة المخزون" value={formatCurrency(inventoryValue)} helper="حسب متوسط التكلفة الحالي" icon={CheckCircle2} />
            <InventoryStat title="مواد منخفضة" value={formatNumber(lowStockItems.length)} helper="اضغط لعرض المواد المنخفضة" icon={AlertTriangle} onClick={() => openFilteredItems("low")} />
            <InventoryStat title="مواد نافدة" value={formatNumber(outOfStockItems.length)} helper="اضغط لعرض المواد النافدة" icon={AlertTriangle} onClick={() => openFilteredItems("out")} />
            <InventoryStat title="صرف بانتظار التنفيذ" value={formatNumber(pendingRequisitions.length + pendingIssueRequisitions.length)} helper="طلبات جديدة أو معتمدة" icon={ClipboardList} onClick={() => selectTab("requisitions")} />
            <InventoryStat title="طلبات شراء معلقة" value={formatNumber(pendingPurchaseRequests.length)} helper={`${formatNumber(approvedPurchaseRequests.length)} معتمدة للاستلام`} icon={PackagePlus} onClick={() => selectTab("purchaseRequests")} />
            <InventoryStat title="عمليات هدر اليوم" value={formatNumber(wasteTodayCount)} helper="من سجل الهدر والتلف" icon={Trash2} onClick={() => selectTab("waste")} />
            <InventoryStat title="معدات تحتاج متابعة" value={formatNumber(equipmentFollowUpCount)} helper="أعطال أو صيانة متأخرة" icon={Wrench} onClick={() => selectTab("equipment")} />
          </div>

          <AiInventoryMonitorPanel />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-[#a65f3f]" />
                <h2 className="font-semibold text-[#2f211c]">تحتاج متابعة</h2>
              </div>
              {followUpIssues.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد عناصر حرجة حالياً.</p> : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#2b2421] text-white">
                    <tr>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">المرجع</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">التفصيل</th>
                      <th className="px-3 py-2 text-right font-semibold">فتح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee4d8]">
                {followUpIssues.map((issue) => (
                  <tr key={issue.id} onClick={() => selectTab(issue.tab)} className="cursor-pointer odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]">{issue.title}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#7c6b60]">{issue.helper}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#a65f3f]">فتح</td>
                  </tr>
                ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList size={18} className="text-[#a65f3f]" />
                <h2 className="font-semibold text-[#2f211c]">آخر النشاطات</h2>
              </div>
              {recentActivities.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد نشاطات تشغيلية حديثة.</p> : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#2b2421] text-white">
                    <tr>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">النشاط</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">التفصيل</th>
                      <th className="px-3 py-2 text-right font-semibold">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee4d8]">
                {recentActivities.map((activity) => (
                  <tr key={activity.id} onClick={() => selectTab(activity.tab)} className="cursor-pointer odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]">{activity.title}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#7c6b60]">{activity.helper}</td>
                    <td className="px-3 py-2 text-xs text-[#9a8779]">{formatDate(activity.at)}</td>
                  </tr>
                ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Boxes size={18} className="text-[#a65f3f]" />
                <h2 className="font-semibold text-[#2f211c]">مواد تحتاج متابعة</h2>
              </div>
              <button type="button" onClick={() => openFilteredItems(lowStockItems.length ? "low" : "out")} className="rounded-md border border-[#e4d8c8] px-3 py-2 text-xs font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">عرض المواد</button>
            </div>
            {[...outOfStockItems, ...lowStockItems].slice(0, 5).length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد مواد منخفضة أو نافدة حالياً.</p> : null}
            <div className="divide-y divide-[#eee4d8]">
              {[...outOfStockItems, ...lowStockItems].slice(0, 5).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span>
                    <span className="block font-medium text-[#2f211c]">{item.nameAr}</span>
                    <span className="mt-1 block text-xs text-[#7c6b60]">الحد الأدنى: {formatQuantity(item.minimumStock, item.baseUnitCode)}</span>
                  </span>
                  <span className="text-lg font-semibold text-[#2f211c]">{formatQuantity(item.stockOnHand, item.baseUnitCode)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "purchaseRequests" ? (
        <div className="space-y-4">
          <SectionHeader title="طلبات الشراء" subtitle="طلبات توريد المواد قبل الاستلام وإضافة الرصيد" />
          <PurchaseRequestsPanel mode="requests" items={items} units={units} onInventoryChanged={loadData} />
        </div>
      ) : null}

      {!isLoading && activeTab === "receiving" ? (
        <div className="space-y-4">
          <SectionHeader title="المشتريات / الاستلام" subtitle="تسجيل الاستلام الفعلي وتحديث تكلفة ورصيد المواد" />
          <PurchaseRequestsPanel mode="receiving" items={items} units={units} onInventoryChanged={loadData} />
        </div>
      ) : null}

      {!isLoading && activeTab === "requisitions" ? (
        <div className="space-y-4">
          <SectionHeader title="طلبات الصرف" subtitle="طلبات المواد القادمة من أقسام المطعم" />
          <InventoryRequisitionsPanel onInventoryChanged={loadData} />
        </div>
      ) : null}

      {!isLoading && activeTab === "waste" ? (
        <div className="space-y-4">
          <SectionHeader title="الهدر والتلف" subtitle="تسجيل ومراجعة هدر المخزن والهدر بعد الصرف" />
          <InventoryWastePanel onInventoryChanged={loadData} />
        </div>
      ) : null}

      {!isLoading && activeTab === "analytics" ? (
        <div className="space-y-4">
          <SectionHeader title="تحليل المخزون" subtitle="قراءة تشغيلية لحركة المواد والتغطية والتكلفة" />
          <InventoryAnalyticsPanel onInventoryChanged={loadData} />
        </div>
      ) : null}

      {!isLoading && activeTab === "equipment" ? (
        <div className="space-y-4">
          <SectionHeader title="المعدات والصيانة" subtitle="إدارة أصول المطعم والصيانة والأعطال" />
          <EquipmentMaintenancePanel onEquipmentFollowUpChanged={setEquipmentFollowUpCount} />
        </div>
      ) : null}

      {!isLoading && activeTab === "items" ? (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4d8c8] bg-[#fbfaf7] px-3 py-2">
              <div>
                <h2 className="font-semibold text-[#2f211c]">المواد | {formatNumber(filteredItems.length)} مادة</h2>
                <p className="mt-1 text-xs text-[#7c6b60]">
                  {itemStockFilter === "low" ? "عرض المواد المنخفضة فقط" : itemStockFilter === "out" ? "عرض المواد النافدة فقط" : "عرض كل المواد"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" />
                  <input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="بحث باسم المادة" className="h-9 w-56 rounded-md border border-[#e4d8c8] bg-white pr-8 pl-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
                </div>
                <select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value as ItemTypeFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                  <option value="all">كل الأنواع</option>
                  {itemTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" onClick={() => setItemStockFilter("all")} className={`rounded-md border px-3 py-2 ${itemStockFilter === "all" ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>كل المواد</button>
                <button type="button" onClick={() => setItemStockFilter("low")} className={`rounded-md border px-3 py-2 ${itemStockFilter === "low" ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>مواد منخفضة</button>
                <button type="button" onClick={() => setItemStockFilter("out")} className={`rounded-md border px-3 py-2 ${itemStockFilter === "out" ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>مواد نافدة</button>
                <button type="button" onClick={() => void loadData()} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-[#4a3b34] hover:bg-[#f5eee6]" title="تحديث"><RefreshCw size={15} />تحديث</button>
                <button type="button" onClick={resetItemForm} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#a65f3f] px-3 text-white hover:bg-[#8f4e34]"><Plus size={15} />إضافة مادة</button>
              </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] table-fixed border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
                    <tr>
                      <th className="w-14 border-l border-[#e6dacd] px-2 py-2 text-right font-semibold">رقم</th>
                      <th className="sticky right-0 z-30 w-48 border-l border-white/15 bg-[#2b2421] px-3 py-2 text-right font-semibold">اسم المادة</th>
                      <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">النوع</th>
                      <th className="w-20 border-l border-white/15 px-2 py-2 text-right font-semibold">الوحدة</th>
                      <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">الرصيد</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">الحد الأدنى</th>
                      <th className="w-24 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الحالة</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">Avg Cost</th>
                      <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">Last Cost</th>
                      <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">قيمة الرصيد</th>
                      <th className="w-36 border-l border-white/15 px-2 py-2 text-right font-semibold">آخر حركة</th>
                      <th className="w-36 border-l border-white/15 px-2 py-2 text-right font-semibold">مؤشرات</th>
                      <th className="w-28 px-2 py-2 text-right font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee4d8]">
                    {filteredItems.map((item, index) => {
                      const availability = itemAvailability(item);
                      const itemMovements = movements.filter((movement) => movement.inventoryItemId === item.id);
                      const latestMovement = itemMovements[0];
                      const latestWaste = itemMovements.find((movement) => movement.movementType === "waste");
                      const latestAdjustment = itemMovements.find((movement) => movement.movementType === "adjustment_in" || movement.movementType === "adjustment_out");
                      return (
                        <tr key={item.id} onClick={() => startEditItem(item)} className={`cursor-pointer odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb] ${editingItem?.id === item.id ? "bg-[#fff1e8]" : ""}`}>
                          <td className="border-l border-[#f0e5da] px-2 py-2 font-semibold text-[#7c6b60]">{formatNumber(index + 1)}</td>
                          <td className="sticky right-0 z-10 truncate border-l border-[#d5c2af] bg-inherit px-3 py-2 font-semibold text-[#1f1713]" title={item.nameAr}>{item.nameAr}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2"><span className="inline-flex rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-2 py-1 text-[11px] font-semibold text-[#4a3b34]">{itemTypeLabels[item.itemType]}</span></td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{item.baseUnitName}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-base font-bold text-[#2f211c]">{formatQuantity(item.stockOnHand, item.baseUnitCode)}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatQuantity(item.minimumStock, item.baseUnitCode)}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2"><span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${availability.className}`}>{availability.label}</span></td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatCurrency(item.averageCost)}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatCurrency(item.lastPurchaseCost)}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]">{formatCurrency(item.stockOnHand * item.averageCost)}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{latestMovement ? `${movementLabels[latestMovement.movementType]} · ${formatDate(latestMovement.createdAt)}` : "-"}</td>
                          <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">
                            <div className="flex flex-wrap gap-1">
                              {!item.isActive ? <span className="rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-2 py-1 text-[11px] font-semibold text-[#7c6b60]">متوقفة</span> : null}
                              {latestAdjustment ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">آخر تسوية: {formatDate(latestAdjustment.createdAt)}</span> : null}
                              {latestWaste ? <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">هدر مسجل</span> : null}
                              {!latestAdjustment && !latestWaste && item.isActive ? <span className="text-[#9a8779]">طبيعية</span> : null}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={(event) => { event.stopPropagation(); startEditItem(item); }} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تفاصيل وتعديل"><Edit3 size={14} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); openAdjustment(item); }} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تسوية"><SlidersHorizontal size={14} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); void toggleItemStatus(item); }} className="rounded-md border border-[#e4d8c8] px-2 py-2 text-[11px] text-[#4a3b34] hover:bg-[#f5eee6]">{item.isActive ? "إيقاف" : "تفعيل"}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-8 text-center text-sm text-[#4a3b34]">لا توجد مواد مطابقة لهذا العرض</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
          </section>

          {isItemFormOpen ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={submitItem} className="w-full max-w-3xl space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <PackagePlus size={18} className="text-[#a65f3f]" />
              <h2 className="font-semibold text-[#2f211c]">{editingItem ? "تفاصيل المادة" : "إضافة مادة"}</h2>
            </div>
            {editingItem ? (
              <div className="grid gap-2 rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
                <p className="text-lg font-semibold text-[#2f211c]">{editingItem.nameAr}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-xs text-[#7c6b60]">الرصيد الحالي</p><p className="font-semibold text-[#2f211c]">{formatQuantity(editingItem.stockOnHand, editingItem.baseUnitCode)}</p></div>
                  <div><p className="text-xs text-[#7c6b60]">الحالة</p><span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${itemAvailability(editingItem).className}`}>{itemAvailability(editingItem).label}</span></div>
                  <div><p className="text-xs text-[#7c6b60]">Average Cost</p><p className="font-semibold text-[#2f211c]">{formatCurrency(editingItem.averageCost)}</p></div>
                  <div><p className="text-xs text-[#7c6b60]">Last Cost</p><p className="font-semibold text-[#2f211c]">{formatCurrency(editingItem.lastPurchaseCost)}</p></div>
                </div>
              </div>
            ) : null}
            <input required value={itemForm.nameAr} onChange={(event) => setItemForm({ ...itemForm, nameAr: event.target.value })} placeholder="اسم المادة" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
            <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
              <span>نوع المادة</span>
              <select required value={itemForm.itemType} onChange={(event) => setItemForm({ ...itemForm, itemType: event.target.value as InventoryItemType })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                {itemTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                <span>الوحدة الأساسية للمادة</span>
                <select required disabled={itemHasMovements} value={itemForm.baseUnitId} onChange={(event) => setItemForm({ ...itemForm, baseUnitId: event.target.value, openingUnitId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f] disabled:bg-[#f3eee8]">
                  {baseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
                </select>
                <span className="block text-xs font-normal leading-5 text-[#9a8779]">اختر غرام/كيلوغرام/مل/لتر/قطعة فقط. الصندوق والقنينة والباكيت تضاف من وحدات التعبئة أدناه لكل مادة.</span>
              </label>
              <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                <span>الحد الأدنى للمخزون</span>
                <input min="0" step="0.001" type="number" value={itemForm.minimumStock} onChange={(event) => setItemForm({ ...itemForm, minimumStock: event.target.value })} placeholder="الحد الأدنى للمخزون" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
                <span className="block text-xs font-normal leading-5 text-[#9a8779]">عند وصول الرصيد إلى هذه الكمية أو أقل، تظهر المادة ضمن تنبيهات المخزون.</span>
              </label>
            </div>
            {!editingItem ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                  <span>الكمية الموجودة حالياً في المخزن</span>
                  <input min="0" step="0.001" type="number" value={itemForm.openingQuantity} onChange={(event) => setItemForm({ ...itemForm, openingQuantity: event.target.value })} placeholder="الكمية الموجودة حالياً في المخزن" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
                  <span className="block text-xs font-normal leading-5 text-[#9a8779]">استخدم هذا الحقل فقط عند إضافة المادة لأول مرة إذا كان لديك رصيد موجود مسبقاً.</span>
                </label>
                <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                  <span>وحدة الكمية الحالية</span>
                  <select value={itemForm.openingUnitId} onChange={(event) => setItemForm({ ...itemForm, openingUnitId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                    {openingUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
                  </select>
                  <span className="block text-xs font-normal leading-5 text-[#9a8779]">يمكن أن تختلف عن الوحدة الأساسية، وسيقوم النظام بالتحويل تلقائياً.</span>
                  <span className="block text-xs font-normal leading-5 text-[#9a8779]">مثال: الوحدة الأساسية غرام، والكمية الحالية 10 كغم.</span>
                </label>
              </div>
            ) : null}
            {itemHasMovements ? <p className="text-xs text-[#9a8779]">لا يمكن تغيير الوحدة الأساسية بعد وجود حركات لهذه المادة.</p> : null}
            <div className="flex gap-2">
              <button disabled={isSaving} type="submit" className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34] disabled:opacity-60"><Save size={16} />حفظ</button>
              <button type="button" onClick={() => { setIsItemFormOpen(false); setEditingItem(null); }} className="flex h-11 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><X size={16} />إلغاء</button>
            </div>
            {editingItem ? (
              <section className="space-y-3 border-t border-[#eee4d8] pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#2f211c]">وحدات الشراء والتعبئة</h3>
                  <p className="mt-1 text-xs leading-5 text-[#9a8779]">الوحدة الأساسية: {editingItem.baseUnitName}. مثال: صندوق = 12 {editingItem.baseUnitName} أو باكيت = 1 {editingItem.baseUnitName}.</p>
                </div>
                <div className="space-y-2 rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
                  <input required list="inventory-packaging-unit-suggestions" value={conversionForm.packagingUnitNameAr} onChange={(event) => setConversionForm({ ...conversionForm, packagingUnitNameAr: event.target.value })} placeholder="اسم التعبئة، مثال: صندوق" className="h-10 w-full rounded-md border border-[#e4d8c8] bg-white px-3 text-sm outline-none focus:border-[#a65f3f]" />
                  <datalist id="inventory-packaging-unit-suggestions">
                    {packagingUnitSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
                  </datalist>
                  <input required min="0.001" step="0.001" type="number" value={conversionForm.quantityInBaseUnit} onChange={(event) => setConversionForm({ ...conversionForm, quantityInBaseUnit: event.target.value })} placeholder={`الكمية بـ ${editingItem.baseUnitName}`} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-white px-3 text-sm outline-none focus:border-[#a65f3f]" />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={isSaving} type="button" onClick={() => void submitConversion()} className="flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-3 text-sm font-semibold text-white disabled:opacity-60"><Save size={15} />{editingConversion ? "تعديل التعبئة" : "إضافة تعبئة"}</button>
                    {editingConversion ? <button type="button" onClick={resetConversionForm} className="h-10 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34]">إلغاء</button> : null}
                  </div>
                </div>
                <div className="divide-y divide-[#eee4d8] rounded-md border border-[#eee4d8]">
                  {editingItemConversions.length === 0 ? <p className="p-3 text-sm text-[#7c6b60]">لا توجد وحدات تعبئة لهذه المادة.</p> : null}
                  {editingItemConversions.map((conversion) => (
                    <div key={conversion.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div>
                        <p className="font-semibold text-[#2f211c]">{conversion.packagingUnitNameAr}</p>
                        <p className="text-xs text-[#7c6b60]">{formatQuantity(conversion.quantityInBaseUnit, editingItem.baseUnitCode)}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => editConversion(conversion)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تعديل"><Edit3 size={15} /></button>
                        <button type="button" onClick={() => void deactivateConversion(conversion)} className="rounded-md border border-[#e4d8c8] p-2 text-rose-700 hover:bg-rose-50" title="تعطيل"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </form>
          </div>
          ) : null}
        </div>
      ) : null}

      {!isLoading && activeTab === "movements" ? (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4d8c8] bg-[#fbfaf7] px-3 py-2">
              <div>
                <h2 className="font-semibold text-[#2f211c]">الحركات | {formatNumber(filteredMovements.length)} حركة</h2>
                <p className="mt-1 text-xs text-[#7c6b60]">كل حركة تظهر قبل/بعد الرصيد إذا كانت محفوظة في قاعدة البيانات.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" />
                  <input value={movementSearch} onChange={(event) => setMovementSearch(event.target.value)} placeholder="بحث مادة / ملاحظة / رقم" className="h-9 w-56 rounded-md border border-[#e4d8c8] bg-white pr-8 pl-3 text-sm outline-none focus:border-[#a65f3f]" />
                </div>
                <input type="date" value={movementDateFrom} onChange={(event) => setMovementDateFrom(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm" title="من تاريخ" />
                <input type="date" value={movementDateTo} onChange={(event) => setMovementDateTo(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm" title="إلى تاريخ" />
                <select value={movementItemFilter} onChange={(event) => setMovementItemFilter(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
                <option value="all">كل المواد</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
              </select>
                <select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value as InventoryAuditMovementType | "all")} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
                <option value="all">كل الحركات</option>
                  {(["opening_balance", "adjustment_in", "adjustment_out", "purchase", "consumption", "waste", "department_waste", "return", "stock_issue"] as InventoryAuditMovementType[]).map((type) => <option key={type} value={type}>{movementLabels[type]}</option>)}
              </select>
                <select value={movementDirectionFilter} onChange={(event) => setMovementDirectionFilter(event.target.value as MovementDirectionFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
                  <option value="all">داخل / خارج</option>
                  <option value="in">داخل</option>
                  <option value="out">خارج</option>
                </select>
                <select value={movementSourceFilter} onChange={(event) => setMovementSourceFilter(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
                  <option value="all">كل المصادر</option>
                  {movementSourceOptions.map((source) => <option key={source} value={source}>{movementSourceLabel(source)}</option>)}
                </select>
                <select value={movementDestinationFilter} onChange={(event) => setMovementDestinationFilter(event.target.value as MovementDestinationFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
                  <option value="all">كل الأقسام</option>
                  {(Object.keys(destinationLabels) as InventoryRequisitionDestination[]).map((destination) => (
                    <option key={destination} value={destination}>{destinationLabels[destination]}</option>
                  ))}
                </select>
                <input value={movementUserFilter} onChange={(event) => setMovementUserFilter(event.target.value)} placeholder="المستخدم" className="h-9 w-32 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm outline-none focus:border-[#a65f3f]" />
                <button type="button" onClick={() => void loadData()} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]"><RefreshCw size={15} />تحديث</button>
              </div>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
                <tr>
                  <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">الوقت</th>
                  <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">رقم الحركة</th>
                  <th className="sticky right-0 z-30 w-44 border-l border-white/15 bg-[#2b2421] px-3 py-2 text-right font-semibold">المادة</th>
                  <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">نوع الحركة</th>
                  <th className="w-20 border-l border-white/15 px-2 py-2 text-right font-semibold">داخل/خارج</th>
                  <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">الكمية</th>
                  <th className="w-16 border-l border-white/15 px-2 py-2 text-right font-semibold">الوحدة</th>
                  <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">قبل</th>
                  <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">بعد</th>
                  <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">المصدر</th>
                  <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">رقم المصدر</th>
                  <th className="w-28 border-l border-white/15 px-2 py-2 text-right font-semibold">المستخدم</th>
                  <th className="w-24 border-l border-white/15 px-2 py-2 text-right font-semibold">القسم</th>
                  <th className="w-28 px-2 py-2 text-right font-semibold">المرجع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDateTime(movement.createdAt)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]" dir="ltr">{movement.id.slice(0, 8)}</td>
                    <td className="sticky right-0 z-10 truncate border-l border-[#d5c2af] bg-inherit px-3 py-2 font-semibold text-[#1f1713]" title={movement.inventoryItemName}>{movement.inventoryItemName}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{movementLabels[movement.movementType]}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2">
                      <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${movement.quantityDelta >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{movement.quantityDelta >= 0 ? "داخل" : "خارج"}</span>
                    </td>
                    <td className={`border-l border-[#f0e5da] px-3 py-2 font-bold ${movement.quantityDelta > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatQuantity(movement.quantityDelta, movement.baseUnitCode)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{movement.baseUnitCode}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{movement.isStockAffecting && typeof movement.quantityBefore === "number" ? formatQuantity(movement.quantityBefore, movement.baseUnitCode) : "لا يؤثر على رصيد المخزن"}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{movement.isStockAffecting && typeof movement.quantityAfter === "number" ? formatQuantity(movement.quantityAfter, movement.baseUnitCode) : "لا يؤثر على رصيد المخزن"}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{movementSourceLabel(movement.sourceType)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]" dir="ltr">{textOrDash(movement.orderNumber ?? movement.requisitionCode ?? movement.wasteCode)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{movement.createdByName ?? "-"}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#5d4032]">{movement.destination ? destinationLabels[movement.destination] : "-"}</td>
                    <td className="px-3 py-2 text-[#5d4032]" title={movement.notes ?? ""}>{textOrDash(movement.requisitionCode ?? movement.wasteCode ?? movement.notes)}</td>
                  </tr>
                ))}
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-sm text-[#4a3b34]">لا توجد حركات مخزون مطابقة للفلاتر الحالية</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "recipes" ? (
        <div className="space-y-4">
          <SectionHeader title="الوصفات" subtitle="إعداد وصفات المنيو وربطها بخصم المخزون">
            <select value={recipeStationFilter} onChange={(event) => setRecipeStationFilter(event.target.value as RecipeStationFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
              <option value="all">كل المحطات</option>
              {(Object.keys(recipeStationLabels) as RecipeSummary["preparationStation"][]).map((station) => (
                <option key={station} value={station}>{recipeStationLabels[station]}</option>
              ))}
            </select>
          </SectionHeader>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
            <div className="border-b border-[#e4d8c8] p-4"><div className="flex items-center gap-2"><CookingPot size={18} className="text-[#a65f3f]" /><h2 className="font-semibold text-[#2f211c]">وصفات المنيو</h2></div></div>
            <div className="divide-y divide-[#eee4d8]">
              {filteredRecipeSummaries.map((summary) => (
                <div key={summary.menuItemId} className="grid gap-3 p-4 text-sm hover:bg-[#fffaf4] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#2f211c]">{summary.menuItemName}</h3>
                      <span className="rounded-md border border-[#d8c6b5] bg-[#fff8f0] px-2 py-1 text-xs font-semibold text-[#5d4032]">{recipeStationLabels[summary.preparationStation]}</span>
                      {summary.recipeId && summary.ingredientCount > 0 ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">الوصفة جاهزة</span>
                      ) : (
                        <span className="rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-2 py-1 text-xs font-semibold text-[#7c6b60]">غير معدة</span>
                      )}
                      <span className="rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-2 py-1 text-xs font-semibold text-[#4a3b34]">{formatNumber(summary.ingredientCount)} مكونات</span>
                      {summary.inventoryTrackingEnabled ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">الخصم مفعّل</span>
                      ) : (
                        <span className="rounded-md border border-[#e4d8c8] bg-white px-2 py-1 text-xs font-semibold text-[#7c6b60]">الخصم غير مفعّل</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[#7c6b60]">
                      <span>{summary.sellingPrice > 0 ? formatCurrency(summary.sellingPrice) : "السعر غير محدد"}</span>
                      <span>تكلفة المواد {formatCurrency(summary.estimatedCost)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void toggleRecipeTracking(summary)}
                      className={`rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-60 ${
                        summary.inventoryTrackingEnabled
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"
                      }`}
                    >
                      خصم المخزون تلقائياً: {summary.inventoryTrackingEnabled ? "مفعّل" : "غير مفعّل"}
                    </button>
                    <button type="button" onClick={() => void openRecipe(summary.menuItemId)} className="rounded-md border border-[#e4d8c8] px-3 py-2 text-xs font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">إعداد الوصفة</button>
                  </div>
                </div>
              ))}
              {filteredRecipeSummaries.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد وصفات مطابقة للمحطة المحددة.</p> : null}
            </div>
          </section>

          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            {!activeRecipe ? <p className="text-sm text-[#7c6b60]">اختر صنفاً من القائمة لإعداد الوصفة.</p> : null}
            {activeRecipe ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[#7c6b60]">Recipe v{activeRecipe.version}</p>
                  <h2 className="text-lg font-semibold text-[#2f211c]">{activeRecipe.menuItemName}</h2>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-md bg-[#f8f3ed] p-3"><p className="text-[#7c6b60]">تكلفة المواد</p><p className="font-semibold">{formatCurrency(activeRecipe.estimatedCost)}</p></div>
                  <div className="rounded-md bg-[#f8f3ed] p-3"><p className="text-[#7c6b60]">سعر البيع</p><p className="font-semibold">{formatCurrency(activeRecipe.sellingPrice)}</p></div>
                  <div className="rounded-md bg-[#f8f3ed] p-3"><p className="text-[#7c6b60]">Food Cost</p><p className="font-semibold">{activeRecipe.sellingPrice > 0 ? `${formatNumber((activeRecipe.estimatedCost / activeRecipe.sellingPrice) * 100)}%` : "0%"}</p></div>
                </div>
                <form onSubmit={submitRecipeItem} className="space-y-3 rounded-md border border-[#eee4d8] p-3">
                  <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                    <span>المادة</span>
                    <select required value={recipeItemForm.inventoryItemId} onChange={(event) => setRecipeItemForm({ ...recipeItemForm, inventoryItemId: event.target.value, unitId: items.find((item) => item.id === event.target.value)?.baseUnitId ?? "" })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal">
                      <option value="">اختر مادة</option>
                      {activeItems.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={openQuickItemDialog} className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]"><Plus size={15} />إضافة مادة جديدة</button>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1 text-sm font-medium text-[#4a3b34] sm:col-span-1">
                      <span>الكمية المستخدمة</span>
                      <input required min="0.001" step="0.001" type="number" value={recipeItemForm.quantity} onChange={(event) => setRecipeItemForm({ ...recipeItemForm, quantity: event.target.value })} placeholder="الكمية المستخدمة" className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal" />
                      <span className="block text-xs font-normal leading-5 text-[#9a8779]">الكمية التي يستهلكها تحضير وجبة واحدة من هذا الصنف.</span>
                    </label>
                    <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                      <span>الوحدة</span>
                      <select required value={recipeItemForm.unitId} onChange={(event) => setRecipeItemForm({ ...recipeItemForm, unitId: event.target.value })} className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal">
                        <option value="">الوحدة</option>
                        {recipeUnitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                      <span>الهدر</span>
                      <input min="0" max="99" step="0.01" type="number" value={recipeItemForm.wastePercent} onChange={(event) => setRecipeItemForm({ ...recipeItemForm, wastePercent: event.target.value })} placeholder="هدر %" className="h-10 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal" />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={isSaving} type="submit" className="flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-3 text-sm font-semibold text-white disabled:opacity-60"><Plus size={15} />{editingRecipeItem ? "تحديث" : "إضافة"}</button>
                    {editingRecipeItem ? <button type="button" onClick={() => { setEditingRecipeItem(null); setRecipeItemForm(emptyRecipeItemForm); }} className="h-10 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34]">إلغاء</button> : null}
                  </div>
                </form>
                <div className="divide-y divide-[#eee4d8]">
                  {activeRecipe.items.length === 0 ? <p className="py-5 text-center text-sm text-[#7c6b60]">لا توجد مكونات لهذه الوصفة</p> : null}
                  {activeRecipe.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                      <div>
                        <p className="font-medium text-[#2f211c]">{item.inventoryItemName}</p>
                        <p className="text-[#7c6b60]">{formatQuantity(item.quantity, item.unitCode)} {item.wastePercent > 0 ? `+ هدر ${formatNumber(item.wastePercent)}%` : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => editRecipeItem(item)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تعديل"><Edit3 size={15} /></button>
                        <button type="button" onClick={() => void removeRecipeItem(item.id)} className="rounded-md border border-[#e4d8c8] p-2 text-rose-700 hover:bg-rose-50" title="حذف"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          </div>
        </div>
      ) : null}

      {isQuickItemDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={submitQuickItem} className="w-full max-w-md space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PackagePlus size={18} className="text-[#a65f3f]" />
                <h2 className="font-semibold text-[#2f211c]">إضافة مادة جديدة</h2>
              </div>
              <button type="button" onClick={() => setIsQuickItemDialogOpen(false)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]"><X size={16} /></button>
            </div>
            <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
              <span>اسم المادة</span>
              <input required value={quickItemForm.nameAr} onChange={(event) => setQuickItemForm({ ...quickItemForm, nameAr: event.target.value })} placeholder="مثال: عدس" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
              <span>نوع المادة</span>
              <select required value={quickItemForm.itemType} onChange={(event) => setQuickItemForm({ ...quickItemForm, itemType: event.target.value as InventoryItemType })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                {itemTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
              <span>الوحدة الأساسية للمادة</span>
              <select required value={quickItemForm.baseUnitId} onChange={(event) => setQuickItemForm({ ...quickItemForm, baseUnitId: event.target.value, openingUnitId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                {baseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
              <span>الحد الأدنى للمخزون اختياري</span>
              <input min="0" step="0.001" type="number" value={quickItemForm.minimumStock} onChange={(event) => setQuickItemForm({ ...quickItemForm, minimumStock: event.target.value })} placeholder="0" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                <span>الكمية الموجودة حالياً بالمخزن اختياري</span>
                <input min="0" step="0.001" type="number" value={quickItemForm.openingQuantity} onChange={(event) => setQuickItemForm({ ...quickItemForm, openingQuantity: event.target.value })} placeholder="مثال: 10" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]" />
              </label>
              <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                <span>وحدة الكمية الحالية</span>
                <select value={quickItemForm.openingUnitId} onChange={(event) => setQuickItemForm({ ...quickItemForm, openingUnitId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f]">
                  {quickOpeningUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button disabled={isSaving} type="submit" className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34] disabled:opacity-60"><Save size={16} />حفظ واختيار المادة</button>
              <button type="button" onClick={() => setIsQuickItemDialogOpen(false)} className="h-11 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">إلغاء</button>
            </div>
          </form>
        </div>
      ) : null}

      {adjustingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={submitAdjustment} className="w-full max-w-md space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-[#2f211c]">تسوية {adjustingItem.nameAr}</h2>
              <button type="button" onClick={() => setAdjustingItem(null)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]"><X size={16} /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input required step="0.001" type="number" value={adjustmentForm.quantityDelta} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, quantityDelta: event.target.value })} placeholder="+2 أو -500" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
              <select required value={adjustmentForm.unitId} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, unitId: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
                {getCompatibleUnits(adjustingItem, units).map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
              </select>
            </div>
            <textarea required value={adjustmentForm.notes} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, notes: event.target.value })} placeholder="سبب التسوية" className="min-h-24 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#a65f3f]" />
            <button disabled={isSaving} type="submit" className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} />تسجيل التسوية</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
