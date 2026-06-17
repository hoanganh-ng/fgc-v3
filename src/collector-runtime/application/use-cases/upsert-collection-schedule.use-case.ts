import {
  CollectionScheduleSourceGroupNotActiveError,
  CollectionScheduleSourceGroupNotFoundError,
  CollectionScheduleSourceGroupPlatformUnsupportedError,
  CollectionScheduleValidationError,
  SourceGroupLookupFailedError,
} from "../application-errors";
import {
  toCollectionScheduleIsoDateTime,
  validateCollectionScheduleForApplication,
  validateCollectionScheduleParametersForApplication,
} from "../collection-schedule-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionScheduleRepository } from "../ports/collection-schedule-repository.port";
import type {
  SourceGroupLookupPort,
  SourceGroupLookupResult,
} from "../ports/source-group-lookup.port";
import type {
  CollectionRunParameters,
  CollectionSchedule,
  ValidationIssue,
} from "../../domain";

export interface UpsertCollectionScheduleUseCaseInput {
  readonly sourceGroupId: string;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
  readonly nextRunAt: string;
  readonly parameters: CollectionRunParameters;
}

export class UpsertCollectionScheduleUseCase {
  public constructor(
    private readonly schedules: CollectionScheduleRepository,
    private readonly sourceGroups: SourceGroupLookupPort,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpsertCollectionScheduleUseCaseInput,
  ): Promise<CollectionSchedule> {
    const sourceGroupId = validateSourceGroupId(input.sourceGroupId);
    const intervalMinutes = validateIntervalMinutes(input.intervalMinutes);
    const nextRunAt = validateNextRunAt(input.nextRunAt);
    const parameters = validateCollectionScheduleParametersForApplication(
      input.parameters,
    );

    await this.validateSourceGroup(sourceGroupId, input.enabled);

    const now = toCollectionScheduleIsoDateTime(this.clock.now());
    const existing = await this.schedules.findBySourceGroupId(sourceGroupId);

    const schedule: CollectionSchedule = {
      sourceGroupId,
      enabled: input.enabled,
      intervalMinutes,
      nextRunAt,
      parameters,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const validatedSchedule = validateCollectionScheduleForApplication(schedule);

    await this.schedules.save(validatedSchedule);

    return validatedSchedule;
  }

  private async validateSourceGroup(
    sourceGroupId: string,
    enabled: boolean,
  ): Promise<void> {
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

    if (sourceGroup.platform !== "FACEBOOK") {
      throw new CollectionScheduleSourceGroupPlatformUnsupportedError(
        sourceGroupId,
        sourceGroup.platform,
      );
    }

    if (enabled && sourceGroup.status !== "ACTIVE") {
      throw new CollectionScheduleSourceGroupNotActiveError(
        sourceGroupId,
        sourceGroup.status,
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

function validateSourceGroupId(sourceGroupId: unknown): string {
  const issues: ValidationIssue[] = [];

  if (typeof sourceGroupId !== "string" || sourceGroupId.trim().length === 0) {
    issues.push({
      path: "sourceGroupId",
      message: "sourceGroupId must be a non-empty string.",
    });
  }

  if (issues.length > 0) {
    throw new CollectionScheduleValidationError(issues);
  }

  return sourceGroupId as string;
}

function validateIntervalMinutes(intervalMinutes: unknown): number {
  const issues: ValidationIssue[] = [];

  if (
    typeof intervalMinutes !== "number" ||
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes < 1 ||
    intervalMinutes > 10080
  ) {
    issues.push({
      path: "intervalMinutes",
      message: "intervalMinutes must be an integer between 1 and 10080.",
    });
  }

  if (issues.length > 0) {
    throw new CollectionScheduleValidationError(issues);
  }

  return intervalMinutes as number;
}

function validateNextRunAt(nextRunAt: unknown): string {
  const issues: ValidationIssue[] = [];

  if (typeof nextRunAt !== "string" || Number.isNaN(Date.parse(nextRunAt))) {
    issues.push({
      path: "nextRunAt",
      message: "nextRunAt must be a valid ISO-8601 datetime with offset.",
    });
  }

  if (issues.length > 0) {
    throw new CollectionScheduleValidationError(issues);
  }

  return nextRunAt as string;
}

function toSourceGroupLookupError(
  sourceGroupId: string,
  lookupResult: Extract<SourceGroupLookupResult, { readonly ok: false }>,
): Error {
  if (
    lookupResult.errorCode === "SOURCE_GROUP_NOT_FOUND" ||
    lookupResult.statusCode === 404
  ) {
    return new CollectionScheduleSourceGroupNotFoundError(sourceGroupId);
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
