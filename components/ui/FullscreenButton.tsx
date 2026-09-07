"use client";

import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";

type FullscreenButtonProps = {
  className?: string;
  compact?: boolean;
};

export function FullscreenButton({ className = "", compact = false }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const listener = () => setIsFullscreen(Boolean(document.fullscreenElement));
    listener();
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  }

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className={className || "management-action-button"}
      title={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
      aria-label={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
    >
      {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      {!compact ? <span>{isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}</span> : null}
    </button>
  );
}
