import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type {
  KnownProfileStatus,
  ProfileStatus,
} from "@/lib/api/profile-manager-client";

const statusMeta = {
  PENDING_CONFIG: {
    label: "PENDING_CONFIG",
    tone: "warning",
  },
  PENDING_LOGIN: {
    label: "PENDING_LOGIN",
    tone: "info",
  },
  READY: {
    label: "READY",
    tone: "success",
  },
  BUSY: {
    label: "BUSY",
    tone: "neutral",
  },
} satisfies Record<
  KnownProfileStatus,
  {
    readonly label: string;
    readonly tone: StatusBadgeTone;
  }
>;

export interface ProfileStatusBadgeProps {
  readonly status: ProfileStatus;
}

export function ProfileStatusBadge({
  status,
}: ProfileStatusBadgeProps): JSX.Element {
  const meta = getStatusMeta(status);

  return <StatusBadge label={meta.label} tone={meta.tone} />;
}

function getStatusMeta(status: ProfileStatus): {
  readonly label: string;
  readonly tone: StatusBadgeTone;
} {
  if (isKnownProfileStatus(status)) {
    return statusMeta[status];
  }

  return {
    label: status,
    tone: "neutral",
  };
}

function isKnownProfileStatus(status: string): status is KnownProfileStatus {
  return Object.prototype.hasOwnProperty.call(statusMeta, status);
}
