"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { FullscreenButton } from "@/components/ui/FullscreenButton";
import { signOut } from "@/services/authService";

export default function FinancePage() {
  async function logout() {
    await signOut();
    window.location.replace("/finance/login");
  }

  return (
    <AuthGuard allowedRole={["admin", "accountant"]} loginPath="/finance/login">
      {(session) => (
        <div dir="rtl" className="management-shell min-h-screen overflow-x-hidden">
          <header className="border-b bg-[var(--kh-surface)] text-[var(--kh-text)] backdrop-blur">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" priority />
                <div>
                  <p className="text-xs font-semibold text-[var(--kh-accent)]">مطعم وكافيه خاتون</p>
                  <h1 className="text-xl font-semibold text-[var(--kh-text)]">واجهة المحاسب</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {session.role === "admin" ? (
                  <Link href="/admin" className="management-action-button">
                    <ShieldCheck size={16} />
                    العودة إلى الإدارة
                  </Link>
                ) : null}
                <div className="rounded-md border border-[var(--kh-border)] bg-[var(--kh-surface)] px-3 py-2 text-sm">
                  <p className="font-semibold text-[var(--kh-text)]">{session.name}</p>
                  <p className="text-xs text-[var(--kh-muted)]">{session.role === "admin" ? "مدير النظام" : "محاسب"}</p>
                </div>
                <FullscreenButton />
                <button type="button" onClick={logout} className="flex h-10 items-center gap-2 rounded-md bg-[#ff5656] px-3 text-sm font-medium text-white hover:bg-[#ff7070]">
                  <LogOut size={16} />
                  خروج
                </button>
              </div>
            </div>
          </header>
          <main className="management-content w-full px-4 py-5 lg:px-6">
            <FinanceDashboard />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}
