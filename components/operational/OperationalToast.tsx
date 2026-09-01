import { BellRing, CheckCircle2 } from "lucide-react";

export type OperationalToastState = {
  id: string;
  title: string;
  tableLabel: string;
  message: string;
  tone: "new" | "ready";
};

type OperationalToastProps = {
  toast: OperationalToastState | null;
};

export function OperationalToast({ toast }: OperationalToastProps) {
  if (!toast) return null;

  const Icon = toast.tone === "ready" ? CheckCircle2 : BellRing;

  return (
    <div className="operational-toast" data-tone={toast.tone} role="status" aria-live="polite">
      <Icon size={18} />
      <div>
        <p className="operational-toast-title">{toast.title}</p>
        <p className="operational-toast-table">{toast.tableLabel}</p>
        <p className="operational-toast-message">{toast.message}</p>
      </div>
    </div>
  );
}
