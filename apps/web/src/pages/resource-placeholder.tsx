import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

export interface PlaceholderStat {
  readonly label: string;
  readonly value: string;
  readonly tone: StatusBadgeTone;
}

export interface ResourcePlaceholderProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly stats: readonly PlaceholderStat[];
  readonly rows: readonly string[];
}

export function ResourcePlaceholder({
  icon: Icon,
  title,
  description,
  stats,
  rows,
}: ResourcePlaceholderProps): JSX.Element {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
            <Icon aria-hidden="true" className="size-5" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[minmax(10rem,1fr)_9rem] border-b border-border bg-muted/45 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Area</span>
            <span>Status</span>
          </div>
          {rows.map((row) => (
            <div
              key={row}
              className="grid min-h-14 grid-cols-[minmax(10rem,1fr)_9rem] items-center border-b border-border px-4 text-sm last:border-b-0"
            >
              <span className="min-w-0 truncate font-medium text-foreground">{row}</span>
              <StatusBadge label="Placeholder" tone="neutral" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                <StatusBadge label={stat.value} tone={stat.tone} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
