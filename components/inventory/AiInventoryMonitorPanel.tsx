"use client";

import { BrainCircuit, RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { AiInventoryAlert, AiMetricComparison, AiOperationalSectionInsight, AiOperationalMetrics, AiInventoryMonitorResponse } from "@/types/aiInventoryMonitor";

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "خطر") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "يحتاج انتباه") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function severityTone(severity: string) {
  if (severity === "حرجة") return "bg-rose-50 text-rose-700 border-rose-200";
  if (severity === "عالية") return "bg-orange-50 text-orange-700 border-orange-200";
  if (severity === "متوسطة") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function formatPercent(value: number | null) {
  if (value === null) return "لا توجد مقارنة";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

function formatMinutes(value: number | null) {
  if (value === null) return "بيانات غير كافية";
  return `${formatNumber(value)} دقيقة`;
}

function comparisonText(metric: AiMetricComparison, formatter: (value: number) => string = formatNumber) {
  return `${formatter(metric.current)} / السابق ${formatter(metric.previous)} (${formatPercent(metric.changePercent)})`;
}

function AlertTable({ title, alerts }: { title: string; alerts: AiInventoryAlert[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
        <h3 className="font-semibold text-[#2f211c]">{title}</h3>
      </div>
      {alerts.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد تنبيهات في هذا القسم.</p> : null}
      {alerts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                <th className="w-44 px-3 py-3 font-semibold">المادة</th>
                <th className="w-28 px-3 py-3 font-semibold">الأهمية</th>
                <th className="px-3 py-3 font-semibold">الملاحظة</th>
                <th className="px-3 py-3 font-semibold">السبب المبني على البيانات</th>
                <th className="px-3 py-3 font-semibold">التوصية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {alerts.map((alert, index) => (
                <tr key={`${title}-${alert.item}-${index}`} className="align-top hover:bg-[#fffaf4] [&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{alert.item}</td>
                  <td className="px-3 py-3">
                    <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + severityTone(alert.severity)}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{alert.note}</td>
                  <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{alert.dataReason}</td>
                  <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{alert.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function InsightTable({ title, insights }: { title: string; insights: AiOperationalSectionInsight[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
        <h3 className="font-semibold text-[#2f211c]">{title}</h3>
      </div>
      {insights.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد ملاحظات في هذا القسم.</p> : null}
      {insights.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                <th className="w-52 px-3 py-3 font-semibold">المؤشر</th>
                <th className="w-28 px-3 py-3 font-semibold">الأهمية</th>
                <th className="px-3 py-3 font-semibold">التحليل</th>
                <th className="px-3 py-3 font-semibold">الدليل الرقمي</th>
                <th className="px-3 py-3 font-semibold">التوصية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {insights.map((insight, index) => (
                <tr key={`${title}-${insight.title}-${index}`} className="align-top hover:bg-[#fffaf4] [&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{insight.title}</td>
                  <td className="px-3 py-3">
                    <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + severityTone(insight.severity)}>{insight.severity}</span>
                  </td>
                  <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{insight.insight}</td>
                  <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{insight.dataReason}</td>
                  <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{insight.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function OperationalMetricsTables({ metrics }: { metrics: AiOperationalMetrics }) {
  const speedRows = [
    ...metrics.speed.kitchen.metrics,
    ...metrics.speed.barista.metrics,
    ...metrics.speed.captain.metrics,
    ...metrics.speed.cashier.metrics,
  ];

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
          <h3 className="font-semibold text-[#2f211c]">مؤشرات الطاولات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                <th className="px-3 py-3 font-semibold">الجلسات</th>
                <th className="px-3 py-3 font-semibold">المبيعات</th>
                <th className="px-3 py-3 font-semibold">متوسط الفاتورة</th>
                <th className="px-3 py-3 font-semibold">متوسط مدة الجلسة</th>
                <th className="px-3 py-3 font-semibold">أعلى استخدام</th>
                <th className="px-3 py-3 font-semibold">أقل استخدام</th>
              </tr>
            </thead>
            <tbody>
              <tr className="[&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                <td className="px-3 py-3">{comparisonText(metrics.tables.sessions)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.tables.sales, formatCurrency)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.tables.averageBill, formatCurrency)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.tables.averageSessionMinutes, (value) => `${formatNumber(value)} دقيقة`)}</td>
                <td className="px-3 py-3">{metrics.tables.topTables.map((row) => `${row.table}: ${formatNumber(row.sessions)}`).join("، ") || "لا يوجد"}</td>
                <td className="px-3 py-3">{metrics.tables.lowTables.map((row) => `${row.table}: ${formatNumber(row.sessions)}`).join("، ") || "لا يوجد"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
          <h3 className="font-semibold text-[#2f211c]">سرعة التشغيل</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                <th className="px-3 py-3 font-semibold">المسار</th>
                <th className="px-3 py-3 font-semibold">المتوسط</th>
                <th className="px-3 py-3 font-semibold">الوسيط</th>
                <th className="px-3 py-3 font-semibold">العينات</th>
                <th className="px-3 py-3 font-semibold">الحالات المتأخرة</th>
                <th className="px-3 py-3 font-semibold">مقارنة بالفترة السابقة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {speedRows.map((row) => (
                <tr key={row.label} className="[&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{row.label}</td>
                  <td className="px-3 py-3">{formatMinutes(row.averageMinutes)}</td>
                  <td className="px-3 py-3">{formatMinutes(row.medianMinutes)}</td>
                  <td className="px-3 py-3">{formatNumber(row.samples)}</td>
                  <td className="px-3 py-3">{formatNumber(row.delayedCount)}</td>
                  <td className="px-3 py-3">{row.previousAverageMinutes === null ? "لا توجد مقارنة" : `${formatMinutes(row.previousAverageMinutes)} (${formatPercent(row.changePercent)})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
        <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
          <h3 className="font-semibold text-[#2f211c]">المؤشرات المالية</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                <th className="px-3 py-3 font-semibold">المشتريات</th>
                <th className="px-3 py-3 font-semibold">دفعات الموردين</th>
                <th className="px-3 py-3 font-semibold">المستحقات التقديرية</th>
                <th className="px-3 py-3 font-semibold">فواتير متأخرة</th>
                <th className="px-3 py-3 font-semibold">المصروفات</th>
                <th className="px-3 py-3 font-semibold">داخل الصندوق</th>
                <th className="px-3 py-3 font-semibold">خارج الصندوق</th>
                <th className="px-3 py-3 font-semibold">فروقات الورديات</th>
              </tr>
            </thead>
            <tbody>
              <tr className="[&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                <td className="px-3 py-3">{comparisonText(metrics.finance.purchases, formatCurrency)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.finance.supplierPayments, formatCurrency)}</td>
                <td className="px-3 py-3">{formatCurrency(metrics.finance.estimatedOutstandingPayables)}</td>
                <td className="px-3 py-3">{formatNumber(metrics.finance.overdueSupplierBills)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.finance.expenses, formatCurrency)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.finance.cashIn, formatCurrency)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.finance.cashOut, formatCurrency)}</td>
                <td className="px-3 py-3">{comparisonText(metrics.finance.cashShiftDifferences, formatCurrency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AiInventoryMonitorPanel() {
  const [result, setResult] = useState<AiInventoryMonitorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runAnalysis() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/ai/inventory-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as AiInventoryMonitorResponse | { error?: string } | null;

      if (!response.ok) {
        if (payload && "configured" in payload && payload.configured === false) {
          setResult(payload);
          setMessage("خدمة التحليل الذكي غير مهيأة");
          return;
        }
        setResult(null);
        setMessage(payload && "error" in payload && payload.error ? payload.error : "تعذر تشغيل التحليل الذكي حالياً.");
        return;
      }

      setResult(payload as AiInventoryMonitorResponse);
    } catch {
      setResult(null);
      setMessage("تعذر الاتصال بخدمة التحليل الذكي.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-[#a65f3f]" />
          <div>
            <h2 className="font-semibold text-[#2f211c]">مراقب التشغيل الذكي</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">تحليل قراءة فقط يعتمد على أرقام التشغيل والمخزون المحسوبة من النظام.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-3 text-sm font-semibold text-white hover:bg-[#8f4e34] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "جارٍ التحليل..." : "تحليل التشغيل الآن"}
        </button>
      </div>

      {message ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</p> : null}

      {result ? (
        <div className="space-y-3">
          {result.operationalAnalysis ? (
            <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
              <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-4 py-3">
                <h3 className="font-semibold text-[#2f211c]">نظرة تنفيذية</h3>
              </div>
              {result.operationalAnalysis.executiveSummary.length === 0 ? (
                <p className="p-4 text-sm text-[#7c6b60]">لا توجد أمور حرجة تحتاج انتباهاً الآن.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-right text-sm">
                    <thead className="bg-[#f5eee6] text-[#4a3b34]">
                      <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                        <th className="w-44 px-3 py-3 font-semibold">المحور</th>
                        <th className="w-28 px-3 py-3 font-semibold">الأهمية</th>
                        <th className="px-3 py-3 font-semibold">الملاحظة</th>
                        <th className="px-3 py-3 font-semibold">الدليل</th>
                        <th className="px-3 py-3 font-semibold">التوصية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eee4d8]">
                      {result.operationalAnalysis.executiveSummary.map((item, index) => (
                        <tr key={`${item.area}-${index}`} className="align-top hover:bg-[#fffaf4] [&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                          <td className="px-3 py-3 font-semibold text-[#2f211c]">{item.area}</td>
                          <td className="px-3 py-3">
                            <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + severityTone(item.severity)}>{item.severity}</span>
                          </td>
                          <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{item.note}</td>
                          <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{item.dataReason}</td>
                          <td className="whitespace-normal px-3 py-3 leading-6 text-[#4a3b34]">{item.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {result.operationalMetrics ? <OperationalMetricsTables metrics={result.operationalMetrics} /> : null}

          {result.operationalAnalysis ? (
            <>
              <InsightTable title="تحليل الطاولات" insights={result.operationalAnalysis.tableInsights} />
              <InsightTable title="تحليل سرعة التشغيل" insights={result.operationalAnalysis.speedInsights} />
              <InsightTable title="التحليل المالي" insights={result.operationalAnalysis.financialInsights} />
              <section className="rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-4 py-3 text-sm text-[#4a3b34]">
                <span className="font-semibold text-[#2f211c]">درجة الثقة: </span>
                {result.operationalAnalysis.dataQuality.confidence}
                <span className="mx-2 text-[#c7b7a7]">|</span>
                {result.operationalAnalysis.dataQuality.reason}
              </section>
            </>
          ) : null}

          <div className="overflow-hidden rounded-md border border-[#e4d8c8]">
            <table className="w-full min-w-[820px] border-collapse text-right text-sm">
              <thead className="bg-[#f5eee6] text-[#4a3b34]">
                <tr className="[&>th]:border-l [&>th]:border-[#e4d8c8] last:[&>th]:border-l-0">
                  <th className="px-3 py-3 font-semibold">مستوى الوضع العام</th>
                  <th className="px-3 py-3 font-semibold">الفترة</th>
                  <th className="px-3 py-3 font-semibold">عدد المواد</th>
                  <th className="px-3 py-3 font-semibold">قيمة المخزون</th>
                  <th className="px-3 py-3 font-semibold">مواد تحتاج متابعة</th>
                  <th className="px-3 py-3 font-semibold">وقت التحليل</th>
                </tr>
              </thead>
              <tbody>
                <tr className="[&>td]:border-l [&>td]:border-[#f0e4d6] last:[&>td]:border-l-0">
                  <td className="px-3 py-3">
                    <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + statusTone(result.analysis.overallStatus)}>
                      {result.analysis.overallStatus}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#4a3b34]">{result.dataWindow.last30Days.startDate} إلى {result.dataWindow.last30Days.endDate}</td>
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{formatNumber(result.dataSummary.itemCount)}</td>
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{formatCurrency(result.dataSummary.inventoryValue)}</td>
                  <td className="px-3 py-3 font-semibold text-[#2f211c]">{formatNumber(result.dataSummary.followUpCount)}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{formatDateTime(result.generatedAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] px-3 py-2 text-sm leading-6 text-[#4a3b34]">{result.analysis.summary}</p>

          {result.analysis.recommendations.length > 0 ? (
            <section className="rounded-md border border-[#e4d8c8] bg-white p-3">
              <h3 className="mb-2 font-semibold text-[#2f211c]">توصيات مختصرة</h3>
              <div className="flex flex-wrap gap-2">
                {result.analysis.recommendations.map((recommendation, index) => (
                  <span key={`${recommendation}-${index}`} className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] px-3 py-2 text-sm text-[#4a3b34]">
                    {recommendation}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <AlertTable title="أهم التنبيهات" alerts={result.analysis.topAlerts} />
          <AlertTable title="مواد معرضة للنفاد" alerts={result.analysis.stockoutRisk} />
          <AlertTable title="استهلاك غير طبيعي" alerts={result.analysis.unusualConsumption} />
          <AlertTable title="هدر يحتاج متابعة" alerts={result.analysis.wasteFollowUp} />
          <AlertTable title="تغيرات أسعار الموردين" alerts={result.analysis.supplierPriceChanges} />
        </div>
      ) : null}
    </section>
  );
}
