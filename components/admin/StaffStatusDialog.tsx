"use client";

import { useState } from "react";
import { staffStatusLabels, type StaffMember, type StaffStatus } from "@/types/staff";

const statuses: StaffStatus[] = ["active", "on_leave", "inactive", "terminated"];

export function StaffStatusDialog({ member, isOpen, onClose, onConfirm }: { member: StaffMember | null; isOpen: boolean; onClose: () => void; onConfirm: (status: StaffStatus) => Promise<void> }) {
  const [status, setStatus] = useState<StaffStatus>("active");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !member) return null;

  async function confirm() {
    setIsSaving(true);
    try {
      await onConfirm(status);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-[#2f211c]">تغيير حالة العامل</h2>
        <p className="mt-1 text-sm text-[#7c6b60]">{member.fullName}</p>
        <select value={status} onChange={(event) => setStatus(event.target.value as StaffStatus)} className="mt-4 h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 outline-none">
          {statuses.map((item) => <option key={item} value={item}>{staffStatusLabels[item]}</option>)}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-[#e4d8c8] px-4 text-sm">إلغاء</button>
          <button type="button" disabled={isSaving} onClick={confirm} className="h-10 rounded-md bg-[#5d4032] px-4 text-sm font-semibold text-white disabled:bg-stone-300">حفظ</button>
        </div>
      </div>
    </div>
  );
}
