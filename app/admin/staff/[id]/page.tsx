"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Edit3, KeyRound, Power, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CreateStaffAccountDialog } from "@/components/admin/CreateStaffAccountDialog";
import { StaffDetails } from "@/components/admin/StaffDetails";
import { StaffForm } from "@/components/admin/StaffForm";
import { StaffStatusDialog } from "@/components/admin/StaffStatusDialog";
import { useStaffMember } from "@/hooks/useStaffMember";
import { updateStaffMember, updateStaffStatus, updateStaffSystemAccess } from "@/services/staffService";
import type { CreateStaffInput, StaffMember, StaffStatus } from "@/types/staff";

function pageTitle(member: StaffMember | null, isEditing: boolean) {
  if (isEditing) return "تعديل بيانات العامل";
  return member?.fullName ?? "تفاصيل العامل";
}

export default function StaffDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("edit") === "1";
  const staffId = useMemo(() => String(params.id), [params.id]);
  const { staffMember, setStaffMember, isLoading, error, refresh } = useStaffMember(staffId);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAccessChanging, setIsAccessChanging] = useState(false);
  const [notice, setNotice] = useState("");

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function handleUpdate(input: CreateStaffInput) {
    const updated = await updateStaffMember({ id: staffId, ...input });
    setStaffMember(updated);
    showNotice("تم تحديث بيانات العامل");
    router.replace(`/admin/staff/${updated.id}`);
  }

  async function handleStatusChange(status: StaffStatus) {
    if (!staffMember) return;
    const updated = await updateStaffStatus(staffMember.id, status);
    setStaffMember(updated);
    showNotice("تم تحديث حالة العامل");
  }

  async function handleSystemAccess(isActive: boolean) {
    if (!staffMember) return;
    setIsAccessChanging(true);
    try {
      const updated = await updateStaffSystemAccess(staffMember.id, isActive);
      setStaffMember(updated);
      showNotice(isActive ? "تم تفعيل دخول النظام" : "تم إيقاف دخول النظام");
    } catch (accessError) {
      console.error("Failed to update staff system access", accessError);
      showNotice("تعذر تحديث دخول النظام");
    } finally {
      setIsAccessChanging(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/staff" className="inline-flex items-center gap-2 text-sm font-medium text-[#7c6b60] hover:text-[#5d4032]">
            <ArrowRight size={16} />
            رجوع إلى العمال
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[#2f211c]">{pageTitle(staffMember, isEditing)}</h1>
        </div>

        {staffMember && !isEditing ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/staff/${staffMember.id}?edit=1`} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8c7b4] bg-white px-3 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5efe8]">
              <Edit3 size={16} />
              تعديل
            </Link>
            <button type="button" onClick={() => setIsStatusOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8c7b4] bg-white px-3 text-sm font-semibold text-[#4a3b34] hover:bg-[#f5efe8]">
              <RotateCcw size={16} />
              تغيير الحالة
            </button>
            {!staffMember.profileId ? (
              <button type="button" onClick={() => setIsAccountOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-semibold text-white hover:bg-[#493126]">
                <KeyRound size={16} />
                إنشاء حساب
              </button>
            ) : (
              <button
                type="button"
                disabled={isAccessChanging || staffMember.status === "terminated"}
                onClick={() => void handleSystemAccess(!staffMember.hasSystemAccess)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-semibold text-white hover:bg-[#493126] disabled:cursor-not-allowed disabled:bg-[#b8aa9d]"
              >
                <Power size={16} />
                {staffMember.hasSystemAccess ? "إيقاف الدخول" : "تفعيل الدخول"}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {isLoading ? <div className="rounded-md border border-[#e4d8c8] bg-white p-6 text-center text-[#7c6b60]">جاري تحميل بيانات العامل...</div> : null}
      {!isLoading && error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {!isLoading && staffMember && isEditing ? (
        <StaffForm member={staffMember} submitLabel="حفظ التعديلات" onSubmit={handleUpdate} onCancel={() => router.replace(`/admin/staff/${staffMember.id}`)} />
      ) : null}

      {!isLoading && staffMember && !isEditing ? <StaffDetails member={staffMember} /> : null}

      {staffMember ? (
        <>
          <StaffStatusDialog member={staffMember} isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} onConfirm={handleStatusChange} />
          <CreateStaffAccountDialog
            isOpen={isAccountOpen}
            member={staffMember}
            onClose={() => setIsAccountOpen(false)}
            onCreated={(updated) => {
              setStaffMember(updated);
              showNotice("تم إنشاء حساب العامل بنجاح");
              void refresh();
            }}
          />
        </>
      ) : null}

      {notice ? <div className="fixed bottom-5 left-5 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">{notice}</div> : null}
    </div>
  );
}
