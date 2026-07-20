import { AuthGuard } from "@/components/auth/AuthGuard";
import { CaptainPosApp } from "@/components/captain/CaptainPosApp";

export default function CaptainPage() {
  return (
    <AuthGuard allowedRole="captain">
      <CaptainPosApp />
    </AuthGuard>
  );
}
