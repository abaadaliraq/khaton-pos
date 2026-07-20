"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { CashierPosApp } from "@/components/cashier/CashierPosApp";

export default function CashierPage() {
  return (
    <AuthGuard allowedRole="cashier">
      {(session) => <CashierPosApp session={session} />}
    </AuthGuard>
  );
}
