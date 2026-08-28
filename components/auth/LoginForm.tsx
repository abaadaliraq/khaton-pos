"use client";

import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRoleRedirectPath } from "@/lib/auth";
import {
  clearLegacyMockStorage,
  getCurrentSession,
  getSupabaseSetupError,
  signInWithUsername,
} from "@/services/authService";
import type { UserRole } from "@/types/auth";

const demoAccounts = [
  ["الكابتن", "captain"],
  ["المحاسب", "cashier"],
  ["المطبخ", "kitchen"],
  ["الإدارة", "admin"],
  ["مسؤول المخزن", "storekeeper"],
  ["محاسب", "accountant"],
  ["مالك", "owner"],
];

const invalidLoginMessage = "اسم المستخدم أو كلمة المرور غير صحيحة";

type LoginFormProps = {
  title?: string;
  subtitle?: string;
  allowedRoles?: UserRole[];
  loginPath?: string;
};

export function LoginForm({
  title = "خاتون / KHATOUN",
  subtitle = "نظام إدارة المطعم",
  allowedRoles,
}: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const setupError = getSupabaseSetupError();

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      clearLegacyMockStorage();

      if (setupError) {
        if (isMounted) {
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const currentSession = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        if (currentSession) {
          if (allowedRoles && !allowedRoles.includes(currentSession.role)) {
            router.replace(getRoleRedirectPath(currentSession.role));
            return;
          }

          router.replace(getRoleRedirectPath(currentSession.role));
          return;
        }
      } catch (sessionError) {
        console.error("Failed to check Supabase session", sessionError);
      }

      if (isMounted) {
        setIsCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [allowedRoles, router, setupError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (setupError) {
      setError(setupError);
      return;
    }

    setIsLoading(true);

    try {
      const session = await signInWithUsername(username, password);

      if (!session) {
        setError(invalidLoginMessage);
        return;
      }

      if (allowedRoles && !allowedRoles.includes(session.role)) {
        router.replace(getRoleRedirectPath(session.role));
        return;
      }

      router.replace(getRoleRedirectPath(session.role));
    } catch (loginError) {
      console.error("Supabase login failed", loginError);
      setError("تعذر تسجيل الدخول، تحقق من إعداد Supabase وحاول مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCheckingSession) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700 shadow-sm">
        جارٍ تجهيز تسجيل الدخول...
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
        {setupError}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#4c5a35] text-base font-bold text-white">
          خ
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-stone-950">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">{subtitle}</p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-stone-700">اسم المستخدم</span>
          <span className="relative block">
            <UserRound className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-12 w-full rounded-lg border border-stone-200 bg-[#fbfaf6] pr-10 pl-3 text-sm outline-none transition focus:border-[#4c5a35] focus:bg-white"
              autoComplete="username"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-stone-700">كلمة المرور</span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              className="h-12 w-full rounded-lg border border-stone-200 bg-[#fbfaf6] pr-10 pl-12 text-sm outline-none transition focus:border-[#4c5a35] focus:bg-white"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((currentValue) => !currentValue)}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#4c5a35] text-sm font-semibold text-white transition hover:bg-[#394427] disabled:bg-stone-300"
      >
        {isLoading ? <Loader2 className="animate-spin" size={18} /> : null}
        {isLoading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
      </button>

      <div className="mt-5 rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
        <p className="text-sm font-medium text-stone-800">حسابات Supabase المطلوبة</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-stone-600">
          {demoAccounts.map(([label, accountUsername]) => (
            <div key={accountUsername} className="rounded-md bg-white px-2 py-1">
              {label}: <span className="font-medium text-stone-900">{accountUsername}</span>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
