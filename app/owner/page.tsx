import { BarChart3, Boxes, Landmark, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import { OwnerPlaceholderPage } from "@/components/owner/OwnerPlaceholderPage";

const cards = [
  { title: "الحسابات", description: "متابعة المصروفات والمدفوعات والمستحقات المالية للمطعم لاحقاً.", icon: Landmark },
  { title: "المشتريات", description: "متابعة طلبات الشراء والفواتير وحالة التوريد لاحقاً.", icon: ShoppingCart },
  { title: "الموردون", description: "متابعة الموردين والمبالغ المستحقة وسجل التعامل لاحقاً.", icon: Truck },
  { title: "المخزون", description: "متابعة قيمة المخزون والمواد المنخفضة والنافدة لاحقاً.", icon: Boxes },
  { title: "التقارير", description: "متابعة التقارير المالية والتشغيلية للمطعم لاحقاً.", icon: BarChart3 },
];

export default function OwnerPage() {
  return (
    <div className="space-y-5">
      <OwnerPlaceholderPage
        title="الرئيسية"
        description="متابعة المؤشرات المالية والتشغيلية للمطعم."
        message="سيتم ربط مؤشرات لوحة الشركاء في المرحلة التالية. هذه الصفحة لا تحتوي حالياً على أي عمليات إضافة أو تعديل أو دفع أو استلام."
        icon={TrendingUp}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#f5eee6] text-[#a65f3f]">
                <Icon size={19} />
              </div>
              <h3 className="font-semibold text-[#2f211c]">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#7c6b60]">{card.description}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
