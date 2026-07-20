-- Safe seed data for Khatoun POS.
-- Run manually after reviewing the migration. This file does not create auth users.

insert into public.restaurant_tables (table_number, name, capacity, status, is_active)
values
  (1, 'طاولة 1', 4, 'available', true),
  (2, 'طاولة 2', 4, 'available', true),
  (3, 'طاولة 3', 4, 'available', true),
  (4, 'طاولة 4', 4, 'available', true),
  (5, 'طاولة 5', 4, 'available', true),
  (6, 'طاولة 6', 4, 'available', true),
  (7, 'طاولة 7', 4, 'available', true),
  (8, 'طاولة 8', 4, 'available', true),
  (9, 'طاولة 9', 4, 'available', true),
  (10, 'طاولة 10', 4, 'available', true),
  (11, 'طاولة 11', 4, 'available', true),
  (12, 'طاولة 12', 4, 'available', true),
  (13, 'طاولة 13', 4, 'available', true),
  (14, 'طاولة 14', 4, 'available', true),
  (15, 'طاولة 15', 4, 'available', true)
on conflict (table_number) do update
set name = excluded.name,
    capacity = excluded.capacity,
    status = excluded.status,
    is_active = excluded.is_active;

insert into public.menu_categories (name_en, name_ar, sort_order, is_active)
values
  ('soups', 'الشوربات', 1, true),
  ('baghdadi-breakfast', 'الفطور البغدادي', 2, true),
  ('sandwiches', 'السندويشات', 3, true),
  ('cold-appetizers', 'المقبلات الباردة', 4, true),
  ('hot-appetizers', 'المقبلات الحارة', 5, true),
  ('salads', 'السلطات', 6, true),
  ('main-dishes', 'الأطباق الرئيسية', 7, true),
  ('sweets', 'الحلويات', 8, true),
  ('hot-drinks', 'المشروبات الساخنة', 9, true),
  ('cold-drinks', 'المشروبات الباردة', 10, true),
  ('mojito', 'الموهيتو', 11, true),
  ('herbal-drinks', 'المشروبات العشبية', 12, true),
  ('hookah', 'النراكيل', 13, true)
on conflict (name_en) do update
set name_ar = excluded.name_ar,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

with seed_items (category_name_en, name_ar, description_ar, price, preparation_station, is_available, sort_order) as (
  values
  ('soups', 'شوربة عدس', 'عدس عراقي كريمي مع ليمون وخبز محمص.', 5000, 'kitchen', true, 1),
  ('soups', 'شوربة بطاطا حمرة', 'بطاطا حمراء وأعشاب تقدم ساخنة.', 6000, 'kitchen', true, 2),
  ('soups', 'شوربة بصل', 'بصل مطهو ببطء مع خبز محمص.', 7000, 'kitchen', true, 3),
  ('soups', 'شوربة خضار', 'خضار موسمية خفيفة بنكهة بيتية.', null, 'kitchen', false, 4),
  ('baghdadi-breakfast', 'فطور خاتون لشخصين', 'صينية فطور بغدادية مع قيمر ودبس وشاي.', 18000, 'kitchen', true, 5),
  ('baghdadi-breakfast', 'قيمر ودبس', 'قيمر عراقي مع دبس التمر وخبز حار.', 7000, 'kitchen', true, 6),
  ('baghdadi-breakfast', 'تشريب باقلاء', 'باقلاء دافئة مع خبز وبيض حسب الطلب.', 7000, 'kitchen', true, 7),
  ('baghdadi-breakfast', 'مخلمة عراقية', 'بيض مع لحم وبصل وطماطة.', 6500, 'kitchen', true, 8),
  ('baghdadi-breakfast', 'بيض وطماطة', 'طبق فطور سريع بتتبيلة عراقية.', 5000, 'kitchen', true, 9),
  ('sandwiches', 'سندويش كباب عروگ', 'عروگ مقلي مع طماطة وبصل بخبز التنور.', 5000, 'kitchen', true, 10),
  ('sandwiches', 'سندويش لسان', 'شرائح لسان مطهوة مع مخللات.', 5000, 'kitchen', true, 11),
  ('sandwiches', 'سندويش مخلمة', 'مخلمة ملفوفة بخبز عراقي ساخن.', 4500, 'kitchen', true, 12),
  ('sandwiches', 'سندويش تبسي دجاج', 'دجاج وباذنجان وبطاطا بصلصة طماطة.', 5000, 'kitchen', true, 13),
  ('sandwiches', 'سندويش جبن عرب', 'جبن عربي طري مع خضار.', 4500, 'kitchen', true, 14),
  ('cold-appetizers', 'حمص لبلبي', 'حمص مع ليمون وكمون وزيت زيتون.', 4000, 'kitchen', true, 15),
  ('cold-appetizers', 'باقلاء', 'باقلاء عراقية دافئة مع الليمون.', 4000, 'kitchen', true, 16),
  ('cold-appetizers', 'جاجيك', 'لبن بالخيار والثوم والأعشاب.', 3500, 'kitchen', true, 17),
  ('cold-appetizers', 'حمص باللحمة', 'حمص كريمي مع قطع لحم متبلة.', 6500, 'kitchen', true, 18),
  ('cold-appetizers', 'بابا غنوج', 'باذنجان مشوي وطحينية.', null, 'kitchen', false, 19),
  ('hot-appetizers', 'لسان', 'لسان مطهو بتتبيلة غنية ويقدم ساخنًا.', null, 'kitchen', false, 20),
  ('hot-appetizers', 'عروك', 'أقراص عراقية مقلية باللحم والخضار.', null, 'kitchen', false, 21),
  ('hot-appetizers', 'كبة موصلية مقلية', 'كبة محشوة باللحم والتوابل.', null, 'kitchen', false, 22),
  ('hot-appetizers', 'بطاطا مقلية', 'بطاطا ذهبية مقرمشة.', 4000, 'kitchen', true, 23),
  ('salads', 'سلطة عراقية', 'طماطة وخيار وبصل وليمون.', 4000, 'kitchen', true, 24),
  ('salads', 'فتوش', 'خضار طازجة وخبز مقرمش ودبس رمان.', 5000, 'kitchen', true, 25),
  ('salads', 'تبولة', 'بقدونس وبرغل وليمون وزيت زيتون.', 5000, 'kitchen', true, 26),
  ('salads', 'سلطة جرجير', 'جرجير ورمان وجبن خفيف.', 6000, 'kitchen', true, 27),
  ('main-dishes', 'دولمة خاتون', 'ورق عنب وخضار محشية بطريقة عراقية.', 16000, 'kitchen', true, 28),
  ('main-dishes', 'تبسي باذنجان', 'باذنجان وبطاطا ولحم بصلصة الطماطة.', 12000, 'kitchen', true, 29),
  ('main-dishes', 'كباب عراقي', 'كباب مشوي مع خبز وخضار.', 14000, 'kitchen', true, 30),
  ('main-dishes', 'تمن ولحم', 'رز عراقي مع لحم مطبوخ بهدوء.', 18000, 'kitchen', true, 31),
  ('main-dishes', 'برياني دجاج', 'رز متبل ودجاج وخضار.', 13000, 'kitchen', true, 32),
  ('sweets', 'براوني التمر', 'براوني ناعم بالتمر والكاكاو.', 8000, 'kitchen', true, 33),
  ('sweets', 'كليجة تمر', 'كليجة محشوة تمر ورائحة هيل.', 6000, 'kitchen', true, 34),
  ('sweets', 'زردة', 'رز بالزعفران والسكر والقرفة.', 6500, 'kitchen', true, 35),
  ('sweets', 'كنافة جبن', 'كنافة دافئة بجبن وقطر.', 7000, 'kitchen', true, 36),
  ('hot-drinks', 'شاي على الفحم', 'شاي عراقي ثقيل بطعم دافئ.', 3000, 'barista', true, 37),
  ('hot-drinks', 'قهوة عراقية', 'قهوة داكنة وغنية.', 4000, 'barista', true, 38),
  ('hot-drinks', 'جاي كرك', 'شاي مطبوخ بالحليب والتوابل.', 5000, 'barista', true, 39),
  ('hot-drinks', 'كابتشينو', 'إسبريسو وحليب مبخر ورغوة.', 5500, 'barista', true, 40),
  ('hot-drinks', 'لاتيه', 'قهوة ناعمة بالحليب.', 5500, 'barista', true, 41),
  ('cold-drinks', 'ليمونادة بالنعناع', 'ليمون ونعناع وثلج.', 6000, 'drinks', true, 42),
  ('cold-drinks', 'زبيب مثلج', 'مشروب زبيب بارد ومنعش.', 4500, 'drinks', true, 43),
  ('cold-drinks', 'لبن عيران', 'لبن بارد خفيف.', 3500, 'drinks', true, 44),
  ('cold-drinks', 'آيس لاتيه', 'قهوة باردة مع حليب وثلج.', 6000, 'drinks', true, 45),
  ('cold-drinks', 'عصير موز', 'عصير طازج يحضر عند الطلب.', null, 'drinks', false, 46),
  ('mojito', 'موهيتو كلاسيك', 'ليمون ونعناع وصودا.', 6000, 'drinks', true, 47),
  ('mojito', 'موهيتو فراولة', 'فراولة ونعناع وليمون.', 6500, 'drinks', true, 48),
  ('mojito', 'موهيتو باشن فروت', 'نكهة استوائية منعشة.', 7000, 'drinks', true, 49),
  ('mojito', 'موهيتو رمان', 'رمان ونعناع بارد.', 7000, 'drinks', true, 50),
  ('herbal-drinks', 'كجرات حار / بارد', 'كركديه بطعم حامض متوازن.', 3000, 'drinks', true, 51),
  ('herbal-drinks', 'ينسون بالعسل', 'ينسون طبيعي محلى بالعسل.', 3500, 'drinks', true, 52),
  ('herbal-drinks', 'شاي نومي حامض عراقي', 'ليمون مجفف دافئ ومنعش.', 3500, 'drinks', true, 53),
  ('herbal-drinks', 'شاي نعناع أخضر طازج', 'نعناع طازج مغلي.', 3000, 'drinks', true, 54),
  ('hookah', 'نركيلة تفاحتين خاتون', 'نكهة كلاسيكية ثابتة.', 12000, 'shisha', true, 55),
  ('hookah', 'نركيلة عنب ونعناع', 'عنب ونعناع بطعم بارد.', 12000, 'shisha', true, 56),
  ('hookah', 'نركيلة ليمون ونعناع', 'حمضيات ونعناع خفيف.', 12000, 'shisha', true, 57),
  ('hookah', 'نركيلة خاتون الخاصة', 'خلطة بيتية هادئة.', null, 'shisha', false, 58)
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
