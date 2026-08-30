"use client";

import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
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
  variant?: "split" | "immersive";
};

export function LoginForm({
  title = "مرحباً بك",
  subtitle = "سجّل الدخول إلى نظام إدارة مطعم وكافيه خاتون",
  allowedRoles,
  variant = "split",
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
      <div className="rounded-2xl border border-white/10 bg-[#343434] px-5 py-4 text-sm text-zinc-200 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
        جارٍ تجهيز تسجيل الدخول...
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-[#ff5656]/25 bg-[#ff5656]/10 p-5 text-sm text-[#ffb0b0] shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
        {setupError}
      </div>
    );
  }

  if (variant === "immersive") {
    return (
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.1rem] border border-white/10 bg-[#343434]/95 p-3 shadow-[0_34px_100px_rgba(0,0,0,0.46)] backdrop-blur-sm lg:min-h-[660px]">
        <div className="grid min-h-[620px] gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]" dir="ltr">
          <div
            className="relative order-2 min-h-64 overflow-hidden rounded-[1.7rem] lg:order-1 lg:-ml-1 lg:min-h-full lg:rounded-l-[1.7rem] lg:rounded-r-[2.4rem]"
            style={{ clipPath: "polygon(0 0, 92% 0, 100% 52%, 88% 100%, 0 100%)" }}
          >
            <Image
              src="/login/khaton-login.jpg"
              alt="واجهة مطعم وكافيه خاتون"
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/10 to-black/28" />
            <div className="relative z-10 flex h-full min-h-64 flex-col justify-between p-6 text-white sm:p-8 lg:p-10" dir="rtl">
              <div className="mr-auto max-w-[280px] text-right">
                <p className="text-base font-semibold text-white">نظام إدارة خاتون</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">نظام صُمم خصيصاً لإدارة عمليات مطعم وكافيه خاتون</p>
              </div>
              <div className="mr-auto text-[11px] leading-5 text-zinc-300">
                <p>Developed by Abaad Iraq</p>
                <a href="https://www.abaad-aliraq.com" target="_blank" rel="noreferrer" className="inline-block text-zinc-400 transition hover:text-[#ff5656]">
                  abaad-aliraq.com
                </a>
              </div>
            </div>
          </div>

          <div className="relative order-1 z-10 flex items-center justify-center rounded-[1.7rem] bg-[#303030] px-5 py-8 lg:order-2 lg:-ml-16 lg:my-10 lg:pl-12 lg:shadow-[-30px_0_80px_rgba(0,0,0,0.34)]" dir="rtl">
            <form onSubmit={handleSubmit} className="w-full max-w-md">
              <div className="text-center">
                <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={82} height={82} className="mx-auto h-[82px] w-[82px] object-contain" priority />
                <h1 className="mt-5 text-3xl font-bold text-white">مرحباً بك</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-300">سجّل الدخول إلى نظام إدارة مطعم وكافيه خاتون</p>
              </div>

              <div className="mt-8 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-200">اسم المستخدم</span>
                  <span className="relative block">
                    <UserRound className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#292929] pr-10 pl-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff5656] focus:bg-[#2d2d2d] focus:shadow-[0_0_0_3px_rgba(255,86,86,0.16)]"
                      autoComplete="username"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-200">كلمة المرور</span>
                  <span className="relative block">
                    <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#292929] pr-10 pl-12 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff5656] focus:bg-[#2d2d2d] focus:shadow-[0_0_0_3px_rgba(255,86,86,0.16)]"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((currentValue) => !currentValue)}
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>
              </div>

              {error ? <p className="mt-4 rounded-xl border border-[#ff5656]/25 bg-[#ff5656]/10 px-3 py-2 text-sm text-[#ffb0b0]">{error}</p> : null}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5656] text-sm font-semibold text-white shadow-[0_16px_30px_rgba(255,86,86,0.22)] transition hover:bg-[#ff7070] disabled:bg-zinc-600 disabled:text-zinc-300 disabled:shadow-none"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : null}
                {isLoading ? "جارٍ تسجيل الدخول..." : "دخول"}
              </button>

              <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-zinc-300">
                {demoAccounts.map(([label, accountUsername]) => (
                  <div key={accountUsername} className="rounded-lg bg-white/[0.05] px-2 py-1">
                    {label}: <span className="font-medium text-white">{accountUsername}</span>
                  </div>
                ))}
              </div>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#343434] p-3 shadow-[0_32px_90px_rgba(0,0,0,0.34)] lg:min-h-[680px]">
      <div className="grid min-h-[620px] gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(410px,0.88fr)]" dir="ltr">
        <div className="relative order-2 min-h-64 overflow-hidden rounded-[1.6rem] lg:order-1 lg:min-h-full">
          <Image
            src="/login/khaton-login.jpg"
            alt="واجهة مطعم وكافيه خاتون"
            fill
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/35" />
          <div className="relative z-10 flex h-full min-h-64 flex-col justify-between p-6 text-white sm:p-8 lg:p-10" dir="rtl">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-[#ff5656]">نظام إدارة خاتون</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">نظام صُمم خصيصاً لإدارة عمليات مطعم وكافيه خاتون</h2>
            </div>
            <div className="text-xs text-zinc-300">
              <p>Developed by Abaad Iraq</p>
              <a href="https://www.abaad-aliraq.com" target="_blank" rel="noreferrer" className="mt-1 inline-block text-zinc-400 transition hover:text-[#ff5656]">
                abaad-aliraq.com
              </a>
            </div>
          </div>
        </div>

        <div className="order-1 flex items-center justify-center rounded-[1.6rem] bg-[#3a3a3a] px-5 py-8 lg:order-2 lg:-mr-12 lg:my-10 lg:shadow-[-24px_0_70px_rgba(0,0,0,0.28)]" dir="rtl">
          <form onSubmit={handleSubmit} className="w-full max-w-md">
            <div className="text-center">
              <Image src="/brand/khaton-logo.png" alt="شعار مطعم وكافيه خاتون" width={78} height={78} className="mx-auto h-[78px] w-[78px] object-contain" priority />
              <h1 className="mt-5 text-3xl font-bold text-white">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{subtitle}</p>
            </div>

            <div className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-200">اسم المستخدم</span>
                <span className="relative block">
                  <UserRound className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#2f2f2f] pr-10 pl-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff5656] focus:bg-[#303030] focus:shadow-[0_0_0_3px_rgba(255,86,86,0.16)]"
                    autoComplete="username"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-200">كلمة المرور</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#2f2f2f] pr-10 pl-12 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff5656] focus:bg-[#303030] focus:shadow-[0_0_0_3px_rgba(255,86,86,0.16)]"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((currentValue) => !currentValue)}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            </div>

            {error ? <p className="mt-4 rounded-xl border border-[#ff5656]/25 bg-[#ff5656]/10 px-3 py-2 text-sm text-[#ffb0b0]">{error}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5656] text-sm font-semibold text-white shadow-[0_16px_30px_rgba(255,86,86,0.22)] transition hover:bg-[#ff7070] disabled:bg-zinc-600 disabled:text-zinc-300 disabled:shadow-none"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : null}
              {isLoading ? "جارٍ تسجيل الدخول..." : "دخول"}
            </button>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm font-medium text-white">حسابات Supabase المطلوبة</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-300">
                {demoAccounts.map(([label, accountUsername]) => (
                  <div key={accountUsername} className="rounded-lg bg-[#2f2f2f] px-2 py-1">
                    {label}: <span className="font-medium text-white">{accountUsername}</span>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
