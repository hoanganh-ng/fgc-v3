import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type { ProfileSourceAccessState } from "@/lib/api/profile-manager-client";

export function ProfileSourceAccessStateBadge({
  accessState,
}: {
  readonly accessState: ProfileSourceAccessState;
}): JSX.Element {
  return (
    <StatusBadge
      label={getProfileSourceAccessStateLabel(accessState)}
      tone={getProfileSourceAccessStateTone(accessState)}
    />
  );
}

export function getProfileSourceAccessStateLabel(
  accessState: ProfileSourceAccessState,
): string {
  return profileSourceAccessStateLabels[accessState];
}

function getProfileSourceAccessStateTone(
  accessState: ProfileSourceAccessState,
): StatusBadgeTone {
  if (
    accessState === "PUBLIC_ACCESSIBLE" ||
    accessState === "JOINED_ACCESSIBLE"
  ) {
    return "success";
  }

  if (
    accessState === "JOIN_REQUIRED" ||
    accessState === "JOIN_REQUESTED" ||
    accessState === "LOGIN_REQUIRED"
  ) {
    return "warning";
  }

  if (
    accessState === "ACCESS_DENIED" ||
    accessState === "CHECKPOINT_REQUIRED"
  ) {
    return "danger";
  }

  if (accessState === "NEEDS_MANUAL_REVIEW") {
    return "info";
  }

  return "neutral";
}

const profileSourceAccessStateLabels = {
  UNKNOWN: "Unknown",
  PUBLIC_ACCESSIBLE: "Public Accessible",
  JOIN_REQUIRED: "Join Required",
  JOIN_REQUESTED: "Join Requested",
  JOINED_ACCESSIBLE: "Joined Accessible",
  ACCESS_DENIED: "Access Denied",
  LOGIN_REQUIRED: "Login Required",
  CHECKPOINT_REQUIRED: "Checkpoint Required",
  NEEDS_MANUAL_REVIEW: "Needs Manual Review",
} satisfies Record<ProfileSourceAccessState, string>;
