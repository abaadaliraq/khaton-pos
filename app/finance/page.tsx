"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { signOut } from "@/services/authService";

export default function FinancePage() {
  async function logout() {
    await signOut();
    window.location.replace("/finance/login");
  }

  return (
    <AuthGuard allowedRole={["admin", "accountant"]} loginPath="/finance/login">
      {(session) => (
        <div dir="rtl" className="min-h-screen bg-[#f8f3ed] text-[#2f211c]">
          <header className="border-b border-[#e4d8c8] bg-[#fffdfa]">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#5d4032] text-lg font-bold text-white">خ</div>
                <div>
                  <p className="text-xs font-semibold text-[#a65f3f]">خاتون POS</p>
                  <h1 className="text-xl font-semibold text-[#2f211c]">واجهة المحاسب</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {session.role === "admin" ? (
                  <Link href="/admin" className="flex h-10 items-center gap-2 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#4a3b34] hover:bg-[#f5eee6]">
                    <ShieldCheck size={16} />
                    العودة إلى الإدارة
                  </Link>
                ) : null}
                <div className="rounded-md border border-[#e4d8c8] bg-white px-3 py-2 text-sm">
                  <p className="font-semibold text-[#2f211c]">{session.name}</p>
                  <p className="text-xs text-[#7c6b60]">{session.role === "admin" ? "مدير النظام" : "محاسب"}</p>
                </div>
                <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#5d4032] px-3 text-sm font-medium text-white hover:bg-[#463025]">
                  <LogOut size={16} />
                  خروج
                </button>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
            <FinanceDashboard />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
