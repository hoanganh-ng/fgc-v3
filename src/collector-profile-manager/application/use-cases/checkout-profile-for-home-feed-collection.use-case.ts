import {
  ProfileLeaseStateConflictError,
  ProfileNotCheckoutEligibleError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { LeaseIdGenerator } from "../ports/lease-id-generator.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
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

export interface CheckoutProfileForHomeFeedCollectionInput {
  readonly profileId: ProfileId;
}

export interface HomeFeedCollectionCheckoutProfile {
  readonly profileId: ProfileId;
  readonly accountStage: ProfileAccountStage;
}

export interface CheckoutProfileForHomeFeedCollectionOutput {
  readonly lease: ProfileLease;
  readonly profile: HomeFeedCollectionCheckoutProfile;
}

export class CheckoutProfileForHomeFeedCollectionUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly leases: ProfileLeaseRepository,
    private readonly leaseIds: LeaseIdGenerator,
    private readonly clock: Clock,
    private readonly transactionManager?: TransactionManager,
  ) {}

  public async execute(
    input: CheckoutProfileForHomeFeedCollectionInput,
  ): Promise<CheckoutProfileForHomeFeedCollectionOutput> {
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
    input: CheckoutProfileForHomeFeedCollectionInput,
    profiles: ProfileRepository,
    leases: ProfileLeaseRepository,
  ): Promise<CheckoutProfileForHomeFeedCollectionOutput> {
    const now = this.clock.now();
    const profile = await loadValidatedProfileById(profiles, input.profileId);
    const eligibility = evaluateCheckoutEligibility(profile, now, {
      purpose: "HOME_FEED_COLLECTION",
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
      purpose: "HOME_FEED_COLLECTION",
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
}
