import { CashierTableCard } from "@/components/cashier/CashierTableCard";
import type { CashierTable } from "@/types/cashier";

type TablesGridProps = {
  tables: CashierTable[];
  selectedTableId: number | null;
  onSelect: (table: CashierTable) => void;
};

export function TablesGrid({ tables, selectedTableId, onSelect }: TablesGridProps) {
  if (tables.length === 0) {
    return (
      <div className="cashier-no-print flex min-h-64 items-center justify-center rounded-lg border border-dashed border-[#d8c9b7] bg-white text-[#7a665c]">
        لا توجد طاولات مطابقة
      </div>
    );
  }

  return (
    <section className="cashier-no-print grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tables.map((table) => (
        <CashierTableCard key={table.id} table={table} isSelected={selectedTableId === table.id} onSelect={onSelect} />
      ))}
    </section>
  );
}
