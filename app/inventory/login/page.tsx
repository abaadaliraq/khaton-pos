import { LoginForm } from "@/components/auth/LoginForm";

export default function InventoryLoginPage() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#292929] px-4 py-8">
      <LoginForm title="نظام إدارة المخزن" subtitle="خاتون / KHATOUN" allowedRoles={["admin", "storekeeper"]} />
    </main>
  );
}
