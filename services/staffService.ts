"use client";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabaseError";
import type { CreateStaffInput, StaffMember, StaffStatistics, StaffStatus, SystemRole, UpdateStaffInput } from "@/types/staff";

type StaffRow = {
  id: string;
  employee_number: number;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  secondary_phone: string | null;
  job_title: string;
  department: StaffMember["department"];
  employment_type: StaffMember["employmentType"];
  shift_type: StaffMember["shiftType"];
  hire_date: string | null;
  birth_date: string | null;
  salary: number | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  status: StaffStatus;
  has_system_access: boolean;
  created_at: string;
  updated_at: string;
  profile: { username: string; role: SystemRole; status: "active" | "inactive" | "suspended" } | null;
};

function clean(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function rowToStaff(row: StaffRow): StaffMember {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    profileId: row.profile_id,
    fullName: row.full_name,
    phone: row.phone,
    secondaryPhone: row.secondary_phone,
    jobTitle: row.job_title,
    department: row.department,
    employmentType: row.employment_type,
    shiftType: row.shift_type,
    hireDate: row.hire_date,
    birthDate: row.birth_date,
    salary: row.salary,
    address: row.address,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    notes: row.notes,
    status: row.status,
    hasSystemAccess: row.has_system_access,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile: row.profile,
  };
}

const staffSelect = "id, employee_number, profile_id, full_name, phone, secondary_phone, job_title, department, employment_type, shift_type, hire_date, birth_date, salary, address, emergency_contact_name, emergency_contact_phone, notes, status, has_system_access, created_at, updated_at, profile:profiles!staff_members_profile_id_fkey(username, role, status)";

export async function getStaffMembers() {
  const supabase = createClient();
  const { data, error } = await supabase.from("staff_members" as never).select(staffSelect).order("employee_number", { ascending: true });
  if (error) {
    logSupabaseError("[staff_members SELECT]", error);
    throw error;
  }
  return ((data ?? []) as unknown as StaffRow[]).map(rowToStaff);
}

export async function getStaffMemberById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("staff_members" as never).select(staffSelect).eq("id", id).maybeSingle();
  if (error) {
    logSupabaseError("[staff_members SELECT by id]", error);
    throw error;
  }
  return data ? rowToStaff(data as unknown as StaffRow) : null;
}

async function getStaffMemberAfterMutation(data: unknown) {
  const id = (data as { id?: string } | null)?.id;
  if (!id) throw new Error("لم يرجع Supabase معرف العامل");
  const staff = await getStaffMemberById(id);
  if (!staff) throw new Error("لم يتم العثور على سجل العامل بعد الحفظ");
  return staff;
}

function rpcPayload(input: CreateStaffInput) {
  return {
    p_full_name: input.fullName,
    p_phone: clean(input.phone),
    p_secondary_phone: clean(input.secondaryPhone),
    p_job_title: input.jobTitle,
    p_department: input.department,
    p_employment_type: input.employmentType,
    p_shift_type: input.shiftType,
    p_hire_date: clean(input.hireDate),
    p_birth_date: clean(input.birthDate),
    p_salary: input.salary ?? null,
    p_address: clean(input.address),
    p_emergency_contact_name: clean(input.emergencyContactName),
    p_emergency_contact_phone: clean(input.emergencyContactPhone),
    p_notes: clean(input.notes),
  };
}

export async function createStaffMember(input: CreateStaffInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_staff_member" as never, rpcPayload(input) as never);
  if (error) {
    logSupabaseError("[staff create RPC create_staff_member]", error);
    throw error;
  }
  return getStaffMemberAfterMutation(data);
}

export async function updateStaffMember(input: UpdateStaffInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_staff_member" as never, { p_staff_id: input.id, ...rpcPayload(input) } as never);
  if (error) {
    logSupabaseError("[staff update RPC update_staff_member]", error);
    throw error;
  }
  return getStaffMemberAfterMutation(data);
}

export async function updateStaffStatus(id: string, status: StaffStatus) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_staff_status" as never, { p_staff_id: id, p_status: status } as never);
  if (error) {
    logSupabaseError("[staff status RPC update_staff_status]", error);
    throw error;
  }
  return getStaffMemberAfterMutation(data);
}

export async function updateStaffSystemAccess(id: string, isActive: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_staff_system_access" as never, { p_staff_id: id, p_is_active: isActive } as never);
  if (error) {
    logSupabaseError("[staff system access RPC update_staff_system_access]", error);
    throw error;
  }
  return getStaffMemberAfterMutation(data);
}

export function getStaffStatistics(staff: StaffMember[]): StaffStatistics {
  return {
    total: staff.length,
    active: staff.filter((member) => member.status === "active").length,
    onLeave: staff.filter((member) => member.status === "on_leave").length,
    inactive: staff.filter((member) => member.status === "inactive").length,
    terminated: staff.filter((member) => member.status === "terminated").length,
    withSystemAccess: staff.filter((member) => member.hasSystemAccess).length,
  };
}

export async function createStaffSystemAccount(input: { staffId: string; username: string; password: string; systemRole: SystemRole }) {
  const response = await fetch("/api/admin/staff/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const responseText = await response.text();
  let payload: { error?: unknown; staff?: StaffRow } = {};
  try {
    payload = responseText ? JSON.parse(responseText) as { error?: unknown; staff?: StaffRow } : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    console.error(`[staff account API create-account] status=${response.status} body=${responseText || "-"}`);
    throw new Error(typeof payload.error === "string" ? payload.error : `تعذر إنشاء حساب النظام. رمز الاستجابة ${response.status}`);
  }

  if (!payload.staff) throw new Error("لم يرجع الخادم سجل العامل");
  return rowToStaff(payload.staff);
}
