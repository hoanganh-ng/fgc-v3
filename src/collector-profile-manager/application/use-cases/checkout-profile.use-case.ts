import {
  InvalidProfileConfigurationError,
  NoEligibleProfileAvailableError,
  ProfileLeaseStateConflictError,
  ProfileNotCheckoutEligibleError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { LeaseIdGenerator } from "../ports/lease-id-generator.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import {
  loadValidatedProfileById,
  validateProfileForApplication,
} from "../profile-validation";
import {
  calculateLeaseExpiresAt,
  createActiveProfileLease,
  evaluateCheckoutEligibility,
  markProfileCheckedOut,
} from "../../domain";
import type {
  AuthenticationState,
  BehavioralPersona,
  CheckoutIneligibilityReason,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  NetworkContext,
  ProfileId,
  ProfileLease,
  SafetyThresholds,
  TemporalRoutine,
} from "../../domain";

export interface CheckoutProfileInput {
  readonly profileId?: ProfileId;
}

export interface CheckoutProfileConfiguration {
  readonly profileId: ProfileId;
  readonly networkContext: NetworkContext;
  readonly hardwareFingerprint: HardwareFingerprint;
  readonly authenticationState: AuthenticationState;
  readonly behavioralPersona: BehavioralPersona;
  readonly temporalRoutine: TemporalRoutine;
  readonly safetyThresholds: SafetyThresholds;
  readonly contentAffinities: ContentAffinities;
}

export interface CheckoutProfileOutput {
  readonly lease: ProfileLease;
  readonly profile: CheckoutProfileConfiguration;
}

export class CheckoutProfileUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly leases: ProfileLeaseRepository,
    private readonly leaseIds: LeaseIdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CheckoutProfileInput = {},
  ): Promise<CheckoutProfileOutput> {
    const now = this.clock.now();
    const candidates = await this.loadCandidates(input);
    const rejectedReasons: CheckoutIneligibilityReason[] = [];

    for (const candidate of candidates) {
      const eligibility = evaluateCheckoutEligibility(candidate, now);

      if (!eligibility.eligible) {
        rejectedReasons.push(...eligibility.reasons);

        if (input.profileId !== undefined) {
          throw new ProfileNotCheckoutEligibleError(
            candidate.identity.id,
            eligibility.reasons,
          );
        }

        continue;
      }

      const activeLease = await this.leases.findActiveByProfileId(
        candidate.identity.id,
      );

      if (activeLease !== null) {
        throw new ProfileLeaseStateConflictError(
          `Profile ${candidate.identity.id} already has active lease ${activeLease.id}.`,
        );
      }

      const lease = createActiveProfileLease({
        id: await this.leaseIds.generateLeaseId(),
        profileId: candidate.identity.id,
        leasedAt: toIsoDateTime(now),
        expiresAt: toIsoDateTime(calculateLeaseExpiresAt(candidate, now)),
      });
      const checkedOutProfile = validateProfileForApplication(
        markProfileCheckedOut(candidate, now, eligibility.localDate),
      );

      await this.profiles.save(checkedOutProfile);
      await this.leases.save(lease);

      return {
        lease,
        profile: toCheckoutProfileConfiguration(checkedOutProfile),
      };
    }

    throw new NoEligibleProfileAvailableError(rejectedReasons);
  }

  private async loadCandidates(
    input: CheckoutProfileInput,
  ): Promise<readonly CollectorProfile[]> {
    if (input.profileId !== undefined) {
      return [await loadValidatedProfileById(this.profiles, input.profileId)];
    }

    const candidates = await this.profiles.findReadyProfiles();

    return candidates.map((profile) => validateProfileForApplication(profile));
  }
}

function toCheckoutProfileConfiguration(
  profile: CollectorProfile,
): CheckoutProfileConfiguration {
  if (profile.hardwareFingerprint === null) {
    throw new InvalidProfileConfigurationError([
      {
        path: "hardwareFingerprint",
        message: "Required before profile can be checked out.",
      },
    ]);
  }

  return {
    profileId: profile.identity.id,
    networkContext: profile.networkContext,
    hardwareFingerprint: profile.hardwareFingerprint,
    authenticationState: profile.authenticationState,
    behavioralPersona: profile.behavioralPersona,
    temporalRoutine: profile.temporalRoutine,
    safetyThresholds: profile.safetyThresholds,
    contentAffinities: profile.contentAffinities,
  };
}
