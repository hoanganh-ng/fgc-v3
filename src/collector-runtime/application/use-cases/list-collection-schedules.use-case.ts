import { CollectionScheduleValidationError } from "../application-errors";
import { validateCollectionScheduleForApplication } from "../collection-schedule-validation";
import type { CollectionScheduleRepository } from "../ports/collection-schedule-repository.port";
import type {
  CollectionSchedule,
  ValidationIssue,
} from "../../domain";

export const DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT = 50;
export const MAX_COLLECTION_SCHEDULE_LIST_LIMIT = 100;

export interface ListCollectionSchedulesInput {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListCollectionSchedulesPage {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

export interface ListCollectionSchedulesOutput {
  readonly items: readonly CollectionSchedule[];
  readonly page: ListCollectionSchedulesPage;
}

export class ListCollectionSchedulesUseCase {
  public constructor(
    private readonly collectionSchedules: CollectionScheduleRepository,
  ) {}

  public async execute(
    input: ListCollectionSchedulesInput = {},
  ): Promise<ListCollectionSchedulesOutput> {
    const query = normalizeListCollectionSchedulesInput(input);
    const result = await this.collectionSchedules.list(query);
    const items = result.items.map((collectionSchedule) =>
      validateCollectionScheduleForApplication(collectionSchedule),
    );

    return {
      items,
      page: {
        limit: query.limit,
        offset: query.offset,
        total: result.total,
      },
    };
  }
}

function normalizeListCollectionSchedulesInput(
  input: ListCollectionSchedulesInput,
): {
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT;
  const offset = input.offset ?? 0;
  const issues: ValidationIssue[] = [];

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
    throw new CollectionScheduleValidationError(issues);
  }

  return {
    limit: Math.min(limit, MAX_COLLECTION_SCHEDULE_LIST_LIMIT),
    offset,
  };
}
