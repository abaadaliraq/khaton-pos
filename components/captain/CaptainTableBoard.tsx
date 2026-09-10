import { BellRing, Clock3, DoorOpen, Plus, ReceiptText, Sparkles, UsersRound } from "lucide-react";
import type { RestaurantOrderStatus, RestaurantTable } from "@/types/pos";

export type CaptainTablePresentationStatus =
  | "all"
  | "available"
  | "occupied"
  | "preparing"
  | "ready"
  | "awaiting_payment"
  | "needs_clearing";

type CaptainTableBoardProps = {
  tables: RestaurantTable[];
  selectedTable: RestaurantTable | null;
  activeFilter: CaptainTablePresentationStatus;
  onFilterChange: (status: CaptainTablePresentationStatus) => void;
  onTableSelect: (table: RestaurantTable) => void;
  onConfirmServed: (table: RestaurantTable) => void;
  onReleaseTable: (table: RestaurantTable) => void;
  confirmingServedOrderId: string | null;
  releasingTableId: number | null;
};

const statusPriority: CaptainTablePresentationStatus[] = [
  "needs_clearing",
  "ready",
  "awaiting_payment",
  "preparing",
  "occupied",
  "available",
];

const statusMeta: Record<
  Exclude<CaptainTablePresentationStatus, "all">,
  { label: string; tone: string; icon: typeof UsersRound; action: string }
> = {
  available: { label: "فارغة", tone: "border-emerald-500 bg-emerald-50 text-emerald-800", icon: Plus, action: "بدء طلب" },
  occupied: { label: "مشغولة", tone: "border-stone-400 bg-white text-stone-900", icon: UsersRound, action: "فتح التفاصيل" },
  preparing: { label: "قيد التحضير", tone: "border-amber-500 bg-amber-50 text-amber-900", icon: Clock3, action: "متابعة" },
  ready: { label: "جاهز للتقديم", tone: "border-[#ff5656] bg-[#fff1f1] text-[#b42323]", icon: BellRing, action: "تم التقديم" },
  awaiting_payment: { label: "بانتظار الدفع", tone: "border-sky-500 bg-sky-50 text-sky-900", icon: ReceiptText, action: "عرض" },
  needs_clearing: { label: "تحتاج إخلاء", tone: "border-violet-500 bg-violet-50 text-violet-900", icon: DoorOpen, action: "إخلاء" },
};

const filterLabels: Record<CaptainTablePresentationStatus, string> = {
  all: "الكل",
  available: "فارغة",
  occupied: "مشغولة",
  preparing: "قيد التحضير",
  ready: "جاهز للتقديم",
  awaiting_payment: "بانتظار الدفع",
  needs_clearing: "تحتاج إخلاء",
};

function orderHasStatus(table: RestaurantTable, statuses: RestaurantOrderStatus[]) {
  return table.orders?.some((order) => statuses.includes(order.status)) ?? false;
}

export function getCaptainTableStatus(table: RestaurantTable): Exclude<CaptainTablePresentationStatus, "all"> {
  if (table.status === "available") {
    return "available";
  }

  if (table.canRelease) {
    return "needs_clearing";
  }

  if (orderHasStatus(table, ["ready"]) || table.currentOrder?.status === "ready") {
    return "ready";
  }

  if (orderHasStatus(table, ["awaiting_payment"]) || table.currentOrder?.status === "awaiting_payment") {
    return "awaiting_payment";
  }

  if (table.hasBusyOrders || orderHasStatus(table, ["submitted", "preparing"])) {
    return "preparing";
  }

  return "occupied";
}

function getStatusCount(tables: RestaurantTable[], status: CaptainTablePresentationStatus) {
  if (status === "all") {
    return tables.length;
  }

  return tables.filter((table) => getCaptainTableStatus(table) === status).length;
}

function getRoundText(table: RestaurantTable) {
  const count = table.sessionOrderCount ?? table.orders?.length ?? 0;
  if (count === 0) {
    return "لا توجد جولة";
  }

  return count === 1 ? "جولة واحدة" : `${count} جولات`;
}

export function CaptainTableBoard({
  tables,
  selectedTable,
  activeFilter,
  onFilterChange,
  onTableSelect,
  onConfirmServed,
  onReleaseTable,
  confirmingServedOrderId,
  releasingTableId,
}: CaptainTableBoardProps) {
  const readyTables = tables.filter((table) => getCaptainTableStatus(table) === "ready");
  const visibleTables = tables.filter((table) => activeFilter === "all" || getCaptainTableStatus(table) === activeFilter);

  return (
    <section className="captain-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="captain-muted text-xs font-bold">01 الطاولات</p>
          <h1 className="captain-heading text-2xl font-black">لوحة الطاولات</h1>
        </div>
        {readyTables.length > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#ff5656] bg-[#fff1f1] px-3 py-2 text-sm font-black text-[#b42323]">
            <BellRing size={18} />
            {readyTables.length} جاهز للتقديم
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {(["all", ...statusPriority] as CaptainTablePresentationStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            data-active={activeFilter === status}
            onClick={() => onFilterChange(status)}
            className="captain-filter-button flex min-h-12 items-center justify-between gap-2 px-3 text-sm font-bold"
          >
            <span>{filterLabels[status]}</span>
            <span className="tabular-nums">{getStatusCount(tables, status)}</span>
          </button>
        ))}
      </div>

      {readyTables.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#ff5656]/45 bg-[#fff7f1] p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#b42323]">
            <Sparkles size={17} />
            أولوية التقديم الآن
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {readyTables.slice(0, 6).map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => onTableSelect(table)}
                className="flex items-center justify-between rounded-lg border border-[#ff5656]/35 bg-white px-3 py-2 text-right text-sm font-bold text-[#111]"
              >
                <span>طاولة {table.id}</span>
                <span className="text-[#b42323]">Round {table.currentOrder?.roundNo ?? "-"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {visibleTables.map((table) => {
          const status = getCaptainTableStatus(table);
          const meta = statusMeta[status];
          const Icon = meta.icon;
          const selected = selectedTable?.id === table.id;
          const isReadyAction = status === "ready" && table.currentOrder?.status === "ready";
          const isReleaseAction = status === "needs_clearing";
          const isWorking =
            (isReadyAction && confirmingServedOrderId === table.currentOrder?.id) || (isReleaseAction && releasingTableId === table.id);

          return (
            <article
              key={table.id}
              data-selected={selected}
              data-status={status}
              className="captain-table-tile min-h-36 rounded-lg border bg-white p-3"
            >
              <button type="button" onClick={() => onTableSelect(table)} className="block h-full w-full text-right">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="captain-muted text-xs font-bold">طاولة</p>
                    <h2 className="captain-heading text-3xl font-black tabular-nums">{table.id}</h2>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-black ${meta.tone}`}>
                    <Icon size={14} />
                    {meta.label}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                  <span className="rounded-lg bg-[#f7efe5] px-2 py-1 text-[#4b4035]">{getRoundText(table)}</span>
                  <span className="rounded-lg bg-[#f7efe5] px-2 py-1 text-[#4b4035]">
                    غير مدفوعة {table.unpaidOrderCount ?? 0}
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isWorking}
                onClick={() => {
                  if (isReadyAction) {
                    onConfirmServed(table);
                    return;
                  }

                  if (isReleaseAction) {
                    onReleaseTable(table);
                    return;
                  }

                  onTableSelect(table);
                }}
                className={status === "ready" ? "captain-primary-button mt-3 h-10 w-full text-sm font-black" : "captain-secondary-button mt-3 h-10 w-full text-sm font-black"}
              >
                {isWorking ? "جارٍ التنفيذ..." : meta.action}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
