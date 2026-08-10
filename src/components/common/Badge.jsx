import { cn } from "@/utils/cn";

const TONES = {
  success: "bg-success/10 text-success ring-1 ring-inset ring-success/25",
  warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/25",
  danger: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/25",
  info: "bg-brand-500/10 text-brand-600 ring-1 ring-inset ring-brand-500/25",
  violet: "bg-violet-500/10 text-violet-600 ring-1 ring-inset ring-violet-500/25",
  neutral: "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export default function Badge({ children, tone = "neutral", dot = false, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", TONES[tone] || TONES.neutral, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusToTone(status) {
  const map = {
    GREEN: "success", YELLOW: "warning", ORANGE: "warning", RED: "danger",
    Low: "success", Medium: "warning", High: "danger", Critical: "danger",
    Running: "success", Delayed: "danger", Maintenance: "neutral",
    Active: "success", Suspended: "danger",
    critical: "danger", warning: "warning", info: "info",
  };
  return map[status] || "neutral";
}
