import { BarChart3 } from "lucide-react";
import { OwnerPlaceholderPage } from "@/components/owner/OwnerPlaceholderPage";

export default function OwnerReportsPage() {
  return (
    <OwnerPlaceholderPage
      title="التقارير"
      description="متابعة التقارير المالية والتشغيلية للمطعم."
      message="سيتم ربط تقارير الشركاء في المرحلة التالية."
      icon={BarChart3}
    />
  );
}
