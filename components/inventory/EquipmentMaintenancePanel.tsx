"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Edit3, Plus, RefreshCw, ShieldCheck, Wrench, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  completeEquipmentMaintenance,
  createEquipmentAsset,
  createEquipmentMaintenanceRecord,
  getEquipmentOverview,
  reportEquipmentBreakdown,
  retireEquipmentAsset,
  startEquipmentMaintenance,
  updateEquipmentAsset,
  type CompleteEquipmentMaintenanceInput,
  type CreateEquipmentAssetInput,
  type CreateEquipmentMaintenanceInput,
  type ReportEquipmentBreakdownInput,
  type UpdateEquipmentAssetInput,
} from "@/services/equipmentMaintenanceService";
import { getSuppliers } from "@/services/purchaseService";
import type { Supplier } from "@/types/finance";
import type { EquipmentAsset, EquipmentCategory, EquipmentLocation, EquipmentMaintenanceRecord, EquipmentMaintenanceStatus, EquipmentMaintenanceType, EquipmentOverview, EquipmentStatus } from "@/types/inventory";

type DueFilter = "all" | "overdue" | "next_7" | "next_30";

type EquipmentForm = {
  nameAr: string;
  category: EquipmentCategory;
  location: EquipmentLocation;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: string;
  supplierId: string;
  warrantyExpiryDate: string;
  status: EquipmentStatus;
  notes: string;
};

type BreakdownForm = {
  problemDescription: string;
  reportedAt: string;
  notes: string;
};

type MaintenanceForm = {
  maintenanceType: EquipmentMaintenanceType;
  status: "reported" | "scheduled";
  reportedAt: string;
  problemDescription: string;
  notes: string;
};

type CompleteForm = {
  workPerformed: string;
  cost: string;
  completedAt: string;
  technicianName: string;
  serviceProvider: string;
  invoiceReference: string;
  nextMaintenanceDate: string;
  equipmentStatus: EquipmentStatus;
  notes: string;
};

type EquipmentMaintenancePanelProps = {
  onEquipmentFollowUpChanged?: (count: number) => void;
};

const categoryLabels: Record<EquipmentCategory, string> = {
  refrigeration: "تبريد",
  cooking: "طبخ",
  coffee: "قهوة وباريستا",
  beverage: "مشروبات",
  ventilation: "تهوية",
  electrical: "كهربائيات",
  cleaning_equipment: "معدات تنظيف",
  pos_it: "أجهزة وأنظمة",
  other: "أخرى",
};

const locationLabels: Record<EquipmentLocation, string> = {
  kitchen: "المطبخ",
  bar: "البار",
  barista: "منطقة الباريستا",
  warehouse: "المخزن",
  dining_hall: "الصالة",
  management: "الإدارة",
  outdoor: "الخارج",
  other: "أخرى",
};

const statusLabels: Record<EquipmentStatus, string> = {
  operational: "يعمل",
  needs_maintenance: "يحتاج صيانة",
  under_maintenance: "تحت الصيانة",
  out_of_service: "خارج الخدمة",
  retired: "مستبعد",
};

const maintenanceTypeLabels: Record<EquipmentMaintenanceType, string> = {
  preventive: "صيانة دورية",
  corrective: "صيانة إصلاحية",
  breakdown: "عطل",
  inspection: "فحص",
  cleaning_service: "خدمة تنظيف",
  installation: "تركيب",
  other: "أخرى",
};

const maintenanceStatusLabels: Record<EquipmentMaintenanceStatus, string> = {
  reported: "مبلغ",
  scheduled: "مجدول",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const categoryOptions = Object.entries(categoryLabels) as [EquipmentCategory, string][];
const locationOptions = Object.entries(locationLabels) as [EquipmentLocation, string][];
const statusOptions = Object.entries(statusLabels) as [EquipmentStatus, string][];
const maintenanceTypeOptions = Object.entries(maintenanceTypeLabels) as [EquipmentMaintenanceType, string][];

const emptyEquipmentForm: EquipmentForm = {
  nameAr: "",
  category: "cooking",
  location: "kitchen",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  purchaseCost: "",
  supplierId: "",
  warrantyExpiryDate: "",
  status: "operational",
  notes: "",
};

const emptyBreakdownForm: BreakdownForm = {
  problemDescription: "",
  reportedAt: "",
  notes: "",
};

const emptyMaintenanceForm: MaintenanceForm = {
  maintenanceType: "preventive",
  status: "reported",
  reportedAt: "",
  problemDescription: "",
  notes: "",
};

const emptyCompleteForm: CompleteForm = {
  workPerformed: "",
  cost: "",
  completedAt: "",
  technicianName: "",
  serviceProvider: "",
  invoiceReference: "",
  nextMaintenanceDate: "",
  equipmentStatus: "operational",
  notes: "",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeZone: "Asia/Baghdad" }).format(new Date(value));
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

function dateDiffDays(fromIso: string, toIso: string) {
  const from = Date.parse(`${fromIso}T00:00:00+03:00`);
  const to = Date.parse(`${toIso}T00:00:00+03:00`);
  return Math.round((to - from) / 86400000);
}

function asNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalize(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar-IQ");
}

function latestCompletedMaintenance(asset: EquipmentAsset) {
  return asset.maintenanceRecords.find((record) => record.status === "completed");
}

function latestNextMaintenance(asset: EquipmentAsset) {
  return asset.maintenanceRecords
    .filter((record) => record.status === "completed" && record.nextMaintenanceDate)
    .map((record) => record.nextMaintenanceDate as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function maintenanceCost(asset: EquipmentAsset) {
  return asset.maintenanceRecords.reduce((sum, record) => sum + record.cost, 0);
}

function breakdownCount(asset: EquipmentAsset) {
  return asset.maintenanceRecords.filter((record) => record.maintenanceType === "breakdown").length;
}

function maintenanceAgeText(asset: EquipmentAsset) {
  if (!asset.purchaseDate) return "غير محدد";
  const days = Math.max(0, dateDiffDays(asset.purchaseDate, todayIso()));
  if (days >= 365) return `${formatNumber(Math.floor(days / 365))} سنة`;
  if (days >= 30) return `${formatNumber(Math.floor(days / 30))} شهر`;
  return `${formatNumber(days)} يوم`;
}

function dueText(asset: EquipmentAsset) {
  const nextDate = latestNextMaintenance(asset);
  if (!nextDate) return "لا يوجد موعد";
  const diff = dateDiffDays(todayIso(), nextDate);
  if (diff < 0) return `الصيانة متأخرة ${formatNumber(Math.abs(diff))} يوم`;
  if (diff === 0) return "الصيانة اليوم";
  return `الصيانة خلال ${formatNumber(diff)} يوم`;
}

function warrantyText(asset: EquipmentAsset) {
  if (!asset.warrantyExpiryDate) return { label: "لا توجد معلومات ضمان", className: "border-[#e4d8c8] bg-[#fbfaf7] text-[#7c6b60]" };
  return asset.warrantyExpiryDate >= todayIso()
    ? { label: "ضمن الضمان", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
    : { label: "انتهى الضمان", className: "border-rose-200 bg-rose-50 text-rose-700" };
}

function statusClass(status: EquipmentStatus) {
  if (status === "operational") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "under_maintenance") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "needs_maintenance" || status === "out_of_service") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-[#e4d8c8] bg-[#fbfaf7] text-[#7c6b60]";
}

function equipmentFormFromAsset(asset: EquipmentAsset): EquipmentForm {
  return {
    nameAr: asset.nameAr,
    category: asset.category,
    location: asset.location,
    brand: asset.brand ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serialNumber ?? "",
    purchaseDate: asset.purchaseDate ?? "",
    purchaseCost: asset.purchaseCost === undefined ? "" : String(asset.purchaseCost),
    supplierId: asset.supplierId ?? "",
    warrantyExpiryDate: asset.warrantyExpiryDate ?? "",
    status: asset.status,
    notes: asset.notes ?? "",
  };
}

function StatCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-4 text-right shadow-sm">
      <p className="text-sm text-[#7c6b60]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2f211c]">{value}</p>
      <p className="mt-1 text-xs text-[#9a8779]">{helper}</p>
    </section>
  );
}

export function EquipmentMaintenancePanel({ onEquipmentFollowUpChanged }: EquipmentMaintenancePanelProps) {
  const [overview, setOverview] = useState<EquipmentOverview>({ assets: [], summary: { total: 0, operational: 0, needsMaintenance: 0, underMaintenance: 0, overdueMaintenance: 0, followUpCount: 0, totalMaintenanceCost: 0 } });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<EquipmentAsset | null>(null);
  const [isEquipmentFormOpen, setIsEquipmentFormOpen] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentForm>(emptyEquipmentForm);
  const [breakdownAsset, setBreakdownAsset] = useState<EquipmentAsset | null>(null);
  const [breakdownForm, setBreakdownForm] = useState<BreakdownForm>(emptyBreakdownForm);
  const [maintenanceAsset, setMaintenanceAsset] = useState<EquipmentAsset | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>(emptyMaintenanceForm);
  const [completeRecord, setCompleteRecord] = useState<EquipmentMaintenanceRecord | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteForm>(emptyCompleteForm);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | "all">("all");
  const [locationFilter, setLocationFilter] = useState<EquipmentLocation | "all">("all");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "all">("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  const selectedAsset = overview.assets.find((asset) => asset.id === selectedAssetId) ?? null;

  const alerts = useMemo(() => {
    const today = todayIso();
    return overview.assets
      .filter((asset) => asset.isActive)
      .flatMap((asset) => {
        const nextDate = latestNextMaintenance(asset);
        const rows: { id: string; title: string; helper: string; tone: "danger" | "warning" }[] = [];
        if (nextDate) {
          const days = dateDiffDays(today, nextDate);
          if (days < 0) rows.push({ id: `${asset.id}-overdue`, title: asset.nameAr, helper: `الصيانة متأخرة ${formatNumber(Math.abs(days))} يوم`, tone: "danger" });
          else if (days <= 7) rows.push({ id: `${asset.id}-soon`, title: asset.nameAr, helper: `الصيانة بعد ${formatNumber(days)} يوم`, tone: "warning" });
        }
        if (asset.status === "under_maintenance") {
          const inProgress = asset.maintenanceRecords.find((record) => record.status === "in_progress");
          const days = inProgress ? Math.max(0, dateDiffDays(inProgress.startedAt?.slice(0, 10) ?? today, today)) : 0;
          rows.push({ id: `${asset.id}-progress`, title: asset.nameAr, helper: `تحت الصيانة منذ ${formatNumber(days)} يوم`, tone: "warning" });
        }
        return rows;
      })
      .slice(0, 6);
  }, [overview.assets]);

  const filteredAssets = useMemo(() => {
    const today = todayIso();
    const query = normalize(search);
    return overview.assets.filter((asset) => {
      const queryMatches =
        !query ||
        normalize(asset.nameAr).includes(query) ||
        normalize(asset.assetCode).includes(query) ||
        normalize(asset.brand).includes(query) ||
        normalize(asset.model).includes(query) ||
        normalize(asset.serialNumber).includes(query);
      const categoryMatches = categoryFilter === "all" || asset.category === categoryFilter;
      const locationMatches = locationFilter === "all" || asset.location === locationFilter;
      const statusMatches = statusFilter === "all" || asset.status === statusFilter;
      const nextDate = latestNextMaintenance(asset);
      const dueMatches =
        dueFilter === "all" ||
        (nextDate
          ? dueFilter === "overdue"
            ? nextDate < today
            : dueFilter === "next_7"
              ? dateDiffDays(today, nextDate) >= 0 && dateDiffDays(today, nextDate) <= 7
              : dateDiffDays(today, nextDate) >= 0 && dateDiffDays(today, nextDate) <= 30
          : false);

      return queryMatches && categoryMatches && locationMatches && statusMatches && dueMatches;
    });
  }, [categoryFilter, dueFilter, locationFilter, overview.assets, search, statusFilter]);

  const loadEquipment = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextOverview, nextSuppliers] = await Promise.all([getEquipmentOverview(), getSuppliers()]);
      setOverview(nextOverview);
      setSuppliers(nextSuppliers);
      setSelectedAssetId((current) => (current && nextOverview.assets.some((asset) => asset.id === current) ? current : null));
      onEquipmentFollowUpChanged?.(nextOverview.summary.followUpCount);
    } catch (loadError) {
      console.error("Failed to load equipment", loadError);
      setError("تعذر تحميل بيانات المعدات والصيانة.");
    } finally {
      setIsLoading(false);
    }
  }, [onEquipmentFollowUpChanged]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEquipment();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadEquipment]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleReload() {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadEquipment();
      }, 250);
    }

    const channel = supabase
      .channel("equipment-maintenance-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_assets" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_maintenance_records" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadEquipment]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function resetEquipmentForm() {
    setEditingAsset(null);
    setEquipmentForm(emptyEquipmentForm);
    setIsEquipmentFormOpen(true);
  }

  function openEditAsset(asset: EquipmentAsset) {
    setEditingAsset(asset);
    setEquipmentForm(equipmentFormFromAsset(asset));
    setIsEquipmentFormOpen(true);
  }

  async function submitEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const basePayload: CreateEquipmentAssetInput = {
        nameAr: equipmentForm.nameAr,
        category: equipmentForm.category,
        location: equipmentForm.location,
        brand: equipmentForm.brand,
        model: equipmentForm.model,
        serialNumber: equipmentForm.serialNumber,
        purchaseDate: equipmentForm.purchaseDate,
        purchaseCost: equipmentForm.purchaseCost ? asNumber(equipmentForm.purchaseCost) : undefined,
        supplierId: equipmentForm.supplierId,
        warrantyExpiryDate: equipmentForm.warrantyExpiryDate,
        notes: equipmentForm.notes,
      };

      if (editingAsset) {
        await updateEquipmentAsset({ ...basePayload, id: editingAsset.id, status: equipmentForm.status } satisfies UpdateEquipmentAssetInput);
        showMessage("تم تعديل بيانات المعدة");
      } else {
        const assetId = await createEquipmentAsset(basePayload);
        setSelectedAssetId(assetId);
        showMessage("تمت إضافة المعدة");
      }

      resetEquipmentForm();
      setIsEquipmentFormOpen(false);
      await loadEquipment();
    } catch (saveError) {
      console.error("Failed to save equipment", saveError);
      setError("تعذر حفظ المعدة. تحقق من البيانات أو الصلاحيات.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitBreakdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!breakdownAsset) return;
    setIsSaving(true);
    setError("");

    try {
      const payload: ReportEquipmentBreakdownInput = {
        equipmentId: breakdownAsset.id,
        problemDescription: breakdownForm.problemDescription,
        reportedAt: breakdownForm.reportedAt,
        notes: breakdownForm.notes,
      };
      await reportEquipmentBreakdown(payload);
      setBreakdownAsset(null);
      setBreakdownForm(emptyBreakdownForm);
      await loadEquipment();
      showMessage("تم تسجيل العطل");
    } catch (breakdownError) {
      console.error("Failed to report equipment breakdown", breakdownError);
      setError("تعذر تسجيل العطل.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!maintenanceAsset) return;
    setIsSaving(true);
    setError("");

    try {
      const payload: CreateEquipmentMaintenanceInput = {
        equipmentId: maintenanceAsset.id,
        maintenanceType: maintenanceForm.maintenanceType,
        status: maintenanceForm.status,
        reportedAt: maintenanceForm.reportedAt,
        problemDescription: maintenanceForm.problemDescription,
        notes: maintenanceForm.notes,
      };
      await createEquipmentMaintenanceRecord(payload);
      setMaintenanceAsset(null);
      setMaintenanceForm(emptyMaintenanceForm);
      await loadEquipment();
      showMessage("تم إنشاء سجل الصيانة");
    } catch (maintenanceError) {
      console.error("Failed to create maintenance record", maintenanceError);
      setError("تعذر إنشاء سجل الصيانة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function startMaintenance(record: EquipmentMaintenanceRecord) {
    setIsSaving(true);
    setError("");

    try {
      await startEquipmentMaintenance(record.id);
      await loadEquipment();
      showMessage("تم بدء الصيانة");
    } catch (startError) {
      console.error("Failed to start maintenance", startError);
      setError("تعذر بدء الصيانة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completeRecord) return;
    setIsSaving(true);
    setError("");

    try {
      const payload: CompleteEquipmentMaintenanceInput = {
        recordId: completeRecord.id,
        workPerformed: completeForm.workPerformed,
        cost: asNumber(completeForm.cost),
        completedAt: completeForm.completedAt,
        technicianName: completeForm.technicianName,
        serviceProvider: completeForm.serviceProvider,
        invoiceReference: completeForm.invoiceReference,
        nextMaintenanceDate: completeForm.nextMaintenanceDate,
        equipmentStatus: completeForm.equipmentStatus,
        notes: completeForm.notes,
      };
      await completeEquipmentMaintenance(payload);
      setCompleteRecord(null);
      setCompleteForm(emptyCompleteForm);
      await loadEquipment();
      showMessage("تم إكمال الصيانة");
    } catch (completeError) {
      console.error("Failed to complete maintenance", completeError);
      setError("تعذر إكمال الصيانة.");
    } finally {
      setIsSaving(false);
    }
  }

  async function retireAsset(asset: EquipmentAsset) {
    setIsSaving(true);
    setError("");

    try {
      await retireEquipmentAsset(asset.id, "استبعاد من واجهة المعدات");
      await loadEquipment();
      showMessage("تم استبعاد المعدة");
    } catch (retireError) {
      console.error("Failed to retire equipment", retireError);
      setError("تعذر استبعاد المعدة.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e4d8c8] bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <Wrench size={18} className="text-[#a65f3f]" />
          <div>
            <h2 className="font-semibold text-[#2f211c]">المعدات والصيانة | {formatNumber(filteredAssets.length)} معدة</h2>
            <p className="mt-1 text-xs text-[#7c6b60]">إدارة أصول المطعم وسجل الصيانة بدون ربطها برصيد المخزون.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadEquipment()} className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
            <RefreshCw size={16} />
            تحديث
          </button>
          <button type="button" onClick={resetEquipmentForm} className="flex h-10 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]">
            <Plus size={16} />
            إضافة معدة
          </button>
        </div>
      </section>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="إجمالي المعدات" value={formatNumber(overview.summary.total)} helper="المعدات النشطة" />
        <StatCard title="تعمل" value={formatNumber(overview.summary.operational)} helper="جاهزة للاستخدام" />
        <StatCard title="تحتاج صيانة" value={formatNumber(overview.summary.needsMaintenance)} helper="بلاغات أو متابعة" />
        <StatCard title="تحت الصيانة" value={formatNumber(overview.summary.underMaintenance)} helper="عمليات جارية" />
        <StatCard title="صيانة متأخرة" value={formatNumber(overview.summary.overdueMaintenance)} helper="حسب الموعد القادم" />
      </div>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-[#a65f3f]" />
          <h3 className="font-semibold text-[#2f211c]">تنبيهات الصيانة</h3>
        </div>
        {alerts.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد تنبيهات صيانة حالياً.</p> : null}
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`rounded-md border px-3 py-2 text-sm ${alert.tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-1 text-xs">{alert.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4">
        {isEquipmentFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
        <form onSubmit={submitEquipment} className="w-full max-w-3xl space-y-3 rounded-md border border-[#e4d8c8] bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wrench size={18} className="text-[#a65f3f]" />
              <h3 className="font-semibold text-[#2f211c]">{editingAsset ? "تعديل معدة" : "إضافة معدة"}</h3>
            </div>
            <button type="button" onClick={() => { setIsEquipmentFormOpen(false); setEditingAsset(null); }} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34]"><X size={15} /></button>
          </div>
          <input required value={equipmentForm.nameAr} onChange={(event) => setEquipmentForm({ ...equipmentForm, nameAr: event.target.value })} placeholder="اسم المعدة" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <select value={equipmentForm.category} onChange={(event) => setEquipmentForm({ ...equipmentForm, category: event.target.value as EquipmentCategory })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]">
              {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={equipmentForm.location} onChange={(event) => setEquipmentForm({ ...equipmentForm, location: event.target.value as EquipmentLocation })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]">
              {locationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {editingAsset ? (
            <select value={equipmentForm.status} onChange={(event) => setEquipmentForm({ ...equipmentForm, status: event.target.value as EquipmentStatus })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]">
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <input value={equipmentForm.brand} onChange={(event) => setEquipmentForm({ ...equipmentForm, brand: event.target.value })} placeholder="الماركة" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
            <input value={equipmentForm.model} onChange={(event) => setEquipmentForm({ ...equipmentForm, model: event.target.value })} placeholder="الموديل" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
          </div>
          <input value={equipmentForm.serialNumber} onChange={(event) => setEquipmentForm({ ...equipmentForm, serialNumber: event.target.value })} placeholder="الرقم التسلسلي اختياري" className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <label className="space-y-1 text-xs font-semibold text-[#7c6b60]">
              تاريخ الشراء
              <input type="date" value={equipmentForm.purchaseDate} onChange={(event) => setEquipmentForm({ ...equipmentForm, purchaseDate: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal text-[#2f211c] outline-none focus:border-[#a65f3f]" />
            </label>
            <input min="0" step="1" type="number" value={equipmentForm.purchaseCost} onChange={(event) => setEquipmentForm({ ...equipmentForm, purchaseCost: event.target.value })} placeholder="سعر الشراء" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
          </div>
          <select value={equipmentForm.supplierId} onChange={(event) => setEquipmentForm({ ...equipmentForm, supplierId: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]">
            <option value="">المورد اختياري</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <label className="space-y-1 text-xs font-semibold text-[#7c6b60]">
            انتهاء الضمان
            <input type="date" value={equipmentForm.warrantyExpiryDate} onChange={(event) => setEquipmentForm({ ...equipmentForm, warrantyExpiryDate: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal text-[#2f211c] outline-none focus:border-[#a65f3f]" />
          </label>
          <textarea value={equipmentForm.notes} onChange={(event) => setEquipmentForm({ ...equipmentForm, notes: event.target.value })} placeholder="ملاحظات" className="min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#a65f3f]" />
          <button disabled={isSaving} type="submit" className="h-11 w-full rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34] disabled:opacity-60">
            {editingAsset ? "حفظ التعديل" : "إضافة معدة"}
          </button>
        </form>
        </div>
        ) : null}

        <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
          <div className="grid gap-2 border-b border-[#eee4d8] p-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_180px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث باسم / رقم أصل / ماركة / موديل / Serial" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm outline-none focus:border-[#a65f3f]" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as EquipmentCategory | "all")} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
              <option value="all">كل الفئات</option>
              {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value as EquipmentLocation | "all")} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
              <option value="all">كل المواقع</option>
              {locationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EquipmentStatus | "all")} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
              <option value="all">كل الحالات</option>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
              <option value="all">كل المواعيد</option>
              <option value="overdue">متأخرة</option>
              <option value="next_7">خلال 7 أيام</option>
              <option value="next_30">خلال 30 يوم</option>
            </select>
          </div>

          {isLoading ? <p className="p-5 text-sm text-[#7c6b60]">جارٍ تحميل المعدات...</p> : null}
          {!isLoading && filteredAssets.length === 0 ? <p className="p-8 text-center text-sm text-[#7c6b60]">لا توجد معدات مطابقة.</p> : null}
          {filteredAssets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-[#2b2421] text-white">
                  <tr>
                    <th className="sticky right-0 z-30 w-28 border-l border-white/15 bg-[#2b2421] px-3 py-2 text-right font-semibold">Asset Code</th>
                    <th className="w-48 border-l border-white/15 px-3 py-2 text-right font-semibold">المعدة</th>
                    <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الفئة</th>
                    <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الموقع</th>
                    <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الحالة</th>
                    <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الضمان</th>
                    <th className="w-28 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">آخر صيانة</th>
                    <th className="w-40 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الصيانة القادمة</th>
                    <th className="w-24 border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">عدد الأعطال</th>
                    <th className="w-32 px-3 py-2 text-right font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee4d8]">
                  {filteredAssets.map((asset) => {
                    const lastMaintenance = latestCompletedMaintenance(asset);
                    return (
                      <tr key={asset.id} className={`odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb] ${selectedAsset?.id === asset.id ? "bg-[#fff1e8]" : ""}`}>
                        <td className="sticky right-0 z-10 border-l border-[#d5c2af] bg-inherit px-3 py-2 font-semibold text-[#1f1713]" dir="ltr">{asset.assetCode}</td>
                        <td className="truncate border-l border-[#f0e5da] px-3 py-2 text-[#2f211c]" title={asset.nameAr}>
                          <button type="button" onClick={() => setSelectedAssetId(asset.id)} className="text-right font-semibold hover:text-[#a65f3f]">{asset.nameAr}</button>
                        </td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{categoryLabels[asset.category]}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{locationLabels[asset.location]}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2"><span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClass(asset.status)}`}>{statusLabels[asset.status]}</span></td>
                        <td className="border-l border-[#f0e5da] px-3 py-2"><span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${warrantyText(asset).className}`}>{warrantyText(asset).label}</span></td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDate(lastMaintenance?.completedAt)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{latestNextMaintenance(asset) ? `${formatDate(latestNextMaintenance(asset))} - ${dueText(asset)}` : "-"}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatNumber(breakdownCount(asset))}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" onClick={() => setSelectedAssetId(asset.id)} className="rounded-md border border-[#e4d8c8] px-2 py-1 text-xs text-[#4a3b34] hover:bg-[#f5eee6]">تفاصيل</button>
                            <button type="button" onClick={() => openEditAsset(asset)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تعديل"><Edit3 size={14} /></button>
                            <button type="button" onClick={() => setBreakdownAsset(asset)} className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">تسجيل عطل</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      {selectedAsset ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4">
        <section className="w-full max-w-6xl rounded-md border border-[#e4d8c8] bg-white p-4 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#a65f3f]">{selectedAsset.assetCode}</p>
              <h3 className="mt-1 text-xl font-semibold text-[#2f211c]">{selectedAsset.nameAr}</h3>
              <p className="mt-1 text-sm text-[#7c6b60]">{categoryLabels[selectedAsset.category]} / {locationLabels[selectedAsset.location]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusClass(selectedAsset.status)}`}>{statusLabels[selectedAsset.status]}</span>
              <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${warrantyText(selectedAsset).className}`}>{warrantyText(selectedAsset).label}</span>
              <button type="button" onClick={() => setMaintenanceAsset(selectedAsset)} className="rounded-md border border-[#e4d8c8] px-3 py-2 text-xs font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">إضافة صيانة</button>
              <button type="button" onClick={() => void retireAsset(selectedAsset)} disabled={isSaving || selectedAsset.status === "retired"} className="rounded-md border border-[#e4d8c8] px-3 py-2 text-xs font-semibold text-[#7c6b60] hover:bg-[#f5eee6] disabled:opacity-50">استبعاد المعدة</button>
              <button type="button" onClick={() => setSelectedAssetId(null)} className="rounded-md border border-[#e4d8c8] px-3 py-2 text-xs font-semibold text-[#4a3b34] hover:bg-[#f5eee6]">إغلاق</button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Detail label="الشراء والضمان" value={`${formatDate(selectedAsset.purchaseDate)} / ${formatCurrency(selectedAsset.purchaseCost ?? 0)}`} helper={selectedAsset.supplierName ?? "المورد غير محدد"} />
            <Detail label="الصيانة القادمة" value={latestNextMaintenance(selectedAsset) ? formatDate(latestNextMaintenance(selectedAsset)) : "-"} helper={dueText(selectedAsset)} />
            <Detail label="تكلفة الصيانة" value={formatCurrency(maintenanceCost(selectedAsset))} helper={`آخر صيانة ${formatCurrency(latestCompletedMaintenance(selectedAsset)?.cost ?? 0)}`} />
            <Detail label="مؤشرات الجهاز" value={`${formatNumber(selectedAsset.maintenanceRecords.length)} صيانة`} helper={`${formatNumber(breakdownCount(selectedAsset))} أعطال / العمر ${maintenanceAgeText(selectedAsset)}`} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3 text-sm">
              <h4 className="mb-3 font-semibold text-[#2f211c]">معلومات الجهاز</h4>
              <InfoRow label="الماركة" value={selectedAsset.brand ?? "-"} />
              <InfoRow label="الموديل" value={selectedAsset.model ?? "-"} />
              <InfoRow label="الرقم التسلسلي" value={selectedAsset.serialNumber ?? "غير مسجل"} />
              <InfoRow label="انتهاء الضمان" value={formatDate(selectedAsset.warrantyExpiryDate)} />
              <InfoRow label="ملاحظات" value={selectedAsset.notes ?? "-"} />
            </section>

            <section className="rounded-md border border-[#eee4d8]">
              <div className="border-b border-[#eee4d8] bg-[#fbfaf7] px-3 py-2">
                <h4 className="font-semibold text-[#2f211c]">سجل الصيانة</h4>
              </div>
              {selectedAsset.maintenanceRecords.length === 0 ? <p className="p-4 text-sm text-[#7c6b60]">لا توجد سجلات صيانة لهذا الجهاز.</p> : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-[#2b2421] text-white">
                    <tr>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">التاريخ</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">النوع</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الحالة</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">وصف العطل</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الفني / الشركة</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">التكلفة</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">ما تم عمله</th>
                      <th className="border-l border-[#e6dacd] px-3 py-2 text-right font-semibold">الصيانة القادمة</th>
                      <th className="px-3 py-2 text-right font-semibold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee4d8]">
                    {selectedAsset.maintenanceRecords.map((record) => (
                      <tr key={record.id} className="odd:bg-white even:bg-[#fffdfa] hover:bg-[#fff4eb]">
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDate(record.completedAt ?? record.reportedAt)}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{maintenanceTypeLabels[record.maintenanceType]}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2"><span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${record.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : record.status === "in_progress" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#e4d8c8] bg-white text-[#7c6b60]"}`}>{maintenanceStatusLabels[record.status]}</span></td>
                        <td className="max-w-[220px] truncate border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]" title={record.problemDescription ?? ""}>{record.problemDescription ?? "-"}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{record.technicianName ?? record.serviceProvider ?? record.createdByName ?? "-"}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 font-semibold text-[#2f211c]">{formatCurrency(record.cost)}</td>
                        <td className="max-w-[240px] truncate border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]" title={record.workPerformed ?? ""}>{record.workPerformed ?? record.notes ?? "-"}</td>
                        <td className="border-l border-[#f0e5da] px-3 py-2 text-[#4a3b34]">{formatDate(record.nextMaintenanceDate)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {record.status === "reported" || record.status === "scheduled" ? (
                              <button disabled={isSaving} type="button" onClick={() => void startMaintenance(record)} className="flex h-8 items-center gap-1 rounded-md border border-[#e4d8c8] px-2 text-[11px] font-semibold text-[#4a3b34] hover:bg-[#f5eee6] disabled:opacity-60"><Clock size={13} />بدء</button>
                            ) : null}
                            {record.status !== "completed" && record.status !== "cancelled" ? (
                              <button disabled={isSaving} type="button" onClick={() => { setCompleteRecord(record); setCompleteForm({ ...emptyCompleteForm, equipmentStatus: selectedAsset.status === "out_of_service" ? "out_of_service" : "operational" }); }} className="flex h-8 items-center gap-1 rounded-md bg-[#a65f3f] px-2 text-[11px] font-semibold text-white disabled:opacity-60"><CheckCircle2 size={13} />إنهاء</button>
                            ) : <span className="text-[#9a8779]">-</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
        </div>
      ) : null}

      {breakdownAsset ? (
        <Modal title={`تسجيل عطل - ${breakdownAsset.nameAr}`} onClose={() => setBreakdownAsset(null)}>
          <form onSubmit={submitBreakdown} className="space-y-3">
            <textarea required value={breakdownForm.problemDescription} onChange={(event) => setBreakdownForm({ ...breakdownForm, problemDescription: event.target.value })} placeholder="وصف المشكلة" className="min-h-24 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#a65f3f]" />
            <label className="space-y-1 text-xs font-semibold text-[#7c6b60]">
              تاريخ البلاغ
              <input type="datetime-local" value={breakdownForm.reportedAt} onChange={(event) => setBreakdownForm({ ...breakdownForm, reportedAt: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm font-normal text-[#2f211c]" />
            </label>
            <textarea value={breakdownForm.notes} onChange={(event) => setBreakdownForm({ ...breakdownForm, notes: event.target.value })} placeholder="ملاحظة" className="min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#a65f3f]" />
            <button disabled={isSaving} type="submit" className="h-11 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white disabled:opacity-60">حفظ العطل</button>
          </form>
        </Modal>
      ) : null}

      {maintenanceAsset ? (
        <Modal title={`إضافة صيانة - ${maintenanceAsset.nameAr}`} onClose={() => setMaintenanceAsset(null)}>
          <form onSubmit={submitMaintenance} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={maintenanceForm.maintenanceType} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: event.target.value as EquipmentMaintenanceType })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
                {maintenanceTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={maintenanceForm.status} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, status: event.target.value as "reported" | "scheduled" })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
                <option value="reported">مبلغ</option>
                <option value="scheduled">مجدول</option>
              </select>
            </div>
            <input type="datetime-local" value={maintenanceForm.reportedAt} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, reportedAt: event.target.value })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
            <textarea value={maintenanceForm.problemDescription} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, problemDescription: event.target.value })} placeholder="وصف أو سبب الصيانة" className="min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm" />
            <textarea value={maintenanceForm.notes} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, notes: event.target.value })} placeholder="ملاحظات" className="min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm" />
            <button disabled={isSaving} type="submit" className="h-11 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white disabled:opacity-60">حفظ السجل</button>
          </form>
        </Modal>
      ) : null}

      {completeRecord ? (
        <Modal title="إنهاء الصيانة" onClose={() => setCompleteRecord(null)}>
          <form onSubmit={submitComplete} className="space-y-3">
            <textarea required value={completeForm.workPerformed} onChange={(event) => setCompleteForm({ ...completeForm, workPerformed: event.target.value })} placeholder="ما تم عمله" className="min-h-24 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input min="0" step="1" type="number" value={completeForm.cost} onChange={(event) => setCompleteForm({ ...completeForm, cost: event.target.value })} placeholder="التكلفة" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
              <input type="datetime-local" value={completeForm.completedAt} onChange={(event) => setCompleteForm({ ...completeForm, completedAt: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={completeForm.technicianName} onChange={(event) => setCompleteForm({ ...completeForm, technicianName: event.target.value })} placeholder="الفني" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
              <input value={completeForm.serviceProvider} onChange={(event) => setCompleteForm({ ...completeForm, serviceProvider: event.target.value })} placeholder="الشركة" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={completeForm.invoiceReference} onChange={(event) => setCompleteForm({ ...completeForm, invoiceReference: event.target.value })} placeholder="رقم الفاتورة اختياري" className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
              <input type="date" value={completeForm.nextMaintenanceDate} onChange={(event) => setCompleteForm({ ...completeForm, nextMaintenanceDate: event.target.value })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm" />
            </div>
            <select value={completeForm.equipmentStatus} onChange={(event) => setCompleteForm({ ...completeForm, equipmentStatus: event.target.value as EquipmentStatus })} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 text-sm">
              <option value="operational">يعمل</option>
              <option value="needs_maintenance">يحتاج صيانة</option>
              <option value="under_maintenance">تحت الصيانة</option>
              <option value="out_of_service">خارج الخدمة</option>
              <option value="retired">مستبعد</option>
            </select>
            <textarea value={completeForm.notes} onChange={(event) => setCompleteForm({ ...completeForm, notes: event.target.value })} placeholder="ملاحظات" className="min-h-20 w-full rounded-md border border-[#e4d8c8] bg-[#fffdfa] px-3 py-2 text-sm" />
            <button disabled={isSaving} type="submit" className="h-11 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white disabled:opacity-60">إنهاء الصيانة</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Detail({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <section className="rounded-md border border-[#eee4d8] bg-[#fbfaf7] p-3">
      <p className="text-xs text-[#7c6b60]">{label}</p>
      <p className="mt-2 font-semibold text-[#2f211c]">{value}</p>
      <p className="mt-1 text-xs text-[#9a8779]">{helper}</p>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#eee4d8] py-2 last:border-b-0">
      <span className="text-[#7c6b60]">{label}</span>
      <span className="text-left font-semibold text-[#2f211c]">{value}</span>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-[#e4d8c8] bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#a65f3f]" />
            <h3 className="font-semibold text-[#2f211c]">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]">
            <X size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
