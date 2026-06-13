import {
  ProfileLeaseStateConflictError,
  ProfileNotCheckoutEligibleError,
  SourceGroupNotFoundError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { LeaseIdGenerator } from "../ports/lease-id-generator.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
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
  markProfileCheckedOut,
} from "../../domain";
import type {
  ProfileAccountStage,
  ProfileId,
  ProfileLease,
} from "../../domain";

export interface CheckoutProfileForAssistedGroupAccessInput {
  readonly profileId: ProfileId;
  readonly sourceGroupId: string;
}

export interface AssistedGroupAccessCheckoutProfile {
  readonly profileId: ProfileId;
  readonly accountStage: ProfileAccountStage;
}

export interface CheckoutProfileForAssistedGroupAccessOutput {
  readonly lease: ProfileLease;
  readonly profile: AssistedGroupAccessCheckoutProfile;
}

export class CheckoutProfileForAssistedGroupAccessUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly leases: ProfileLeaseRepository,
    private readonly leaseIds: LeaseIdGenerator,
    private readonly clock: Clock,
    private readonly sourceGroupReference: SourceGroupReferencePort,
    private readonly transactionManager?: TransactionManager,
  ) {}

  public async execute(
    input: CheckoutProfileForAssistedGroupAccessInput,
  ): Promise<CheckoutProfileForAssistedGroupAccessOutput> {
    await this.ensureSourceGroupExists(input.sourceGroupId);

    if (this.transactionManager !== undefined) {
      return this.transactionManager.runInTransaction((repositories) =>
        this.executeWithRepositories(
          input,
          repositories.profiles,
          repositories.leases,
        ),
      );
    }

    return this.executeWithRepositories(input, this.profiles, this.leases);
  }

  private async executeWithRepositories(
    input: CheckoutProfileForAssistedGroupAccessInput,
    profiles: ProfileRepository,
    leases: ProfileLeaseRepository,
  ): Promise<CheckoutProfileForAssistedGroupAccessOutput> {
    const now = this.clock.now();
    const profile = await loadValidatedProfileById(profiles, input.profileId);
    const eligibility = evaluateCheckoutEligibility(profile, now, {
      purpose: "ASSISTED_GROUP_ACCESS",
    });

    if (!eligibility.eligible) {
      throw new ProfileNotCheckoutEligibleError(
        profile.identity.id,
        eligibility.reasons,
      );
    }

    const activeLease = await leases.findActiveByProfileId(profile.identity.id);

    if (activeLease !== null) {
      throw new ProfileLeaseStateConflictError(
        `Profile ${profile.identity.id} already has active lease ${activeLease.id}.`,
      );
    }

    const lease = createActiveProfileLease({
      id: await this.leaseIds.generateLeaseId(),
      profileId: profile.identity.id,
      purpose: "ASSISTED_GROUP_ACCESS",
      leasedAt: toIsoDateTime(now),
      expiresAt: toIsoDateTime(calculateLeaseExpiresAt(profile, now)),
    });
    const checkedOutProfile = validateProfileForApplication(
      markProfileCheckedOut(profile, now, eligibility.localDate),
    );

    await profiles.save(checkedOutProfile);
    await leases.save(lease);

    return {
      lease,
      profile: {
        profileId: checkedOutProfile.identity.id,
        accountStage: checkedOutProfile.identity.accountStage,
      },
    };
  }

  private async ensureSourceGroupExists(sourceGroupId: string): Promise<void> {
    const sourceGroupExists = await this.sourceGroupReference.exists(
      sourceGroupId,
    );
    if (!sourceGroupExists) {
      throw new SourceGroupNotFoundError(sourceGroupId);
    }
  }
}
