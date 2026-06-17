import type {
  CollectionRunParameters,
  CollectionSchedule,
  CollectionScheduleSourceGroupId,
} from "../../domain";

export interface CollectionScheduleListQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface CollectionScheduleListResult {
  readonly items: readonly CollectionSchedule[];
  readonly total: number;
}

export interface CollectionScheduleRepository {
  save(schedule: CollectionSchedule): Promise<void>;
  findBySourceGroupId(
    sourceGroupId: CollectionScheduleSourceGroupId,
  ): Promise<CollectionSchedule | null>;
  list(
    query: CollectionScheduleListQuery,
  ): Promise<CollectionScheduleListResult>;
}