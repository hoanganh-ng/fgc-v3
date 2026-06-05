import {
  InvalidApplicationOperationError,
  InvalidProfileConfigurationError,
  InvalidProvisioningTokenError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import { assertUsableProvisioningToken } from "../provisioning-token-policy";
import { validateProfileForApplication } from "../profile-validation";
import type {
  HardwareFingerprint,
  NetworkContext,
  ProfileId,
} from "../../domain";

export interface GetProvisioningConfigurationInput {
  readonly provisioningToken: string;
}

export interface ProvisioningConfiguration {
  readonly profileId: ProfileId;
  readonly networkContext: NetworkContext;
  readonly hardwareFingerprint: HardwareFingerprint;
}

export class GetProvisioningConfigurationUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: GetProvisioningConfigurationInput,
  ): Promise<ProvisioningConfiguration> {
    const profile = await this.profiles.findByProvisioningToken(
      input.provisioningToken,
    );

    if (profile === null) {
      throw new InvalidProvisioningTokenError();
    }

    const validProfile = validateProfileForApplication(profile);

    if (validProfile.identity.status !== "PENDING_LOGIN") {
      throw new InvalidApplicationOperationError(
        "Provisioning configuration is only available for PENDING_LOGIN profiles.",
      );
    }

    assertUsableProvisioningToken(
      validProfile,
      input.provisioningToken,
      this.clock.now(),
    );

    if (validProfile.hardwareFingerprint === null) {
      throw new InvalidProfileConfigurationError([
        {
          path: "hardwareFingerprint",
          message: "Required before provisioning configuration can be read.",
        },
      ]);
    }

    return {
      profileId: validProfile.identity.id,
      networkContext: validProfile.networkContext,
      hardwareFingerprint: validProfile.hardwareFingerprint,
    };
  }
}
