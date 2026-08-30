"use client";

import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRole="admin">
      {(session) => (
        <div dir="rtl" className="management-shell min-h-screen bg-[#292929] text-white">
          <div className="flex min-h-screen">
            <AdminSidebar />
            <div className="min-w-0 flex-1">
              <AdminHeader session={session} />
              <main className="management-content w-full space-y-5 px-4 py-5 lg:px-6">{children}</main>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
