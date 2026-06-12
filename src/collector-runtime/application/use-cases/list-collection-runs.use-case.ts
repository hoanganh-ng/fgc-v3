import { CollectionRunValidationError } from "../application-errors";
import { validateCollectionRunForApplication } from "../collection-run-validation";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import {
  isCollectionRunStatus,
  type CollectionRun,
  type CollectionRunSourceGroupId,
  type CollectionRunStatus,
  type ValidationIssue,
} from "../../domain";

export const DEFAULT_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_COLLECTION_RUN_LIST_LIMIT = 100;

export interface ListCollectionRunsInput {
  readonly status?: CollectionRunStatus;
  readonly sourceGroupId?: CollectionRunSourceGroupId;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListCollectionRunsPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ListCollectionRunsOutput {
  readonly items: readonly CollectionRun[];
  readonly page: ListCollectionRunsPage;
}

export class ListCollectionRunsUseCase {
  public constructor(private readonly collectionRuns: CollectionRunRepository) {}

  public async execute(
    input: ListCollectionRunsInput = {},
  ): Promise<ListCollectionRunsOutput> {
    const query = normalizeListCollectionRunsInput(input);
    const result = await this.collectionRuns.list(query);
    const items = result.items.map((collectionRun) =>
      validateCollectionRunForApplication(collectionRun),
    );

    return {
      items,
      page:
        result.total === undefined
          ? {
              limit: query.limit,
              offset: query.offset,
            }
          : {
              limit: query.limit,
              offset: query.offset,
              total: result.total,
            },
    };
  }
}

function normalizeListCollectionRunsInput(
  input: ListCollectionRunsInput,
): {
  readonly status?: CollectionRunStatus;
  readonly sourceGroupId?: CollectionRunSourceGroupId;
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_COLLECTION_RUN_LIST_LIMIT;
  const offset = input.offset ?? 0;
  const issues: ValidationIssue[] = [];

  if (input.status !== undefined && !isCollectionRunStatus(input.status)) {
    issues.push({
      path: "status",
      message: "status must be a valid collection run status.",
    });
  }

  if (
    input.sourceGroupId !== undefined &&
    (typeof input.sourceGroupId !== "string" ||
      input.sourceGroupId.trim().length === 0)
  ) {
    issues.push({
      path: "sourceGroupId",
      message: "sourceGroupId must be a non-empty string.",
    });
  }

  if (!Number.isInteger(limit) || limit < 1) {
    issues.push({
      path: "limit",
      message: "limit must be a positive integer.",
    });
  }

  if (!Number.isInteger(offset) || offset < 0) {
    issues.push({
      path: "offset",
      message: "offset must be a non-negative integer.",
    });
  }

  if (issues.length > 0) {
    throw new CollectionRunValidationError(issues);
  }

  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.sourceGroupId !== undefined
      ? { sourceGroupId: input.sourceGroupId }
      : {}),
    limit: Math.min(limit, MAX_COLLECTION_RUN_LIST_LIMIT),
    offset,
  };
}
