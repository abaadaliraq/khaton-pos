"use client";

import { Search, X } from "lucide-react";
import type { EmploymentType, StaffDepartment, StaffStatus } from "@/types/staff";
import { departmentLabels, employmentTypeLabels, staffStatusLabels } from "@/types/staff";

export type StaffFilterState = {
  search: string;
  status: "all" | StaffStatus;
  department: "all" | StaffDepartment;
  employmentType: "all" | EmploymentType;
  access: "all" | "with" | "without";
};

type StaffFiltersProps = {
  filters: StaffFilterState;
  onChange: (filters: StaffFilterState) => void;
};

const statuses: StaffStatus[] = ["active", "on_leave", "inactive", "terminated"];
const departments: StaffDepartment[] = ["service", "cashier", "kitchen", "management", "cleaning", "barista", "shisha", "inventory", "finance", "other"];
const employmentTypes: EmploymentType[] = ["full_time", "part_time", "temporary"];

export function StaffFilters({ filters, onChange }: StaffFiltersProps) {
  function update(partial: Partial<StaffFilterState>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <section className="rounded-md border border-[#e4d8c8] bg-white p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_repeat(4,180px)]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8779]" size={18} />
          <input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="بحث بالاسم أو الرقم أو الهاتف أو الوظيفة"
            className="h-11 w-full rounded-md border border-[#e4d8c8] bg-[#fbfaf7] pr-10 pl-10 text-sm outline-none focus:border-[#a65f3f] focus:bg-white"
          />
          {filters.search ? (
            <button type="button" onClick={() => update({ search: "" })} className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#7c6b60] hover:bg-[#efe7dc]">
              <X size={15} />
            </button>
          ) : null}
        </div>
        <select value={filters.status} onChange={(event) => update({ status: event.target.value as StaffFilterState["status"] })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
          <option value="all">كل الحالات</option>
          {statuses.map((status) => <option key={status} value={status}>{staffStatusLabels[status]}</option>)}
        </select>
        <select value={filters.department} onChange={(event) => update({ department: event.target.value as StaffFilterState["department"] })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
          <option value="all">كل الأقسام</option>
          {departments.map((department) => <option key={department} value={department}>{departmentLabels[department]}</option>)}
        </select>
        <select value={filters.employmentType} onChange={(event) => update({ employmentType: event.target.value as StaffFilterState["employmentType"] })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
          <option value="all">كل الدوام</option>
          {employmentTypes.map((type) => <option key={type} value={type}>{employmentTypeLabels[type]}</option>)}
        </select>
        <select value={filters.access} onChange={(event) => update({ access: event.target.value as StaffFilterState["access"] })} className="h-11 rounded-md border border-[#e4d8c8] bg-[#fbfaf7] px-3 text-sm outline-none">
          <option value="all">كل الحسابات</option>
          <option value="with">لديه حساب</option>
          <option value="without">بدون حساب</option>
        </select>
      </div>
    </section>
  );
}
