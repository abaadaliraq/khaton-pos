"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminStats } from "@/components/admin/AdminStats";
import { CreateStaffAccountDialog } from "@/components/admin/CreateStaffAccountDialog";
import { StaffFilters, type StaffFilterState } from "@/components/admin/StaffFilters";
import { StaffStatusDialog } from "@/components/admin/StaffStatusDialog";
import { StaffTable } from "@/components/admin/StaffTable";
import { updateStaffStatus } from "@/services/staffService";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import type { StaffMember, StaffStatus } from "@/types/staff";

const initialFilters: StaffFilterState = { search: "", status: "all", department: "all", employmentType: "all", access: "all" };

export default function StaffPage() {
  const { staff, statistics, isLoading, error, refresh, setStaff } = useStaffMembers();
  const [filters, setFilters] = useState(initialFilters);
  const [statusMember, setStatusMember] = useState<StaffMember | null>(null);
  const [accountMember, setAccountMember] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return staff.filter((member) => {
      const searchMatches = !search || member.fullName.toLowerCase().includes(search) || String(member.employeeNumber).includes(search) || member.jobTitle.toLowerCase().includes(search) || (member.phone ?? "").includes(search);
      return searchMatches &&
        (filters.status === "all" || member.status === filters.status) &&
        (filters.department === "all" || member.department === filters.department) &&
        (filters.employmentType === "all" || member.employmentType === filters.employmentType) &&
        (filters.access === "all" || (filters.access === "with" ? member.hasSystemAccess : !member.hasSystemAccess));
    });
  }, [filters, staff]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function changeStatus(status: StaffStatus) {
    if (!statusMember) return;
    const updated = await updateStaffStatus(statusMember.id, status);
    setStaff((current) => current.map((member) => (member.id === updated.id ? updated : member)));
    setToast("تم تحديث حالة العامل بنجاح");
    window.setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-[#7c6b60]">لوحة الإدارة</p><h1 className="text-2xl font-semibold text-[#2f211c]">العمال والموظفون</h1></div>
        <Link href="/admin/staff/new" className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]"><Plus size={18} />إضافة عامل جديد</Link>
      </section>
      <AdminStats statistics={statistics} />
      <StaffFilters filters={filters} onChange={(next) => { setFilters(next); setPage(1); }} />
      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-6 text-sm text-[#7c6b60]">جارٍ تحميل بيانات العمال...</div> : null}
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {!isLoading && !error ? <StaffTable staff={visible} onChangeStatus={setStatusMember} onCreateAccount={setAccountMember} /> : null}
      {totalPages > 1 ? <div className="flex items-center justify-end gap-2"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-9 rounded-md border border-[#e4d8c8] px-3 text-sm disabled:opacity-50">السابق</button><span className="text-sm text-[#7c6b60]">{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-9 rounded-md border border-[#e4d8c8] px-3 text-sm disabled:opacity-50">التالي</button></div> : null}
      {toast ? <div className="fixed bottom-5 left-5 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">{toast}</div> : null}
      <StaffStatusDialog member={statusMember} isOpen={Boolean(statusMember)} onClose={() => setStatusMember(null)} onConfirm={changeStatus} />
      <CreateStaffAccountDialog member={accountMember} isOpen={Boolean(accountMember)} onClose={() => setAccountMember(null)} onCreated={(member) => { setStaff((current) => current.map((item) => item.id === member.id ? member : item)); setToast("تم إنشاء حساب العامل بنجاح"); void refresh(); }} />
    </div>
  );
}
