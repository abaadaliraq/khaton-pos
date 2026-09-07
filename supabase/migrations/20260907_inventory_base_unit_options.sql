update public.inventory_units
set name_ar = 'كيلوغرام',
    name_en = 'Kilogram',
    is_base_unit = true,
    sort_order = 20
where code = 'kg';

update public.inventory_units
set name_ar = 'لتر',
    name_en = 'Liter',
    is_base_unit = true,
    sort_order = 40
where code = 'l';

update public.inventory_units
set name_ar = 'غرام',
    name_en = 'Gram',
    is_base_unit = true,
    sort_order = 10
where code = 'g';

update public.inventory_units
set name_ar = 'مل',
    name_en = 'Milliliter',
    is_base_unit = true,
    sort_order = 30
where code = 'ml';

update public.inventory_units
set name_ar = 'قطعة',
    name_en = 'Piece',
    is_base_unit = true,
    sort_order = 50
where code = 'piece';

update public.inventory_units
set is_base_unit = false
where code not in ('g', 'kg', 'ml', 'l', 'piece')
  and is_base_unit = true;
