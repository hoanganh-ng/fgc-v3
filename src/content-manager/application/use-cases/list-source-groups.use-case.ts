import { ContentValidationError } from "../application-errors";
import { validateSourceGroupForApplication } from "../content-validation";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import type {
  ContentCategoryId,
  SourceGroup,
  SourceGroupStatus,
  ValidationIssue,
} from "../../domain";

export const DEFAULT_SOURCE_GROUP_LIST_LIMIT = 50;
export const MAX_SOURCE_GROUP_LIST_LIMIT = 100;

export interface ListSourceGroupsInput {
  readonly status?: SourceGroupStatus;
  readonly categoryId?: ContentCategoryId;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListSourceGroupsPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ListSourceGroupsOutput {
  readonly items: readonly SourceGroup[];
  readonly page: ListSourceGroupsPage;
}

export class ListSourceGroupsUseCase {
  public constructor(private readonly sourceGroups: SourceGroupRepository) {}

  public async execute(
    input: ListSourceGroupsInput = {},
  ): Promise<ListSourceGroupsOutput> {
    const query = normalizeListSourceGroupsInput(input);
    const result = await this.sourceGroups.list(query);
    const items = result.items.map((sourceGroup) =>
      validateSourceGroupForApplication(sourceGroup),
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

function normalizeListSourceGroupsInput(input: ListSourceGroupsInput): {
  readonly status?: SourceGroupStatus;
  readonly categoryId?: ContentCategoryId;
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_SOURCE_GROUP_LIST_LIMIT;
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
    throw new ContentValidationError(issues);
  }

  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    limit: Math.min(limit, MAX_SOURCE_GROUP_LIST_LIMIT),
    offset,
  };
}
