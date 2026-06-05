import {
  InvalidApplicationOperationError,
  ProfileLeaseAlreadyClosedError,
  ProfileLeaseNotFoundError,
  ProfileLeaseStateConflictError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import type { TransactionManager } from "../ports/transaction-manager.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import {
  loadValidatedProfileById,
  validateProfileForApplication,
} from "../profile-validation";
import {
  getProfileLocalDate,
  markProfileReleasedFromLease,
  releaseProfileLease,
  toUtcDateString,
} from "../../domain";
import type { CollectorProfile, ProfileLease, ProfileLeaseId } from "../../domain";

export interface ReleaseProfileLeaseInput {
  readonly leaseId: ProfileLeaseId;
  readonly macroActionsPerformed?: number;
}

export interface ReleaseProfileLeaseOutput {
  readonly lease: ProfileLease;
  readonly profile: CollectorProfile;
}

export class ReleaseProfileLeaseUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly leases: ProfileLeaseRepository,
    private readonly clock: Clock,
    private readonly transactionManager?: TransactionManager,
  ) {}

  public async execute(
    input: ReleaseProfileLeaseInput,
  ): Promise<ReleaseProfileLeaseOutput> {
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
    input: ReleaseProfileLeaseInput,
    profiles: ProfileRepository,
    leases: ProfileLeaseRepository,
  ): Promise<ReleaseProfileLeaseOutput> {
    const lease = await leases.findById(input.leaseId);

    if (lease === null) {
      throw new ProfileLeaseNotFoundError(input.leaseId);
    }

    const now = this.clock.now();

    if (lease.status !== "ACTIVE") {
      throw new ProfileLeaseAlreadyClosedError(lease.id, lease.status);
    }

    if (Date.parse(lease.expiresAt) <= now.getTime()) {
      throw new ProfileLeaseAlreadyClosedError(lease.id, "EXPIRED");
    }

    const macroActionsPerformed = input.macroActionsPerformed ?? 0;

    if (
      !Number.isInteger(macroActionsPerformed) ||
      macroActionsPerformed < 0
    ) {
      throw new InvalidApplicationOperationError(
        "macroActionsPerformed must be a non-negative integer.",
      );
    }

    const profile = await loadValidatedProfileById(profiles, lease.profileId);

    if (profile.identity.status !== "BUSY") {
      throw new ProfileLeaseStateConflictError(
        `Profile ${profile.identity.id} must be BUSY before lease ${lease.id} can be released.`,
      );
    }

    const localDate = getProfileLocalDate(profile, now) ?? toUtcDateString(now);
    const releasedAt = toIsoDateTime(now);
    const releasedProfile = validateProfileForApplication(
      markProfileReleasedFromLease(
        profile,
        lease,
        now,
        localDate,
        macroActionsPerformed,
      ),
    );
    const releasedLease = releaseProfileLease(lease, releasedAt);

    await profiles.save(releasedProfile);
    await leases.updateStatus(releasedLease);

    return {
      lease: releasedLease,
      profile: releasedProfile,
    };
  }
}
