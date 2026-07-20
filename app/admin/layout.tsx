"use client";

import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRole="admin">
      {(session) => (
        <div dir="rtl" className="min-h-screen bg-[#f8f3ed] text-[#2f211c]">
          <div className="flex min-h-screen">
            <AdminSidebar />
            <div className="min-w-0 flex-1">
              <AdminHeader session={session} />
              <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 lg:px-6">{children}</main>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
