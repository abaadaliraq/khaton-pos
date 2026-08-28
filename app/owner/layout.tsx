"use client";

import { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OwnerHeader } from "@/components/owner/OwnerHeader";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRole="owner">
      {(session) => (
        <div dir="rtl" className="min-h-screen bg-[#f8f3ed] text-[#2f211c]">
          <div className="flex min-h-screen">
            <OwnerSidebar />
            <div className="min-w-0 flex-1">
              <OwnerHeader session={session} />
              <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 lg:px-6">{children}</main>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
