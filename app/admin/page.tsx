"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { PlaceholderDashboard } from "@/components/layout/PlaceholderDashboard";

export default function AdminPage() {
  return (
    <AuthGuard allowedRole="admin">
      {(session) => (
        <PlaceholderDashboard
          title="لوحة الإدارة"
          description="سيتم بناء المستخدمين والتقارير والمنيو والإعدادات في المرحلة القادمة."
          role="admin"
          session={session}
        />
      )}
    </AuthGuard>
  );
}
