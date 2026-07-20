import { AppHeader } from "@/components/layout/AppHeader";
import type { UserRole, UserSession } from "@/types/auth";

type PlaceholderDashboardProps = {
  title: string;
  description: string;
  role: UserRole;
  session: UserSession;
};

export function PlaceholderDashboard({ title, description, role, session }: PlaceholderDashboardProps) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f4ed] text-stone-950">
      <AppHeader title={title} session={session} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-[#4c5a35]">مسار {role}</p>
          <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-stone-600">{description}</p>
        </section>
      </main>
    </div>
  );
}
