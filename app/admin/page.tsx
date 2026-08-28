import Link from "next/link";
import { ArrowLeft, ClipboardList, Settings, Table2, UsersRound, Utensils } from "lucide-react";

const adminSections = [
  { title: "المنيو", description: "إدارة تصنيفات وأصناف المنيو وحالة البيع.", href: "/admin/menu", icon: Utensils },
  { title: "العمال", description: "إدارة بيانات العمال وحسابات النظام التشغيلية.", href: "/admin/staff", icon: UsersRound },
  { title: "الطاولات", description: "إدارة توزيع الطاولات وحالتها التشغيلية.", href: "/admin/tables", icon: Table2 },
  { title: "سجل العمليات", description: "مراجعة العمليات المسجلة داخل النظام.", href: "/admin/audit", icon: ClipboardList },
  { title: "الإعدادات", description: "إعدادات النظام العامة.", href: "/admin/settings", icon: Settings },
];

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">مدير النظام</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">لوحة إدارة النظام</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">إدارة إعدادات وتشغيل نظام خاتون.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href} className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm transition hover:border-[#d8c5b4] hover:bg-[#fffaf4]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#f5eee6] text-[#a65f3f]">
                  <Icon size={20} />
                </div>
                <ArrowLeft className="mt-2 text-[#9a8779]" size={16} />
              </div>
              <h2 className="mt-4 font-semibold text-[#2f211c]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#7c6b60]">{section.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
