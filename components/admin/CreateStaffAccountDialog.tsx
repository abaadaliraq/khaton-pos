"use client";

import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { logSupabaseError } from "@/lib/supabaseError";
import { createStaffSystemAccount } from "@/services/staffService";
import type { StaffMember, SystemRole } from "@/types/staff";

const roles: { value: SystemRole; label: string }[] = [
  { value: "admin", label: "مدير النظام" },
  { value: "captain", label: "كابتن" },
  { value: "cashier", label: "كاشير" },
  { value: "kitchen", label: "مطبخ" },
  { value: "storekeeper", label: "مسؤول المخزن" },
  { value: "accountant", label: "محاسب" },
];

export function CreateStaffAccountDialog({ member, isOpen, onClose, onCreated }: { member: StaffMember | null; isOpen: boolean; onClose: () => void; onCreated: (member: StaffMember) => void }) {
  const [username, setUsername] = useState("");
  const [systemRole, setSystemRole] = useState<SystemRole>("captain");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !member) return null;

  function resetAndClose() {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    const currentMember = member;
    setError("");
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      setError("اسم المستخدم يجب أن يحتوي أحرفًا إنجليزية وأرقامًا وشرطة سفلية فقط");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    if (password !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await createStaffSystemAccount({ staffId: currentMember.id, username: normalizedUsername, password, systemRole });
      onCreated(updated);
      resetAndClose();
    } catch (createError) {
      logSupabaseError("[staff account create]", createError);
      setError(createError instanceof Error ? createError.message : "تعذر إنشاء حساب العامل");
    } finally {
      setPassword("");
      setConfirmPassword("");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-md bg-white p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-[#2f211c]">إنشاء حساب للنظام</h2>
        <p className="mt-1 text-sm text-[#7c6b60]">سيستخدم العامل هذا الحساب للدخول إلى نظام خاتون.</p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">اسم المستخدم<input value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">الدور<select value={systemRole} onChange={(e) => setSystemRole(e.target.value as SystemRole)} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">كلمة المرور<div className="relative"><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 pl-10 outline-none" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#7c6b60]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <label className="grid gap-1 text-sm font-medium text-[#4a3b34]">تأكيد كلمة المرور<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type={showPassword ? "text" : "password"} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none" /></label>
        </div>
        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={resetAndClose} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button>
          <button type="submit" disabled={isSaving} className="h-10 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:bg-stone-300">{isSaving ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
        </div>
      </form>
    </div>
  );
}
