"use client";

import { Eye, Pencil, ShieldPlus, ToggleLeft } from "lucide-react";
import Link from "next/link";
import { departmentLabels, employmentTypeLabels, shiftTypeLabels, type StaffMember } from "@/types/staff";
import { StaffStatusBadge } from "@/components/admin/StaffStatusBadge";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium" }).format(new Date(value));
}

export function StaffTable({ staff, onChangeStatus, onCreateAccount }: { staff: StaffMember[]; onChangeStatus: (member: StaffMember) => void; onCreateAccount: (member: StaffMember) => void }) {
  if (staff.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#d8c8b8] bg-white p-8 text-center text-[#7c6b60]">
        لا توجد سجلات عمال حتى الآن
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-sm">
          <thead className="bg-[#f5eee6] text-[#4a3b34]">
            <tr>
              <th className="px-3 py-3 text-right font-semibold">رقم</th>
              <th className="px-3 py-3 text-right font-semibold">الاسم</th>
              <th className="px-3 py-3 text-right font-semibold">الوظيفة</th>
              <th className="px-3 py-3 text-right font-semibold">القسم</th>
              <th className="px-3 py-3 text-right font-semibold">الهاتف</th>
              <th className="px-3 py-3 text-right font-semibold">الدوام</th>
              <th className="px-3 py-3 text-right font-semibold">الوردية</th>
              <th className="px-3 py-3 text-right font-semibold">التعيين</th>
              <th className="px-3 py-3 text-right font-semibold">الحالة</th>
              <th className="px-3 py-3 text-right font-semibold">حساب</th>
              <th className="px-3 py-3 text-right font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee4d8]">
            {staff.map((member) => (
              <tr key={member.id} className="hover:bg-[#fffaf4]">
                <td className="px-3 py-3 font-semibold text-[#5d4032]">#{member.employeeNumber}</td>
                <td className="px-3 py-3 text-[#2f211c]">{member.fullName}</td>
                <td className="px-3 py-3 text-[#4a3b34]">{member.jobTitle}</td>
                <td className="px-3 py-3 text-[#4a3b34]">{departmentLabels[member.department]}</td>
                <td className="px-3 py-3 text-[#4a3b34]">{member.phone ?? "-"}</td>
                <td className="px-3 py-3 text-[#4a3b34]">{employmentTypeLabels[member.employmentType]}</td>
                <td className="px-3 py-3 text-[#4a3b34]">{shiftTypeLabels[member.shiftType]}</td>
                <td className="px-3 py-3 text-[#4a3b34]">{formatDate(member.hireDate)}</td>
                <td className="px-3 py-3"><StaffStatusBadge status={member.status} /></td>
                <td className="px-3 py-3">{member.hasSystemAccess ? <span className="text-emerald-700">نعم</span> : <span className="text-[#9a8779]">لا</span>}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/staff/${member.id}`} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="عرض"><Eye size={15} /></Link>
                    <Link href={`/admin/staff/${member.id}?edit=1`} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تعديل"><Pencil size={15} /></Link>
                    <button type="button" onClick={() => onChangeStatus(member)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="تغيير الحالة"><ToggleLeft size={15} /></button>
                    {!member.hasSystemAccess ? <button type="button" onClick={() => onCreateAccount(member)} className="rounded-md border border-[#e4d8c8] p-2 text-[#4a3b34] hover:bg-[#f5eee6]" title="إنشاء حساب"><ShieldPlus size={15} /></button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
