import type { CollectorProfile, IsoDateTime, ProfileId } from "../../domain";

export interface ProfileCheckoutCandidateQuery {
  readonly status: "READY";
  readonly availableAt: IsoDateTime;
  readonly limit?: number;
}

export interface ProfileRepository {
  save(profile: CollectorProfile): Promise<void>;
  findById(id: ProfileId): Promise<CollectorProfile | null>;
  findCheckoutCandidates(
    query: ProfileCheckoutCandidateQuery,
  ): Promise<readonly CollectorProfile[]>;
  findByProvisioningToken(token: string): Promise<CollectorProfile | null>;
  existsByDisplayName(
    displayName: string,
    excludeProfileId?: ProfileId,
  ): Promise<boolean>;
}
