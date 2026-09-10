"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ShieldAlert, RefreshCw, Search, WalletCards, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  emergencyCloseCashShift,
  getCashierOptions,
  getCashShiftMovementSummaries,
  getExpectedCashForShift,
  getRecentCashShifts,
} from "@/services/financeService";
import type { CashierOption, CashShift, CashShiftMovementSummary, ExpectedCashBreakdown } from "@/types/finance";

type StatusFilter = "all" | CashShift["status"];
type DialogState = "emergencyClose" | null;

const statusLabels: Record<CashShift["status"], string> = {
  open: "مفتوحة",
  closed: "مغلقة",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function emptySummary(shiftId: string): CashShiftMovementSummary {
  return { shiftId, cashIn: 0, cashOut: 0 };
}

export function CashShiftManagementPanel() {
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [cashiers, setCashiers] = useState<CashierOption[]>([]);
  const [movementSummaries, setMovementSummaries] = useState<Record<string, CashShiftMovementSummary>>({});
  const [openExpected, setOpenExpected] = useState<Record<string, ExpectedCashBreakdown>>({});
  const [selectedShift, setSelectedShift] = useState<CashShift | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [countedCash, setCountedCash] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextShifts, nextCashiers] = await Promise.all([getRecentCashShifts(), getCashierOptions()]);
      const summaries = await getCashShiftMovementSummaries(nextShifts.map((shift) => shift.id));
      const expectedPairs = await Promise.all(
        nextShifts
          .filter((shift) => shift.status === "open")
          .map(async (shift) => [shift.id, await getExpectedCashForShift(shift.id)] as const),
      );

      setShifts(nextShifts);
      setCashiers(nextCashiers);
      setMovementSummaries(Object.fromEntries(summaries.map((summary) => [summary.shiftId, summary])));
      setOpenExpected(Object.fromEntries(expectedPairs.filter((pair): pair is readonly [string, ExpectedCashBreakdown] => pair[1] !== null)));
    } catch (loadError) {
      console.error("Failed to load cash shifts", loadError);
      setError("تعذر تحميل ورديات الصندوق.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleReload() {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadData();
      }, 250);
    }

    const channel = supabase
      .channel("cash-shift-management-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_shifts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredShifts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar-IQ");
    return shifts.filter((shift) => {
      const statusMatches = statusFilter === "all" || shift.status === statusFilter;
      const cashierMatches = cashierFilter === "all" || shift.cashierId === cashierFilter;
      const dateMatches = (!dateFrom || shift.businessDate >= dateFrom) && (!dateTo || shift.businessDate <= dateTo);
      const searchMatches =
        !query ||
        `${shift.cashierName ?? ""} ${shift.openedByName ?? ""} ${shift.closedByName ?? ""} ${shift.openingNote ?? ""} ${shift.closingNote ?? ""} ${shift.id}`
          .toLocaleLowerCase("ar-IQ")
          .includes(query);
      return statusMatches && cashierMatches && dateMatches && searchMatches;
    });
  }, [cashierFilter, dateFrom, dateTo, search, shifts, statusFilter]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function resetForms() {
    setCountedCash("");
    setEmergencyReason("");
    setSelectedShift(null);
    setDialog(null);
  }

  async function submitEmergencyClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShift) return;
    if (!emergencyReason.trim()) {
      setError("سبب الإغلاق الاستثنائي مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await emergencyCloseCashShift({
        shiftId: selectedShift.id,
        countedCash: Number(countedCash),
        reason: emergencyReason,
      });
      resetForms();
      showMessage("تم تنفيذ الإغلاق الاستثنائي وحفظ السبب في سجل العمليات.");
      await loadData();
    } catch (emergencyCloseError) {
      console.error("Failed to emergency close cash shift", emergencyCloseError);
      setError(emergencyCloseError instanceof Error ? emergencyCloseError.message : "تعذر تنفيذ الإغلاق الاستثنائي.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedExpected = selectedShift ? openExpected[selectedShift.id] : undefined;

  return (
    <div className="space-y-4" dir="rtl">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e4d8c8] bg-white px-3 py-2 text-[#2f211c] shadow-sm">
        <div className="flex items-center gap-2">
          <WalletCards size={18} className="text-[#a65f3f]" />
          <div>
            <h2 className="font-semibold">إدارة ورديات الصندوق | {formatNumber(filteredShifts.length)} وردية</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">رقابة على ورديات الكاشير والحركات النقدية، مع إغلاق استثنائي للمدير/المالك عند الحاجة.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث كاشير / ملاحظة" className="h-9 w-52 rounded-md border border-[#e4d8c8] bg-white pr-8 pl-3 text-sm outline-none focus:border-[#a65f3f]" />
          </div>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm" title="من تاريخ" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm" title="إلى تاريخ" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
            <option value="all">كل الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="closed">مغلقة</option>
          </select>
          <select value={cashierFilter} onChange={(event) => setCashierFilter(event.target.value)} className="h-9 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm">
            <option value="all">كل الكاشير</option>
            {cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.name}</option>)}
          </select>
          <button type="button" onClick={() => void loadData()} className="flex h-9 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
            <RefreshCw size={15} />
            تحديث
          </button>
        </div>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        {isLoading ? <p className="p-4 text-sm text-[#7c6b60]">جارٍ تحميل الورديات...</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
              <tr>
                <th className="w-32 border-l border-white/15 px-3 py-2 text-right font-semibold">تاريخ العمل</th>
                <th className="sticky right-0 z-30 w-44 border-l border-white/15 bg-[#2b2421] px-3 py-2 text-right font-semibold">الكاشير</th>
                <th className="w-24 border-l border-white/15 px-3 py-2 text-right font-semibold">الحالة</th>
                <th className="w-24 border-l border-white/15 px-3 py-2 text-right font-semibold">وقت الفتح</th>
                <th className="w-36 border-l border-white/15 px-3 py-2 text-right font-semibold">فتح بواسطة</th>
                <th className="w-28 border-l border-white/15 px-3 py-2 text-right font-semibold">رصيد افتتاحي</th>
                <th className="w-28 border-l border-white/15 px-3 py-2 text-right font-semibold">Cash In</th>
                <th className="w-28 border-l border-white/15 px-3 py-2 text-right font-semibold">Cash Out</th>
                <th className="w-30 border-l border-white/15 px-3 py-2 text-right font-semibold">النقد المتوقع</th>
                <th className="w-28 border-l border-white/15 px-3 py-2 text-right font-semibold">النقد المعدود</th>
                <th className="w-28 border-l border-white/15 px-3 py-2 text-right font-semibold">الفارق</th>
                <th className="w-24 border-l border-white/15 px-3 py-2 text-right font-semibold">وقت الإغلاق</th>
                <th className="w-36 border-l border-white/15 px-3 py-2 text-right font-semibold">أغلق بواسطة</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {filteredShifts.map((shift) => {
                const summary = movementSummaries[shift.id] ?? emptySummary(shift.id);
                const expectedCash = shift.status === "open" ? openExpected[shift.id]?.expectedCash : shift.expectedCashSnapshot;
                return (
                  <tr key={shift.id} className="odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDate(`${shift.businessDate}T00:00:00+03:00`)}</td>
                    <td className="sticky right-0 z-10 border-l border-[#d5c2af] bg-inherit px-3 py-2 font-semibold text-[#1f1713]">{shift.cashierName ?? shift.cashierId.slice(0, 8)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2">
                      <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${shift.status === "open" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"}`}>{statusLabels[shift.status]}</span>
                    </td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatTime(shift.openedAt)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{shift.openedByName ?? shift.openedBy.slice(0, 8)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]">{formatCurrency(shift.openingCash)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-emerald-700">{formatCurrency(summary.cashIn)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-rose-700">{formatCurrency(summary.cashOut)}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]">{typeof expectedCash === "number" ? formatCurrency(expectedCash) : "-"}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{typeof shift.countedCash === "number" ? formatCurrency(shift.countedCash) : "-"}</td>
                    <td className={`border-l border-[#f0e5da] px-3 py-2 font-semibold ${typeof shift.cashDifference === "number" && shift.cashDifference !== 0 ? "text-rose-700" : "text-[#4a3b34]"}`}>{typeof shift.cashDifference === "number" ? formatCurrency(shift.cashDifference) : "-"}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{shift.closedAt ? formatTime(shift.closedAt) : "-"}</td>
                    <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{shift.closedByName ?? shift.closedBy?.slice(0, 8) ?? "-"}</td>
                    <td className="px-3 py-2">
                      {shift.status === "open" ? (
                        <button type="button" onClick={() => { setSelectedShift(shift); setDialog("emergencyClose"); setCountedCash(String(openExpected[shift.id]?.expectedCash ?? "")); setEmergencyReason(""); }} className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                          <ShieldAlert size={14} />
                          إغلاق استثنائي
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> مكتملة</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center text-sm text-[#4a3b34]">لا توجد ورديات مطابقة للفلاتر الحالية</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {dialog === "emergencyClose" && selectedShift ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <form onSubmit={submitEmergencyClose} className="w-full max-w-lg rounded-md border border-white/10 bg-[#2f2f2f] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">إغلاق استثنائي للوردية</h3>
                <p className="mt-1 text-xs text-zinc-400">{selectedShift.cashierName ?? selectedShift.cashierId}</p>
              </div>
              <button type="button" onClick={resetForms} className="rounded-md border border-white/10 p-2 text-zinc-300 hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-zinc-400">النقد المتوقع</p>
                <p className="mt-1 font-semibold">{selectedExpected ? formatCurrency(selectedExpected.expectedCash) : "-"}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-zinc-400">الفارق الحالي</p>
                <p className="mt-1 font-semibold">{selectedExpected && countedCash ? formatCurrency(Number(countedCash) - selectedExpected.expectedCash) : "-"}</p>
              </div>
            </div>
            <div className="space-y-3">
              <input required min="0" step="0.001" type="number" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="النقد المعدود" className="h-11 w-full rounded-md border border-white/10 bg-[#242424] px-3 text-sm text-white outline-none focus:border-[#ff5656]" />
              <textarea required value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} placeholder="سبب الإغلاق الاستثنائي" className="min-h-24 w-full rounded-md border border-white/10 bg-[#242424] px-3 py-2 text-sm text-white outline-none focus:border-[#ff5656]" />
            </div>
            <button disabled={isSaving || !emergencyReason.trim()} type="submit" className="mt-4 h-11 w-full rounded-md bg-[#ff5656] text-sm font-semibold text-white disabled:opacity-60">تأكيد الإغلاق الاستثنائي</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
