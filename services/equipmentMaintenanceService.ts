"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type {
  EquipmentAsset,
  EquipmentCategory,
  EquipmentLocation,
  EquipmentMaintenanceRecord,
  EquipmentMaintenanceStatus,
  EquipmentMaintenanceType,
  EquipmentOverview,
  EquipmentStatus,
} from "@/types/inventory";

type ProfileNameRow = { full_name: string | null; username: string | null };

type MaintenanceRow = {
  id: string;
  equipment_id: string;
  maintenance_type: EquipmentMaintenanceType;
  status: EquipmentMaintenanceStatus;
  reported_at: string;
  started_at: string | null;
  completed_at: string | null;
  problem_description: string | null;
  work_performed: string | null;
  technician_name: string | null;
  service_provider: string | null;
  cost: number | string;
  invoice_reference: string | null;
  next_maintenance_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_profile: ProfileNameRow | null;
};

type EquipmentRow = {
  id: string;
  asset_code: string;
  name_ar: string;
  name_en: string | null;
  category: EquipmentCategory;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location: EquipmentLocation;
  status: EquipmentStatus;
  purchase_date: string | null;
  purchase_cost: number | string | null;
  supplier_id: string | null;
  warranty_start_date: string | null;
  warranty_expiry_date: string | null;
  installation_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  supplier: { name: string } | null;
  created_by_profile: ProfileNameRow | null;
  equipment_maintenance_records: MaintenanceRow[] | null;
};

export type CreateEquipmentAssetInput = {
  nameAr: string;
  category: EquipmentCategory;
  location: EquipmentLocation;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  supplierId?: string;
  warrantyExpiryDate?: string;
  notes?: string;
};

export type UpdateEquipmentAssetInput = CreateEquipmentAssetInput & {
  id: string;
  status: EquipmentStatus;
};

export type ReportEquipmentBreakdownInput = {
  equipmentId: string;
  problemDescription: string;
  reportedAt?: string;
  notes?: string;
};

export type CreateEquipmentMaintenanceInput = {
  equipmentId: string;
  maintenanceType: EquipmentMaintenanceType;
  status: "reported" | "scheduled";
  reportedAt?: string;
  problemDescription?: string;
  notes?: string;
};

export type CompleteEquipmentMaintenanceInput = {
  recordId: string;
  workPerformed: string;
  cost: number;
  completedAt?: string;
  technicianName?: string;
  serviceProvider?: string;
  invoiceReference?: string;
  nextMaintenanceDate?: string;
  equipmentStatus: EquipmentStatus;
  notes?: string;
};

const profileNameSelect = "full_name, username";
const maintenanceSelect = `id, equipment_id, maintenance_type, status, reported_at, started_at, completed_at, problem_description, work_performed, technician_name, service_provider, cost, invoice_reference, next_maintenance_date, notes, created_at, updated_at,
  created_by_profile:profiles!equipment_maintenance_records_created_by_fkey(${profileNameSelect})`;
const equipmentSelect = `id, asset_code, name_ar, name_en, category, brand, model, serial_number, location, status, purchase_date, purchase_cost, supplier_id, warranty_start_date, warranty_expiry_date, installation_date, notes, is_active, created_at, updated_at,
  supplier:suppliers!equipment_assets_supplier_id_fkey(name),
  created_by_profile:profiles!equipment_assets_created_by_fkey(${profileNameSelect}),
  equipment_maintenance_records(${maintenanceSelect})`;

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function cleanNumber(value: number | undefined) {
  return Number.isFinite(value) && value !== undefined ? value : null;
}

function profileName(profile: ProfileNameRow | null | undefined) {
  return profile?.full_name ?? profile?.username ?? undefined;
}

function rowToMaintenance(row: MaintenanceRow): EquipmentMaintenanceRecord {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    maintenanceType: row.maintenance_type,
    status: row.status,
    reportedAt: row.reported_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    problemDescription: row.problem_description ?? undefined,
    workPerformed: row.work_performed ?? undefined,
    technicianName: row.technician_name ?? undefined,
    serviceProvider: row.service_provider ?? undefined,
    cost: asNumber(row.cost),
    invoiceReference: row.invoice_reference ?? undefined,
    nextMaintenanceDate: row.next_maintenance_date ?? undefined,
    notes: row.notes ?? undefined,
    createdByName: profileName(row.created_by_profile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEquipment(row: EquipmentRow): EquipmentAsset {
  return {
    id: row.id,
    assetCode: row.asset_code,
    nameAr: row.name_ar,
    nameEn: row.name_en ?? undefined,
    category: row.category,
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,
    serialNumber: row.serial_number ?? undefined,
    location: row.location,
    status: row.status,
    purchaseDate: row.purchase_date ?? undefined,
    purchaseCost: row.purchase_cost === null ? undefined : asNumber(row.purchase_cost),
    supplierId: row.supplier_id ?? undefined,
    supplierName: row.supplier?.name ?? undefined,
    warrantyStartDate: row.warranty_start_date ?? undefined,
    warrantyExpiryDate: row.warranty_expiry_date ?? undefined,
    installationDate: row.installation_date ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active,
    createdByName: profileName(row.created_by_profile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    maintenanceRecords: (row.equipment_maintenance_records ?? [])
      .map(rowToMaintenance)
      .sort((a, b) => Date.parse(b.completedAt ?? b.startedAt ?? b.reportedAt) - Date.parse(a.completedAt ?? a.startedAt ?? a.reportedAt)),
  };
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

function latestNextMaintenance(asset: EquipmentAsset) {
  return asset.maintenanceRecords
    .filter((record) => record.status === "completed" && record.nextMaintenanceDate)
    .map((record) => record.nextMaintenanceDate as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function summarizeEquipment(assets: EquipmentAsset[]): EquipmentOverview["summary"] {
  const today = todayIso();
  const activeAssets = assets.filter((asset) => asset.isActive);
  const overdueMaintenance = activeAssets.filter((asset) => {
    const nextDate = latestNextMaintenance(asset);
    return nextDate ? nextDate < today : false;
  }).length;
  const totalMaintenanceCost = assets.reduce((sum, asset) => sum + asset.maintenanceRecords.reduce((assetSum, record) => assetSum + record.cost, 0), 0);

  return {
    total: activeAssets.length,
    operational: activeAssets.filter((asset) => asset.status === "operational").length,
    needsMaintenance: activeAssets.filter((asset) => asset.status === "needs_maintenance").length,
    underMaintenance: activeAssets.filter((asset) => asset.status === "under_maintenance").length,
    overdueMaintenance,
    followUpCount: activeAssets.filter((asset) => ["needs_maintenance", "under_maintenance", "out_of_service"].includes(asset.status)).length + overdueMaintenance,
    totalMaintenanceCost,
  };
}

export async function getEquipmentOverview(): Promise<EquipmentOverview> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("equipment_assets" as never)
    .select(equipmentSelect)
    .order("asset_code", { ascending: true });

  if (error) {
    logSupabaseError("[equipment assets SELECT]", error);
    throw error;
  }

  const assets = ((data ?? []) as unknown as EquipmentRow[]).map(rowToEquipment);
  return {
    assets,
    summary: summarizeEquipment(assets),
  };
}

export async function createEquipmentAsset(input: CreateEquipmentAssetInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_equipment_asset" as never, {
    p_name_ar: input.nameAr.trim(),
    p_category: input.category,
    p_location: input.location,
    p_brand: clean(input.brand),
    p_model: clean(input.model),
    p_serial_number: clean(input.serialNumber),
    p_purchase_date: clean(input.purchaseDate),
    p_purchase_cost: cleanNumber(input.purchaseCost),
    p_supplier_id: clean(input.supplierId),
    p_warranty_expiry_date: clean(input.warrantyExpiryDate),
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[equipment create RPC]", error);
    throw error;
  }

  return data as string;
}

export async function updateEquipmentAsset(input: UpdateEquipmentAssetInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_equipment_asset" as never, {
    p_equipment_id: input.id,
    p_name_ar: input.nameAr.trim(),
    p_category: input.category,
    p_location: input.location,
    p_status: input.status,
    p_brand: clean(input.brand),
    p_model: clean(input.model),
    p_serial_number: clean(input.serialNumber),
    p_purchase_date: clean(input.purchaseDate),
    p_purchase_cost: cleanNumber(input.purchaseCost),
    p_supplier_id: clean(input.supplierId),
    p_warranty_expiry_date: clean(input.warrantyExpiryDate),
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[equipment update RPC]", error);
    throw error;
  }

  return data as string;
}

export async function reportEquipmentBreakdown(input: ReportEquipmentBreakdownInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("report_equipment_breakdown" as never, {
    p_equipment_id: input.equipmentId,
    p_problem_description: input.problemDescription.trim(),
    p_reported_at: input.reportedAt ? new Date(input.reportedAt).toISOString() : null,
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[equipment breakdown RPC]", error);
    throw error;
  }

  return data as string;
}

export async function createEquipmentMaintenanceRecord(input: CreateEquipmentMaintenanceInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_equipment_maintenance_record" as never, {
    p_equipment_id: input.equipmentId,
    p_maintenance_type: input.maintenanceType,
    p_status: input.status,
    p_reported_at: input.reportedAt ? new Date(input.reportedAt).toISOString() : null,
    p_problem_description: clean(input.problemDescription),
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[equipment maintenance create RPC]", error);
    throw error;
  }

  return data as string;
}

export async function startEquipmentMaintenance(recordId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("start_equipment_maintenance" as never, { p_record_id: recordId } as never);

  if (error) {
    logSupabaseError("[equipment maintenance start RPC]", error);
    throw error;
  }

  return data as string;
}

export async function completeEquipmentMaintenance(input: CompleteEquipmentMaintenanceInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("complete_equipment_maintenance" as never, {
    p_record_id: input.recordId,
    p_work_performed: input.workPerformed.trim(),
    p_cost: input.cost,
    p_completed_at: input.completedAt ? new Date(input.completedAt).toISOString() : null,
    p_technician_name: clean(input.technicianName),
    p_service_provider: clean(input.serviceProvider),
    p_invoice_reference: clean(input.invoiceReference),
    p_next_maintenance_date: clean(input.nextMaintenanceDate),
    p_equipment_status: input.equipmentStatus,
    p_notes: clean(input.notes),
  } as never);

  if (error) {
    logSupabaseError("[equipment maintenance complete RPC]", error);
    throw error;
  }

  return data as string;
}

export async function retireEquipmentAsset(equipmentId: string, notes?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("retire_equipment_asset" as never, {
    p_equipment_id: equipmentId,
    p_notes: clean(notes),
  } as never);

  if (error) {
    logSupabaseError("[equipment retire RPC]", error);
    throw error;
  }

  return data as string;
}
