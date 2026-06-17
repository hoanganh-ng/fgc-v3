import type {
  AccountExerciseRunStatus,
  CollectionRunStatus,
  ProfileSourceAccessCheckRunStatus,
  ValidationIssue,
} from "../domain";

export type CollectorRuntimeApplicationErrorCode =
  | "COLLECTION_RUN_NOT_FOUND"
  | "ACCOUNT_EXERCISE_RUN_NOT_FOUND"
  | "ACCOUNT_EXERCISE_RUN_LEASE_CONFLICT"
  | "INVALID_COLLECTION_RUN_STATUS_TRANSITION"
  | "INVALID_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITION"
  | "COLLECTION_RUN_VALIDATION_ERROR"
  | "ACCOUNT_EXERCISE_RUN_VALIDATION_ERROR"
  | "ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_FOUND"
  | "ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_ACTIVE"
  | "ACCOUNT_EXERCISE_SOURCE_GROUP_PLATFORM_UNSUPPORTED"
  | "CATEGORY_BROWSE_ENTRY_ROUTE_NOT_FOUND"
  | "CATEGORY_BROWSE_ENTRY_ROUTE_NOT_ELIGIBLE"
  | "COLLECTION_RUN_SOURCE_GROUP_NOT_FOUND"
  | "COLLECTION_RUN_SOURCE_GROUP_NOT_ACTIVE"
  | "COLLECTION_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED"
  | "SOURCE_GROUP_LOOKUP_FAILED"
  | "PROFILE_SOURCE_ACCESS_CHECK_RUN_NOT_FOUND"
  | "INVALID_PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUS_TRANSITION"
  | "PROFILE_SOURCE_ACCESS_CHECK_RUN_VALIDATION_ERROR"
  | "PROFILE_REFERENCE_LOOKUP_FAILED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_SOURCE_ACCESS_CHECK_RUN_CONFLICT"
  | "PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_NOT_FOUND"
  | "PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_NOT_ACTIVE"
  | "PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED"
  | "COLLECTION_SCHEDULE_VALIDATION_ERROR"
  | "COLLECTION_SCHEDULE_NOT_FOUND"
  | "COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_FOUND"
  | "COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_ACTIVE"
  | "COLLECTION_SCHEDULE_SOURCE_GROUP_PLATFORM_UNSUPPORTED";

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

export class AccountExerciseRunLeaseConflictError extends CollectorRuntimeApplicationError {
  public readonly accountExerciseRunId: string;

  public constructor(accountExerciseRunId: string) {
    super(
      "ACCOUNT_EXERCISE_RUN_LEASE_CONFLICT",
      `Account exercise run already has a different lease: ${accountExerciseRunId}.`,
    );
    this.accountExerciseRunId = accountExerciseRunId;
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

export class AccountExerciseSourceGroupNotFoundError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super(
      "ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_FOUND",
      `Source group not found for account exercise request: ${sourceGroupId}.`,
    );
    this.sourceGroupId = sourceGroupId;
  }
}

export class AccountExerciseSourceGroupNotActiveError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly status: string;

  public constructor(sourceGroupId: string, status: string) {
    super(
      "ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_ACTIVE",
      `Source group ${sourceGroupId} must be ACTIVE before Category Browse exercise.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.status = status;
  }
}

export class AccountExerciseSourceGroupPlatformUnsupportedError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly platform: string;

  public constructor(sourceGroupId: string, platform: string) {
    super(
      "ACCOUNT_EXERCISE_SOURCE_GROUP_PLATFORM_UNSUPPORTED",
      `Source group ${sourceGroupId} must use platform FACEBOOK before Category Browse exercise.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.platform = platform;
  }
}

export class CategoryBrowseEntryRouteNotFoundError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly entryRouteId: string;

  public constructor(sourceGroupId: string, entryRouteId: string) {
    super(
      "CATEGORY_BROWSE_ENTRY_ROUTE_NOT_FOUND",
      `Category Browse entry route not found for source group ${sourceGroupId}: ${entryRouteId}.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.entryRouteId = entryRouteId;
  }
}

export class CategoryBrowseEntryRouteNotEligibleError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string, message: string) {
    super("CATEGORY_BROWSE_ENTRY_ROUTE_NOT_ELIGIBLE", message);
    this.sourceGroupId = sourceGroupId;
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

export class ProfileSourceAccessCheckRunNotFoundError extends CollectorRuntimeApplicationError {
  public readonly checkRunId: string;

  public constructor(checkRunId: string) {
    super(
      "PROFILE_SOURCE_ACCESS_CHECK_RUN_NOT_FOUND",
      `Profile-source access check run not found: ${checkRunId}.`,
    );
    this.checkRunId = checkRunId;
  }
}

export class ProfileSourceAccessCheckRunSourceGroupNotFoundError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super(
      "PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_NOT_FOUND",
      `Source group not found: ${sourceGroupId}`,
    );
    this.sourceGroupId = sourceGroupId;
  }
}

export class ProfileSourceAccessCheckRunSourceGroupNotActiveError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super(
      "PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_NOT_ACTIVE",
      `Source group is not active: ${sourceGroupId}`,
    );
    this.sourceGroupId = sourceGroupId;
  }
}

export class ProfileSourceAccessCheckRunSourceGroupPlatformUnsupportedError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly platform: string;

  public constructor(sourceGroupId: string, platform: string) {
    super(
      "PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED",
      `Source group platform is not supported: ${platform}`,
    );
    this.sourceGroupId = sourceGroupId;
    this.platform = platform;
  }
}

export class InvalidProfileSourceAccessCheckRunStatusTransitionError extends CollectorRuntimeApplicationError {
  public readonly from: ProfileSourceAccessCheckRunStatus;
  public readonly to: ProfileSourceAccessCheckRunStatus;

  public constructor(
    from: ProfileSourceAccessCheckRunStatus,
    to: ProfileSourceAccessCheckRunStatus,
  ) {
    super(
      "INVALID_PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUS_TRANSITION",
      `Invalid profile-source access check run status transition: ${from} -> ${to}.`,
    );
    this.from = from;
    this.to = to;
  }
}

export class ProfileSourceAccessCheckRunValidationError extends CollectorRuntimeApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "PROFILE_SOURCE_ACCESS_CHECK_RUN_VALIDATION_ERROR",
      "Profile-source access check run input is invalid.",
    );
    this.issues = issues;
  }
}

export class ProfileNotFoundError extends CollectorRuntimeApplicationError {
  public readonly profileId: string;

  public constructor(profileId: string) {
    super("PROFILE_NOT_FOUND", `Profile not found: ${profileId}.`);
    this.profileId = profileId;
  }
}

export class ProfileReferenceLookupFailedError extends CollectorRuntimeApplicationError {
  public readonly profileId: string;
  public readonly causeCode?: string;
  public readonly statusCode?: number;

  public constructor(
    profileId: string,
    message: string,
    context: {
      readonly causeCode?: string;
      readonly statusCode?: number;
    } = {},
  ) {
    super("PROFILE_REFERENCE_LOOKUP_FAILED", message);
    this.profileId = profileId;
    if (context.causeCode !== undefined) {
      this.causeCode = context.causeCode;
    }
    if (context.statusCode !== undefined) {
      this.statusCode = context.statusCode;
    }
  }
}

export class ProfileSourceAccessCheckRunConflictError extends CollectorRuntimeApplicationError {
  public readonly profileId: string;
  public readonly sourceGroupId: string;

  public constructor(profileId: string, sourceGroupId: string) {
    super(
      "PROFILE_SOURCE_ACCESS_CHECK_RUN_CONFLICT",
      `A check run is already queued or running for profile ${profileId} and source group ${sourceGroupId}.`,
    );
    this.profileId = profileId;
    this.sourceGroupId = sourceGroupId;
  }
}

export class CollectionScheduleValidationError extends CollectorRuntimeApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "COLLECTION_SCHEDULE_VALIDATION_ERROR",
      "Collection schedule input is invalid.",
    );
    this.issues = issues;
  }
}

export class CollectionScheduleNotFoundError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super(
      "COLLECTION_SCHEDULE_NOT_FOUND",
      `Collection schedule not found: ${sourceGroupId}.`,
    );
    this.sourceGroupId = sourceGroupId;
  }
}

export class CollectionScheduleSourceGroupNotFoundError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super(
      "COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_FOUND",
      `Source group not found for collection schedule: ${sourceGroupId}.`,
    );
    this.sourceGroupId = sourceGroupId;
  }
}

export class CollectionScheduleSourceGroupNotActiveError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly status: string;

  public constructor(sourceGroupId: string, status: string) {
    super(
      "COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_ACTIVE",
      `Source group ${sourceGroupId} must be ACTIVE to enable a collection schedule.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.status = status;
  }
}

export class CollectionScheduleSourceGroupPlatformUnsupportedError extends CollectorRuntimeApplicationError {
  public readonly sourceGroupId: string;
  public readonly platform: string;

  public constructor(sourceGroupId: string, platform: string) {
    super(
      "COLLECTION_SCHEDULE_SOURCE_GROUP_PLATFORM_UNSUPPORTED",
      `Source group ${sourceGroupId} must use platform FACEBOOK for a collection schedule.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.platform = platform;
  }
}
