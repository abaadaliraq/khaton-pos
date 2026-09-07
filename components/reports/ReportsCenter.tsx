"use client";

import Image from "next/image";
import { AlertCircle, Archive, Eye, FileSpreadsheet, History, Printer, RefreshCw, Save, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FullscreenButton } from "@/components/ui/FullscreenButton";
import { createClient } from "@/lib/supabase/client";
import {
  generateReport,
  getReportSnapshots,
  periodTypeLabels,
  reportTypeLabels,
  resolveReportRange,
  saveReportSnapshot,
  snapshotToGeneratedReport,
} from "@/services/reportsService";
import type { GeneratedReport, ReportPeriodType, ReportSnapshot, ReportType } from "@/types/reports";

type ReportsCenterProps = {
  audience: "admin" | "owner";
};

type PeriodSelection = ReportPeriodType | "previous_month";

const reportTypes: ReportType[] = ["financial", "inventory", "material_consumption", "waste", "purchases", "cash_shifts"];
const periodTypes: PeriodSelection[] = ["daily", "weekly", "monthly", "previous_month", "custom"];
const periodLabels: Record<PeriodSelection, string> = { ...periodTypeLabels, previous_month: "الشهر السابق" };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: "Asia/Baghdad", dateStyle: "short" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: "Asia/Baghdad", timeStyle: "short" }).format(new Date(value));
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
}

function addMonths(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function startOfMonth(dateKey: string) {
  return dateKey.slice(0, 8) + "01";
}

function endOfMonth(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function resolvePeriodSelection(periodSelection: PeriodSelection, customStart: string, customEnd: string) {
  if (periodSelection === "previous_month") {
    const previousMonth = addMonths(todayKey(), -1);
    return resolveReportRange("custom", startOfMonth(previousMonth), endOfMonth(previousMonth));
  }
  return resolveReportRange(periodSelection, customStart, customEnd);
}

function printCurrentReport() {
  window.setTimeout(() => window.print(), 80);
}

function cellTone(columnKey: string, value: unknown) {
  const text = String(value ?? "");
  if (columnKey === "status") {
    if (text === "متوفر" || text === "مدفوع" || text === "مفتوحة") return "text-emerald-700";
    if (text === "منخفض" || text === "بانتظار الدفع") return "text-amber-700";
    if (text === "نافد" || text === "متوقف") return "text-rose-700";
  }
  if (columnKey === "differenceStatus") {
    if (text === "متطابق") return "text-emerald-700";
    if (text === "زيادة") return "text-amber-700";
    if (text === "نقص") return "text-rose-700";
  }
  return "";
}

function isCodeColumn(columnKey: string) {
  return ["reference", "number", "reportCode", "invoice"].includes(columnKey);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-[#c9b8a6] bg-[#fffdf8] p-6 text-center text-sm font-bold text-[#51483f]">
      {message}
    </div>
  );
}

function ReportTable({
  columns,
  rows,
  compact = false,
}: {
  columns: GeneratedReport["columns"];
  rows: GeneratedReport["rows"];
  compact?: boolean;
}) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="report-empty-cell">لا توجد بيانات ضمن هذه الفترة</td>
            </tr>
          ) : null}
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} data-row-index={rowIndex}>
              {columns.map((column) => (
                <td key={column.key} className={`${compact ? "report-compact-cell" : ""} ${cellTone(column.key, row[column.key])}`} dir={isCodeColumn(column.key) ? "ltr" : "rtl"}>
                  {row[column.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryStrip({ summary }: { summary: GeneratedReport["summary"] }) {
  const entries = Object.entries(summary);
  return (
    <div className="report-summary-strip">
      <table>
        <tbody>
          <tr>
            {entries.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
          <tr>
            {entries.map(([label, value]) => (
              <td key={label}>{value}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReportPaperHeader({ report }: { report: GeneratedReport }) {
  const mode = report.mode === "saved" ? `نسخة محفوظة - الإصدار ${report.version ?? "-"}` : "عرض مباشر";
  return (
    <header className="report-paper-header">
      <div className="flex items-start gap-3">
        <Image src="/brand/khaton-logo.png" width={58} height={58} alt="شعار خاتون" className="h-14 w-14 object-contain" priority />
        <div>
          <p className="text-base font-black text-[#181818]">مطعم وكافيه خاتون</p>
          <h1 className="mt-1 text-2xl font-black text-[#181818]">{report.title}</h1>
          <p className="mt-2 text-sm font-bold text-[#51483f]">الفترة: {report.range.startDate} - {report.range.endDate}</p>
          <p className="text-sm font-bold text-[#51483f]">الحالة: {mode}</p>
          {report.reportReference ? <p className="mt-1 font-mono text-sm font-black text-[#181818]" dir="ltr">{report.reportReference}</p> : null}
        </div>
      </div>
      <div className="text-left text-sm font-bold leading-7 text-[#181818]" dir="rtl">
        <p>تاريخ الإنشاء: {formatDate(report.generatedAt)}</p>
        <p>الوقت: {formatTime(report.generatedAt)}</p>
        <p>أنشأ بواسطة: {report.generatedByName ?? "المستخدم الحالي"}</p>
      </div>
    </header>
  );
}

export function ReportsCenter({ audience }: ReportsCenterProps) {
  const [reportType, setReportType] = useState<ReportType>("financial");
  const [periodType, setPeriodType] = useState<PeriodSelection>("daily");
  const [customStart, setCustomStart] = useState(todayKey());
  const [customEnd, setCustomEnd] = useState(todayKey());
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<{ name: string; unit: string; rows: GeneratedReport["rows"] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const resolvedRange = useMemo(() => resolvePeriodSelection(periodType, customStart, customEnd), [customEnd, customStart, periodType]);

  const loadSnapshots = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const rows = await getReportSnapshots();
      setSnapshots(rows);
    } catch (error) {
      console.error("Failed to load report snapshots", error);
      setErrorMessage("تعذر تحميل سجل التقارير المحفوظة. تأكد من تطبيق Migration الخاصة بالتقارير.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSnapshots();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSnapshots]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`report_snapshots_${audience}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "report_snapshots" },
        () => {
          void loadSnapshots();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [audience, loadSnapshots]);

  async function handleGenerate() {
    try {
      setIsGenerating(true);
      setMessage("");
      setErrorMessage("");
      const report = await generateReport(reportType, resolvedRange);
      setCurrentReport(report);
    } catch (error) {
      console.error("Failed to generate report", error);
      setErrorMessage("تعذر إنشاء التقرير من مصادر البيانات الحالية.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!currentReport || currentReport.mode !== "live") return;
    try {
      setIsSaving(true);
      setMessage("");
      setErrorMessage("");
      const snapshot = await saveReportSnapshot(currentReport);
      setCurrentReport(snapshotToGeneratedReport(snapshot));
      setSnapshots((previous) => [snapshot, ...previous.filter((item) => item.id !== snapshot.id)]);
      setMessage(`تم حفظ التقرير كنسخة ${snapshot.reportReference} - الإصدار ${snapshot.version}.`);
    } catch (error) {
      console.error("Failed to save report snapshot", error);
      setErrorMessage("تعذر حفظ نسخة التقرير. إذا لم تطبق Migration التقارير بعد فالحفظ سيبقى غير متاح.");
    } finally {
      setIsSaving(false);
    }
  }

  function openSnapshot(snapshot: ReportSnapshot, shouldPrint = false) {
    const report = snapshotToGeneratedReport(snapshot);
    setCurrentReport(report);
    setMessage(`تم فتح النسخة المحفوظة ${snapshot.reportReference}.`);
    setErrorMessage("");
    if (shouldPrint) printCurrentReport();
  }

  function openMaterialDetails(row: GeneratedReport["rows"][number]) {
    if (currentReport?.reportType !== "material_consumption") return;
    const analytics = currentReport.payload.analytics as { items?: { id: string; nameAr: string; baseUnitName: string; timeline: { date: string; label: string; quantityBase: number; destination?: string; reference?: string }[] }[] } | undefined;
    const item = analytics?.items?.find((candidate) => candidate.id === row.itemId);
    if (!item) return;
    setSelectedMaterial({
      name: item.nameAr,
      unit: item.baseUnitName,
      rows: item.timeline.map((event) => ({
        date: event.date,
        operation: event.label,
        quantity: `${event.quantityBase} ${item.baseUnitName}`,
        department: event.destination ?? "-",
        source: "حركات المادة",
        reference: event.reference ?? "-",
      })),
    });
  }

  return (
    <div className="reports-center -mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-[#f5f0e8] px-3 pb-5 text-right text-[#181818] lg:-mx-6 lg:px-5" dir="rtl">
      <section className="print-hidden sticky top-[49px] z-30 border-b border-[#d4c5b4] bg-[#f5f0e8]/95 py-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-2">
          <label className="report-toolbar-field">
            نوع التقرير
            <select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>
              {reportTypes.map((type) => (
                <option key={type} value={type}>{reportTypeLabels[type]}</option>
              ))}
            </select>
          </label>
          <label className="report-toolbar-field">
            الفترة
            <select value={periodType} onChange={(event) => setPeriodType(event.target.value as PeriodSelection)}>
              {periodTypes.map((type) => (
                <option key={type} value={type}>{periodLabels[type]}</option>
              ))}
            </select>
          </label>
          {periodType === "custom" ? (
            <>
              <label className="report-toolbar-field">
                من
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </label>
              <label className="report-toolbar-field">
                إلى
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </label>
            </>
          ) : null}
          <button type="button" onClick={handleGenerate} disabled={isGenerating} className="report-toolbar-button primary">
            <Search size={16} />
            {isGenerating ? "جاري الإنشاء" : "إنشاء التقرير"}
          </button>
          <button type="button" onClick={handleSave} disabled={!currentReport || currentReport.mode !== "live" || isSaving} className="report-toolbar-button">
            <Save size={16} />
            {isSaving ? "جاري الحفظ" : "حفظ نسخة"}
          </button>
          <button type="button" onClick={printCurrentReport} disabled={!currentReport} className="report-toolbar-button">
            <Printer size={16} />
            طباعة
          </button>
          <button type="button" onClick={() => setShowHistory((value) => !value)} className="report-toolbar-button">
            <Archive size={16} />
            التقارير المحفوظة
          </button>
          <button type="button" onClick={loadSnapshots} className="report-toolbar-button icon-only" title="تحديث">
            <RefreshCw size={16} />
          </button>
          <FullscreenButton compact className="report-toolbar-button icon-only" />
        </div>
      </section>

      {message ? <div className="print-hidden mt-3 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{message}</div> : null}
      {errorMessage ? (
        <div className="print-hidden mt-3 flex items-center gap-2 border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
          <AlertCircle size={17} />
          {errorMessage}
        </div>
      ) : null}

      <section className="reports-print-area report-paper mt-3">
        {!currentReport ? (
          <>
            <header className="report-paper-header">
              <div className="flex items-start gap-3">
                <Image src="/brand/khaton-logo.png" width={58} height={58} alt="شعار خاتون" className="h-14 w-14 object-contain" priority />
                <div>
                  <p className="text-base font-black">مطعم وكافيه خاتون</p>
                  <h1 className="mt-1 text-2xl font-black">مركز التقارير</h1>
                  <p className="mt-2 text-sm font-bold text-[#51483f]">اختر نوع التقرير والفترة ثم اضغط إنشاء التقرير.</p>
                </div>
              </div>
              <div className="text-sm font-bold text-[#51483f]">الفترة: {resolvedRange.startDate} - {resolvedRange.endDate}</div>
            </header>
            <SummaryStrip summary={{ "نوع التقرير": reportTypeLabels[reportType], "الفترة": periodLabels[periodType], "من": resolvedRange.startDate, "إلى": resolvedRange.endDate }} />
            <ReportTable columns={[{ key: "message", label: "الحالة" }]} rows={[]} />
          </>
        ) : (
          <>
            <ReportPaperHeader report={currentReport} />
            <SummaryStrip summary={currentReport.summary} />
            <section className="report-main-section">
              <div className="report-section-title">
                <FileSpreadsheet size={18} />
                <h2>جدول التفاصيل</h2>
              </div>
              <div className={currentReport.reportType === "material_consumption" ? "report-clickable-table" : ""} onClick={(event) => {
                const rowIndex = (event.target as HTMLElement).closest("tr")?.getAttribute("data-row-index");
                if (rowIndex !== null && rowIndex !== undefined) openMaterialDetails(currentReport.rows[Number(rowIndex)]);
              }}>
                <ReportTable columns={currentReport.columns} rows={currentReport.rows} />
              </div>
            </section>
            {currentReport.sections.map((section) => (
              <section key={section.title} className="report-secondary-section">
                <h3>{section.title}</h3>
                <ReportTable columns={section.columns} rows={section.rows} compact />
              </section>
            ))}
            {currentReport.notes.length > 0 ? (
              <section className="report-notes">
                <h3>ملاحظات التقرير</h3>
                {currentReport.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </section>
            ) : null}
          </>
        )}
      </section>

      {showHistory ? (
        <section className="print-hidden report-history-section">
          <div className="report-section-title">
            <History size={18} />
            <h2>التقارير المحفوظة</h2>
          </div>
          {isLoadingHistory ? <EmptyState message="جاري تحميل التقارير المحفوظة..." /> : null}
          {!isLoadingHistory ? (
            <ReportTable
              compact
              columns={[
                { key: "reference", label: "رقم التقرير" },
                { key: "type", label: "نوع التقرير" },
                { key: "period", label: "الفترة" },
                { key: "from", label: "من" },
                { key: "to", label: "إلى" },
                { key: "generatedAt", label: "تاريخ الإنشاء" },
                { key: "generatedBy", label: "أنشأ بواسطة" },
                { key: "version", label: "الإصدار" },
                { key: "status", label: "الحالة" },
              ]}
              rows={snapshots.map((snapshot) => ({
                reference: snapshot.reportReference,
                type: reportTypeLabels[snapshot.reportType],
                period: periodTypeLabels[snapshot.periodType],
                from: snapshot.periodStart,
                to: snapshot.periodEnd,
                generatedAt: formatDateTime(snapshot.generatedAt),
                generatedBy: snapshot.generatedByName,
                version: `الإصدار ${snapshot.version}`,
                status: "تقرير محفوظ",
              }))}
            />
          ) : null}
          {!isLoadingHistory && snapshots.length > 0 ? (
            <div className="report-history-actions">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black" dir="ltr">{snapshot.reportReference}</span>
                  <button type="button" onClick={() => openSnapshot(snapshot)} title="عرض">
                    <Eye size={14} />
                  </button>
                  <button type="button" onClick={() => openSnapshot(snapshot, true)} title="طباعة">
                    <Printer size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {selectedMaterial ? (
        <div className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section className="max-h-[86vh] w-full max-w-5xl overflow-hidden border border-[#aa9784] bg-[#fffdf8] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d4c5b4] bg-[#f0e7dc] px-4 py-3">
              <div>
                <p className="text-xs font-black text-[#a65f3f]">تفاصيل المادة</p>
                <h2 className="text-xl font-black text-[#181818]">{selectedMaterial.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedMaterial(null)} className="border border-[#c9b8a6] bg-white p-2 text-[#181818]">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              <ReportTable
                columns={[
                  { key: "date", label: "التاريخ" },
                  { key: "operation", label: "العملية" },
                  { key: "quantity", label: "الكمية" },
                  { key: "department", label: "القسم" },
                  { key: "source", label: "المصدر" },
                  { key: "reference", label: "المرجع" },
                ]}
                rows={selectedMaterial.rows}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
