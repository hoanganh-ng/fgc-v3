import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
  ProfileHomeFeedCollectionRunProfileId,
  ProfileHomeFeedCollectionRunStatus,
  ProfileHomeFeedCollectionRunSummary,
  ProfileHomeFeedCollectionRunFailureReason,
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

export interface ProfileHomeFeedCollectionRunStatusTransition {
  readonly runId: ProfileHomeFeedCollectionRunId;
  readonly expectedStatus: ProfileHomeFeedCollectionRunStatus;
  readonly nextStatus: ProfileHomeFeedCollectionRunStatus;
  readonly updatedAt: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly finishedAt?: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly summary?: ProfileHomeFeedCollectionRunSummary;
  readonly failureReason?: ProfileHomeFeedCollectionRunFailureReason;
}

export type ProfileHomeFeedCollectionRunStatusTransitionResult =
  | {
      readonly ok: true;
      readonly run: ProfileHomeFeedCollectionRun;
    }
  | {
      readonly ok: false;
      readonly reason: "not_found";
    }
  | {
      readonly ok: false;
      readonly reason: "status_conflict";
      readonly currentRun: ProfileHomeFeedCollectionRun;
    };

export interface ProfileHomeFeedCollectionRunRepository {
  create(run: ProfileHomeFeedCollectionRun): Promise<void>;
  findById(
    id: ProfileHomeFeedCollectionRunId,
  ): Promise<ProfileHomeFeedCollectionRun | null>;
  list(
    query: ProfileHomeFeedCollectionRunListQuery,
  ): Promise<ProfileHomeFeedCollectionRunListResult>;
  claimNextQueued(
    startedAt: ProfileHomeFeedCollectionRunIsoDateTime,
  ): Promise<ProfileHomeFeedCollectionRun | null>;
  transitionStatus(
    transition: ProfileHomeFeedCollectionRunStatusTransition,
  ): Promise<ProfileHomeFeedCollectionRunStatusTransitionResult>;
}
