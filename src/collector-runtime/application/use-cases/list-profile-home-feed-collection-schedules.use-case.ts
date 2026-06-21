import { ProfileHomeFeedCollectionScheduleValidationError } from "../application-errors";
import { validateProfileHomeFeedCollectionScheduleForApplication } from "../profile-home-feed-collection-schedule-validation";
import type { ProfileHomeFeedCollectionScheduleRepository } from "../ports/profile-home-feed-collection-schedule-repository.port";
import type {
  ProfileHomeFeedCollectionSchedule,
  ValidationIssue,
} from "../../domain";

export const DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT = 50;
export const MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT = 100;

export interface ListProfileHomeFeedCollectionSchedulesInput {
  readonly enabled?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProfileHomeFeedCollectionSchedulesPage {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

export interface ListProfileHomeFeedCollectionSchedulesOutput {
  readonly items: readonly ProfileHomeFeedCollectionSchedule[];
  readonly page: ListProfileHomeFeedCollectionSchedulesPage;
}

export class ListProfileHomeFeedCollectionSchedulesUseCase {
  public constructor(
    private readonly schedules: ProfileHomeFeedCollectionScheduleRepository,
  ) {}

  public async execute(
    input: ListProfileHomeFeedCollectionSchedulesInput = {},
  ): Promise<ListProfileHomeFeedCollectionSchedulesOutput> {
    const query = normalizeListProfileHomeFeedCollectionSchedulesInput(input);
    const result = await this.schedules.list(query);
    const items = result.items.map((schedule) =>
      validateProfileHomeFeedCollectionScheduleForApplication(schedule),
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

function normalizeListProfileHomeFeedCollectionSchedulesInput(
  input: ListProfileHomeFeedCollectionSchedulesInput,
): {
  readonly enabled?: boolean;
  readonly limit: number;
  readonly offset: number;
} {
  const limit =
    input.limit ?? DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT;
  const offset = input.offset ?? 0;
  const issues: ValidationIssue[] = [];

  if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
    issues.push({
      path: "enabled",
      message: "enabled must be a boolean.",
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
    throw new ProfileHomeFeedCollectionScheduleValidationError(issues);
  }

  return {
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    limit: Math.min(
      limit,
      MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
    ),
    offset,
  };
}
