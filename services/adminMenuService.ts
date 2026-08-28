"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { AdminMenuCategory, AdminMenuItem, MenuCategoryInput, MenuItemInput } from "@/types/adminMenu";

type MenuCategoryRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
  sort_order: number;
  is_active: boolean;
};

type MenuItemRow = {
  id: string;
  category_id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  price: number | string | null;
  preparation_station: AdminMenuItem["preparationStation"];
  is_available: boolean;
  sort_order: number;
};

const categorySelect = "id, name_ar, name_en, sort_order, is_active";
const itemSelect = "id, category_id, name_ar, name_en, description_ar, price, preparation_station, is_available, sort_order";

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowToCategory(row: MenuCategoryRow): AdminMenuCategory {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function rowToItem(row: MenuItemRow): AdminMenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    price: row.price === null ? null : toNumber(row.price),
    preparationStation: row.preparation_station,
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
  };
}

function itemPayload(input: MenuItemInput) {
  const price = Math.max(0, Number(input.price) || 0);
  return {
    category_id: input.categoryId,
    name_ar: input.nameAr.trim(),
    name_en: clean(input.nameEn),
    description_ar: clean(input.descriptionAr),
    price,
    preparation_station: input.preparationStation,
    is_available: price > 0 && input.isAvailable,
    sort_order: Number(input.sortOrder) || 0,
  };
}

async function writeAudit(action: string, entityType: string, entityId: string, oldData: unknown, newData: unknown) {
  const supabase = createClient();
  const { error } = await supabase.rpc("write_audit_log" as never, {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_old_data: oldData,
    p_new_data: newData,
  } as never);

  if (error) {
    logSupabaseError(`[audit write ${action}]`, error);
    throw error;
  }
}

export async function getAdminMenu() {
  const supabase = createClient();
  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("menu_categories" as never).select(categorySelect).order("sort_order", { ascending: true }),
    supabase.from("menu_items" as never).select(itemSelect).order("sort_order", { ascending: true }),
  ]);

  if (categoriesError) {
    logSupabaseError("[admin menu_categories SELECT]", categoriesError);
    throw categoriesError;
  }
  if (itemsError) {
    logSupabaseError("[admin menu_items SELECT]", itemsError);
    throw itemsError;
  }

  return {
    categories: ((categories ?? []) as unknown as MenuCategoryRow[]).map(rowToCategory),
    items: ((items ?? []) as unknown as MenuItemRow[]).map(rowToItem),
  };
}

export async function createMenuCategory(input: MenuCategoryInput) {
  const supabase = createClient();
  const payload = {
    name_ar: input.nameAr.trim(),
    name_en: clean(input.nameEn),
    sort_order: Number(input.sortOrder) || 0,
    is_active: input.isActive,
  };
  const { data, error } = await supabase.from("menu_categories" as never).insert(payload as never).select(categorySelect).single();

  if (error) {
    logSupabaseError("[menu_categories INSERT]", error);
    throw error;
  }

  await writeAudit("إضافة تصنيف", "menu_categories", (data as MenuCategoryRow).id, null, data);
  return rowToCategory(data as unknown as MenuCategoryRow);
}

export async function updateMenuCategory(previous: AdminMenuCategory, input: MenuCategoryInput) {
  const supabase = createClient();
  const payload = {
    name_ar: input.nameAr.trim(),
    name_en: clean(input.nameEn),
    sort_order: Number(input.sortOrder) || 0,
    is_active: input.isActive,
  };
  const { data, error } = await supabase.from("menu_categories" as never).update(payload as never).eq("id", previous.id).select(categorySelect).single();

  if (error) {
    logSupabaseError("[menu_categories UPDATE]", error);
    throw error;
  }

  await writeAudit("تعديل تصنيف", "menu_categories", previous.id, previous, data);
  return rowToCategory(data as unknown as MenuCategoryRow);
}

export async function createMenuItem(input: MenuItemInput) {
  const supabase = createClient();
  const payload = itemPayload(input);
  const { data, error } = await supabase.from("menu_items" as never).insert(payload as never).select(itemSelect).single();

  if (error) {
    logSupabaseError("[menu_items INSERT]", error);
    throw error;
  }

  await writeAudit("إضافة صنف", "menu_items", (data as MenuItemRow).id, null, data);
  return rowToItem(data as unknown as MenuItemRow);
}

export async function updateMenuItem(previous: AdminMenuItem, input: MenuItemInput) {
  const supabase = createClient();
  const payload = itemPayload(input);
  const { data, error } = await supabase.from("menu_items" as never).update(payload as never).eq("id", previous.id).select(itemSelect).single();

  if (error) {
    logSupabaseError("[menu_items UPDATE]", error);
    throw error;
  }

  const next = rowToItem(data as unknown as MenuItemRow);
  const action = previous.price !== next.price
    ? "تغيير سعر"
    : previous.isAvailable !== next.isAvailable
      ? next.isAvailable ? "تفعيل صنف" : "تعطيل صنف"
      : "تعديل صنف";
  await writeAudit(action, "menu_items", previous.id, previous, next);
  return next;
}
