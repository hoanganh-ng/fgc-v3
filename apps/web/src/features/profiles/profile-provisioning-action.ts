import type {
  ProfileAuthenticationHealth,
  ProfileStatus,
} from "@/lib/api/profile-manager-client";

/**
 * Operator-visible provisioning action resolved from the current
 * profile state. The frontend is an adapter; the backend remains the
 * authoritative owner of the recovery lifecycle. Frontend checks only
 * guide visibility and copy.
 *
 * The `successTitle` is captured at the time the action is submitted
 * and stored in component state. The page must NOT re-read
 * `successTitle` from the live `resolveProvisioningAction(...)` after a
 * refetch, because the profile status flips to `PENDING_LOGIN` after a
 * successful request and the live action would always be the
 * `PENDING_LOGIN` "Issue New Provisioning Token" variant.
 */
export type ProvisioningAction =
  | {
      readonly kind: "action";
      readonly buttonLabel: string;
      readonly pendingLabel: string;
      readonly successTitle: string;
      readonly cardDescription: string;
      readonly explanation: string;
      readonly confirmPrompt: (profile: ProvisioningActionProfile) => string;
    }
  | {
      readonly kind: "none";
      readonly cardDescription: string;
      readonly explanation: string;
      readonly successTitle: string;
    };

export interface ProvisioningActionProfile {
  readonly id: string;
  readonly displayName: string;
}

export function resolveProvisioningAction(
  status: ProfileStatus,
  health: ProfileAuthenticationHealth,
): ProvisioningAction {
  if (status === "PENDING_CONFIG") {
    return {
      kind: "action",
      buttonLabel: "Start Provisioning",
      pendingLabel: "Starting Provisioning",
      successTitle: "Provisioning started.",
      cardDescription: "Start login provisioning through the backend API.",
      explanation:
        "PENDING_CONFIG can start provisioning after the backend accepts the required configuration.",
      confirmPrompt: (profile) =>
        `Start provisioning for ${profile.displayName} (${profile.id})?\n\nThe backend may issue a one-time provisioning token. Save it immediately if it is returned.`,
    };
  }

  if (status === "PENDING_LOGIN") {
    return {
      kind: "action",
      buttonLabel: "Issue New Provisioning Token",
      pendingLabel: "Issuing Provisioning Token",
      successTitle: "New provisioning token issued.",
      cardDescription:
        "Issue a new provisioning token through the backend API.",
      explanation:
        "PENDING_LOGIN means provisioning has started. Issuing a new token supersedes the previous one; the previous token is no longer acceptable for session ingestion.",
      confirmPrompt: (profile) =>
        `Issue a new provisioning token for ${profile.displayName} (${profile.id})?\n\nThe previous token becomes invalid immediately and cannot be used to submit a session. Save the new token if one is returned.`,
    };
  }

  if (status === "READY" && health === "REAUTH_REQUIRED") {
    return {
      kind: "action",
      buttonLabel: "Start Reauthentication",
      pendingLabel: "Starting Reauthentication",
      successTitle: "Reauthentication started.",
      cardDescription:
        "Start reprovisioning for a REAUTH_REQUIRED profile through the backend API.",
      explanation:
        "READY + REAUTH_REQUIRED means a previous session was reported as login-required. The backend will issue a new provisioning token and the operator must drive the same provisioning CLI to capture a fresh Facebook session.",
      confirmPrompt: (profile) =>
        `Start reauthentication for ${profile.displayName} (${profile.id})?\n\nThe backend will issue a new one-time provisioning token. The previous token is no longer acceptable for session ingestion. Save the new token immediately if one is returned.`,
    };
  }

  if (status === "READY" && health === "CHECKPOINT_REVIEW_REQUIRED") {
    return {
      kind: "action",
      buttonLabel: "Start Manual Checkpoint Recovery",
      pendingLabel: "Starting Manual Checkpoint Recovery",
      successTitle: "Manual checkpoint recovery started.",
      cardDescription:
        "Start reprovisioning for a CHECKPOINT_REVIEW_REQUIRED profile through the backend API.",
      explanation:
        "READY + CHECKPOINT_REVIEW_REQUIRED means a previous session was reported as a Facebook checkpoint. There is no automated bypass. The backend will issue a new provisioning token and the operator must drive the existing headed provisioning CLI to perform the manual Facebook checkpoint flow.",
      confirmPrompt: (profile) =>
        `Start manual checkpoint recovery for ${profile.displayName} (${profile.id})?\n\nThe backend will issue a new one-time provisioning token. The previous token is no longer acceptable for session ingestion. There is no automated bypass — you must drive the existing headed provisioning CLI to complete the manual Facebook checkpoint flow. Save the new token immediately if one is returned.`,
    };
  }

  if (status === "BUSY") {
    return {
      kind: "none",
      cardDescription:
        "Provisioning is not available while the profile is BUSY.",
      explanation:
        "BUSY means the profile is currently checked out by runtime work. Provisioning actions will be available again after the lease is released.",
      successTitle: "Provisioning started.",
    };
  }

  return {
    kind: "none",
    cardDescription:
      "Provisioning is not available for the current health state.",
    explanation:
      "READY + HEALTHY means authentication state is already captured. The backend will only allow provisioning when authenticationHealth is REAUTH_REQUIRED or CHECKPOINT_REVIEW_REQUIRED.",
    successTitle: "Provisioning started.",
  };
}
