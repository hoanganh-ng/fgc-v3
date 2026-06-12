import type {
  CollectionRunFailureReason,
  CollectionRunId,
  CollectionRunParameters,
  CollectionRunSourceGroupId,
  CollectionRunSummary,
} from "../../domain";

export interface CollectionRunExecutorInput {
  readonly collectionRunId: CollectionRunId;
  readonly sourceGroupId: CollectionRunSourceGroupId;
  readonly parameters: CollectionRunParameters;
}

export type CollectionRunExecutorResult =
  | {
      readonly ok: true;
      readonly summary: CollectionRunSummary;
    }
  | {
      readonly ok: false;
      readonly failureReason: CollectionRunFailureReason;
      readonly summary?: CollectionRunSummary;
    };

export interface CollectionRunExecutorPort {
  execute(input: CollectionRunExecutorInput): Promise<CollectionRunExecutorResult>;
}
