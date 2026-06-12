import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type {
  KnownProfileAccountStage,
  ProfileAccountStage,
} from "@/lib/api/profile-manager-client";

const accountStageMeta = {
  NEW_ACCOUNT: {
    label: "NEW_ACCOUNT",
    tone: "warning",
  },
  WARMING: {
    label: "WARMING",
    tone: "info",
  },
  COLLECTION_READY: {
    label: "COLLECTION_READY",
    tone: "success",
  },
  LIMITED: {
    label: "LIMITED",
    tone: "warning",
  },
  NEEDS_REVIEW: {
    label: "NEEDS_REVIEW",
    tone: "danger",
  },
  RETIRED: {
    label: "RETIRED",
    tone: "neutral",
  },
} satisfies Record<
  KnownProfileAccountStage,
  {
    readonly label: string;
    readonly tone: StatusBadgeTone;
  }
>;

export interface ProfileAccountStageBadgeProps {
  readonly accountStage: ProfileAccountStage;
}

export function ProfileAccountStageBadge({
  accountStage,
}: ProfileAccountStageBadgeProps): JSX.Element {
  const meta = getAccountStageMeta(accountStage);

  return <StatusBadge label={meta.label} tone={meta.tone} />;
}

function getAccountStageMeta(accountStage: ProfileAccountStage): {
  readonly label: string;
  readonly tone: StatusBadgeTone;
} {
  if (isKnownProfileAccountStage(accountStage)) {
    return accountStageMeta[accountStage];
  }

  return {
    label: accountStage,
    tone: "neutral",
  };
}

function isKnownProfileAccountStage(
  accountStage: string,
): accountStage is KnownProfileAccountStage {
  return Object.prototype.hasOwnProperty.call(accountStageMeta, accountStage);
}
