"use client";

import { Edit2, Loader2, Plus, Save, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { logSupabaseError } from "@/lib/supabaseError";
import { createMenuCategory, createMenuItem, getAdminMenu, updateMenuCategory, updateMenuItem } from "@/services/adminMenuService";
import type { AdminMenuCategory, AdminMenuItem, MenuCategoryInput, MenuItemInput } from "@/types/adminMenu";

type AvailabilityFilter = "all" | "active" | "inactive";

const stationLabels: Record<AdminMenuItem["preparationStation"], string> = {
  kitchen: "المطبخ",
  barista: "البار",
  drinks: "المشروبات",
  shisha: "النركيلة",
};

const emptyCategory: MenuCategoryInput = { nameAr: "", nameEn: "", sortOrder: 0, isActive: true };
const emptyItem: MenuItemInput = {
  categoryId: "",
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  price: 0,
  preparationStation: "kitchen",
  isAvailable: true,
  sortOrder: 0,
};

function itemIsSellable(item: AdminMenuItem) {
  return item.isAvailable && Number(item.price ?? 0) > 0;
}

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<AdminMenuCategory[]>([]);
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminMenuCategory | null>(null);
  const [itemForm, setItemForm] = useState<MenuItemInput>(emptyItem);
  const [categoryForm, setCategoryForm] = useState<MenuCategoryInput>(emptyCategory);
  const [isItemOpen, setIsItemOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  async function loadMenu() {
    setIsLoading(true);
    setError("");
    try {
      const catalog = await getAdminMenu();
      setCategories(catalog.categories);
      setItems(catalog.items);
    } catch (loadError) {
      logSupabaseError("[admin menu load]", loadError);
      setError("تعذر تحميل بيانات المنيو.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMenu();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return items.filter((item) => {
      const category = categoryById.get(item.categoryId);
      const matchesCategory = categoryFilter === "all" || item.categoryId === categoryFilter;
      const matchesAvailability = availabilityFilter === "all" || (availabilityFilter === "active" ? itemIsSellable(item) : !itemIsSellable(item));
      const text = [item.nameAr, item.nameEn, item.descriptionAr, category?.nameAr].filter(Boolean).join(" ").toLowerCase();
      return matchesCategory && matchesAvailability && (!normalized || text.includes(normalized));
    });
  }, [availabilityFilter, categoryById, categoryFilter, items, search]);

  const groupedCategories = categories
    .filter((category) => categoryFilter === "all" || category.id === categoryFilter)
    .map((category) => ({
      category,
      items: filteredItems.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0 || categoryFilter !== "all");

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function openNewItem() {
    setEditingItem(null);
    setItemForm({ ...emptyItem, categoryId: categories.find((category) => category.isActive)?.id ?? categories[0]?.id ?? "", sortOrder: items.length + 1 });
    setFormError("");
    setIsItemOpen(true);
  }

  function openEditItem(item: AdminMenuItem) {
    setEditingItem(item);
    setItemForm({
      categoryId: item.categoryId,
      nameAr: item.nameAr,
      nameEn: item.nameEn ?? "",
      descriptionAr: item.descriptionAr ?? "",
      price: Number(item.price ?? 0),
      preparationStation: item.preparationStation,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
    });
    setFormError("");
    setIsItemOpen(true);
  }

  function openNewCategory() {
    setEditingCategory(null);
    setCategoryForm({ ...emptyCategory, sortOrder: categories.length + 1 });
    setFormError("");
    setIsCategoryOpen(true);
  }

  function openEditCategory(category: AdminMenuCategory) {
    setEditingCategory(category);
    setCategoryForm({ nameAr: category.nameAr, nameEn: category.nameEn ?? "", sortOrder: category.sortOrder, isActive: category.isActive });
    setFormError("");
    setIsCategoryOpen(true);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemForm.categoryId) {
      setFormError("اختر التصنيف.");
      return;
    }
    if (!itemForm.nameAr.trim()) {
      setFormError("الاسم العربي مطلوب.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const saved = editingItem ? await updateMenuItem(editingItem, itemForm) : await createMenuItem(itemForm);
      setItems((current) => editingItem ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setIsItemOpen(false);
      flash(editingItem ? "تم تعديل الصنف" : "تمت إضافة الصنف");
    } catch (saveError) {
      logSupabaseError("[admin menu item save]", saveError);
      setFormError("تعذر حفظ الصنف.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryForm.nameAr.trim()) {
      setFormError("اسم التصنيف مطلوب.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const saved = editingCategory ? await updateMenuCategory(editingCategory, categoryForm) : await createMenuCategory(categoryForm);
      setCategories((current) => editingCategory ? current.map((category) => category.id === saved.id ? saved : category) : [...current, saved]);
      setIsCategoryOpen(false);
      flash(editingCategory ? "تم تعديل التصنيف" : "تمت إضافة التصنيف");
    } catch (saveError) {
      logSupabaseError("[admin menu category save]", saveError);
      setFormError("تعذر حفظ التصنيف.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">لوحة الإدارة</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">المنيو</h1>
          <p className="mt-2 text-sm text-[#7c6b60]">إدارة تصنيفات وأصناف وأسعار المنيو من مصدر Supabase الحالي.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openNewCategory} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5eee6]"><Plus size={17} />إضافة تصنيف</button>
          <button type="button" onClick={openNewItem} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]"><Plus size={17} />إضافة صنف</button>
        </div>
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c6b60]" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث عن صنف أو وصف" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] pr-10 pl-3 text-sm outline-none" />
          </label>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل التصنيفات</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.nameAr}</option>)}
          </select>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
            <option value="all">كل الحالات</option>
            <option value="active">فعال للبيع</option>
            <option value="inactive">غير فعال</option>
          </select>
        </div>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]"><Loader2 className="ml-2 inline animate-spin" size={16} />جارٍ تحميل المنيو...</div> : null}
      {!isLoading && groupedCategories.length === 0 ? <p className="rounded-md border border-[#e4d8c8] bg-white p-5 text-sm text-[#7c6b60]">لا توجد أصناف مطابقة.</p> : null}

      {groupedCategories.map(({ category, items: categoryItems }) => (
        <section key={category.id} className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee4d8] p-4">
            <div>
              <h2 className="font-semibold text-[#2f211c]">{category.nameAr}</h2>
              <p className="text-xs text-[#7c6b60]">{category.isActive ? "تصنيف فعال" : "تصنيف غير فعال"} · ترتيب {category.sortOrder}</p>
            </div>
            <button type="button" onClick={() => openEditCategory(category)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Edit2 size={15} />تعديل التصنيف</button>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {categoryItems.map((item) => (
              <article key={item.id} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#2f211c]">{item.nameAr}</h3>
                    {item.nameEn ? <p className="text-xs text-[#7c6b60]">{item.nameEn}</p> : null}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${itemIsSellable(item) ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{itemIsSellable(item) ? "فعال" : "غير فعال"}</span>
                </div>
                {item.descriptionAr ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#7c6b60]">{item.descriptionAr}</p> : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#2f211c]">{formatCurrency(Number(item.price ?? 0))}</p>
                    {Number(item.price ?? 0) <= 0 ? <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">السعر غير محدد</span> : null}
                  </div>
                  <button type="button" onClick={() => openEditItem(item)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]"><Edit2 size={15} />تعديل</button>
                </div>
                <p className="mt-3 text-xs text-[#9a8779]">{stationLabels[item.preparationStation]} · ترتيب {item.sortOrder}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      {isItemOpen ? (
        <MenuItemDialog
          form={itemForm}
          categories={categories}
          editingItem={editingItem}
          formError={formError}
          isSaving={isSaving}
          onChange={setItemForm}
          onClose={() => setIsItemOpen(false)}
          onSubmit={submitItem}
        />
      ) : null}

      {isCategoryOpen ? (
        <MenuCategoryDialog
          form={categoryForm}
          editingCategory={editingCategory}
          formError={formError}
          isSaving={isSaving}
          onChange={setCategoryForm}
          onClose={() => setIsCategoryOpen(false)}
          onSubmit={submitCategory}
        />
      ) : null}
    </div>
  );
}

function MenuItemDialog({
  form,
  categories,
  editingItem,
  formError,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: MenuItemInput;
  categories: AdminMenuCategory[];
  editingItem: AdminMenuItem | null;
  formError: string;
  isSaving: boolean;
  onChange: (form: MenuItemInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const price = Number(form.price) || 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <DialogHeader title={editingItem ? "تعديل صنف" : "إضافة صنف"} onClose={onClose} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">الاسم العربي<input required value={form.nameAr} onChange={(event) => onChange({ ...form, nameAr: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">الاسم الإنجليزي<input value={form.nameEn ?? ""} onChange={(event) => onChange({ ...form, nameEn: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">التصنيف<select required value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">{categories.map((category) => <option key={category.id} value={category.id}>{category.nameAr}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">السعر<input min="0" type="number" value={form.price || ""} onChange={(event) => onChange({ ...form, price: event.target.value ? Number(event.target.value) : 0 })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">محطة التحضير<select value={form.preparationStation} onChange={(event) => onChange({ ...form, preparationStation: event.target.value as AdminMenuItem["preparationStation"] })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">{Object.entries(stationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">ترتيب العرض<input type="number" value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: Number(event.target.value) || 0 })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="flex items-center gap-2 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm font-medium text-[#4a3b34] md:col-span-2">
            <input type="checkbox" checked={form.isAvailable && price > 0} disabled={price <= 0} onChange={(event) => onChange({ ...form, isAvailable: event.target.checked })} />
            الصنف متاح للبيع
          </label>
          {price <= 0 ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 md:col-span-2">السعر غير محدد، لذلك سيتم حفظ الصنف غير متاح للبيع.</p> : null}
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34] md:col-span-2">الوصف<textarea value={form.descriptionAr ?? ""} onChange={(event) => onChange({ ...form, descriptionAr: event.target.value })} className="min-h-24 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 outline-none" /></label>
        </div>
        <DialogActions formError={formError} isSaving={isSaving} onClose={onClose} />
      </form>
    </div>
  );
}

function MenuCategoryDialog({
  form,
  editingCategory,
  formError,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: MenuCategoryInput;
  editingCategory: AdminMenuCategory | null;
  formError: string;
  isSaving: boolean;
  onChange: (form: MenuCategoryInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-md border border-[#e4d8c8] bg-white p-5 shadow-xl">
        <DialogHeader title={editingCategory ? "تعديل تصنيف" : "إضافة تصنيف"} onClose={onClose} />
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">الاسم العربي<input required value={form.nameAr} onChange={(event) => onChange({ ...form, nameAr: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">الاسم الإنجليزي<input value={form.nameEn ?? ""} onChange={(event) => onChange({ ...form, nameEn: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">ترتيب التصنيف<input type="number" value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: Number(event.target.value) || 0 })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="flex items-center gap-2 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm font-medium text-[#4a3b34]"><input type="checkbox" checked={form.isActive} onChange={(event) => onChange({ ...form, isActive: event.target.checked })} />التصنيف فعال</label>
        </div>
        <DialogActions formError={formError} isSaving={isSaving} onClose={onClose} />
      </form>
    </div>
  );
}

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#eee4d8] pb-3">
      <h2 className="text-xl font-semibold text-[#2f211c]">{title}</h2>
      <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]" aria-label="إغلاق"><X size={16} /></button>
    </div>
  );
}

function DialogActions({ formError, isSaving, onClose }: { formError: string; isSaving: boolean; onClose: () => void }) {
  return (
    <>
      {formError ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button>
        <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{isSaving ? "جارٍ الحفظ..." : "حفظ"}</button>
      </div>
    </>
  );
}
