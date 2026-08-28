alter table public.restaurant_tables
  add column if not exists area text,
  add column if not exists layout_x numeric(5,2),
  add column if not exists layout_y numeric(5,2),
  add column if not exists layout_rotation numeric(6,2) not null default 0;

alter table public.restaurant_tables
  drop constraint if exists restaurant_tables_layout_x_range,
  add constraint restaurant_tables_layout_x_range
    check (layout_x is null or (layout_x >= 0 and layout_x <= 100));

alter table public.restaurant_tables
  drop constraint if exists restaurant_tables_layout_y_range,
  add constraint restaurant_tables_layout_y_range
    check (layout_y is null or (layout_y >= 0 and layout_y <= 100));
