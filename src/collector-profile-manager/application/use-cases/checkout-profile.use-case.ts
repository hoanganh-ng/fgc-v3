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
  SUCCESSFUL_PROFILE_SOURCE_ACCESS_STATES,
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
    await this.ensureSourceGroupExists(input.sourceGroupId);

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
    // Get profile IDs with successful source access
    const eligibleProfileIds =
      await profileSourceAccess.findProfileIdsBySourceGroupAndStates(
        input.sourceGroupId,
        SUCCESSFUL_PROFILE_SOURCE_ACCESS_STATES,
      );
    const eligibleProfileIdSet = new Set(eligibleProfileIds);

    const now = this.clock.now();
    const candidates = await this.loadCandidates(profiles, input, now);
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

      if (!eligibleProfileIdSet.has(candidate.identity.id)) {
        const sourceAccessReason = {
          code: "SOURCE_ACCESS_UNSUCCESSFUL" as const,
          message: `Profile does not have successful source access for source group ${input.sourceGroupId}.`,
        };

        if (input.profileId !== undefined) {
          throw new ProfileNotCheckoutEligibleError(candidate.identity.id, [
            sourceAccessReason,
          ]);
        }

        rejectedReasons.push(sourceAccessReason);
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

  private async ensureSourceGroupExists(sourceGroupId: string): Promise<void> {
    const sourceGroupExists = await this.sourceGroupReference.exists(
      sourceGroupId,
    );
    if (!sourceGroupExists) {
      throw new SourceGroupNotFoundError(sourceGroupId);
    }
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
