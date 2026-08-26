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
on conflict (name_en) do nothing;

update public.menu_items item
set name_ar = 'سلطة بغدادية',
    description_ar = 'خيار وطماطم وبصل وأعشاب طازجة بخلطة بيتية بسيطة.',
    price = 4000,
    preparation_station = 'kitchen',
    is_available = true,
    sort_order = 42
from public.menu_categories category
where item.category_id = category.id
  and category.name_en = 'salads'
  and item.name_ar = 'سلطة عراقية'
  and not exists (
    select 1
    from public.menu_items existing
    where existing.category_id = category.id
      and existing.name_ar = 'سلطة بغدادية'
  );

update public.menu_items item
set description_ar = 'خيار وطماطم وبصل وأعشاب طازجة بخلطة بيتية بسيطة.',
    price = 4000,
    preparation_station = 'kitchen',
    is_available = true,
    sort_order = 42
from public.menu_categories category
where item.category_id = category.id
  and category.name_en = 'salads'
  and item.name_ar = 'سلطة بغدادية';

update public.menu_items item
set is_available = false
from public.menu_categories category
where item.category_id = category.id
  and category.name_en = 'salads'
  and item.name_ar = 'سلطة عراقية'
  and exists (
    select 1
    from public.menu_items published_salad
    where published_salad.category_id = category.id
      and published_salad.name_ar = 'سلطة بغدادية'
  );

with historical_items (category_name_en, name_ar) as (
  values
  ('soups', 'شوربة خضار'),
  ('hot-appetizers', 'بطاطا مقلية'),
  ('salads', 'فتوش'),
  ('salads', 'تبولة'),
  ('salads', 'سلطة جرجير'),
  ('main-dishes', 'دولمة خاتون'),
  ('main-dishes', 'تبسي باذنجان'),
  ('main-dishes', 'كباب عراقي'),
  ('main-dishes', 'تمن ولحم'),
  ('main-dishes', 'برياني دجاج'),
  ('sweets', 'كنافة جبن'),
  ('hookah', 'نركيلة خاتون الخاصة')
)
update public.menu_items item
set is_available = false
from historical_items
join public.menu_categories category on category.name_en = historical_items.category_name_en
where item.category_id = category.id
  and item.name_ar = historical_items.name_ar;

with zero_price_published_items (category_name_en, name_ar, description_ar, sort_order) as (
  values
  ('cold-appetizers', 'بابا غنوج', 'باذنجان مشوي ممزوج بالطحينية والليمون والثوم.', 30),
  ('hot-appetizers', 'لسان', 'لسان مطهو بتتبيلة غنية ويقدم ساخناً.', 34),
  ('hot-appetizers', 'عروك', 'أقراص عراقية مقلية محضرة باللحم والخضار والتوابل.', 35),
  ('hot-appetizers', 'كبة موصلية مقلية', 'كبة موصلية محشوة باللحم والتوابل ومقلية حتى تصبح ذهبية.', 36),
  ('cold-drinks', 'عصير موز', 'عصير موز طازج محضر عند الطلب.', 88)
)
update public.menu_items item
set description_ar = zero_price_published_items.description_ar,
    price = 0,
    is_available = false,
    sort_order = zero_price_published_items.sort_order
from zero_price_published_items
join public.menu_categories category on category.name_en = zero_price_published_items.category_name_en
where item.category_id = category.id
  and item.name_ar = zero_price_published_items.name_ar;

with missing_items (category_name_en, name_ar, description_ar, price, preparation_station, is_available, sort_order) as (
  values
  ('baghdadi-breakfast', 'بيض مسلوق مع خضار', 'بيض مسلوق يقدم مع خيار وطماطم وزيتون وخبز عراقي.', 4500, 'kitchen', true, 9),
  ('baghdadi-breakfast', 'جبن عرب وخبز حار', 'جبن عربي طري يقدم مع خبز ساخن وخضار طازجة.', 5000, 'kitchen', true, 10),
  ('baghdadi-breakfast', 'صحن فطور بغدادي صغير', 'اختيار خفيف من الجبن، الزيتون، الخضار، البيض وخبز عراقي.', 9000, 'kitchen', true, 11),
  ('sandwiches', 'سندويش مخ الخروف', 'مخ الخروف الطري المطبوخ على البخار، يقدم مع رشة ليمون وملح في خبز الصمون.', 5000, 'kitchen', true, 14),
  ('sandwiches', 'سندويش كيمر عرب', 'كيمر عراقي غني ودسم يقدم مع الدبس أو العسل حسب الاختيار.', 4000, 'kitchen', true, 15),
  ('sandwiches', 'سندويش باسطرمة خاتون', 'شرائح باسطرمة متبلة تقدم في خبز عراقي ساخن مع الطماطم والمخلل.', 5000, 'kitchen', true, 18),
  ('sandwiches', 'سندويش كبدة بغدادية', 'كبدة مقلية بتوابل عراقية مع البصل والطماطم، تقدم في خبز الصمون أو التنور.', 5000, 'kitchen', true, 19),
  ('sandwiches', 'سندويش لحم بقري عراقي', 'لحم بقري مطبوخ على الطريقة العراقية مع البصل والتوابل، يقدم في خبز ساخن.', 5500, 'kitchen', true, 20),
  ('sandwiches', 'سندويش بيض وبطاطا', 'بيض مسلوق أو مقلي مع بطاطا، يقدم في خبز عراقي مع رشة ملح وفلفل.', 4500, 'kitchen', true, 22),
  ('sandwiches', 'سندويش حبش', 'شرائح حبش خفيفة تقدم في خبز ساخن مع الخس والطماطم وصلصة خاصة.', 5000, 'kitchen', true, 23),
  ('cold-appetizers', 'محروك أصبعه', 'عدس وعجين مقلي مع بصل مكرمل ودبس رمان بنكهة شامية قديمة.', 5000, 'kitchen', true, 26),
  ('cold-appetizers', 'كبدة مقبلات', 'قطع كبدة مقلية بتوابل عراقية تقدم مع الليمون والخبز.', 6000, 'kitchen', true, 27),
  ('cold-appetizers', 'بيتنجانية', 'باذنجان محضر بتتبيلة خاتون الخاصة ويقدم بارداً.', 0, 'kitchen', false, 31),
  ('cold-appetizers', 'طحينية', 'صلصة طحينية كريمية محضرة مع الليمون والثوم.', 0, 'kitchen', false, 32),
  ('cold-appetizers', 'زيتونية', 'مقبلات باردة محضرة من الزيتون بتتبيلة خاتون الخاصة.', 0, 'kitchen', false, 33),
  ('hot-appetizers', 'كبة موصلية مسلوقة', 'كبة موصلية محشوة باللحم والتوابل ومطهوة بالسلق.', 0, 'kitchen', false, 37),
  ('hot-appetizers', 'كبة تمن', 'كبة عراقية محضرة من الأرز ومحشوة باللحم المتبل.', 0, 'kitchen', false, 38),
  ('salads', 'سلطة دجاج خاتون', 'دجاج مشوي مع خضار طازجة وصلصة خفيفة بنكهة شرقية.', 7000, 'kitchen', true, 39),
  ('salads', 'سلطة لحم', 'شرائح لحم بقري متبلة مع خضار موسمية ولمسة دبس رمان.', 8000, 'kitchen', true, 40),
  ('salads', 'سلطة بقوليات', 'حمص وفاصوليا وبقوليات مشكلة مع زيت الزيتون والليمون.', 5000, 'kitchen', true, 41),
  ('main-dishes', 'قوزي لحم', 'قوزي عراقي باللحم يقدم مع الأرز المتبل والمكسرات.', 0, 'kitchen', false, 43),
  ('main-dishes', 'قوزي دجاج', 'قوزي عراقي بالدجاج يقدم مع الأرز المتبل والمكسرات.', 0, 'kitchen', false, 44),
  ('main-dishes', 'سمك مقلي', 'سمك مقلي يقدم مع المقبلات والليمون.', 0, 'kitchen', false, 45),
  ('main-dishes', 'ملفوف الخاتون باللحم', 'أوراق ملفوف محشوة بالأرز واللحم ومطهوة على طريقة الخاتون.', 0, 'kitchen', false, 46),
  ('main-dishes', 'برياني الخاتون بالدجاج', 'برياني بالدجاج والأرز المتبل يقدم على طريقة الخاتون.', 0, 'kitchen', false, 47),
  ('main-dishes', 'مشويات مع أو بدون رز', 'تشكيلة مشويات عراقية تقدم حسب الاختيار مع الأرز أو بدونه.', 0, 'kitchen', false, 48),
  ('main-dishes', 'طبق كباب لحم', 'كباب لحم عراقي مشوي يقدم مع الخضار المشوية والخبز.', 0, 'kitchen', false, 49),
  ('main-dishes', 'طبق كباب دجاج', 'كباب دجاج عراقي مشوي يقدم مع الخضار المشوية والخبز.', 0, 'kitchen', false, 50),
  ('main-dishes', 'طبق مشكل لحم', 'تشكيلة من مشويات اللحم تقدم مع الخضار والخبز.', 0, 'kitchen', false, 51),
  ('main-dishes', 'طبق مشكل دجاج', 'تشكيلة من مشويات الدجاج تقدم مع الخضار والخبز.', 0, 'kitchen', false, 52),
  ('main-dishes', 'طبق تكة لحم', 'قطع لحم متبلة ومشوية تقدم مع الخضار والخبز.', 0, 'kitchen', false, 53),
  ('main-dishes', 'طبق تكة دجاج', 'قطع دجاج متبلة ومشوية تقدم مع الخضار والخبز.', 0, 'kitchen', false, 54),
  ('main-dishes', 'طبق الأربعاء والجمعة: مسكوف ودولمة', 'طبق خاص يقدم يومي الأربعاء والجمعة ويضم سمك المسكوف مع الدولمة العراقية.', 0, 'kitchen', false, 55),
  ('main-dishes', 'طبق الثلاثاء: دولمة', 'دولمة عراقية تقدم كطبق خاص كل يوم ثلاثاء.', 0, 'kitchen', false, 56),
  ('main-dishes', 'باجة يوم الخميس', 'باجة عراقية تقدم كطبق خاص يوم الخميس.', 0, 'kitchen', false, 57),
  ('sweets', 'تمرية بغدادية', 'تحفة من الطحين والتمر المحمّص، تقدم دافئة مع رشة سكر بودرة.', 6000, 'kitchen', true, 58),
  ('sweets', 'حلاوة شعرية', 'شعرية محمصة بالزبدة وتغمر بالقطر، تقدم مزينة بالفستق.', 7000, 'kitchen', true, 59),
  ('hot-drinks', 'جاي وحليب', 'مزيج من الشاي والحليب الساخن يقدم بطابع بيتي دافئ.', 4500, 'barista', true, 65),
  ('hot-drinks', 'إسبريسو', 'قهوة مركزة بطبقة كريما ناعمة لمحبي الطعم القوي.', 4000, 'barista', true, 67),
  ('hot-drinks', 'أمريكانو', 'إسبريسو مع ماء ساخن بطعم متوازن وخفيف.', 4500, 'barista', true, 68),
  ('hot-drinks', 'فلات وايت', 'قهوة غنية بالحليب بقوام مخملي وطعم أوضح من اللاتيه.', 6000, 'barista', true, 71),
  ('hot-drinks', 'موكا', 'قهوة بالحليب والشوكولاتة بطعم دافئ وغني.', 6000, 'barista', true, 72),
  ('hot-drinks', 'ماكياتو', 'إسبريسو مع لمسة حليب ورغوة خفيفة.', 5000, 'barista', true, 73),
  ('hot-drinks', 'هوت شوكليت', 'شوكولاتة ساخنة بالحليب، كثيفة وناعمة.', 5500, 'barista', true, 74),
  ('hot-drinks', 'قهوة تركية', 'قهوة تركية ثقيلة تقدم بأسلوب كلاسيكي.', 4500, 'barista', true, 75),
  ('cold-drinks', 'كركديه مثلج', 'كجرات بارد بلونه الأحمر ونكهته الحامضة.', 3500, 'drinks', true, 79),
  ('cold-drinks', 'آيس أمريكانو', 'إسبريسو مع ماء بارد وثلج لطعم قوي ومنعش.', 5000, 'drinks', true, 80),
  ('cold-drinks', 'سبانش لاتيه بارد', 'قهوة باردة بالحليب المحلى، ناعمة وغنية.', 6500, 'drinks', true, 82),
  ('cold-drinks', 'كراميل آيس لاتيه', 'لاتيه بارد مع صوص الكراميل ولمسة حلاوة متوازنة.', 6500, 'drinks', true, 83),
  ('cold-drinks', 'فرابتشينو', 'قهوة مثلجة مخفوقة بالحليب والثلج بطعم كريمي.', 7000, 'drinks', true, 84),
  ('cold-drinks', 'موكا بارد', 'قهوة باردة بالشوكولاتة والحليب والثلج.', 6500, 'drinks', true, 85),
  ('cold-drinks', 'عصير برتقال', 'عصير برتقال طازج ومنعش.', 6000, 'drinks', true, 86),
  ('cold-drinks', 'عصير رمان', 'عصير رمان بارد بطعم حامض وحلو متوازن.', 7000, 'drinks', true, 87),
  ('cold-drinks', 'عصير كوكتيل', 'مزيج منعش من الفواكه الطازجة محضر عند الطلب.', 0, 'drinks', false, 89),
  ('mojito', 'موهيتو بلو بيري', 'توت أزرق مع نعناع وليمون وصودا بطعم بارد وغني.', 7000, 'drinks', true, 93),
  ('mojito', 'موهيتو خاتون', 'خلطة خاصة من الليمون والنعناع والفواكه الموسمية بطابع البيت.', 7500, 'drinks', true, 95),
  ('herbal-drinks', 'شاي بابونج', 'زهور بابونج مهدئة تقدم دافئة.', 3000, 'drinks', true, 99)
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
  missing_items.name_ar,
  missing_items.description_ar,
  missing_items.price::numeric(12,0),
  missing_items.preparation_station,
  missing_items.is_available,
  missing_items.sort_order
from missing_items
join public.menu_categories category on category.name_en = missing_items.category_name_en
on conflict (category_id, name_ar) do nothing;
