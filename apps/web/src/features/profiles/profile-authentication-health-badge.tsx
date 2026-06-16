import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type {
  KnownProfileAuthenticationHealth,
  ProfileAuthenticationHealth,
} from "@/lib/api/profile-manager-client";

/**
 * Reusable operator-visible badge for the closed
 * `ProfileAuthenticationHealth` enum. Frontend checks guide visibility
 * only; the backend remains the authoritative owner of health
 * transitions. The badge never mutates or infers state, and the raw
 * closed enum string is preserved so the operator can correlate the
 * display with the backend value.
 */
const healthMeta = {
  NOT_PROVISIONED: {
    label: "NOT_PROVISIONED",
    tone: "neutral" as const,
  },
  HEALTHY: {
    label: "HEALTHY",
    tone: "success" as const,
  },
  REAUTH_REQUIRED: {
    label: "REAUTH_REQUIRED",
    tone: "warning" as const,
  },
  CHECKPOINT_REVIEW_REQUIRED: {
    label: "CHECKPOINT_REVIEW_REQUIRED",
    tone: "danger" as const,
  },
} satisfies Record<
  KnownProfileAuthenticationHealth,
  { readonly label: string; readonly tone: StatusBadgeTone }
>;

export interface ProfileAuthenticationHealthBadgeProps {
  readonly health: ProfileAuthenticationHealth;
  readonly className?: string | undefined;
}

export function ProfileAuthenticationHealthBadge({
  health,
  className,
}: ProfileAuthenticationHealthBadgeProps): JSX.Element {
  const meta = getHealthMeta(health);

  return (
    <StatusBadge
      label={meta.label}
      tone={meta.tone}
      {...(className !== undefined ? { className } : {})}
    />
  );
}

function getHealthMeta(health: ProfileAuthenticationHealth): {
  readonly label: string;
  readonly tone: StatusBadgeTone;
} {
  if (isKnownAuthenticationHealth(health)) {
    return healthMeta[health];
  }

  return {
    label: health,
    tone: "neutral",
  };
}

function isKnownAuthenticationHealth(
  value: string,
): value is KnownProfileAuthenticationHealth {
  return Object.prototype.hasOwnProperty.call(healthMeta, value);
}
