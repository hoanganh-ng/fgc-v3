import { InvalidProfileQueryError } from "../application-errors";
import { validateProfileForApplication } from "../profile-validation";
import { toProfileSummaryDto } from "../profile-read-dtos";
import type { ProfileSummary } from "../profile-read-dtos";
import type { ProfileRepository } from "../ports/profile-repository.port";
import type { ProfileStatus, ValidationIssue } from "../../domain";

export const DEFAULT_PROFILE_LIST_LIMIT = 25;
export const MAX_PROFILE_LIST_LIMIT = 100;

export interface ListProfilesInput {
  readonly status?: ProfileStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProfilesPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ListProfilesOutput {
  readonly items: readonly ProfileSummary[];
  readonly page: ListProfilesPage;
}

export class ListProfilesUseCase {
  public constructor(private readonly profiles: ProfileRepository) {}

  public async execute(
    input: ListProfilesInput = {},
  ): Promise<ListProfilesOutput> {
    const query = normalizeListProfilesInput(input);
    const result = await this.profiles.listProfiles(query);
    const items = result.items
      .map((profile) => validateProfileForApplication(profile))
      .map((profile) => toProfileSummaryDto(profile));
    const page =
      result.total === undefined
        ? {
            limit: query.limit,
            offset: query.offset ?? 0,
          }
        : {
            limit: query.limit,
            offset: query.offset ?? 0,
            total: result.total,
          };

    return {
      items,
      page,
    };
  }
}

function normalizeListProfilesInput(input: ListProfilesInput): {
  readonly status?: ProfileStatus;
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_PROFILE_LIST_LIMIT;
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
    throw new InvalidProfileQueryError(issues);
  }

  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    limit: Math.min(limit, MAX_PROFILE_LIST_LIMIT),
    offset,
  };
}
