"use client";

import { useEffect, useMemo, useState } from "react";
import { BillPanel } from "@/components/cashier/BillPanel";
import { CashierFilters, type CashierFilter } from "@/components/cashier/CashierFilters";
import { CashierHeader } from "@/components/cashier/CashierHeader";
import { CashierStats } from "@/components/cashier/CashierStats";
import { CloseTableDialog } from "@/components/cashier/CloseTableDialog";
import { DiscountDialog } from "@/components/cashier/DiscountDialog";
import { OrderDetailsDialog } from "@/components/cashier/OrderDetailsDialog";
import { PaymentDialog } from "@/components/cashier/PaymentDialog";
import { PrintReceipt } from "@/components/cashier/PrintReceipt";
import { ShiftSummaryDialog } from "@/components/cashier/ShiftSummaryDialog";
import { TablesGrid } from "@/components/cashier/TablesGrid";
import { getBillTotals, getShiftSummary } from "@/lib/cashierCalculations";
import { getCashierTables } from "@/services/cashierService";
import { applyOrderDiscount, closePaidTable, recordOrderPayment } from "@/services/paymentService";
import type { UserSession } from "@/types/auth";
import type { CashierOrder, CashierTable, DiscountData, PaymentRecord } from "@/types/cashier";

type CashierPosAppProps = {
  session: UserSession;
};

export function CashierPosApp({ session }: CashierPosAppProps) {
  const [tables, setTables] = useState<CashierTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<CashierFilter>("all");
  const [message, setMessage] = useState("");
  const [isBillSheetOpen, setIsBillSheetOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCloseTableOpen, setIsCloseTableOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<CashierOrder | null>(null);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3200);
  }

  async function reloadTables() {
    const nextTables = await getCashierTables();
    setTables(nextTables);
    setSelectedTableId(
      (currentId) =>
        nextTables.find((table) => table.id === currentId)?.id ??
        nextTables.find((table) => table.order)?.id ??
        nextTables[0]?.id ??
        null,
    );
  }

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const nextTables = await getCashierTables();

        if (!isMounted) {
          return;
        }

        setTables(nextTables);
        setSelectedTableId(nextTables.find((table) => table.order)?.id ?? nextTables[0]?.id ?? null);
      } catch (error) {
        console.error("Failed to load cashier data", error);

        if (isMounted) {
          showMessage("تعذر تحميل بيانات المحاسب من Supabase.");
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? null,
    [selectedTableId, tables],
  );

  const selectedOrder = selectedTable?.order ?? null;

  const filteredTables = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tables.filter((table) => {
      const filterMatches = activeFilter === "all" || table.status === activeFilter;
      const searchMatches =
        normalizedSearch.length === 0 ||
        String(table.id).includes(normalizedSearch) ||
        table.order?.id.toLowerCase().includes(normalizedSearch);

      return filterMatches && searchMatches;
    });
  }, [activeFilter, searchTerm, tables]);

  const stats = useMemo(() => {
    const summary = getShiftSummary(tables);
    const unpaid = tables.reduce((total, table) => {
      if (!table.order || table.status === "paid") {
        return total;
      }

      return total + getBillTotals(table.order).remainingAmount;
    }, 0);

    return {
      openTables: summary.openTables,
      paidInvoices: summary.paidInvoices,
      sales: summary.totalSales,
      unpaid,
      summary,
    };
  }, [tables]);

  function selectTable(table: CashierTable) {
    if (!table.order) {
      showMessage("لا يوجد طلب مفتوح على هذه الطاولة");
      return;
    }

    setSelectedTableId(table.id);
    setIsBillSheetOpen(true);
  }

  async function applyDiscount(discount: DiscountData) {
    if (!selectedOrder) {
      return;
    }

    const subtotal = getBillTotals(selectedOrder).subtotal;
    const discountAmount = discount.type === "percent" ? Math.round((subtotal * discount.value) / 100) : discount.value;

    try {
      await applyOrderDiscount(selectedOrder.id, discountAmount, "خصم من واجهة المحاسب");
      await reloadTables();
      showMessage("تم تطبيق الخصم بنجاح");
    } catch (error) {
      console.error("Failed to apply discount", error);
      showMessage("تعذر تطبيق الخصم في Supabase.");
    }
  }

  async function removeDiscount() {
    if (!selectedOrder) {
      return;
    }

    try {
      await applyOrderDiscount(selectedOrder.id, 0, "إزالة الخصم من واجهة المحاسب");
      await reloadTables();
      showMessage("تمت إزالة الخصم");
    } catch (error) {
      console.error("Failed to remove discount", error);
      showMessage("تعذر إزالة الخصم في Supabase.");
    }
  }

  async function confirmPayment(payment: PaymentRecord) {
    if (!selectedOrder) {
      return;
    }

    if (payment.method === "mixed") {
      showMessage("الدفع المختلط يحتاج تمرير تفاصيل كل وسيلة دفع.");
      return;
    }

    try {
      await recordOrderPayment(selectedOrder.id, [
        {
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        },
      ]);
      await reloadTables();
      showMessage("تم تسجيل الدفع بنجاح");
    } catch (error) {
      console.error("Failed to record payment", error);
      showMessage("تعذر تسجيل الدفع في Supabase.");
    }
  }

  function printReceipt() {
    if (!selectedOrder) {
      return;
    }

    setPrintOrder(selectedOrder);
    window.setTimeout(() => window.print(), 50);
  }

  async function closeTable() {
    if (!selectedTable?.order) {
      return;
    }

    if (getBillTotals(selectedTable.order).remainingAmount > 0) {
      showMessage("لا يمكن إغلاق الطاولة قبل اكتمال الدفع");
      setIsCloseTableOpen(false);
      return;
    }

    try {
      await closePaidTable(selectedTable.order.id);
      await reloadTables();
      setIsBillSheetOpen(false);
      setIsCloseTableOpen(false);
      showMessage("تم إغلاق الطاولة بنجاح");
    } catch (error) {
      console.error("Failed to close table", error);
      showMessage("تعذر إغلاق الطاولة في Supabase.");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F1E8] text-[#2C211D]">
      <CashierHeader session={session} onOpenShiftSummary={() => setIsShiftOpen(true)} />

      <main className="cashier-no-print mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <CashierStats
            openTables={stats.openTables}
            paidInvoices={stats.paidInvoices}
            sales={stats.sales}
            unpaid={stats.unpaid}
          />
          <CashierFilters
            searchTerm={searchTerm}
            activeFilter={activeFilter}
            onSearchChange={setSearchTerm}
            onFilterChange={setActiveFilter}
          />
          <TablesGrid tables={filteredTables} selectedTableId={selectedTableId} onSelect={selectTable} />
        </div>

        <BillPanel
          table={selectedTable}
          isMobileOpen={isBillSheetOpen}
          onMobileClose={() => setIsBillSheetOpen(false)}
          onOpenDetails={() => setIsDetailsOpen(true)}
          onOpenDiscount={() => setIsDiscountOpen(true)}
          onRemoveDiscount={removeDiscount}
          onOpenPayment={() => setIsPaymentOpen(true)}
          onPrint={printReceipt}
          onOpenCloseTable={() => setIsCloseTableOpen(true)}
        />
      </main>

      {message ? (
        <div className="cashier-no-print fixed left-4 right-4 top-20 z-[60] mx-auto max-w-md rounded-lg border border-[#3B8F8B]/25 bg-[#3B8F8B]/10 px-4 py-3 text-center font-medium text-[#2f7470] shadow-sm">
          {message}
        </div>
      ) : null}

      <DiscountDialog order={selectedOrder} isOpen={isDiscountOpen} onClose={() => setIsDiscountOpen(false)} onApply={applyDiscount} />
      <PaymentDialog order={selectedOrder} isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} onConfirm={confirmPayment} />
      <ShiftSummaryDialog isOpen={isShiftOpen} summary={stats.summary} onClose={() => setIsShiftOpen(false)} />
      <OrderDetailsDialog order={selectedOrder} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
      <CloseTableDialog isOpen={isCloseTableOpen} onClose={() => setIsCloseTableOpen(false)} onConfirm={closeTable} />
      <PrintReceipt order={printOrder ?? selectedOrder} session={session} />
    </div>
  );
}
