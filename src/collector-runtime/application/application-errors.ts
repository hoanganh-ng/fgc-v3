import type {
  AccountExerciseRunStatus,
  CollectionRunStatus,
  ValidationIssue,
} from "../domain";

export type CollectorRuntimeApplicationErrorCode =
  | "COLLECTION_RUN_NOT_FOUND"
  | "ACCOUNT_EXERCISE_RUN_NOT_FOUND"
  | "INVALID_COLLECTION_RUN_STATUS_TRANSITION"
  | "INVALID_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITION"
  | "COLLECTION_RUN_VALIDATION_ERROR"
  | "ACCOUNT_EXERCISE_RUN_VALIDATION_ERROR"
  | "COLLECTION_RUN_SOURCE_GROUP_NOT_FOUND"
  | "COLLECTION_RUN_SOURCE_GROUP_NOT_ACTIVE"
  | "COLLECTION_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED"
  | "SOURCE_GROUP_LOOKUP_FAILED";

export abstract class CollectorRuntimeApplicationError extends Error {
  public readonly code: CollectorRuntimeApplicationErrorCode;

  protected constructor(
    code: CollectorRuntimeApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CollectionRunNotFoundError extends CollectorRuntimeApplicationError {
  public readonly collectionRunId: string;

  public constructor(collectionRunId: string) {
    super(
      "COLLECTION_RUN_NOT_FOUND",
      `Collection run not found: ${collectionRunId}.`,
    );
    this.collectionRunId = collectionRunId;
  }
}

export class AccountExerciseRunNotFoundError extends CollectorRuntimeApplicationError {
  public readonly accountExerciseRunId: string;

  public constructor(accountExerciseRunId: string) {
    super(
      "ACCOUNT_EXERCISE_RUN_NOT_FOUND",
      `Account exercise run not found: ${accountExerciseRunId}.`,
    );
    this.accountExerciseRunId = accountExerciseRunId;
  }
}

export class InvalidCollectionRunStatusTransitionError extends CollectorRuntimeApplicationError {
  public readonly from: CollectionRunStatus;
  public readonly to: CollectionRunStatus;

  public constructor(from: CollectionRunStatus, to: CollectionRunStatus) {
    super(
      "INVALID_COLLECTION_RUN_STATUS_TRANSITION",
      `Invalid collection run status transition: ${from} -> ${to}.`,
    );
    this.from = from;
    this.to = to;
  }
}

export class InvalidAccountExerciseRunStatusTransitionError extends CollectorRuntimeApplicationError {
  public readonly from: AccountExerciseRunStatus;
  public readonly to: AccountExerciseRunStatus;

  public constructor(
    from: AccountExerciseRunStatus,
    to: AccountExerciseRunStatus,
  ) {
    super(
      "INVALID_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITION",
      `Invalid account exercise run status transition: ${from} -> ${to}.`,
    );
    this.from = from;
    this.to = to;
  }
}

export class CollectionRunValidationError extends CollectorRuntimeApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "COLLECTION_RUN_VALIDATION_ERROR",
      "Collection run input is invalid.",
    );
    this.issues = issues;
  }
}

export class AccountExerciseRunValidationError extends CollectorRuntimeApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "ACCOUNT_EXERCISE_RUN_VALIDATION_ERROR",
      "Account exercise run input is invalid.",
    );
    this.issues = issues;
  }
}

export class CollectionRunSourceGroupNotFoundError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super(
      "COLLECTION_RUN_SOURCE_GROUP_NOT_FOUND",
      `Source group not found for collection run request: ${sourceGroupId}.`,
    );
    this.sourceGroupId = sourceGroupId;
  }
}

export class CollectionRunSourceGroupNotActiveError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly status: string;

  public constructor(sourceGroupId: string, status: string) {
    super(
      "COLLECTION_RUN_SOURCE_GROUP_NOT_ACTIVE",
      `Source group ${sourceGroupId} must be ACTIVE before collection.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.status = status;
  }
}

export class CollectionRunSourceGroupPlatformUnsupportedError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly platform: string;

  public constructor(sourceGroupId: string, platform: string) {
    super(
      "COLLECTION_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED",
      `Source group ${sourceGroupId} must use platform FACEBOOK.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.platform = platform;
  }
}

export class SourceGroupLookupFailedError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly causeCode?: string;
  public readonly statusCode?: number;

  public constructor(
    sourceGroupId: string,
    message: string,
    context: {
      readonly causeCode?: string;
      readonly statusCode?: number;
    } = {},
  ) {
    super("SOURCE_GROUP_LOOKUP_FAILED", message);
    this.sourceGroupId = sourceGroupId;
    if (context.causeCode !== undefined) {
      this.causeCode = context.causeCode;
    }
    if (context.statusCode !== undefined) {
      this.statusCode = context.statusCode;
    }
  }
}
