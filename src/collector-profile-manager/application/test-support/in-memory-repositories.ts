import type {
  CollectorProfile,
  ProfileId,
  ProfileLease,
  ProfileLeaseId,
  ProfileSourceAccess,
  ProfileSourceAccessSourceGroupId,
  ProfileSourceAccessState,
} from "../../domain";
import type {
  ProfileCheckoutCandidateQuery,
  ProfileListQuery,
  ProfileListResult,
  ProfileRepository,
} from "../ports/profile-repository.port";
import type { ProfileLeaseRepository } from "../ports/profile-lease-repository.port";
import type {
  ProfileSourceAccessRepository,
} from "../ports/profile-source-access-repository.port";

export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<ProfileId, CollectorProfile>();

  public async save(profile: CollectorProfile): Promise<void> {
    this.profiles.set(profile.identity.id, profile);
  }

  public async findById(id: ProfileId): Promise<CollectorProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  public async listProfiles(
    query: ProfileListQuery,
  ): Promise<ProfileListResult> {
    const offset = query.offset ?? 0;
    const matchingProfiles = [...this.profiles.values()]
      .filter(
        (profile) =>
          query.status === undefined ||
          profile.identity.status === query.status,
      )
      .sort(compareProfilesByCreatedAt);
    const items = matchingProfiles.slice(offset, offset + query.limit);

    return {
      items,
      total: matchingProfiles.length,
    };
  }

  public async findCheckoutCandidates(
    query: ProfileCheckoutCandidateQuery,
  ): Promise<readonly CollectorProfile[]> {
    const availableAtMs = Date.parse(query.availableAt);
    const candidates = [...this.profiles.values()].filter((profile) => {
      if (profile.identity.status !== query.status) {
        return false;
      }

      if (profile.identity.nextAvailableAt === null) {
        return true;
      }

      return Date.parse(profile.identity.nextAvailableAt) <= availableAtMs;
    });

    return query.limit === undefined
      ? candidates
      : candidates.slice(0, query.limit);
  }

  public async findByProvisioningToken(
    token: string,
  ): Promise<CollectorProfile | null> {
    for (const profile of this.profiles.values()) {
      if (
        profile.provisioningToken.status === "ISSUED" &&
        profile.provisioningToken.tokenHash === token
      ) {
        return profile;
      }
    }

    return null;
  }

  public async existsByDisplayName(
    displayName: string,
    excludeProfileId?: ProfileId,
  ): Promise<boolean> {
    for (const profile of this.profiles.values()) {
      if (
        profile.identity.displayName === displayName &&
        profile.identity.id !== excludeProfileId
      ) {
        return true;
      }
    }

    return false;
  }
}

function compareProfilesByCreatedAt(
  left: CollectorProfile,
  right: CollectorProfile,
): number {
  const leftCreatedAt = Date.parse(left.identity.createdAt);
  const rightCreatedAt = Date.parse(right.identity.createdAt);

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return left.identity.id.localeCompare(right.identity.id);
}

export class InMemoryProfileLeaseRepository implements ProfileLeaseRepository {
  private readonly leases = new Map<ProfileLeaseId, ProfileLease>();

  public async save(lease: ProfileLease): Promise<void> {
    this.leases.set(lease.id, lease);
  }

  public async findById(id: ProfileLeaseId): Promise<ProfileLease | null> {
    return this.leases.get(id) ?? null;
  }

  public async findActiveByProfileId(
    profileId: ProfileId,
  ): Promise<ProfileLease | null> {
    for (const lease of this.leases.values()) {
      if (lease.profileId === profileId && lease.status === "ACTIVE") {
        return lease;
      }
    }

    return null;
  }

  public async updateStatus(lease: ProfileLease): Promise<void> {
    this.leases.set(lease.id, lease);
  }
}

export class InMemoryProfileSourceAccessRepository
  implements ProfileSourceAccessRepository
{
  private readonly records = new Map<string, ProfileSourceAccess>();

  public async upsert(profileSourceAccess: ProfileSourceAccess): Promise<void> {
    this.records.set(
      toProfileSourceAccessKey(
        profileSourceAccess.profileId,
        profileSourceAccess.sourceGroupId,
      ),
      profileSourceAccess,
    );
  }

  public async getByProfileAndSourceGroup(
    profileId: ProfileId,
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<ProfileSourceAccess | null> {
    return (
      this.records.get(toProfileSourceAccessKey(profileId, sourceGroupId)) ??
      null
    );
  }

  public async listByProfile(
    profileId: ProfileId,
  ): Promise<readonly ProfileSourceAccess[]> {
    return [...this.records.values()]
      .filter((record) => record.profileId === profileId)
      .sort(compareProfileSourceAccess);
  }

  public async listBySourceGroup(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<readonly ProfileSourceAccess[]> {
    return [...this.records.values()]
      .filter((record) => record.sourceGroupId === sourceGroupId)
      .sort(compareProfileSourceAccess);
  }

  public async findProfileIdsBySourceGroupAndStates(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
    accessStates: readonly ProfileSourceAccessState[],
  ): Promise<readonly ProfileId[]> {
    const stateSet = new Set(accessStates);
    return [...this.records.values()]
      .filter(
        (record) =>
          record.sourceGroupId === sourceGroupId &&
          stateSet.has(record.accessState),
      )
      .map((record) => record.profileId);
  }
}

function toProfileSourceAccessKey(
  profileId: ProfileId,
  sourceGroupId: ProfileSourceAccessSourceGroupId,
): string {
  return `${profileId}:${sourceGroupId}`;
}

function compareProfileSourceAccess(
  left: ProfileSourceAccess,
  right: ProfileSourceAccess,
): number {
  const leftUpdatedAt = Date.parse(left.updatedAt);
  const rightUpdatedAt = Date.parse(right.updatedAt);

  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }

  return left.id.localeCompare(right.id);
}
