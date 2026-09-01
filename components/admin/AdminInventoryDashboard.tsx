"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ClipboardList, CookingPot, Edit3, PackagePlus, Plus, RefreshCw, Save, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { ManagementTabs } from "@/components/ui/ManagementTabs";
import {
  adjustInventoryStock,
  createInventoryItem,
  getInventoryOverview,
  updateInventoryItem,
  type AdjustInventoryInput,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
} from "@/services/inventoryService";
import { createClient } from "@/lib/supabase/client";
import { PurchaseRequestsPanel } from "@/components/inventory/PurchaseRequestsPanel";
import { deleteRecipeItem, getActiveRecipe, getCompatibleUnits, getOrCreateActiveRecipe, getRecipeSummaries, updateMenuItemInventoryTracking, upsertRecipeItem } from "@/services/recipeService";
import { formatCurrency } from "@/lib/formatCurrency";
import type { ActiveRecipe, InventoryItem, InventoryMovement, InventoryMovementType, InventoryUnit, RecipeItem, RecipeSummary } from "@/types/inventory";

type ActiveTab = "overview" | "items" | "purchaseRequests" | "receiving" | "movements" | "recipes";
type StockFilter = "all" | "low" | "out";

const movementLabels: Record<InventoryMovementType, string> = {
  opening_balance: "رصيد افتتاحي",
  adjustment_in: "تسوية إضافة",
  adjustment_out: "تسوية إخراج",
  purchase: "شراء",
  consumption: "استهلاك",
  waste: "هدر",
  return: "مرتجع",
};

const tabs: { id: ActiveTab; label: string }[] = [
  { id: "overview", label: "الملخص" },
  { id: "items", label: "المواد" },
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
  nameEn: "",
  baseUnitId: "",
  minimumStock: "0",
  openingQuantity: "",
  openingUnitId: "",
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

function InventoryStat({ title, value, helper, onClick }: { title: string; value: string; helper: string; onClick?: () => void }) {
  const className = "rounded-md border border-[#e4d8c8] bg-white p-4 text-right shadow-sm";
  const content = (
    <>
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2f211c]">{value}</p>
      <p className="mt-1 text-xs text-[#9a8779]">{helper}</p>
    </>
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

export function AdminInventoryDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
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
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustmentForm);
  const [itemStockFilter, setItemStockFilter] = useState<StockFilter>("all");
  const [movementItemFilter, setMovementItemFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryMovementType | "all">("all");
  const [recipeItemForm, setRecipeItemForm] = useState(emptyRecipeItemForm);
  const [isQuickItemDialogOpen, setIsQuickItemDialogOpen] = useState(false);
  const [quickItemForm, setQuickItemForm] = useState(emptyQuickItemForm);
  const realtimeReloadTimerRef = useRef<number | null>(null);

  const baseUnits = useMemo(() => units.filter((unit) => unit.isBaseUnit), [units]);
  const selectedBaseUnit = units.find((unit) => unit.id === itemForm.baseUnitId);
  const openingUnits = selectedBaseUnit ? units.filter((unit) => unit.family === selectedBaseUnit.family) : [];
  const selectedQuickBaseUnit = units.find((unit) => unit.id === quickItemForm.baseUnitId);
  const quickOpeningUnits = selectedQuickBaseUnit ? units.filter((unit) => unit.family === selectedQuickBaseUnit.family) : [];
  const activeItems = items.filter((item) => item.isActive);
  const lowStockItems = activeItems.filter((item) => item.stockOnHand > 0 && item.stockOnHand <= item.minimumStock);
  const outOfStockItems = activeItems.filter((item) => item.stockOnHand === 0);
  const filteredItems =
    itemStockFilter === "low"
      ? lowStockItems
      : itemStockFilter === "out"
        ? outOfStockItems
        : items;
  const inventoryValue = items.reduce((total, item) => total + item.stockOnHand * item.averageCost, 0);
  const selectedRecipeItem = items.find((item) => item.id === recipeItemForm.inventoryItemId);
  const recipeUnitOptions = useMemo(
    () => (selectedRecipeItem ? getCompatibleUnits(selectedRecipeItem, units) : []),
    [selectedRecipeItem, units],
  );
  const itemHasMovements = editingItem ? movements.some((movement) => movement.inventoryItemId === editingItem.id) : false;

  const filteredMovements = movements.filter((movement) => {
    const itemMatches = movementItemFilter === "all" || movement.inventoryItemId === movementItemFilter;
    const typeMatches = movementTypeFilter === "all" || movement.movementType === movementTypeFilter;
    return itemMatches && typeMatches;
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [inventoryData, recipesData] = await Promise.all([getInventoryOverview(), getRecipeSummaries()]);
      setUnits(inventoryData.units);
      setItems(inventoryData.items);
      setMovements(inventoryData.movements);
      setRecipeSummaries(recipesData);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, scheduleReload)
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
    setItemForm({ ...emptyItemForm, baseUnitId: firstBaseUnit?.id ?? "", openingUnitId: firstBaseUnit?.id ?? "" });
  }

  function startEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemForm({
      nameAr: item.nameAr,
      nameEn: item.nameEn ?? "",
      baseUnitId: item.baseUnitId,
      minimumStock: String(item.minimumStock),
      openingQuantity: "",
      openingUnitId: item.baseUnitId,
    });
    setActiveTab("items");
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
          nameEn: itemForm.nameEn,
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
          nameEn: itemForm.nameEn,
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
      await updateInventoryItem({ ...item, id: item.id, nameAr: item.nameAr, nameEn: item.nameEn, baseUnitId: item.baseUnitId, minimumStock: item.minimumStock, isActive: !item.isActive });
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
    <div className="space-y-5">
      <DashboardHero
        className="-mx-4 lg:-ml-6 lg:mr-0"
        image="/images/dashboard/inventory-dashboard-hero.jpg"
        eyebrow="Inventory Control"
        title="إدارة المخزن"
        description="المخزون والمشتريات وحركة المواد"
      />

      <section className="flex justify-end">
        <button type="button" onClick={() => void loadData()} className="flex h-11 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">
          <RefreshCw size={17} />
          تحديث
        </button>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <ManagementTabs tabs={tabs} activeTab={activeTab} onChange={selectTab} ariaLabel="أقسام إدارة المخزن" />

      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-6 text-sm text-[#7c6b60] shadow-sm">جارٍ تحميل بيانات المخزن...</div> : null}

      {!isLoading && activeTab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InventoryStat title="إجمالي المواد" value={formatNumber(activeItems.length)} helper="المواد النشطة فقط" />
            <InventoryStat title="مواد منخفضة" value={formatNumber(lowStockItems.length)} helper="اضغط لعرض المواد المنخفضة فقط" onClick={() => openFilteredItems("low")} />
            <InventoryStat title="مواد نفدت" value={formatNumber(outOfStockItems.length)} helper="اضغط لعرض المواد النافدة فقط" onClick={() => openFilteredItems("out")} />
            <InventoryStat title="قيمة المخزون" value={formatCurrency(inventoryValue)} helper="حسب متوسط التكلفة الحالي" />
          </div>
          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Boxes size={18} className="text-[#a65f3f]" />
              <h2 className="font-semibold text-[#2f211c]">تنبيهات المخزون</h2>
            </div>
            {lowStockItems.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد مواد منخفضة حالياً</p> : null}
            <div className="divide-y divide-[#eee4d8]">
              {lowStockItems.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-medium text-[#2f211c]">{item.nameAr}</span>
                  <span className="text-[#7c6b60]">{formatQuantity(item.stockOnHand, item.baseUnitCode)} / حد أدنى {formatQuantity(item.minimumStock, item.baseUnitCode)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "purchaseRequests" ? (
        <PurchaseRequestsPanel mode="requests" items={items} units={units} onInventoryChanged={loadData} />
      ) : null}

      {!isLoading && activeTab === "receiving" ? (
        <PurchaseRequestsPanel mode="receiving" items={items} units={units} onInventoryChanged={loadData} />
      ) : null}

      {!isLoading && activeTab === "items" ? (
        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={submitItem} className="space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <PackagePlus size={18} className="text-[#a65f3f]" />
              <h2 className="font-semibold text-[#2f211c]">{editingItem ? "تعديل مادة" : "إضافة مادة"}</h2>
            </div>
            <input required value={itemForm.nameAr} onChange={(event) => setItemForm({ ...itemForm, nameAr: event.target.value })} placeholder="اسم المادة" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
            <input value={itemForm.nameEn} onChange={(event) => setItemForm({ ...itemForm, nameEn: event.target.value })} placeholder="الاسم الإنجليزي اختياري" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-[#4a3b34]">
                <span>الوحدة الأساسية للمادة</span>
                <select required disabled={itemHasMovements} value={itemForm.baseUnitId} onChange={(event) => setItemForm({ ...itemForm, baseUnitId: event.target.value, openingUnitId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal outline-none focus:border-[#a65f3f] disabled:bg-[#f3eee8]">
                  {baseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.nameAr}</option>)}
                </select>
                <span className="block text-xs font-normal leading-5 text-[#9a8779]">الوحدة التي يعتمدها النظام داخلياً في الوصفات وحساب المخزون.</span>
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
              {editingItem ? <button type="button" onClick={resetItemForm} className="flex h-11 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><X size={16} />إلغاء</button> : null}
            </div>
          </form>

          <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4d8c8] bg-[#fbfaf7] p-4">
              <div>
                <h2 className="font-semibold text-[#2f211c]">قائمة المواد</h2>
                <p className="mt-1 text-xs text-[#7c6b60]">
                  {itemStockFilter === "low" ? "عرض المواد المنخفضة فقط" : itemStockFilter === "out" ? "عرض المواد النافدة فقط" : "عرض كل المواد"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <button type="button" onClick={() => setItemStockFilter("all")} className={`rounded-md border px-3 py-2 ${itemStockFilter === "all" ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>كل المواد</button>
                <button type="button" onClick={() => setItemStockFilter("low")} className={`rounded-md border px-3 py-2 ${itemStockFilter === "low" ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>مواد منخفضة</button>
                <button type="button" onClick={() => setItemStockFilter("out")} className={`rounded-md border px-3 py-2 ${itemStockFilter === "out" ? "border-[#ff5656] bg-[#ff5656] text-white" : "border-[#e4d8c8] bg-white text-[#4a3b34] hover:bg-[#f5eee6]"}`}>مواد نافدة</button>
              </div>
            </div>
            {filteredItems.length === 0 ? <div className="p-8 text-center text-sm text-[#7c6b60]">لا توجد مواد مطابقة لهذا العرض</div> : null}
            {filteredItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full border-collapse text-sm">
                  <thead className="bg-[#f5eee6] text-[#4a3b34]">
                    <tr>
                      <th className="px-3 py-3 text-right font-semibold">المادة</th>
                      <th className="px-3 py-3 text-right font-semibold">الرصيد</th>
                      <th className="px-3 py-3 text-right font-semibold">الحد الأدنى</th>
                      <th className="px-3 py-3 text-right font-semibold">Average Cost</th>
                      <th className="px-3 py-3 text-right font-semibold">Last Cost</th>
                      <th className="px-3 py-3 text-right font-semibold">الحالة</th>
                      <th className="px-3 py-3 text-right font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee4d8]">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#fffaf4]">
                        <td className="px-3 py-3 font-medium text-[#2f211c]">{item.nameAr}</td>
                        <td className="px-3 py-3 text-[#4a3b34]">{formatQuantity(item.stockOnHand, item.baseUnitCode)}</td>
                        <td className="px-3 py-3 text-[#4a3b34]">{formatQuantity(item.minimumStock, item.baseUnitCode)}</td>
                        <td className="px-3 py-3 text-[#4a3b34]">{formatCurrency(item.averageCost)}</td>
                        <td className="px-3 py-3 text-[#4a3b34]">{formatCurrency(item.lastPurchaseCost)}</td>
                        <td className="px-3 py-3">{item.isActive ? <span className="text-emerald-700">نشطة</span> : <span className="text-[#9a8779]">متوقفة</span>}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => startEditItem(item)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تعديل"><Edit3 size={15} /></button>
                            <button type="button" onClick={() => openAdjustment(item)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تسوية"><SlidersHorizontal size={15} /></button>
                            <button type="button" onClick={() => void toggleItemStatus(item)} className="rounded-md border border-[#e4d8c8] px-3 py-2 text-xs text-[#4a3b34] hover:bg-[#f5eee6]">{item.isActive ? "إيقاف" : "تفعيل"}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "movements" ? (
        <section className="space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ClipboardList size={18} className="text-[#a65f3f]" /><h2 className="font-semibold text-[#2f211c]">حركات المخزون</h2></div>
            <div className="flex flex-wrap gap-2">
              <select value={movementItemFilter} onChange={(event) => setMovementItemFilter(event.target.value)} className="h-10 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
                <option value="all">كل المواد</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
              </select>
              <select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value as InventoryMovementType | "all")} className="h-10 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
                <option value="all">كل الحركات</option>
                {(["opening_balance", "adjustment_in", "adjustment_out", "purchase", "consumption"] as InventoryMovementType[]).map((type) => <option key={type} value={type}>{movementLabels[type]}</option>)}
              </select>
            </div>
          </div>
          {filteredMovements.length === 0 ? <p className="p-5 text-center text-sm text-[#7c6b60]">لا توجد حركات مخزون حتى الآن</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="bg-[#f5eee6] text-[#4a3b34]">
                <tr>
                  <th className="px-3 py-3 text-right font-semibold">المادة</th>
                  <th className="px-3 py-3 text-right font-semibold">النوع</th>
                  <th className="px-3 py-3 text-right font-semibold">الكمية</th>
                  <th className="px-3 py-3 text-right font-semibold">قبل / بعد</th>
                  <th className="px-3 py-3 text-right font-semibold">الملاحظات</th>
                  <th className="px-3 py-3 text-right font-semibold">الموظف</th>
                  <th className="px-3 py-3 text-right font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee4d8]">
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-[#fffaf4]">
                    <td className="px-3 py-3 font-medium text-[#2f211c]">{movement.inventoryItemName}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{movementLabels[movement.movementType]}</td>
                    <td className={`px-3 py-3 font-semibold ${movement.quantityDelta > 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatQuantity(movement.quantityDelta, movement.baseUnitCode)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatQuantity(movement.quantityBefore, movement.baseUnitCode)} / {formatQuantity(movement.quantityAfter, movement.baseUnitCode)}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{movement.notes ?? "-"}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{movement.createdByName ?? "-"}</td>
                    <td className="px-3 py-3 text-[#4a3b34]">{formatDateTime(movement.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "recipes" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
            <div className="border-b border-[#e4d8c8] p-4"><div className="flex items-center gap-2"><CookingPot size={18} className="text-[#a65f3f]" /><h2 className="font-semibold text-[#2f211c]">وصفات المنيو</h2></div></div>
            <div className="divide-y divide-[#eee4d8]">
              {recipeSummaries.map((summary) => (
                <div key={summary.menuItemId} className="grid gap-3 p-4 text-sm hover:bg-[#fffaf4] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#2f211c]">{summary.menuItemName}</h3>
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
