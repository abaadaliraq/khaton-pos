import { Volume2 } from "lucide-react";

type SoundControlsProps = {
  isEnabled: boolean;
  needsActivation: boolean;
  onActivate: () => void;
  onTest: () => void;
  audioState?: string;
  lastTestStatus?: string;
  variant?: "light" | "captain";
};

export function SoundControls({ isEnabled, needsActivation, onActivate, onTest, audioState = "none", lastTestStatus = "idle", variant = "light" }: SoundControlsProps) {
  const baseButton =
    variant === "captain"
      ? "captain-control flex h-10 items-center gap-2 px-3 text-sm font-bold"
      : "flex h-10 items-center gap-2 rounded-lg border border-[#D8C8B7] bg-white px-3 text-sm font-bold text-[#2C211D] shadow-sm hover:bg-[#F1E6D8]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onActivate} className={baseButton}>
        <Volume2 size={16} className={isEnabled ? "text-[#2F7D57]" : "text-[#B94B43]"} />
        {isEnabled && !needsActivation ? "الصوت مفعّل ✓" : "تفعيل الصوت"}
      </button>
      <button type="button" onClick={onTest} className={baseButton}>
        اختبار الصوت
      </button>
      {process.env.NODE_ENV === "development" ? (
        <span className="h-10 rounded-lg border border-[#D8C8B7] bg-[#FFF9F1] px-3 py-2 text-xs font-bold text-[#5f4b40]">
          Audio: {audioState} · Last test: {lastTestStatus}
        </span>
      ) : null}
    </div>
  );
}
