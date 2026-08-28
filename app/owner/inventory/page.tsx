import { Boxes } from "lucide-react";
import { OwnerPlaceholderPage } from "@/components/owner/OwnerPlaceholderPage";

export default function OwnerInventoryPage() {
  return (
    <OwnerPlaceholderPage
      title="المخزون"
      description="متابعة قيمة المخزون والمواد المنخفضة والنافدة وحركة المواد."
      message="سيتم ربط مؤشرات المخزون في المرحلة التالية."
      icon={Boxes}
    />
  );
}
