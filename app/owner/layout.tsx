"use client";

import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OwnerHeader } from "@/components/owner/OwnerHeader";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRole="owner">
      {(session) => (
        <div dir="rtl" className="management-shell owner-shell min-h-screen bg-[#292929] text-white">
          <div className="flex min-h-screen">
            <OwnerSidebar />
            <div className="min-w-0 flex-1">
              <OwnerHeader session={session} />
              <main className="management-content owner-content w-full space-y-5 px-4 py-5 lg:px-6">{children}</main>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
