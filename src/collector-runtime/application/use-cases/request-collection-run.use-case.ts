import {
  CollectionRunSourceGroupNotActiveError,
  CollectionRunSourceGroupNotFoundError,
  CollectionRunSourceGroupPlatformUnsupportedError,
  CollectionRunValidationError,
  SourceGroupLookupFailedError,
} from "../application-errors";
import {
  toCollectionRunIsoDateTime,
  validateCollectionRunForApplication,
  validateCollectionRunParametersForApplication,
} from "../collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type {
  SourceGroupLookupPort,
  SourceGroupLookupResult,
  SourceGroupLookupSourceGroup,
} from "../ports/source-group-lookup.port";
import type {
  CollectionRun,
  CollectionRunParameters,
  ValidationIssue,
} from "../../domain";

export interface RequestCollectionRunInput {
  readonly sourceGroupId: string;
  readonly maxScrolls?: number;
  readonly maxDurationMs?: number;
}

export class RequestCollectionRunUseCase {
  public constructor(
    private readonly collectionRuns: CollectionRunRepository,
    private readonly sourceGroups: SourceGroupLookupPort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: RequestCollectionRunInput,
  ): Promise<CollectionRun> {
    const sourceGroupId = validateSourceGroupId(input.sourceGroupId);
    const parameters = validateCollectionRunParametersForApplication(
      toCollectionRunParameters(input),
    );

    await this.validateSourceGroup(sourceGroupId);

    const now = toCollectionRunIsoDateTime(this.clock.now());
    const collectionRun = validateCollectionRunForApplication({
      id: await this.ids.generateId(),
      sourceGroupId,
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await this.collectionRuns.save(collectionRun);

    return collectionRun;
  }

  private async validateSourceGroup(sourceGroupId: string): Promise<void> {
    const lookupResult = await this.lookupSourceGroup(sourceGroupId);

    if (!lookupResult.ok) {
      throw toSourceGroupLookupError(sourceGroupId, lookupResult);
    }

    const sourceGroup = lookupResult.sourceGroup;

    if (sourceGroup.id !== sourceGroupId) {
      throw new SourceGroupLookupFailedError(
        sourceGroupId,
        "Content Manager returned a different source group id.",
      );
    }

    if (sourceGroup.status !== "ACTIVE") {
      throw new CollectionRunSourceGroupNotActiveError(
        sourceGroupId,
        sourceGroup.status,
      );
    }

    if (sourceGroup.platform !== "FACEBOOK") {
      throw new CollectionRunSourceGroupPlatformUnsupportedError(
        sourceGroupId,
        sourceGroup.platform,
      );
    }
  }

  private async lookupSourceGroup(
    sourceGroupId: string,
  ): Promise<SourceGroupLookupResult> {
    try {
      return await this.sourceGroups.getSourceGroup(sourceGroupId);
    } catch (error) {
      throw new SourceGroupLookupFailedError(
        sourceGroupId,
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Could not resolve the source group from Content Manager.",
      );
    }
  }
}

function toCollectionRunParameters(
  input: RequestCollectionRunInput,
): CollectionRunParameters {
  return {
    ...(input.maxScrolls !== undefined ? { maxScrolls: input.maxScrolls } : {}),
    ...(input.maxDurationMs !== undefined
      ? { maxDurationMs: input.maxDurationMs }
      : {}),
  };
}

function validateSourceGroupId(sourceGroupId: string): string {
  const issues: ValidationIssue[] = [];

  if (typeof sourceGroupId !== "string" || sourceGroupId.trim().length === 0) {
    issues.push({
      path: "sourceGroupId",
      message: "sourceGroupId must be a non-empty string.",
    });
  }

  if (issues.length > 0) {
    throw new CollectionRunValidationError(issues);
  }

  return sourceGroupId;
}

function toSourceGroupLookupError(
  sourceGroupId: string,
  lookupResult: Extract<SourceGroupLookupResult, { readonly ok: false }>,
): Error {
  if (
    lookupResult.errorCode === "SOURCE_GROUP_NOT_FOUND" ||
    lookupResult.statusCode === 404
  ) {
    return new CollectionRunSourceGroupNotFoundError(sourceGroupId);
  }

  return new SourceGroupLookupFailedError(
    sourceGroupId,
    lookupResult.errorMessage,
    {
      causeCode: lookupResult.errorCode,
      ...(lookupResult.statusCode !== undefined
        ? { statusCode: lookupResult.statusCode }
        : {}),
    },
  );
}

export type { SourceGroupLookupSourceGroup };
