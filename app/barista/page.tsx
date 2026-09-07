"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { BaristaScreen } from "@/components/barista/BaristaScreen";

export default function BaristaPage() {
  return (
    <AuthGuard allowedRole={["barista", "admin"]}>
      {(session) => <BaristaScreen session={session} />}
    </AuthGuard>
  );
}
