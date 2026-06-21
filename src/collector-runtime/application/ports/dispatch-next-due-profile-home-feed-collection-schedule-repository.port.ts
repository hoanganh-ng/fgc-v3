import type {
  CollectorRuntimeAccountStage,
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleFailureReason,
  ProfileHomeFeedCollectionScheduleIsoDateTime,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../../domain";

export interface DispatchNextDueProfileHomeFeedCollectionScheduleCandidate {
  readonly schedule: ProfileHomeFeedCollectionSchedule;
}

export interface ExpectedProfileHomeFeedCollectionScheduleInput {
  readonly profileId: ProfileHomeFeedCollectionScheduleProfileId;
  readonly expectedNextRunAt: ProfileHomeFeedCollectionScheduleIsoDateTime;
  readonly dispatchAt: ProfileHomeFeedCollectionScheduleIsoDateTime;
}

export interface DispatchProfileHomeFeedCollectionScheduleInput
  extends ExpectedProfileHomeFeedCollectionScheduleInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
  readonly accountStageAtRequest: CollectorRuntimeAccountStage;
}

export type DispatchProfileHomeFeedCollectionScheduleResult =
  | {
      readonly outcome: "DISPATCHED";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
      readonly run: ProfileHomeFeedCollectionRun;
    }
  | {
      readonly outcome: "SKIPPED_ACTIVE_RUN";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
    }
  | {
      readonly outcome: "RACE_LOST";
    };

export interface RecordProfileHomeFeedCollectionScheduleLookupFailureInput
  extends ExpectedProfileHomeFeedCollectionScheduleInput {
  readonly failureReason: ProfileHomeFeedCollectionScheduleFailureReason;
}

export type RecordProfileHomeFeedCollectionScheduleAttemptResult =
  | {
      readonly outcome: "UPDATED";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
    }
  | {
      readonly outcome: "RACE_LOST";
    };

export interface DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort {
  findNextDueCandidate(
    dispatchAt: ProfileHomeFeedCollectionScheduleIsoDateTime,
  ): Promise<DispatchNextDueProfileHomeFeedCollectionScheduleCandidate | null>;
  dispatchOrSkipActiveRun(
    input: DispatchProfileHomeFeedCollectionScheduleInput,
  ): Promise<DispatchProfileHomeFeedCollectionScheduleResult>;
  recordProfileNotFound(
    input: ExpectedProfileHomeFeedCollectionScheduleInput,
  ): Promise<RecordProfileHomeFeedCollectionScheduleAttemptResult>;
  recordProfileLookupFailed(
    input: RecordProfileHomeFeedCollectionScheduleLookupFailureInput,
  ): Promise<RecordProfileHomeFeedCollectionScheduleAttemptResult>;
}
