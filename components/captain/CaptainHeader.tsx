import { Clock, LogOut, UserRound } from "lucide-react";

type CaptainHeaderProps = {
  currentTime: string;
  onLogout: () => void;
};

export function CaptainHeader({ currentTime, onLogout }: CaptainHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#fbfaf6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#4c5a35] text-sm font-bold text-white">
              خ
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-stone-950">KHATOUN / خاتون</p>
              <p className="text-xs text-stone-500">نظام الطلبات</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-stone-700">
          <div className="hidden items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm sm:flex">
            <Clock size={16} />
            <span className="tabular-nums">{currentTime || "..."}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
            <UserRound size={16} />
            <span className="hidden sm:inline">الكابتن أحمد</span>
            <span className="sm:hidden">أحمد</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}
