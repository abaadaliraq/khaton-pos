import { BellRing, Building2, ClipboardCheck, MenuSquare, Printer, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SettingRow = {
  setting: string;
  value: string;
  action: string;
  notes: string;
  tone?: "active" | "readonly" | "inactive";
};

type SettingSection = {
  title: string;
  description: string;
  icon: LucideIcon;
  rows: SettingRow[];
};

const packageVersion = "0.1.0";

function environmentLabel() {
  if (process.env.NODE_ENV === "production") return "بيئة إنتاج";
  if (process.env.NODE_ENV === "development") return "بيئة تطوير";
  if (process.env.NODE_ENV === "test") return "بيئة اختبار";
  return "غير محددة";
}

function connectionStatusLabel() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? "مهيأ" : "غير مفعّل حالياً";
}

function toneClass(tone: SettingRow["tone"]) {
  if (tone === "active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (tone === "inactive") return "bg-stone-100 text-[#6f6258] border-stone-200";
  return "bg-[#fff7ed] text-[#8a4d2f] border-[#ead6bf]";
}

function StatusPill({ row }: { row: SettingRow }) {
  return (
    <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + toneClass(row.tone)}>
      {row.action}
    </span>
  );
}

function SettingsTable({ section }: { section: SettingSection }) {
  const Icon = section.icon;

  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e4d8c8] bg-white text-[#a65f3f]">
            <Icon size={18} />
          </span>
          <div>
            <h2 className="font-semibold text-[#2f211c]">{section.title}</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">{section.description}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-right text-sm">
          <thead className="bg-[#f5eee6] text-[#4a3b34]">
            <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
              <th className="w-[24%] px-3 py-3 font-semibold">الإعداد</th>
              <th className="w-[26%] px-3 py-3 font-semibold">القيمة الحالية</th>
              <th className="w-[20%] px-3 py-3 font-semibold">الإجراء / التعديل</th>
              <th className="px-3 py-3 font-semibold">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee4d8]">
            {section.rows.map((row) => (
              <tr key={row.setting} className="hover:bg-[#fffaf4] [&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                <td className="whitespace-normal px-3 py-3 font-semibold leading-6 text-[#2f211c]">{row.setting}</td>
                <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{row.value}</td>
                <td className="px-3 py-3"><StatusPill row={row} /></td>
                <td className="whitespace-normal px-3 py-3 leading-6 text-[#6f6258]">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminSettingsPage() {
  const sections: SettingSection[] = [
    {
      title: "بيانات المطعم",
      description: "بيانات العرض العامة المستخدمة حالياً في الواجهات والطباعة.",
      icon: Building2,
      rows: [
        { setting: "اسم المطعم", value: "مطعم وكافيه خاتون", action: "قراءة فقط", notes: "الاسم مستخدم حالياً في الفواتير والسندات.", tone: "readonly" },
        { setting: "الهاتف", value: "غير مفعّل حالياً", action: "غير قابل للتعديل", notes: "لا يوجد إعداد مركزي محفوظ للهاتف حالياً.", tone: "inactive" },
        { setting: "العنوان", value: "غير مفعّل حالياً", action: "غير قابل للتعديل", notes: "لا يوجد إعداد مركزي محفوظ للعنوان حالياً.", tone: "inactive" },
        { setting: "الشعار", value: "/brand/khaton-logo.png", action: "قراءة فقط", notes: "الشعار موجود كملف ثابت ويظهر في شاشة الدخول وسندات الدفع.", tone: "readonly" },
        { setting: "ملاحظات الفاتورة", value: "شكراً لزيارتكم", action: "قراءة فقط", notes: "النص موجود حالياً داخل مكوّن طباعة فاتورة الكاشير.", tone: "readonly" },
      ],
    },
    {
      title: "إعدادات التشغيل",
      description: "قيم تشغيلية مستخدمة حالياً في النظام بدون إضافة منطق جديد.",
      icon: Settings2,
      rows: [
        { setting: "المنطقة الزمنية", value: "توقيت بغداد", action: "قراءة فقط", notes: "كل العرض التشغيلي يعتمد Asia/Baghdad في الكود الحالي.", tone: "readonly" },
        { setting: "الحد الأدنى لإغلاق الوردية", value: "15 ساعة", action: "قراءة فقط", notes: "مطبق على مستوى قاعدة البيانات ضمن Workflow الورديات الحالي.", tone: "active" },
        { setting: "العملة", value: "دينار عراقي", action: "قراءة فقط", notes: "تنسيق المبالغ يستخدم د.ع عبر دوال التنسيق الحالية.", tone: "readonly" },
        { setting: "محطات التحضير", value: "المطبخ، الباريستا", action: "قراءة فقط", notes: "التوجيه التشغيلي يعتمد المحطات الموجودة حالياً في الطلبات.", tone: "active" },
        { setting: "تحديث البيانات اللحظي", value: "مفعّل حسب الصفحة والدور", action: "قراءة فقط", notes: "يعتمد اشتراكات Supabase Realtime الموجودة في الواجهات التشغيلية.", tone: "active" },
      ],
    },
    {
      title: "إعدادات الطباعة",
      description: "عرض حالة قوالب الطباعة الحالية بدون تعديل القوالب أو الحسابات.",
      icon: Printer,
      rows: [
        { setting: "شعار الفاتورة", value: "غير مفعّل في فاتورة الكاشير الحالية", action: "غير قابل للتعديل", notes: "فاتورة الكاشير النصية الحالية لا تعرض صورة الشعار.", tone: "inactive" },
        { setting: "اسم المطعم", value: "مطعم وكافيه خاتون", action: "قراءة فقط", notes: "موجود في فاتورة الكاشير وسند دفع المورد.", tone: "readonly" },
        { setting: "ورق A4", value: "مفعّل لسند دفع المورد", action: "قراءة فقط", notes: "سند دفع المورد يستخدم صفحة A4 عند الطباعة.", tone: "active" },
        { setting: "طابعة حرارية 80 ملم", value: "مفعّلة لفاتورة الكاشير", action: "قراءة فقط", notes: "قالب فاتورة الطاولة معد للطباعة الحرارية.", tone: "active" },
        { setting: "ملاحظات السند والفاتورة", value: "نصوص ثابتة حالياً", action: "قراءة فقط", notes: "لا يوجد محرر إعدادات مركزي لهذه النصوص حالياً.", tone: "readonly" },
      ],
    },
    {
      title: "إعدادات المنيو",
      description: "خيارات العرض الحالية والمستقبلية للمنيو كما تظهر في واجهات التشغيل.",
      icon: MenuSquare,
      rows: [
        { setting: "عرض الأصناف غير المتاحة", value: "مفعّل حسب بيانات المنيو الحالية", action: "قراءة فقط", notes: "لا يوجد مفتاح إعداد مركزي مستقل لهذا الخيار حالياً.", tone: "readonly" },
        { setting: "عرض الصور إذا تمت إضافتها مستقبلاً", value: "جاهز بصرياً جزئياً", action: "قراءة فقط", notes: "المنيو يستخدم بدائل بصرية حالياً ولا يوجد حقل صورة في قاعدة البيانات.", tone: "readonly" },
        { setting: "ترتيب الأقسام", value: "حسب ترتيب بيانات المنيو الحالية", action: "قراءة فقط", notes: "لا يوجد محرر إعدادات منفصل لترتيب الأقسام في هذه الصفحة.", tone: "readonly" },
      ],
    },
    {
      title: "إعدادات التنبيهات",
      description: "ملخص معلومات الإشعارات التشغيلية الموجودة فقط.",
      icon: BellRing,
      rows: [
        { setting: "التحديث اللحظي", value: "مفعّل", action: "قراءة فقط", notes: "يتابع الطلبات وطلبات المواد وطلبات الشراء والورديات حسب الدور.", tone: "active" },
        { setting: "الصوت", value: "مفعّل للأدوار التشغيلية", action: "قراءة فقط", notes: "الصوت يتطلب تفاعل المستخدم أولاً ومالك النظام يعرض التنبيهات بصرياً فقط.", tone: "active" },
        { setting: "تنبيهات حسب الدور", value: "مفعّلة", action: "قراءة فقط", notes: "كل دور يرى التنبيهات المناسبة له فقط.", tone: "active" },
      ],
    },
    {
      title: "معلومات النظام",
      description: "معلومات آمنة بدون عرض مفاتيح أو أسرار.",
      icon: ClipboardCheck,
      rows: [
        { setting: "اسم النظام", value: "Khatoun POS", action: "قراءة فقط", notes: "اسم الحزمة والتطبيق الحالي.", tone: "readonly" },
        { setting: "الإصدار", value: packageVersion, action: "قراءة فقط", notes: "مأخوذ من إصدار المشروع الحالي.", tone: "readonly" },
        { setting: "آخر بناء", value: "غير متاح داخل التطبيق", action: "غير قابل للتعديل", notes: "لا يوجد رقم Build محفوظ في config عام حالياً.", tone: "inactive" },
        { setting: "حالة الاتصال", value: connectionStatusLabel(), action: "قراءة فقط", notes: "يعرض فقط هل إعداد رابط الاتصال العام موجود، بدون كشف الرابط.", tone: "readonly" },
        { setting: "بيئة التشغيل", value: environmentLabel(), action: "قراءة فقط", notes: "تعرض نوع البيئة فقط ولا تعرض أي مفاتيح أو أسرار.", tone: "readonly" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة الإدارة</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">الإعدادات</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">عرض منظم للإعدادات الحالية والقيم غير المفعّلة، بدون تغيير منطق النظام أو قاعدة البيانات.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-[#e4d8c8] bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-[#7c6b60]">النمط</p>
          <p className="mt-1 font-semibold text-[#2f211c]">قراءة إعدادات</p>
        </div>
        <div className="rounded-md border border-[#e4d8c8] bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-[#7c6b60]">قاعدة البيانات</p>
          <p className="mt-1 font-semibold text-[#2f211c]">بدون تعديل</p>
        </div>
        <div className="rounded-md border border-[#e4d8c8] bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-[#7c6b60]">العملة</p>
          <p className="mt-1 font-semibold text-[#2f211c]">د.ع</p>
        </div>
        <div className="rounded-md border border-[#e4d8c8] bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-[#7c6b60]">التوقيت</p>
          <p className="mt-1 font-semibold text-[#2f211c]">بغداد</p>
        </div>
      </section>

      {sections.map((section) => (
        <SettingsTable key={section.title} section={section} />
      ))}
    </div>
  );
}
