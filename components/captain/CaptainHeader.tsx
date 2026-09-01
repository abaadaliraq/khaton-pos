import { Clock, LogOut, Moon, Sun, UserRound, Volume2, VolumeX } from "lucide-react";
import { OperationalBrand } from "@/components/operational/OperationalBrand";

type CaptainHeaderProps = {
  currentTime: string;
  theme: "light" | "dark";
  soundEnabled: boolean;
  soundNeedsActivation: boolean;
  onToggleSound: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export function CaptainHeader({ currentTime, theme, soundEnabled, soundNeedsActivation, onToggleSound, onToggleTheme, onLogout }: CaptainHeaderProps) {
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <header className="captain-header sticky top-0 z-30 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <OperationalBrand title="واجهة الكابتن" subtitle="نظام الطلبات" variant={theme} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            className="captain-control flex h-10 items-center justify-center gap-2 px-3 text-sm"
          >
            {soundEnabled ? <Volume2 size={16} className="text-[#ff5656]" /> : <VolumeX size={16} />}
            <span className="hidden md:inline">{soundNeedsActivation ? "اضغط لتفعيل الصوت" : soundEnabled ? "الصوت مفعل" : "الصوت مكتوم"}</span>
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="captain-control flex h-10 w-10 items-center justify-center"
            aria-label={theme === "dark" ? "تفعيل المود النهاري" : "تفعيل المود الليلي"}
            title={theme === "dark" ? "المود النهاري" : "المود الليلي"}
          >
            <ThemeIcon size={16} />
          </button>
          <div className="captain-control hidden items-center gap-2 px-3 py-2 text-sm sm:flex">
            <Clock size={16} />
            <span className="tabular-nums">{currentTime || "..."}</span>
          </div>
          <div className="captain-control flex items-center gap-2 px-3 py-2 text-sm">
            <UserRound size={16} />
            <span className="hidden sm:inline">الكابتن أحمد</span>
            <span className="sm:hidden">أحمد</span>
          </div>
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
