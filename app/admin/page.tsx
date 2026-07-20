"use client";

import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { AdminStats } from "@/components/admin/AdminStats";
import { useStaffMembers } from "@/hooks/useStaffMembers";

export default function AdminPage() {
  const { statistics, staff, isLoading, error } = useStaffMembers();
  const recent = staff.slice(0, 5);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#7c6b60]">الرئيسية</p>
          <h1 className="text-2xl font-semibold text-[#2f211c]">نظرة عامة على الإدارة</h1>
        </div>
        <Link href="/admin/staff/new" className="flex h-11 items-center gap-2 rounded-md bg-[#a65f3f] px-4 text-sm font-semibold text-white hover:bg-[#8f4e34]"><Plus size={18} />إضافة عامل جديد</Link>
      </section>
      <AdminStats statistics={statistics} />
      <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2"><UsersRound size={19} className="text-[#a65f3f]" /><h2 className="font-semibold text-[#2f211c]">آخر العمال</h2></div>
        {isLoading ? <p className="text-sm text-[#7c6b60]">جارٍ تحميل بيانات العمال...</p> : null}
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {!isLoading && !error && recent.length === 0 ? <p className="text-sm text-[#7c6b60]">لا توجد سجلات عمال حتى الآن</p> : null}
        <div className="divide-y divide-[#eee4d8]">
          {recent.map((member) => (
            <Link key={member.id} href={`/admin/staff/${member.id}`} className="flex items-center justify-between py-3 text-sm hover:bg-[#fffaf4]">
              <span className="font-medium text-[#2f211c]">{member.fullName}</span>
              <span className="text-[#7c6b60]">#{member.employeeNumber} · {member.jobTitle}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
