/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const menuSource = fs.readFileSync(path.join(rootDir, "data", "menu.ts"), "utf8");

const executableSource = menuSource
  .replace(/^import\s+type\s+\{[^}]+\}\s+from\s+["'][^"']+["'];\s*/m, "")
  .replace(/export const categories:\s*Category\[\]\s*=/, "const categories =")
  .replace(/export const menuItems:\s*MenuItem\[\]\s*=/, "const menuItems =");

const { categories, menuItems } = new Function(`${executableSource}; return { categories, menuItems };`)();

function sql(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function stationFor(categoryId) {
  if (categoryId === "hot-drinks") {
    return "barista";
  }

  if (["cold-drinks", "mojito", "herbal-drinks"].includes(categoryId)) {
    return "drinks";
  }

  if (categoryId === "hookah") {
    return "shisha";
  }

  return "kitchen";
}

const realCategories = categories.filter((category) => category.id !== "all");
const categoryRows = realCategories.map((category, index) => {
  return `(${sql(category.id)}, ${sql(category.name)}, ${index + 1}, true)`;
});

const itemRows = menuItems.map((item, index) => {
  const available = item.price > 0;
  const price = available ? String(item.price) : "null";

  return [
    sql(item.categoryId),
    sql(item.name),
    sql(item.description ?? null),
    price,
    sql(stationFor(item.categoryId)),
    available ? "true" : "false",
    String(index + 1),
  ].join(", ").replace(/^/, "(").replace(/$/, ")");
});

const tableRows = Array.from({ length: 15 }, (_, index) => {
  const tableNumber = index + 1;
  return `(${tableNumber}, ${sql(`طاولة ${tableNumber}`)}, 4, 'available', true)`;
});

const seedSql = `-- Safe seed data for Khatoun POS.
-- Run manually after reviewing the migration. This file does not create auth users.

insert into public.restaurant_tables (table_number, name, capacity, status, is_active)
values
  ${tableRows.join(",\n  ")}
on conflict (table_number) do update
set name = excluded.name,
    capacity = excluded.capacity,
    status = excluded.status,
    is_active = excluded.is_active;

insert into public.menu_categories (name_en, name_ar, sort_order, is_active)
values
  ${categoryRows.join(",\n  ")}
on conflict (name_en) do update
set name_ar = excluded.name_ar,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

with seed_items (category_name_en, name_ar, description_ar, price, preparation_station, is_available, sort_order) as (
  values
  ${itemRows.join(",\n  ")}
)
insert into public.menu_items (
  category_id,
  name_ar,
  description_ar,
  price,
  preparation_station,
  is_available,
  sort_order
)
select
  category.id,
  seed_items.name_ar,
  seed_items.description_ar,
  seed_items.price::numeric(12,0),
  seed_items.preparation_station,
  seed_items.is_available,
  seed_items.sort_order
from seed_items
join public.menu_categories category on category.name_en = seed_items.category_name_en
on conflict (category_id, name_ar) do update
set description_ar = excluded.description_ar,
    price = excluded.price,
    preparation_station = excluded.preparation_station,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order;
`;

fs.writeFileSync(path.join(rootDir, "supabase", "seed.sql"), seedSql, "utf8");
console.log(`Generated supabase/seed.sql with ${realCategories.length} categories and ${menuItems.length} menu items.`);
