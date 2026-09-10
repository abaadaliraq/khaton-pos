import { BellRing, CheckCircle2 } from "lucide-react";

export type OperationalToastState = {
  id: string;
  title: string;
  tableLabel: string;
  message: string;
  tone: "new" | "ready";
  actionUrl?: string;
};

type OperationalToastProps = {
  toast: OperationalToastState | null;
};

export function OperationalToast({ toast }: OperationalToastProps) {
  if (!toast) return null;

  const Icon = toast.tone === "ready" ? CheckCircle2 : BellRing;
  const clickable = Boolean(toast.actionUrl);

  function openAction() {
    if (!toast?.actionUrl || typeof window === "undefined") return;
    window.location.href = toast.actionUrl;
  }

  return (
    <div
      className="operational-toast"
      data-tone={toast.tone}
      role={clickable ? "button" : "status"}
      aria-live="polite"
      tabIndex={clickable ? 0 : undefined}
      onClick={openAction}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openAction();
      }}
    >
      <Icon size={18} />
      <div>
        <p className="operational-toast-title">{toast.title}</p>
        <p className="operational-toast-table">{toast.tableLabel}</p>
        <p className="operational-toast-message">{toast.message}</p>
      </div>
    </div>
  );
}
