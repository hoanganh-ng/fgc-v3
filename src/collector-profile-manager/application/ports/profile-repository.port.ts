import type {
  CollectorProfile,
  IsoDateTime,
  ProfileId,
  ProfileStatus,
} from "../../domain";

export interface ProfileCheckoutCandidateQuery {
  readonly status: "READY";
  readonly availableAt: IsoDateTime;
  readonly limit?: number;
}

export interface ProfileListQuery {
  readonly status?: ProfileStatus;
  readonly limit: number;
  readonly offset?: number;
}

export interface ProfileListResult {
  readonly items: readonly CollectorProfile[];
  readonly total?: number;
}

export interface ProfileRepository {
  save(profile: CollectorProfile): Promise<void>;
  findById(id: ProfileId): Promise<CollectorProfile | null>;
  listProfiles(query: ProfileListQuery): Promise<ProfileListResult>;
  findCheckoutCandidates(
    query: ProfileCheckoutCandidateQuery,
  ): Promise<readonly CollectorProfile[]>;
  findByProvisioningToken(token: string): Promise<CollectorProfile | null>;
  existsByDisplayName(
    displayName: string,
    excludeProfileId?: ProfileId,
  ): Promise<boolean>;
}
