import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type { ContentStatus } from "@/lib/api/content-manager-client";

export function ContentItemStatusBadge({
  status,
}: {
  readonly status: ContentStatus;
}): JSX.Element {
  return <StatusBadge label={status} tone={getContentItemStatusTone(status)} />;
}

export function getContentItemStatusTone(
  status: ContentStatus,
): StatusBadgeTone {
  if (status === "SELECTED") {
    return "success";
  }

  if (status === "REJECTED") {
    return "danger";
  }

  if (status === "COLLECTED") {
    return "info";
  }

  return "neutral";
}
