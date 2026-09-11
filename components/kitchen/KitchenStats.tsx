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
          <article key={stat.label} className="rounded-lg border border-[#E1D3C2] bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#6F6258]">{stat.label}</span>
              <Icon style={{ color: stat.color }} size={20} />
            </div>
            <p className="mt-2 text-2xl font-black text-[#2C211D]">{stat.value}</p>
          </article>
        );
      })}
    </section>
  );
}
