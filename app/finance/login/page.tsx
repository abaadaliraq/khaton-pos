import { LoginForm } from "@/components/auth/LoginForm";

export default function FinanceLoginPage() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#292929] px-4 py-8">
      <LoginForm title="نظام الحسابات" subtitle="خاتون / KHATOUN" allowedRoles={["admin", "accountant"]} />
    </main>
  );
}
