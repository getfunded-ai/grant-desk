import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  open: "Open",
  forecasted: "Forecast",
  closed: "Closed",
  custom: "Other",
};

const STYLES: Record<string, string> = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  forecasted:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
  closed: "border-border bg-muted text-muted-foreground",
  custom: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  status,
  customValue,
}: {
  status: string;
  customValue?: string | null;
}) {
  const label = status === "custom" && customValue ? customValue : (LABELS[status] ?? status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status] ?? STYLES.custom,
      )}
    >
      {label}
    </span>
  );
}
