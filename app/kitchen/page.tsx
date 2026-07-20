"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { KitchenScreen } from "@/components/kitchen/KitchenScreen";

export default function KitchenPage() {
  return (
    <AuthGuard allowedRole="kitchen">
      {(session) => <KitchenScreen session={session} />}
    </AuthGuard>
  );
}
