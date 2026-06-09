import {
  InvalidProfileConfigurationError,
  ProfileLeaseAlreadyClosedError,
  ProfileLeaseNotFoundError,
  ProfileLeaseStateConflictError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import { loadValidatedProfileById } from "../profile-validation";
import type {
  AuthenticationState,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  IsoDateTime,
  NetworkContext,
  ProfileId,
  ProfileLease,
  ProfileLeaseId,
  SafetyThresholds,
  TemporalRoutine,
} from "../../domain";

export interface GetRuntimeProfileConfigurationInput {
  readonly leaseId: ProfileLeaseId;
}

export interface RuntimeProfileConfiguration {
  readonly profileId: ProfileId;
  readonly leaseId: ProfileLeaseId;
  readonly leaseExpiresAt: IsoDateTime;
  readonly hardwareFingerprint: HardwareFingerprint;
  readonly networkContext: NetworkContext;
  readonly authenticationState: AuthenticationState;
  readonly temporalRoutine: TemporalRoutine;
  readonly safetyThresholds: SafetyThresholds;
  readonly contentAffinities: ContentAffinities;
}

export class GetRuntimeProfileConfigurationUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly leases: ProfileLeaseRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: GetRuntimeProfileConfigurationInput,
  ): Promise<RuntimeProfileConfiguration> {
    const lease = await this.leases.findById(input.leaseId);

    if (lease === null) {
      throw new ProfileLeaseNotFoundError(input.leaseId);
    }

    this.assertLeaseIsActive(lease);

    const profile = await loadValidatedProfileById(
      this.profiles,
      lease.profileId,
    );

    if (profile.identity.status !== "BUSY") {
      throw new ProfileLeaseStateConflictError(
        `Profile ${profile.identity.id} must be BUSY before runtime configuration for lease ${lease.id} can be read.`,
      );
    }

    return toRuntimeProfileConfiguration(profile, lease);
  }

  private assertLeaseIsActive(lease: ProfileLease): void {
    if (lease.status !== "ACTIVE") {
      throw new ProfileLeaseAlreadyClosedError(lease.id, lease.status);
    }

    if (Date.parse(lease.expiresAt) <= this.clock.now().getTime()) {
      throw new ProfileLeaseAlreadyClosedError(lease.id, "EXPIRED");
    }
  }
}

function toRuntimeProfileConfiguration(
  profile: CollectorProfile,
  lease: ProfileLease,
): RuntimeProfileConfiguration {
  if (profile.hardwareFingerprint === null) {
    throw new InvalidProfileConfigurationError([
      {
        path: "hardwareFingerprint",
        message: "Required before runtime configuration can be read.",
      },
    ]);
  }

  return {
    profileId: profile.identity.id,
    leaseId: lease.id,
    leaseExpiresAt: lease.expiresAt,
    hardwareFingerprint: profile.hardwareFingerprint,
    networkContext: profile.networkContext,
    authenticationState: profile.authenticationState,
    temporalRoutine: profile.temporalRoutine,
    safetyThresholds: profile.safetyThresholds,
    contentAffinities: profile.contentAffinities,
  };
}
