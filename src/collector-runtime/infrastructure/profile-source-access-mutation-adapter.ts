import type {
  ProfileSourceAccessMutationInput,
  ProfileSourceAccessMutationPort,
  ProfileSourceAccessMutationResult,
} from "../application";
import type { ProfileSourceAccessCheckRunOutcome } from "../domain";
import type {
  UpsertProfileSourceAccessInput,
  UpsertProfileSourceAccessResult,
} from "./profile-manager-http-client";

export interface ProfileSourceAccessMutationHttpClient {
  upsertProfileSourceAccess(
    input: UpsertProfileSourceAccessInput,
  ): Promise<UpsertProfileSourceAccessResult>;
}

export class ProfileManagerHttpProfileSourceAccessMutationAdapter
  implements ProfileSourceAccessMutationPort
{
  public constructor(private readonly client: ProfileSourceAccessMutationHttpClient) {}

  public async applyOutcome(
    input: ProfileSourceAccessMutationInput,
  ): Promise<ProfileSourceAccessMutationResult> {
    const request = toUpsertProfileSourceAccessInput(input);
    const result = await this.client.upsertProfileSourceAccess(request);

    if (!result.ok) {
      return {
        ok: false,
        failureReason: {
          code: "ACCESS_CHECK_MUTATION_FAILED",
          message: "Profile-source access mutation failed.",
        },
      };
    }

    if (
      result.profileId !== input.profileId ||
      result.sourceGroupId !== input.sourceGroupId ||
      result.accessState !== input.outcome
    ) {
      return {
        ok: false,
        failureReason: {
          code: "ACCESS_CHECK_MUTATION_RESPONSE_INVALID",
          message: "Profile-source access mutation response was invalid.",
        },
      };
    }

    return { ok: true };
  }
}

function toUpsertProfileSourceAccessInput(
  input: ProfileSourceAccessMutationInput,
): UpsertProfileSourceAccessInput {
  return {
    profileId: input.profileId,
    sourceGroupId: input.sourceGroupId,
    accessState: input.outcome,
    lastFailureReason: toProfileSourceAccessFailureReason(input.outcome),
  };
}

function toProfileSourceAccessFailureReason(
  outcome: ProfileSourceAccessCheckRunOutcome,
): UpsertProfileSourceAccessInput["lastFailureReason"] {
  switch (outcome) {
    case "PUBLIC_ACCESSIBLE":
    case "JOINED_ACCESSIBLE":
      return null;
    case "JOIN_REQUIRED":
      return {
        code: "JOIN_REQUIRED",
        message: "Profile must join the source group before collection.",
      };
    case "ACCESS_DENIED":
      return {
        code: "ACCESS_DENIED",
        message: "Profile cannot currently access the source group.",
      };
    case "LOGIN_REQUIRED":
      return {
        code: "LOGIN_REQUIRED",
        message: "Profile login is required before source access can be checked.",
      };
    case "CHECKPOINT_REQUIRED":
      return {
        code: "CHECKPOINT_REQUIRED",
        message:
          "Profile checkpoint review is required before source access can be checked.",
      };
    case "NEEDS_MANUAL_REVIEW":
      return {
        code: "ACCESS_CHECK_INCONCLUSIVE",
        message: "Automated source access check was inconclusive.",
      };
  }
}
