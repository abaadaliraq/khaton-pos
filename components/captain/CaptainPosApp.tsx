"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CaptainHeader } from "@/components/captain/CaptainHeader";
import { CategoryTabs } from "@/components/captain/CategoryTabs";
import { OrderPanel } from "@/components/captain/OrderPanel";
import { ProductGrid } from "@/components/captain/ProductGrid";
import { SendOrderDialog } from "@/components/captain/SendOrderDialog";
import { TableSelector } from "@/components/captain/TableSelector";
import { signOut } from "@/services/authService";
import { getMenuCatalog } from "@/services/menuService";
import { createRestaurantOrder } from "@/services/orderService";
import { getRestaurantTables } from "@/services/tableService";
import type { Category, MenuItem, OrderItem, RestaurantTable } from "@/types/pos";

function getBaghdadTime() {
  return new Intl.DateTimeFormat("ar-IQ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Baghdad",
  }).format(new Date());
}

export function CaptainPosApp() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState<Category[]>([{ id: "all", name: "الكل" }]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [isSendingOrder, setIsSendingOrder] = useState(false);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setCurrentTime(getBaghdadTime()), 0);
    const timer = window.setInterval(() => setCurrentTime(getBaghdadTime()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [catalog, restaurantTables] = await Promise.all([getMenuCatalog(), getRestaurantTables()]);

        if (!isMounted) {
          return;
        }

        setCategories(catalog.categories);
        setMenuItems(catalog.menuItems);
        setTables(restaurantTables);
        setSelectedTable(restaurantTables[0] ?? null);
      } catch (error) {
        console.error("Failed to load captain data", error);

        if (isMounted) {
          setLoadError("تعذر تحميل المنيو والطاولات من Supabase.");
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return menuItems.filter((item) => {
      const categoryMatches = activeCategory === "all" || item.categoryId === activeCategory;
      const searchMatches =
        normalizedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description?.toLowerCase().includes(normalizedSearch);

      return categoryMatches && searchMatches;
    });
  }, [activeCategory, menuItems, searchTerm]);

  const subtotal = useMemo(
    () => orderItems.reduce((total, orderItem) => total + orderItem.item.price * orderItem.quantity, 0),
    [orderItems],
  );

  const itemCount = useMemo(() => orderItems.reduce((total, orderItem) => total + orderItem.quantity, 0), [orderItems]);

  function addItem(item: MenuItem) {
    if (item.price <= 0) {
      return;
    }

    setOrderItems((currentItems) => {
      const existingItem = currentItems.find((orderItem) => orderItem.item.id === item.id);

      if (existingItem) {
        return currentItems.map((orderItem) =>
          orderItem.item.id === item.id ? { ...orderItem, quantity: orderItem.quantity + 1 } : orderItem,
        );
      }

      return [...currentItems, { item, quantity: 1, note: "" }];
    });
  }

  function updateQuantity(itemId: string, direction: "increase" | "decrease") {
    setOrderItems((currentItems) =>
      currentItems.map((orderItem) => {
        if (orderItem.item.id !== itemId) {
          return orderItem;
        }

        const nextQuantity = direction === "increase" ? orderItem.quantity + 1 : Math.max(1, orderItem.quantity - 1);
        return { ...orderItem, quantity: nextQuantity };
      }),
    );
  }

  function removeItem(itemId: string) {
    setOrderItems((currentItems) => currentItems.filter((orderItem) => orderItem.item.id !== itemId));
    setNoteItemId((currentNoteItemId) => (currentNoteItemId === itemId ? null : currentNoteItemId));
  }

  function updateNote(itemId: string, note: string) {
    setOrderItems((currentItems) =>
      currentItems.map((orderItem) => (orderItem.item.id === itemId ? { ...orderItem, note } : orderItem)),
    );
  }

  async function confirmSendOrder() {
    if (!selectedTable || orderItems.length === 0 || isSendingOrder) {
      return;
    }

    setIsSendingOrder(true);
    setLoadError("");

    try {
      await createRestaurantOrder({
        table: selectedTable,
        items: orderItems,
      });

      const restaurantTables = await getRestaurantTables();
      setTables(restaurantTables);
      setSelectedTable((currentTable) => {
        if (!currentTable) {
          return restaurantTables[0] ?? null;
        }

        return restaurantTables.find((table) => table.id === currentTable.id) ?? restaurantTables[0] ?? null;
      });
      setIsSendDialogOpen(false);
      setIsOrderSheetOpen(false);
      setOrderItems([]);
      setNoteItemId(null);
      setSuccessMessage("تم إرسال طلب الطاولة بنجاح");
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch (error) {
      console.error("Failed to submit order", error);
      setLoadError("تعذر إرسال الطلب إلى Supabase.");
    } finally {
      setIsSendingOrder(false);
    }
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f4ed] text-stone-950">
      <CaptainHeader currentTime={currentTime} onLogout={logout} />

      <main className="mx-auto grid max-w-7xl gap-4 px-4 pb-24 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-6">
        <div className="min-w-0 space-y-4">
          <TableSelector
            tables={tables}
            selectedTable={selectedTable}
            isOpen={isTableSelectorOpen}
            onOpen={() => setIsTableSelectorOpen(true)}
            onClose={() => setIsTableSelectorOpen(false)}
            onSelect={setSelectedTable}
          />

          {loadError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
              {loadError}
            </div>
          ) : null}

          <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث عن صنف..."
                className="h-12 w-full rounded-lg border border-stone-200 bg-[#fbfaf6] pr-10 pl-12 text-sm outline-none transition placeholder:text-stone-400 focus:border-[#4c5a35] focus:bg-white"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
                  aria-label="مسح البحث"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-3 shadow-sm">
            <CategoryTabs categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} />
          </section>

          <ProductGrid items={filteredItems} onAdd={addItem} />
        </div>

        <OrderPanel
          orderItems={orderItems}
          selectedTable={selectedTable}
          subtotal={subtotal}
          itemCount={itemCount}
          isMobileOpen={isOrderSheetOpen}
          noteItemId={noteItemId}
          onMobileOpen={() => setIsOrderSheetOpen(true)}
          onMobileClose={() => setIsOrderSheetOpen(false)}
          onIncrease={(itemId) => updateQuantity(itemId, "increase")}
          onDecrease={(itemId) => updateQuantity(itemId, "decrease")}
          onRemove={removeItem}
          onToggleNote={(itemId) => setNoteItemId((currentItemId) => (currentItemId === itemId ? null : itemId))}
          onNoteChange={updateNote}
          onSend={() => setIsSendDialogOpen(true)}
        />
      </main>

      {successMessage ? (
        <div className="fixed left-4 right-4 top-20 z-[70] mx-auto max-w-md rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center font-bold text-emerald-800 shadow-sm">
          {successMessage}
        </div>
      ) : null}

      <SendOrderDialog
        isOpen={isSendDialogOpen}
        selectedTable={selectedTable}
        itemCount={itemCount}
        subtotal={subtotal}
        onClose={() => setIsSendDialogOpen(false)}
        onConfirm={confirmSendOrder}
      />
    </div>
  );
}
