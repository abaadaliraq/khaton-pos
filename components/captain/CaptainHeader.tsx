import { Clock, LogOut, UserRound } from "lucide-react";
import { OperationalBrand } from "@/components/operational/OperationalBrand";
import { FullscreenButton } from "@/components/ui/FullscreenButton";

type CaptainHeaderProps = {
  currentTime: string;
  onLogout: () => void;
};

export function CaptainHeader({ currentTime, onLogout }: CaptainHeaderProps) {
  return (
    <header className="captain-header sticky top-0 z-30 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <OperationalBrand title="واجهة الكابتن" subtitle="نظام الطلبات" variant="light" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="captain-control hidden items-center gap-2 px-3 py-2 text-sm sm:flex">
            <Clock size={16} />
            <span className="tabular-nums">{currentTime || "..."}</span>
          </div>
          <div className="captain-control flex items-center gap-2 px-3 py-2 text-sm">
            <UserRound size={16} />
            <span className="hidden sm:inline">الكابتن أحمد</span>
            <span className="sm:hidden">أحمد</span>
          </div>
          <FullscreenButton className="captain-control flex h-10 items-center gap-2 px-3 text-sm font-medium" />
          <button
            type="button"
            onClick={onLogout}
            className="captain-control flex h-10 items-center gap-2 px-3 text-sm font-medium"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}
