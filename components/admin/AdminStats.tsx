import { BadgeCheck, BriefcaseBusiness, PauseCircle, UserCog, UsersRound } from "lucide-react";
import type { StaffStatistics } from "@/types/staff";

const cards = [
  { key: "total", label: "إجمالي العمال", icon: UsersRound },
  { key: "active", label: "نشط", icon: BadgeCheck },
  { key: "onLeave", label: "في إجازة", icon: PauseCircle },
  { key: "withSystemAccess", label: "حسابات نظام", icon: UserCog },
] as const;

export function AdminStats({ statistics }: { statistics: StaffStatistics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7c6b60]">{card.label}</span>
              <Icon size={19} className="text-[#a65f3f]" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-[#2f211c]">{statistics[card.key]}</p>
          </div>
        );
      })}
      <div className="rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-4 shadow-sm xl:hidden">
        <div className="flex items-center gap-2 text-sm text-[#7c6b60]"><BriefcaseBusiness size={18} /> غير نشط/منتهي</div>
        <p className="mt-3 text-xl font-semibold text-[#2f211c]">{statistics.inactive + statistics.terminated}</p>
      </div>
    </section>
  );
}
