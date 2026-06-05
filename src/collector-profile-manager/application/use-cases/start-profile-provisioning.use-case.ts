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
import { transitionCollectorProfileStatus } from "../../domain";
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

    if (profile.identity.status !== "PENDING_CONFIG") {
      throw new InvalidApplicationOperationError(
        "Profile provisioning can only start from PENDING_CONFIG.",
      );
    }

    validateRequiredConfigurationForApplication(profile);

    const token = await this.tokenGenerator.generateToken();
    const issuedAtDate = this.clock.now();
    const issuedAt = toIsoDateTime(issuedAtDate);
    const expiresAt = toIsoDateTime(
      new Date(issuedAtDate.getTime() + PROVISIONING_TOKEN_TTL_MS),
    );
    const pendingLoginProfile = transitionCollectorProfileStatus(
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
