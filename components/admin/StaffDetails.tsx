import { departmentLabels, employmentTypeLabels, shiftTypeLabels, type StaffMember } from "@/types/staff";
import { StaffStatusBadge } from "@/components/admin/StaffStatusBadge";
import { formatCurrency } from "@/lib/formatCurrency";
import { getRoleLabel } from "@/lib/auth";

function dateValue(value: string | null) {
  return value ? new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-md border border-[#e4d8c8] bg-white p-3"><p className="text-xs text-[#7c6b60]">{label}</p><p className="mt-1 font-medium text-[#2f211c]">{value ?? "-"}</p></div>;
}

export function StaffDetails({ member }: { member: StaffMember }) {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#7c6b60]">عامل رقم #{member.employeeNumber}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#2f211c]">{member.fullName}</h2>
          </div>
          <StaffStatusBadge status={member.status} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Info label="الوظيفة" value={member.jobTitle} />
        <Info label="القسم" value={departmentLabels[member.department]} />
        <Info label="نوع الدوام" value={employmentTypeLabels[member.employmentType]} />
        <Info label="الوردية" value={shiftTypeLabels[member.shiftType]} />
        <Info label="تاريخ التعيين" value={dateValue(member.hireDate)} />
        <Info label="الراتب" value={member.salary === null ? "-" : formatCurrency(member.salary)} />
        <Info label="الهاتف" value={member.phone} />
        <Info label="هاتف ثانوي" value={member.secondaryPhone} />
        <Info label="تاريخ الميلاد" value={dateValue(member.birthDate)} />
        <Info label="العنوان" value={member.address} />
        <Info label="جهة الطوارئ" value={member.emergencyContactName} />
        <Info label="هاتف الطوارئ" value={member.emergencyContactPhone} />
        <Info label="دخول النظام" value={member.hasSystemAccess ? "نعم" : "لا"} />
        <Info label="اسم المستخدم" value={member.profile?.username} />
        <Info label="دور النظام" value={member.profile?.role ? getRoleLabel(member.profile.role) : null} />
        <Info label="تاريخ إنشاء السجل" value={dateValue(member.createdAt)} />
        <Info label="آخر تحديث" value={dateValue(member.updatedAt)} />
      </section>

      <section className="rounded-md border border-[#e4d8c8] bg-white p-4">
        <h3 className="font-semibold text-[#2f211c]">الملاحظات</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#4a3b34]">{member.notes || "لا توجد ملاحظات"}</p>
      </section>
    </div>
  );
}
