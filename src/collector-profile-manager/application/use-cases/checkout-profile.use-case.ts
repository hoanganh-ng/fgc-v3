import {
  InvalidProfileConfigurationError,
  NoEligibleProfileAvailableError,
  ProfileLeaseStateConflictError,
  ProfileNotCheckoutEligibleError,
  SourceGroupNotFoundError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { LeaseIdGenerator } from "../ports/lease-id-generator.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import type { ProfileSourceAccessRepository } from "../ports/profile-source-access-repository.port";
import type { SourceGroupReferencePort } from "../ports/source-group-reference.port";
import type { TransactionManager } from "../ports/transaction-manager.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import {
  loadValidatedProfileById,
  validateProfileForApplication,
} from "../profile-validation";
import {
  calculateLeaseExpiresAt,
  createActiveProfileLease,
  evaluateCheckoutEligibility,
  isSuccessfulProfileSourceAccessState,
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
  ProfileSourceAccessState,
  SafetyThresholds,
  TemporalRoutine,
} from "../../domain";

export interface CheckoutProfileInput {
  readonly sourceGroupId: string;
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
    private readonly sourceGroupReference: SourceGroupReferencePort,
    private readonly profileSourceAccess: ProfileSourceAccessRepository,
    private readonly transactionManager?: TransactionManager,
  ) {}

  public async execute(
    input: CheckoutProfileInput,
  ): Promise<CheckoutProfileOutput> {
    if (this.transactionManager !== undefined) {
      return this.transactionManager.runInTransaction((repositories) =>
        this.executeWithRepositories(
          input,
          repositories.profiles,
          repositories.leases,
          repositories.profileSourceAccess,
        ),
      );
    }

    return this.executeWithRepositories(
      input,
      this.profiles,
      this.leases,
      this.profileSourceAccess,
    );
  }

  private async executeWithRepositories(
    input: CheckoutProfileInput,
    profiles: ProfileRepository,
    leases: ProfileLeaseRepository,
    profileSourceAccess: ProfileSourceAccessRepository,
  ): Promise<CheckoutProfileOutput> {
    // Validate source group exists
    const sourceGroupExists = await this.sourceGroupReference.exists(
      input.sourceGroupId,
    );
    if (!sourceGroupExists) {
      throw new SourceGroupNotFoundError(input.sourceGroupId);
    }

    // Get profile IDs with successful source access
    const successfulStates: ProfileSourceAccessState[] = [
      "PUBLIC_ACCESSIBLE",
      "JOINED_ACCESSIBLE",
    ];
    const eligibleProfileIds =
      await profileSourceAccess.findProfileIdsBySourceGroupAndStates(
        input.sourceGroupId,
        successfulStates,
      );
    const eligibleProfileIdSet = new Set(eligibleProfileIds);

    const now = this.clock.now();
    const candidates = await this.loadCandidates(profiles, input, now);
    const rejectedReasons: CheckoutIneligibilityReason[] = [];

    for (const candidate of candidates) {
      // Check source access for explicit profile checkout
      if (
        input.profileId !== undefined &&
        !eligibleProfileIdSet.has(candidate.identity.id)
      ) {
        throw new ProfileNotCheckoutEligibleError(candidate.identity.id, [
          {
            code: "SOURCE_ACCESS_UNSUCCESSFUL",
            message: `Profile does not have successful source access for source group ${input.sourceGroupId}.`,
          },
        ]);
      }

      // Skip profiles without successful source access for automatic selection
      if (
        input.profileId === undefined &&
        !eligibleProfileIdSet.has(candidate.identity.id)
      ) {
        rejectedReasons.push({
          code: "SOURCE_ACCESS_UNSUCCESSFUL",
          message: `Profile does not have successful source access for source group ${input.sourceGroupId}.`,
        });
        continue;
      }

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

      const activeLease = await leases.findActiveByProfileId(
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

      await profiles.save(checkedOutProfile);
      await leases.save(lease);

      return {
        lease,
        profile: toCheckoutProfileConfiguration(checkedOutProfile),
      };
    }

    throw new NoEligibleProfileAvailableError(rejectedReasons);
  }

  private async loadCandidates(
    profiles: ProfileRepository,
    input: CheckoutProfileInput,
    now: Date,
  ): Promise<readonly CollectorProfile[]> {
    if (input.profileId !== undefined) {
      return [await loadValidatedProfileById(profiles, input.profileId)];
    }

    const candidates = await profiles.findCheckoutCandidates({
      status: "READY",
      availableAt: toIsoDateTime(now),
    });

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
