import { ContentValidationError } from "../application-errors";
import { validateSourcePublisherForApplication } from "../content-validation";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import type {
  ContentPlatform,
  SourcePublisher,
  SourcePublisherKind,
  SourcePublisherStatus,
  ValidationIssue,
} from "../../domain";

export const DEFAULT_SOURCE_PUBLISHER_LIST_LIMIT = 50;
export const MAX_SOURCE_PUBLISHER_LIST_LIMIT = 100;

export interface ListSourcePublishersInput {
  readonly status?: SourcePublisherStatus;
  readonly kind?: SourcePublisherKind;
  readonly platform?: ContentPlatform;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListSourcePublishersPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ListSourcePublishersOutput {
  readonly items: readonly SourcePublisher[];
  readonly page: ListSourcePublishersPage;
}

export class ListSourcePublishersUseCase {
  public constructor(
    private readonly sourcePublishers: SourcePublisherRepository,
  ) {}

  public async execute(
    input: ListSourcePublishersInput = {},
  ): Promise<ListSourcePublishersOutput> {
    const query = normalizeListSourcePublishersInput(input);
    const result = await this.sourcePublishers.list(query);
    const items = result.items.map((sourcePublisher) =>
      validateSourcePublisherForApplication(sourcePublisher),
    );

    return {
      items,
      page:
        result.total === undefined
          ? { limit: query.limit, offset: query.offset }
          : {
              limit: query.limit,
              offset: query.offset,
              total: result.total,
            },
    };
  }
}

function normalizeListSourcePublishersInput(input: ListSourcePublishersInput): {
  readonly status?: SourcePublisherStatus;
  readonly kind?: SourcePublisherKind;
  readonly platform?: ContentPlatform;
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_SOURCE_PUBLISHER_LIST_LIMIT;
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
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.platform !== undefined ? { platform: input.platform } : {}),
    limit: Math.min(limit, MAX_SOURCE_PUBLISHER_LIST_LIMIT),
    offset,
  };
}
