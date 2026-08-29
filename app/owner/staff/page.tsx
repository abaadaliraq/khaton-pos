"use client";

import { Search, UserCheck, UserRoundX, UsersRound, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import type { StaffDepartment, StaffMember, StaffStatus } from "@/types/staff";
import { departmentLabels, staffStatusLabels } from "@/types/staff";

type StaffActivityFilter = "all" | "active" | "inactive";

const departments: StaffDepartment[] = ["service", "cashier", "kitchen", "management", "cleaning", "barista", "shisha", "inventory", "finance", "other"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ar-IQ");
}

function isOwnerLinked(member: StaffMember) {
  return (member.profile?.role as string | undefined) === "owner";
}

function isActive(member: StaffMember) {
  return member.status === "active";
}

function accessLabel(member: StaffMember) {
  return member.hasSystemAccess && member.profileId ? "نعم" : "لا";
}

function statusTone(status: StaffStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "on_leave") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof UsersRound }) {
  return (
    <article className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#7c6b60]">{title}</span>
        <Icon size={19} className="text-[#a65f3f]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2f211c]">{value}</p>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-[#e4d8c8] bg-[#fbfaf7] p-5 text-center text-sm text-[#7c6b60]">{message}</p>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="h-4 w-28 rounded bg-[#efe7dc]" />
            <div className="mt-5 h-8 w-20 rounded bg-[#efe7dc]" />
          </div>
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-md border border-[#e4d8c8] bg-white" />
    </div>
  );
}

function StaffTable({ staff }: { staff: StaffMember[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e4d8c8] bg-white shadow-sm">
      <div className="border-b border-[#eee4d8] p-4">
        <h2 className="font-semibold text-[#2f211c]">قائمة العمال</h2>
      </div>
      {staff.length === 0 ? <div className="p-4"><EmptyState message="لا توجد سجلات عمال مطابقة للفلاتر الحالية." /></div> : null}
      {staff.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-right text-sm">
            <thead className="bg-[#f5eee6] text-[#4a3b34]">
              <tr>
                <th className="px-3 py-3 font-semibold">رقم الموظف</th>
                <th className="px-3 py-3 font-semibold">الاسم</th>
                <th className="px-3 py-3 font-semibold">القسم</th>
                <th className="px-3 py-3 font-semibold">الوظيفة / الدور</th>
                <th className="px-3 py-3 font-semibold">الهاتف</th>
                <th className="px-3 py-3 font-semibold">حالة الموظف</th>
                <th className="px-3 py-3 font-semibold">حساب دخول للنظام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee4d8]">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-[#fffaf4]">
                  <td className="px-3 py-3 font-semibold text-[#5d4032]">#{member.employeeNumber}</td>
                  <td className="px-3 py-3 font-medium text-[#2f211c]">{member.fullName}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{departmentLabels[member.department]}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{member.jobTitle}</td>
                  <td className="px-3 py-3 text-[#4a3b34]">{member.phone ?? "-"}</td>
                  <td className="px-3 py-3">
                    <span className={"inline-flex rounded-md border px-2 py-1 text-xs font-semibold " + statusTone(member.status)}>
                      {staffStatusLabels[member.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={member.hasSystemAccess && member.profileId ? "font-semibold text-emerald-700" : "text-[#9a8779]"}>
                      {accessLabel(member)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function OwnerStaffPage() {
  const { staff, isLoading, error } = useStaffMembers();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<"all" | StaffDepartment>("all");
  const [activity, setActivity] = useState<StaffActivityFilter>("all");

  const ownerVisibleStaff = useMemo(() => staff.filter((member) => !isOwnerLinked(member)), [staff]);

  const totals = useMemo(() => {
    return ownerVisibleStaff.reduce(
      (summary, member) => ({
        total: summary.total + 1,
        active: summary.active + (isActive(member) ? 1 : 0),
        inactive: summary.inactive + (isActive(member) ? 0 : 1),
        withAccess: summary.withAccess + (member.hasSystemAccess && member.profileId ? 1 : 0),
      }),
      { total: 0, active: 0, inactive: 0, withAccess: 0 },
    );
  }, [ownerVisibleStaff]);

  const filteredStaff = useMemo(() => {
    const query = normalize(search);
    return ownerVisibleStaff.filter((member) => {
      const matchesSearch = !query || normalize(member.fullName).includes(query);
      const matchesDepartment = department === "all" || member.department === department;
      const matchesActivity = activity === "all" || (activity === "active" ? isActive(member) : !isActive(member));
      return matchesSearch && matchesDepartment && matchesActivity;
    });
  }, [activity, department, ownerVisibleStaff, search]);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#e4d8c8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7c6b60]">لوحة المالك</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2f211c]">العمال</h1>
        <p className="mt-2 text-sm leading-6 text-[#7c6b60]">عرض قراءة فقط لبيانات العمال وحسابات دخولهم للنظام.</p>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="إجمالي العمال" value={formatNumber(totals.total)} icon={UsersRound} />
            <StatCard title="العمال الفعالون" value={formatNumber(totals.active)} icon={UserCheck} />
            <StatCard title="العمال غير الفعالين" value={formatNumber(totals.inactive)} icon={UserRoundX} />
            <StatCard title="مرتبطون بحساب نظام" value={formatNumber(totals.withAccess)} icon={UserCog} />
          </section>

          <section className="rounded-md border border-[#e4d8c8] bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="بحث بالاسم"
                  className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] pr-10 pl-3 text-sm outline-none focus:border-[#a65f3f]"
                />
              </label>
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value as "all" | StaffDepartment)}
                className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#a65f3f]"
              >
                <option value="all">كل الأقسام</option>
                {departments.map((item) => (
                  <option key={item} value={item}>{departmentLabels[item]}</option>
                ))}
              </select>
              <select
                value={activity}
                onChange={(event) => setActivity(event.target.value as StaffActivityFilter)}
                className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#a65f3f]"
              >
                <option value="all">كل الحالات</option>
                <option value="active">فعال</option>
                <option value="inactive">غير فعال</option>
              </select>
            </div>
          </section>

          <StaffTable staff={filteredStaff} />
        </>
      )}
    </div>
  );
}
