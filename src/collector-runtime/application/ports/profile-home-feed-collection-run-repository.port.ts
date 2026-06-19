import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
  ProfileHomeFeedCollectionRunProfileId,
  ProfileHomeFeedCollectionRunStatus,
} from "../../domain";

export interface ProfileHomeFeedCollectionRunListQuery {
  readonly status?: ProfileHomeFeedCollectionRunStatus;
  readonly profileId?: ProfileHomeFeedCollectionRunProfileId;
  readonly limit: number;
  readonly offset: number;
}

export interface ProfileHomeFeedCollectionRunListResult {
  readonly items: readonly ProfileHomeFeedCollectionRun[];
  readonly total: number;
}

export interface ProfileHomeFeedCollectionRunRepository {
  save(run: ProfileHomeFeedCollectionRun): Promise<void>;
  findById(
    id: ProfileHomeFeedCollectionRunId,
  ): Promise<ProfileHomeFeedCollectionRun | null>;
  list(
    query: ProfileHomeFeedCollectionRunListQuery,
  ): Promise<ProfileHomeFeedCollectionRunListResult>;
  claimNextQueued(
    startedAt: ProfileHomeFeedCollectionRunIsoDateTime,
  ): Promise<ProfileHomeFeedCollectionRun | null>;
}
