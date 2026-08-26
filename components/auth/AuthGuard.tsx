"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getRoleRedirectPath } from "@/lib/auth";
import { clearLegacyMockStorage, getCurrentSession, getSupabaseSetupError } from "@/services/authService";
import type { UserRole, UserSession } from "@/types/auth";

type AuthGuardProps = {
  allowedRole: UserRole | UserRole[];
  loginPath?: string;
  children: ReactNode | ((session: UserSession) => ReactNode);
};

export function AuthGuard({ allowedRole, loginPath = "/login", children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  const setupError = getSupabaseSetupError();

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      clearLegacyMockStorage();

      if (setupError) {
        if (isMounted) {
          setError(setupError);
          setIsChecking(false);
        }
        return;
      }

      try {
        const currentSession = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (!currentSession) {
          if (pathname !== loginPath) {
            router.replace(loginPath);
          }
          return;
        }

        const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

        if (!allowedRoles.includes(currentSession.role)) {
          const redirectPath = getRoleRedirectPath(currentSession.role);

          if (pathname !== redirectPath) {
            router.replace(redirectPath);
          }
          return;
        }

        setSession(currentSession);
        setIsChecking(false);
      } catch (sessionError) {
        console.error("Failed to guard Supabase route", sessionError);

        if (isMounted) {
          setError("تعذر التحقق من الجلسة.");
          setIsChecking(false);
        }
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [allowedRole, loginPath, pathname, router, setupError]);

  if (isChecking || !session) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f7f4ed] px-4 text-stone-700">
        <div className="rounded-lg border border-stone-200 bg-white px-5 py-4 text-sm shadow-sm">
          {error || "جارٍ التحقق من الجلسة..."}
        </div>
      </div>
    );
  }

  return <>{typeof children === "function" ? children(session) : children}</>;
}
