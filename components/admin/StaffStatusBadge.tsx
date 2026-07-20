import clsx from "clsx";
import { staffStatusLabels, type StaffStatus } from "@/types/staff";

const statusClasses: Record<StaffStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  on_leave: "border-amber-200 bg-amber-50 text-amber-800",
  inactive: "border-stone-200 bg-stone-100 text-stone-700",
  terminated: "border-rose-200 bg-rose-50 text-rose-800",
};

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return <span className={clsx("inline-flex rounded-full border px-2 py-1 text-xs font-medium", statusClasses[status])}>{staffStatusLabels[status]}</span>;
}
