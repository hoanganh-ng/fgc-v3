import { InvalidApplicationOperationError } from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import type { TokenGenerator } from "../ports/token-generator.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import {
  loadValidatedProfileById,
  validateProfileForApplication,
  validateRequiredConfigurationForApplication,
} from "../profile-validation";
import {
  canStartProvisioning,
  explainStartProvisioningRejection,
  transitionCollectorProfileStatus,
} from "../../domain";
import type { CollectorProfile, IsoDateTime, ProfileId } from "../../domain";

const PROVISIONING_TOKEN_TTL_MS = 15 * 60 * 1000;

export interface StartProfileProvisioningInput {
  readonly profileId: ProfileId;
}

export interface StartProfileProvisioningOutput {
  readonly profile: CollectorProfile;
  readonly provisioningToken: string;
  readonly expiresAt: IsoDateTime;
}

/**
 * Domain-owned assertion that the profile is eligible to start or restart
 * provisioning. Throws `InvalidApplicationOperationError` with a
 * backend-owned message when the profile is `BUSY` or `READY` with a
 * health value other than `REAUTH_REQUIRED` /
 * `CHECKPOINT_REVIEW_REQUIRED`. The companion `canStartProvisioning`
 * predicate is the single source of truth for this rule; this helper
 * only translates its `false` result into the application-layer error.
 */
function assertStartProvisioningEligibility(
  profile: CollectorProfile,
): void {
  if (canStartProvisioning(profile)) {
    return;
  }

  const reason = explainStartProvisioningRejection(profile);

  if (reason === "PROFILE_BUSY") {
    throw new InvalidApplicationOperationError(
      "Profile provisioning cannot start while the profile is BUSY. Release the active lease first.",
    );
  }

  throw new InvalidApplicationOperationError(
    "Profile provisioning can only start from PENDING_CONFIG, PENDING_LOGIN, or READY with authenticationHealth REAUTH_REQUIRED or CHECKPOINT_REVIEW_REQUIRED.",
  );
}

export class StartProfileProvisioningUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly tokenGenerator: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: StartProfileProvisioningInput,
  ): Promise<StartProfileProvisioningOutput> {
    const profile = await loadValidatedProfileById(
      this.profiles,
      input.profileId,
    );

    assertStartProvisioningEligibility(profile);

    // Required configuration must be present for every supported
    // entry point: initial PENDING_CONFIG, READY recovery, and the
    // PENDING_LOGIN restart path. The existing
    // `transitionCollectorProfileStatus` helper also performs this
    // validation when the status moves from PENDING_CONFIG to
    // PENDING_LOGIN.
    validateRequiredConfigurationForApplication(profile);

    const token = await this.tokenGenerator.generateToken();
    const issuedAtDate = this.clock.now();
    const issuedAt = toIsoDateTime(issuedAtDate);
    const expiresAt = toIsoDateTime(
      new Date(issuedAtDate.getTime() + PROVISIONING_TOKEN_TTL_MS),
    );

    const pendingLoginProfile =
      profile.identity.status === "PENDING_LOGIN"
        ? // PENDING_LOGIN restart: keep the status, refresh updatedAt.
          // The previous ISSUED token is superseded by the new one; the
          // previous token hash is no longer findable, so reusing it
          // fails `findByProvisioningToken`.
          {
            ...profile,
            identity: {
              ...profile.identity,
              updatedAt: issuedAt,
            },
            provisioningToken: {
              status: "ISSUED",
              tokenHash: token,
              issuedAt,
              expiresAt,
              consumedAt: null,
            },
          }
        : transitionCollectorProfileStatus(
            profile,
            "PENDING_LOGIN",
            issuedAt,
          );

    const profileWithToken: CollectorProfile = {
      ...pendingLoginProfile,
      provisioningToken: {
        status: "ISSUED",
        tokenHash: token,
        issuedAt,
        expiresAt,
        consumedAt: null,
      },
    };
    const validProfile = validateProfileForApplication(profileWithToken);

    await this.profiles.save(validProfile);

    return {
      profile: validProfile,
      provisioningToken: token,
      expiresAt,
    };
  }
}
