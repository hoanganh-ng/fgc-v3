import { ContentValidationError } from "../application-errors";
import { validateContentItemForApplication } from "../content-validation";
import type { ContentItemRepository } from "../ports/content-item-repository.port";
import type {
  ContentItem,
  ContentStatus,
  SourceGroupId,
  ValidationIssue,
} from "../../domain";

export const DEFAULT_CONTENT_ITEM_LIST_LIMIT = 50;
export const MAX_CONTENT_ITEM_LIST_LIMIT = 100;

export interface ListContentItemsInput {
  readonly status?: ContentStatus;
  readonly sourceGroupId?: SourceGroupId;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListContentItemsPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ListContentItemsOutput {
  readonly items: readonly ContentItem[];
  readonly page: ListContentItemsPage;
}

export class ListContentItemsUseCase {
  public constructor(private readonly contentItems: ContentItemRepository) {}

  public async execute(
    input: ListContentItemsInput = {},
  ): Promise<ListContentItemsOutput> {
    const query = normalizeListContentItemsInput(input);
    const result = await this.contentItems.list(query);
    const items = result.items.map((contentItem) =>
      validateContentItemForApplication(contentItem),
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

function normalizeListContentItemsInput(input: ListContentItemsInput): {
  readonly status?: ContentStatus;
  readonly sourceGroupId?: SourceGroupId;
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_CONTENT_ITEM_LIST_LIMIT;
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
    ...(input.sourceGroupId !== undefined
      ? { sourceGroupId: input.sourceGroupId }
      : {}),
    limit: Math.min(limit, MAX_CONTENT_ITEM_LIST_LIMIT),
    offset,
  };
}
