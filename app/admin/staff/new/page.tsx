"use client";

import { useRouter } from "next/navigation";
import { StaffForm } from "@/components/admin/StaffForm";
import { createStaffMember } from "@/services/staffService";
import type { CreateStaffInput } from "@/types/staff";

export default function NewStaffPage() {
  const router = useRouter();

  async function submit(input: CreateStaffInput) {
    const member = await createStaffMember(input);
    router.push(`/admin/staff/${member.id}`);
  }

  return (
    <div className="space-y-5">
      <div><p className="text-sm text-[#7c6b60]">العمال</p><h1 className="text-2xl font-semibold text-[#2f211c]">إضافة عامل جديد</h1></div>
      <StaffForm submitLabel="حفظ العامل" onCancel={() => router.push("/admin/staff")} onSubmit={submit} />
    </div>
  );
}
