import type { CollectorProfile, ProfileId } from "../../domain";

export interface ProfileRepository {
  save(profile: CollectorProfile): Promise<void>;
  findById(id: ProfileId): Promise<CollectorProfile | null>;
  findReadyProfiles(): Promise<readonly CollectorProfile[]>;
  findByProvisioningToken(token: string): Promise<CollectorProfile | null>;
  existsByDisplayName(
    displayName: string,
    excludeProfileId?: ProfileId,
  ): Promise<boolean>;
}
