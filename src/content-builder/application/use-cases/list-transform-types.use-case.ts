import { TransformTypeValidationError } from "../application-errors";
import { validateTransformTypeForApplication } from "../transform-type-validation";
import type { TransformTypeRepository } from "../ports/transform-type-repository.port";
import {
  isTransformTypeStatus,
  type TransformType,
  type TransformTypeStatus,
  type ValidationIssue,
} from "../../domain";

export const DEFAULT_TRANSFORM_TYPE_LIST_LIMIT = 50;
export const MAX_TRANSFORM_TYPE_LIST_LIMIT = 100;

export interface ListTransformTypesInput {
  readonly status?: TransformTypeStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListTransformTypesPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ListTransformTypesOutput {
  readonly items: readonly TransformType[];
  readonly page: ListTransformTypesPage;
}

export class ListTransformTypesUseCase {
  public constructor(
    private readonly transformTypes: TransformTypeRepository,
  ) {}

  public async execute(
    input: ListTransformTypesInput = {},
  ): Promise<ListTransformTypesOutput> {
    const query = normalizeListTransformTypesInput(input);
    const result = await this.transformTypes.list(query);
    const items = result.items.map((transformType) =>
      validateTransformTypeForApplication(transformType),
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

function normalizeListTransformTypesInput(input: ListTransformTypesInput): {
  readonly status?: TransformTypeStatus;
  readonly limit: number;
  readonly offset: number;
} {
  const limit = input.limit ?? DEFAULT_TRANSFORM_TYPE_LIST_LIMIT;
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

  if (input.status !== undefined && !isTransformTypeStatus(input.status)) {
    issues.push({
      path: "status",
      message: "status must be one of: ACTIVE, ARCHIVED.",
    });
  }

  if (issues.length > 0) {
    throw new TransformTypeValidationError(issues);
  }

  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    limit: Math.min(limit, MAX_TRANSFORM_TYPE_LIST_LIMIT),
    offset,
  };
}
