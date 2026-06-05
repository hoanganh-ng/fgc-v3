import type { ProfileId, ProfileLease, ProfileLeaseId } from "../../domain";

export interface ProfileLeaseRepository {
  save(lease: ProfileLease): Promise<void>;
  findById(id: ProfileLeaseId): Promise<ProfileLease | null>;
  findActiveByProfileId(profileId: ProfileId): Promise<ProfileLease | null>;
}
