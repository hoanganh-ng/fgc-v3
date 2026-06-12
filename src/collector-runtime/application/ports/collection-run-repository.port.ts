import type {
  CollectionRun,
  CollectionRunId,
  CollectionRunIsoDateTime,
  CollectionRunSourceGroupId,
  CollectionRunStatus,
} from "../../domain";

export interface CollectionRunListQuery {
  readonly status?: CollectionRunStatus;
  readonly sourceGroupId?: CollectionRunSourceGroupId;
  readonly limit: number;
  readonly offset: number;
}

export interface CollectionRunListResult {
  readonly items: readonly CollectionRun[];
  readonly total?: number;
}

export interface CollectionRunRepository {
  save(collectionRun: CollectionRun): Promise<void>;
  findById(id: CollectionRunId): Promise<CollectionRun | null>;
  list(query: CollectionRunListQuery): Promise<CollectionRunListResult>;
  claimNextQueued(startedAt: CollectionRunIsoDateTime): Promise<CollectionRun | null>;
}
