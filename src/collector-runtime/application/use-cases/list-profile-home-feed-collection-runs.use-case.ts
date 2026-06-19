import { ProfileHomeFeedCollectionRunValidationError } from "../application-errors";
import { validateProfileHomeFeedCollectionRunForApplication } from "../profile-home-feed-collection-run-validation";
import type {
  ProfileHomeFeedCollectionRunListQuery,
  ProfileHomeFeedCollectionRunRepository,
} from "../ports/profile-home-feed-collection-run-repository.port";
import {
  isProfileHomeFeedCollectionRunStatus,
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunProfileId,
  type ProfileHomeFeedCollectionRunStatus,
  type ValidationIssue,
} from "../../domain";

export const DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT = 100;

export interface ListProfileHomeFeedCollectionRunsInput {
  readonly status?: ProfileHomeFeedCollectionRunStatus;
  readonly profileId?: ProfileHomeFeedCollectionRunProfileId;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProfileHomeFeedCollectionRunsOutput {
  readonly items: readonly ProfileHomeFeedCollectionRun[];
  readonly page: {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
  };
}

export class ListProfileHomeFeedCollectionRunsUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
  ) {}

  public async execute(
    input: ListProfileHomeFeedCollectionRunsInput = {},
  ): Promise<ListProfileHomeFeedCollectionRunsOutput> {
    const query = normalizeInput(input);
    const result = await this.runs.list(query);

    return {
      items: result.items.map(validateProfileHomeFeedCollectionRunForApplication),
      page: {
        limit: query.limit,
        offset: query.offset,
        total: result.total,
      },
    };
  }
}

function normalizeInput(
  input: ListProfileHomeFeedCollectionRunsInput,
): ProfileHomeFeedCollectionRunListQuery {
  const limit =
    input.limit ?? DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT;
  const offset = input.offset ?? 0;
  const issues: ValidationIssue[] = [];

  if (
    input.status !== undefined &&
    !isProfileHomeFeedCollectionRunStatus(input.status)
  ) {
    issues.push({
      path: "status",
      message: "status must be a valid profile home-feed collection run status.",
    });
  }

  if (
    input.profileId !== undefined &&
    (typeof input.profileId !== "string" || input.profileId.trim().length === 0)
  ) {
    issues.push({
      path: "profileId",
      message: "profileId must be a non-empty string.",
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
    throw new ProfileHomeFeedCollectionRunValidationError(issues);
  }

  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    limit: Math.min(limit, MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT),
    offset,
  };
}
