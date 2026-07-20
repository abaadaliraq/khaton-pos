import type { Category, MenuItem } from "@/types/pos";

export const categories: Category[] = [
  { id: "all", name: "الكل" },
  { id: "soups", name: "الشوربات" },
  { id: "baghdadi-breakfast", name: "الفطور البغدادي" },
  { id: "sandwiches", name: "السندويشات" },
  { id: "cold-appetizers", name: "المقبلات الباردة" },
  { id: "hot-appetizers", name: "المقبلات الحارة" },
  { id: "salads", name: "السلطات" },
  { id: "main-dishes", name: "الأطباق الرئيسية" },
  { id: "sweets", name: "الحلويات" },
  { id: "hot-drinks", name: "المشروبات الساخنة" },
  { id: "cold-drinks", name: "المشروبات الباردة" },
  { id: "mojito", name: "الموهيتو" },
  { id: "herbal-drinks", name: "المشروبات العشبية" },
  { id: "hookah", name: "النراكيل" },
];

export const menuItems: MenuItem[] = [
  { id: "lentil-soup", categoryId: "soups", name: "شوربة عدس", description: "عدس عراقي كريمي مع ليمون وخبز محمص.", price: 5000 },
  { id: "red-potato-soup", categoryId: "soups", name: "شوربة بطاطا حمرة", description: "بطاطا حمراء وأعشاب تقدم ساخنة.", price: 6000 },
  { id: "onion-soup", categoryId: "soups", name: "شوربة بصل", description: "بصل مطهو ببطء مع خبز محمص.", price: 7000 },
  { id: "veg-soup", categoryId: "soups", name: "شوربة خضار", description: "خضار موسمية خفيفة بنكهة بيتية.", price: 0 },

  { id: "khatoun-breakfast", categoryId: "baghdadi-breakfast", name: "فطور خاتون لشخصين", description: "صينية فطور بغدادية مع قيمر ودبس وشاي.", price: 18000 },
  { id: "geimar-dibs", categoryId: "baghdadi-breakfast", name: "قيمر ودبس", description: "قيمر عراقي مع دبس التمر وخبز حار.", price: 7000 },
  { id: "bagila", categoryId: "baghdadi-breakfast", name: "تشريب باقلاء", description: "باقلاء دافئة مع خبز وبيض حسب الطلب.", price: 7000 },
  { id: "makhlama", categoryId: "baghdadi-breakfast", name: "مخلمة عراقية", description: "بيض مع لحم وبصل وطماطة.", price: 6500 },
  { id: "egg-tomato", categoryId: "baghdadi-breakfast", name: "بيض وطماطة", description: "طبق فطور سريع بتتبيلة عراقية.", price: 5000 },

  { id: "aroug-sandwich", categoryId: "sandwiches", name: "سندويش كباب عروگ", description: "عروگ مقلي مع طماطة وبصل بخبز التنور.", price: 5000 },
  { id: "tongue-sandwich", categoryId: "sandwiches", name: "سندويش لسان", description: "شرائح لسان مطهوة مع مخللات.", price: 5000 },
  { id: "makhlama-sandwich", categoryId: "sandwiches", name: "سندويش مخلمة", description: "مخلمة ملفوفة بخبز عراقي ساخن.", price: 4500 },
  { id: "chicken-tepsi-sandwich", categoryId: "sandwiches", name: "سندويش تبسي دجاج", description: "دجاج وباذنجان وبطاطا بصلصة طماطة.", price: 5000 },
  { id: "cheese-sandwich", categoryId: "sandwiches", name: "سندويش جبن عرب", description: "جبن عربي طري مع خضار.", price: 4500 },

  { id: "hummus", categoryId: "cold-appetizers", name: "حمص لبلبي", description: "حمص مع ليمون وكمون وزيت زيتون.", price: 4000 },
  { id: "cold-bagila", categoryId: "cold-appetizers", name: "باقلاء", description: "باقلاء عراقية دافئة مع الليمون.", price: 4000 },
  { id: "jajik", categoryId: "cold-appetizers", name: "جاجيك", description: "لبن بالخيار والثوم والأعشاب.", price: 3500 },
  { id: "hummus-meat", categoryId: "cold-appetizers", name: "حمص باللحمة", description: "حمص كريمي مع قطع لحم متبلة.", price: 6500 },
  { id: "baba-ghanoush", categoryId: "cold-appetizers", name: "بابا غنوج", description: "باذنجان مشوي وطحينية.", price: 0 },

  { id: "tongue-hot", categoryId: "hot-appetizers", name: "لسان", description: "لسان مطهو بتتبيلة غنية ويقدم ساخنًا.", price: 0 },
  { id: "aroug-hot", categoryId: "hot-appetizers", name: "عروك", description: "أقراص عراقية مقلية باللحم والخضار.", price: 0 },
  { id: "mosul-kubba", categoryId: "hot-appetizers", name: "كبة موصلية مقلية", description: "كبة محشوة باللحم والتوابل.", price: 0 },
  { id: "fried-potato", categoryId: "hot-appetizers", name: "بطاطا مقلية", description: "بطاطا ذهبية مقرمشة.", price: 4000 },

  { id: "iraqi-salad", categoryId: "salads", name: "سلطة عراقية", description: "طماطة وخيار وبصل وليمون.", price: 4000 },
  { id: "fattoush", categoryId: "salads", name: "فتوش", description: "خضار طازجة وخبز مقرمش ودبس رمان.", price: 5000 },
  { id: "tabbouleh", categoryId: "salads", name: "تبولة", description: "بقدونس وبرغل وليمون وزيت زيتون.", price: 5000 },
  { id: "rocket-salad", categoryId: "salads", name: "سلطة جرجير", description: "جرجير ورمان وجبن خفيف.", price: 6000 },

  { id: "dolma", categoryId: "main-dishes", name: "دولمة خاتون", description: "ورق عنب وخضار محشية بطريقة عراقية.", price: 16000 },
  { id: "tepsi", categoryId: "main-dishes", name: "تبسي باذنجان", description: "باذنجان وبطاطا ولحم بصلصة الطماطة.", price: 12000 },
  { id: "iraqi-kebab", categoryId: "main-dishes", name: "كباب عراقي", description: "كباب مشوي مع خبز وخضار.", price: 14000 },
  { id: "rice-meat", categoryId: "main-dishes", name: "تمن ولحم", description: "رز عراقي مع لحم مطبوخ بهدوء.", price: 18000 },
  { id: "chicken-biryani", categoryId: "main-dishes", name: "برياني دجاج", description: "رز متبل ودجاج وخضار.", price: 13000 },

  { id: "date-brownie", categoryId: "sweets", name: "براوني التمر", description: "براوني ناعم بالتمر والكاكاو.", price: 8000 },
  { id: "kleicha", categoryId: "sweets", name: "كليجة تمر", description: "كليجة محشوة تمر ورائحة هيل.", price: 6000 },
  { id: "zarda", categoryId: "sweets", name: "زردة", description: "رز بالزعفران والسكر والقرفة.", price: 6500 },
  { id: "kunafa", categoryId: "sweets", name: "كنافة جبن", description: "كنافة دافئة بجبن وقطر.", price: 7000 },

  { id: "coal-tea", categoryId: "hot-drinks", name: "شاي على الفحم", description: "شاي عراقي ثقيل بطعم دافئ.", price: 3000 },
  { id: "iraqi-coffee", categoryId: "hot-drinks", name: "قهوة عراقية", description: "قهوة داكنة وغنية.", price: 4000 },
  { id: "karak", categoryId: "hot-drinks", name: "جاي كرك", description: "شاي مطبوخ بالحليب والتوابل.", price: 5000 },
  { id: "cappuccino", categoryId: "hot-drinks", name: "كابتشينو", description: "إسبريسو وحليب مبخر ورغوة.", price: 5500 },
  { id: "latte", categoryId: "hot-drinks", name: "لاتيه", description: "قهوة ناعمة بالحليب.", price: 5500 },

  { id: "mint-lemonade", categoryId: "cold-drinks", name: "ليمونادة بالنعناع", description: "ليمون ونعناع وثلج.", price: 6000 },
  { id: "iced-raisin", categoryId: "cold-drinks", name: "زبيب مثلج", description: "مشروب زبيب بارد ومنعش.", price: 4500 },
  { id: "ayran", categoryId: "cold-drinks", name: "لبن عيران", description: "لبن بارد خفيف.", price: 3500 },
  { id: "iced-latte", categoryId: "cold-drinks", name: "آيس لاتيه", description: "قهوة باردة مع حليب وثلج.", price: 6000 },
  { id: "banana-juice", categoryId: "cold-drinks", name: "عصير موز", description: "عصير طازج يحضر عند الطلب.", price: 0 },

  { id: "classic-mojito", categoryId: "mojito", name: "موهيتو كلاسيك", description: "ليمون ونعناع وصودا.", price: 6000 },
  { id: "strawberry-mojito", categoryId: "mojito", name: "موهيتو فراولة", description: "فراولة ونعناع وليمون.", price: 6500 },
  { id: "passion-mojito", categoryId: "mojito", name: "موهيتو باشن فروت", description: "نكهة استوائية منعشة.", price: 7000 },
  { id: "pomegranate-mojito", categoryId: "mojito", name: "موهيتو رمان", description: "رمان ونعناع بارد.", price: 7000 },

  { id: "hibiscus", categoryId: "herbal-drinks", name: "كجرات حار / بارد", description: "كركديه بطعم حامض متوازن.", price: 3000 },
  { id: "anise", categoryId: "herbal-drinks", name: "ينسون بالعسل", description: "ينسون طبيعي محلى بالعسل.", price: 3500 },
  { id: "noomi", categoryId: "herbal-drinks", name: "شاي نومي حامض عراقي", description: "ليمون مجفف دافئ ومنعش.", price: 3500 },
  { id: "mint-tea", categoryId: "herbal-drinks", name: "شاي نعناع أخضر طازج", description: "نعناع طازج مغلي.", price: 3000 },

  { id: "double-apple", categoryId: "hookah", name: "نركيلة تفاحتين خاتون", description: "نكهة كلاسيكية ثابتة.", price: 12000 },
  { id: "grape-mint", categoryId: "hookah", name: "نركيلة عنب ونعناع", description: "عنب ونعناع بطعم بارد.", price: 12000 },
  { id: "lemon-mint-hookah", categoryId: "hookah", name: "نركيلة ليمون ونعناع", description: "حمضيات ونعناع خفيف.", price: 12000 },
  { id: "special-hookah", categoryId: "hookah", name: "نركيلة خاتون الخاصة", description: "خلطة بيتية هادئة.", price: 0 },
];
