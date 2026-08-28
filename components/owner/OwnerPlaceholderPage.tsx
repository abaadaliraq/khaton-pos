import type { LucideIcon } from "lucide-react";

export function OwnerPlaceholderPage({
  title,
  description,
  message,
  icon: Icon,
}: {
  title: string;
  description: string;
  message: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة الشركاء</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#2f211c]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">{description}</p>
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#f5eee6] text-[#a65f3f]">
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[#2f211c]">قراءة فقط</h3>
            <p className="mt-1 text-sm leading-6 text-[#7c6b60]">{message}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
