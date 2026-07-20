import { AlertTriangle, CheckCircle2, Flame, Timer } from "lucide-react";

type KitchenStatsProps = {
  newCount: number;
  preparingCount: number;
  readyCount: number;
  lateCount: number;
};

export function KitchenStats({ newCount, preparingCount, readyCount, lateCount }: KitchenStatsProps) {
  const stats = [
    { label: "طلبات جديدة", value: newCount, icon: Flame, color: "#D88A3D" },
    { label: "قيد التحضير", value: preparingCount, icon: Timer, color: "#3D7F8A" },
    { label: "جاهزة", value: readyCount, icon: CheckCircle2, color: "#3E8B65" },
    { label: "متأخرة", value: lateCount, icon: AlertTriangle, color: "#B94B43" },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <article key={stat.label} className="rounded-lg border border-white/10 bg-[#24211E] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#C9BEB2]">{stat.label}</span>
              <Icon style={{ color: stat.color }} size={20} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-[#FFF8EE]">{stat.value}</p>
          </article>
        );
      })}
    </section>
  );
}
