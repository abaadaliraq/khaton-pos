import { AiInventoryMonitorPanel } from "@/components/inventory/AiInventoryMonitorPanel";

export function AiOperationsPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">مركز القرار</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">التحليل الذكي</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">تحليل بيانات التشغيل والمخزون للمساعدة في اتخاذ القرار</p>
      </section>

      <AiInventoryMonitorPanel />
    </div>
  );
}
