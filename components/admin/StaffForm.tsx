"use client";

import { FormEvent, useMemo, useState } from "react";
import { logSupabaseError } from "@/lib/supabaseError";
import type { CreateStaffInput, StaffMember } from "@/types/staff";
import { departmentLabels, employmentTypeLabels, shiftTypeLabels } from "@/types/staff";

const departments = Object.keys(departmentLabels) as CreateStaffInput["department"][];
const employmentTypes = Object.keys(employmentTypeLabels) as CreateStaffInput["employmentType"][];
const shiftTypes = Object.keys(shiftTypeLabels) as CreateStaffInput["shiftType"][];

const blankForm: CreateStaffInput = {
  fullName: "",
  phone: "",
  secondaryPhone: "",
  jobTitle: "",
  department: "service",
  employmentType: "full_time",
  shiftType: "fixed",
  hireDate: "",
  birthDate: "",
  salary: null,
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
};

function fromMember(member?: StaffMember | null): CreateStaffInput {
  if (!member) return blankForm;
  return {
    fullName: member.fullName,
    phone: member.phone ?? "",
    secondaryPhone: member.secondaryPhone ?? "",
    jobTitle: member.jobTitle,
    department: member.department,
    employmentType: member.employmentType,
    shiftType: member.shiftType,
    hireDate: member.hireDate ?? "",
    birthDate: member.birthDate ?? "",
    salary: member.salary,
    address: member.address ?? "",
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactPhone: member.emergencyContactPhone ?? "",
    notes: member.notes ?? "",
  };
}

export function StaffForm({ member, submitLabel, onCancel, onSubmit }: { member?: StaffMember | null; submitLabel: string; onCancel: () => void; onSubmit: (input: CreateStaffInput) => Promise<void> }) {
  const initial = useMemo(() => fromMember(member), [member]);
  const [form, setForm] = useState<CreateStaffInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof CreateStaffInput>(key: K, value: CreateStaffInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSubmitError("");
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const phonePattern = /^[0-9+\s-]*$/;
    if (form.fullName.trim().length < 2) nextErrors.fullName = "الاسم يجب ألا يقل عن حرفين";
    if (!form.jobTitle.trim()) nextErrors.jobTitle = "المسمى الوظيفي مطلوب";
    if (form.phone && !phonePattern.test(form.phone)) nextErrors.phone = "الهاتف يسمح بالأرقام و+ والمسافات فقط";
    if (form.secondaryPhone && !phonePattern.test(form.secondaryPhone)) nextErrors.secondaryPhone = "الهاتف يسمح بالأرقام و+ والمسافات فقط";
    if (form.emergencyContactPhone && !phonePattern.test(form.emergencyContactPhone)) nextErrors.emergencyContactPhone = "الهاتف يسمح بالأرقام و+ والمسافات فقط";
    if (form.salary !== null && form.salary !== undefined && form.salary < 0) nextErrors.salary = "الراتب يجب أن يكون موجبًا أو فارغًا";
    if (form.birthDate && new Date(form.birthDate) > new Date()) nextErrors.birthDate = "تاريخ الميلاد لا يكون في المستقبل";
    if (form.hireDate && new Date(form.hireDate).getFullYear() < 1980) nextErrors.hireDate = "تاريخ التعيين غير منطقي";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate() || isSaving) return;
    setIsSaving(true);
    setSubmitError("");
    try {
      await onSubmit(form);
    } catch (saveError) {
      logSupabaseError("[staff form submit]", saveError);
      setSubmitError("تعذر حفظ بيانات العامل. راجع الاتصال أو صلاحيات قاعدة البيانات ثم حاول مرة أخرى.");
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass = "h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#a65f3f] focus:bg-white";
  const labelClass = "grid gap-1 text-sm font-medium text-[#4a3b34]";

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#2f211c]">المعلومات الأساسية</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>الاسم الكامل<input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className={inputClass} />{errors.fullName ? <span className="text-xs text-rose-700">{errors.fullName}</span> : null}</label>
          <label className={labelClass}>رقم الهاتف<input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} className={inputClass} />{errors.phone ? <span className="text-xs text-rose-700">{errors.phone}</span> : null}</label>
          <label className={labelClass}>هاتف ثانوي<input value={form.secondaryPhone ?? ""} onChange={(e) => update("secondaryPhone", e.target.value)} className={inputClass} />{errors.secondaryPhone ? <span className="text-xs text-rose-700">{errors.secondaryPhone}</span> : null}</label>
          <label className={labelClass}>تاريخ الميلاد<input type="date" value={form.birthDate ?? ""} onChange={(e) => update("birthDate", e.target.value)} className={inputClass} />{errors.birthDate ? <span className="text-xs text-rose-700">{errors.birthDate}</span> : null}</label>
          <label className={`${labelClass} md:col-span-2`}>العنوان<input value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#2f211c]">معلومات العمل</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>المسمى الوظيفي<input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} className={inputClass} />{errors.jobTitle ? <span className="text-xs text-rose-700">{errors.jobTitle}</span> : null}</label>
          <label className={labelClass}>القسم<select value={form.department} onChange={(e) => update("department", e.target.value as CreateStaffInput["department"])} className={inputClass}>{departments.map((item) => <option key={item} value={item}>{departmentLabels[item]}</option>)}</select></label>
          <label className={labelClass}>نوع الدوام<select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value as CreateStaffInput["employmentType"])} className={inputClass}>{employmentTypes.map((item) => <option key={item} value={item}>{employmentTypeLabels[item]}</option>)}</select></label>
          <label className={labelClass}>الوردية<select value={form.shiftType} onChange={(e) => update("shiftType", e.target.value as CreateStaffInput["shiftType"])} className={inputClass}>{shiftTypes.map((item) => <option key={item} value={item}>{shiftTypeLabels[item]}</option>)}</select></label>
          <label className={labelClass}>تاريخ التعيين<input type="date" value={form.hireDate ?? ""} onChange={(e) => update("hireDate", e.target.value)} className={inputClass} />{errors.hireDate ? <span className="text-xs text-rose-700">{errors.hireDate}</span> : null}</label>
          <label className={labelClass}>الراتب<input type="number" min="0" value={form.salary ?? ""} onChange={(e) => update("salary", e.target.value ? Number(e.target.value) : null)} className={inputClass} />{errors.salary ? <span className="text-xs text-rose-700">{errors.salary}</span> : null}</label>
        </div>
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#2f211c]">جهة اتصال الطوارئ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>الاسم<input value={form.emergencyContactName ?? ""} onChange={(e) => update("emergencyContactName", e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>الهاتف<input value={form.emergencyContactPhone ?? ""} onChange={(e) => update("emergencyContactPhone", e.target.value)} className={inputClass} />{errors.emergencyContactPhone ? <span className="text-xs text-rose-700">{errors.emergencyContactPhone}</span> : null}</label>
        </div>
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
        <label className={labelClass}>ملاحظات<textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} className="min-h-28 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] p-3 text-sm outline-none focus:border-[#a65f3f] focus:bg-white" /></label>
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-md border border-[#e4d8c8] bg-white px-4 text-sm font-medium text-[#4a3b34] hover:bg-[#f5eee6]">إلغاء</button>
        <button type="submit" disabled={isSaving} className="h-11 rounded-md bg-[#5d4032] px-5 text-sm font-semibold text-white hover:bg-[#463025] disabled:bg-stone-300">{isSaving ? "جارٍ الحفظ..." : submitLabel}</button>
      </div>
      {submitError ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p> : null}
    </form>
  );
}
