import type {
  CollectionRun,
  CollectionRunId,
  CollectionSchedule,
  CollectionScheduleIsoDateTime,
} from "../../domain";

export interface DispatchNextDueCollectionScheduleInput {
  readonly dispatchAt: CollectionScheduleIsoDateTime;
  readonly collectionRunId: CollectionRunId;
}

export interface DispatchNextDueCollectionScheduleResult {
  readonly schedule: CollectionSchedule;
  readonly collectionRun: CollectionRun;
}

export interface DispatchNextDueCollectionScheduleRepositoryPort {
  dispatchNextDue(
    input: DispatchNextDueCollectionScheduleInput,
  ): Promise<DispatchNextDueCollectionScheduleResult | null>;
}