import { cn } from "@/lib/cn";

export type StatusBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: StatusBadgeTone;
  readonly className?: string;
}

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded border px-2 text-xs font-medium",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        tone === "info" && "border-[#9bbdd1] bg-[#e8f4f8] text-[#245a72]",
        tone === "success" && "border-[#9dccad] bg-[#edf8ee] text-[#23633a]",
        tone === "warning" && "border-[#dfc36e] bg-[#fff7dc] text-[#76591a]",
        tone === "danger" && "border-[#e4a0a0] bg-[#fff0f0] text-[#8f3030]",
        className,
      )}
    >
      {label}
    </span>
  );
}
