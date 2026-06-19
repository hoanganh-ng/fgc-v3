import { ZodError } from "zod";
import {
  CollectorProfileApplicationError,
  type CollectorProfileApplicationErrorCode,
  InvalidProfileConfigurationError,
  InvalidProfileQueryError,
  NoEligibleProfileAvailableError,
  ProfileNotCheckoutEligibleError,
} from "../../../collector-profile-manager/application";
import {
  CollectorProfileDomainError,
  type CollectorProfileDomainErrorCode,
} from "../../../collector-profile-manager/domain";
import {
  ContentManagerApplicationError,
  ContentValidationError,
  type ContentManagerApplicationErrorCode,
} from "../../../content-manager/application";
import {
  ContentManagerDomainError,
  type ContentManagerDomainErrorCode,
} from "../../../content-manager/domain";
import {
  CollectionRunValidationError,
  AccountExerciseRunValidationError,
  ProfileHomeFeedCollectionRunValidationError,
  ProfileSourceAccessCheckRunValidationError,
  CollectionScheduleValidationError,
  CollectorRuntimeApplicationError,
  SourceGroupLookupFailedError,
  ProfileReferenceLookupFailedError,
  type CollectorRuntimeApplicationErrorCode,
} from "../../../collector-runtime/application";
import {
  CollectorRuntimeDomainError,
  type CollectorRuntimeDomainErrorCode,
} from "../../../collector-runtime/domain";
import { HttpRequestValidationError } from "../schemas/http-validation";

export interface HttpErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly issues?: readonly {
      readonly path: string;
      readonly message: string;
    }[];
    readonly reasons?: readonly unknown[];
  };
}

export interface HttpErrorMapping {
  readonly statusCode: number;
  readonly body: HttpErrorBody;
}

export function mapErrorToHttpResponse(error: unknown): HttpErrorMapping {
  if (error instanceof HttpRequestValidationError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          issues: error.issues,
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          issues: error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            message: issue.message,
          })),
        },
      },
    };
  }

  if (isFastifyValidationError(error)) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
        },
      },
    };
  }

  if (error instanceof InvalidProfileConfigurationError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
    };
  }

  if (error instanceof InvalidProfileQueryError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
    };
  }

  if (error instanceof ProfileNotCheckoutEligibleError) {
    return {
      statusCode: 409,
      body: {
        error: {
          code: error.code,
          message: error.message,
          reasons: error.reasons,
        },
      },
    };
  }

  if (error instanceof NoEligibleProfileAvailableError) {
    return {
      statusCode: 404,
      body: {
        error: {
          code: error.code,
          message: error.message,
          reasons: error.reasons,
        },
      },
    };
  }

  if (error instanceof ContentValidationError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
    };
  }

  if (
    error instanceof CollectionRunValidationError ||
    error instanceof AccountExerciseRunValidationError ||
    error instanceof ProfileHomeFeedCollectionRunValidationError ||
    error instanceof ProfileSourceAccessCheckRunValidationError
  ) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
    };
  }

  if (error instanceof CollectionScheduleValidationError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
    };
  }

  if (error instanceof CollectorProfileApplicationError) {
    return mapKnownError(
      error.code,
      applicationErrorStatus[error.code],
      error.message,
    );
  }

  if (error instanceof ContentManagerApplicationError) {
    return mapKnownError(
      error.code,
      contentApplicationErrorStatus[error.code],
      error.message,
    );
  }

  if (error instanceof CollectorRuntimeApplicationError) {
    if (error instanceof SourceGroupLookupFailedError) {
      const causeCodeRegex = /^[A-Z][A-Z0-9_]{0,63}$/;
      const validCauseCode =
        error.causeCode !== undefined && causeCodeRegex.test(error.causeCode)
          ? error.causeCode
          : undefined;

      return {
        statusCode: 502,
        body: {
          error: {
            code: "SOURCE_GROUP_LOOKUP_FAILED",
            message: "Content Manager source group lookup failed.",
            reasons: [
              ...(validCauseCode !== undefined ? [{ causeCode: validCauseCode }] : []),
              ...(error.statusCode !== undefined ? [{ statusCode: error.statusCode }] : []),
            ],
          },
        },
      };
    }

    if (error instanceof ProfileReferenceLookupFailedError) {
      const causeCodeRegex = /^[A-Z][A-Z0-9_]{0,63}$/;
      const validCauseCode =
        error.causeCode !== undefined && causeCodeRegex.test(error.causeCode)
          ? error.causeCode
          : undefined;

      return {
        statusCode: 502,
        body: {
          error: {
            code: "PROFILE_REFERENCE_LOOKUP_FAILED",
            message: "Profile Manager profile lookup failed.",
            reasons: [
              ...(validCauseCode !== undefined ? [{ causeCode: validCauseCode }] : []),
              ...(error.statusCode !== undefined ? [{ statusCode: error.statusCode }] : []),
            ],
          },
        },
      };
    }

    return mapKnownError(
      error.code,
      collectorRuntimeApplicationErrorStatus[error.code],
      error.message,
    );
  }

  if (error instanceof CollectorProfileDomainError) {
    return mapKnownError(
      error.code,
      domainErrorStatus[error.code],
      error.message,
    );
  }

  if (error instanceof ContentManagerDomainError) {
    return mapKnownError(
      error.code,
      contentDomainErrorStatus[error.code],
      error.message,
    );
  }

  if (error instanceof CollectorRuntimeDomainError) {
    return mapKnownError(
      error.code,
      collectorRuntimeDomainErrorStatus[error.code],
      error.message,
    );
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
  };
}

const applicationErrorStatus: Record<CollectorProfileApplicationErrorCode, number> = {
  PROFILE_NOT_FOUND: 404,
  PROFILE_ALREADY_EXISTS: 409,
  INVALID_PROFILE_CONFIGURATION: 400,
  INVALID_PROFILE_QUERY: 400,
  INVALID_PROVISIONING_TOKEN: 401,
  PROVISIONING_TOKEN_EXPIRED: 401,
  PROVISIONING_TOKEN_CONSUMED: 401,
  INVALID_APPLICATION_OPERATION: 409,
  NO_ELIGIBLE_PROFILE_AVAILABLE: 404,
  PROFILE_NOT_CHECKOUT_ELIGIBLE: 409,
  PROFILE_LEASE_NOT_FOUND: 404,
  PROFILE_LEASE_ALREADY_CLOSED: 409,
  PROFILE_LEASE_STATE_CONFLICT: 409,
  PROFILE_SOURCE_ACCESS_NOT_FOUND: 404,
  INVALID_PROFILE_SOURCE_ACCESS: 400,
  SOURCE_GROUP_NOT_FOUND: 404,
};

const domainErrorStatus: Record<CollectorProfileDomainErrorCode, number> = {
  INVALID_PROFILE_STATE_TRANSITION: 409,
  INVALID_PROFILE_ACCOUNT_STAGE_TRANSITION: 409,
  MISSING_REQUIRED_PROFILE_CONFIGURATION: 400,
  INVALID_PROVISIONING_TOKEN_STATE: 400,
  IMMUTABLE_FINGERPRINT_VIOLATION: 409,
  INVALID_PROVISIONING_RECOVERY_TRANSITION: 409,
};

const contentApplicationErrorStatus: Record<
  ContentManagerApplicationErrorCode,
  number
> = {
  CONTENT_CATEGORY_ALREADY_EXISTS: 409,
  CONTENT_CATEGORY_NOT_FOUND: 404,
  SOURCE_GROUP_ALREADY_EXISTS: 409,
  SOURCE_GROUP_NOT_FOUND: 404,
  SOURCE_GROUP_ENTRY_ROUTE_NOT_FOUND: 404,
  CONTENT_ITEM_NOT_FOUND: 404,
  INVALID_CONTENT_STATUS_TRANSITION: 409,
  CONTENT_VALIDATION_ERROR: 400,
  SOURCE_PUBLISHER_NOT_FOUND: 404,
};

const collectorRuntimeApplicationErrorStatus: Record<
  CollectorRuntimeApplicationErrorCode,
  number
> = {
  COLLECTION_RUN_NOT_FOUND: 404,
  ACCOUNT_EXERCISE_RUN_NOT_FOUND: 404,
  ACCOUNT_EXERCISE_RUN_LEASE_CONFLICT: 409,
  INVALID_COLLECTION_RUN_STATUS_TRANSITION: 409,
  INVALID_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITION: 409,
  COLLECTION_RUN_VALIDATION_ERROR: 400,
  ACCOUNT_EXERCISE_RUN_VALIDATION_ERROR: 400,
  ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_FOUND: 404,
  ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_ACTIVE: 409,
  ACCOUNT_EXERCISE_SOURCE_GROUP_PLATFORM_UNSUPPORTED: 409,
  CATEGORY_BROWSE_ENTRY_ROUTE_NOT_FOUND: 404,
  CATEGORY_BROWSE_ENTRY_ROUTE_NOT_ELIGIBLE: 409,
  COLLECTION_RUN_SOURCE_GROUP_NOT_FOUND: 404,
  COLLECTION_RUN_SOURCE_GROUP_NOT_ACTIVE: 409,
  COLLECTION_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED: 409,
  SOURCE_GROUP_LOOKUP_FAILED: 502,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_NOT_FOUND: 404,
  INVALID_PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUS_TRANSITION: 409,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_VALIDATION_ERROR: 400,
  PROFILE_REFERENCE_LOOKUP_FAILED: 502,
  PROFILE_NOT_FOUND: 404,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_CONFLICT: 409,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_NOT_FOUND: 404,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_NOT_ACTIVE: 409,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_SOURCE_GROUP_PLATFORM_UNSUPPORTED: 409,
  PROFILE_HOME_FEED_COLLECTION_RUN_NOT_FOUND: 404,
  INVALID_PROFILE_HOME_FEED_COLLECTION_RUN_STATUS_TRANSITION: 409,
  PROFILE_HOME_FEED_COLLECTION_RUN_VALIDATION_ERROR: 400,
  PROFILE_HOME_FEED_COLLECTION_RUN_CONFLICT: 409,
  // Collection schedule errors are mapped here for the Sprint 061
  // /collector/collection-schedules routes. The validation error is also
  // handled explicitly above so the structured issues list reaches the
  // client.
  COLLECTION_SCHEDULE_VALIDATION_ERROR: 400,
  COLLECTION_SCHEDULE_NOT_FOUND: 404,
  COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_FOUND: 404,
  COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_ACTIVE: 409,
  COLLECTION_SCHEDULE_SOURCE_GROUP_PLATFORM_UNSUPPORTED: 409,
};

const contentDomainErrorStatus: Record<ContentManagerDomainErrorCode, number> = {
  INVALID_CONTENT_STATUS_TRANSITION: 409,
  SOURCE_PUBLISHER_IDENTITY_MISMATCH: 409,
  CONTENT_COLLECTION_PROVENANCE_CONFLICT: 409,
};

const collectorRuntimeDomainErrorStatus: Record<
  CollectorRuntimeDomainErrorCode,
  number
> = {
  INVALID_COLLECTION_RUN_STATUS_TRANSITION: 409,
  INVALID_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITION: 409,
  INVALID_PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUS_TRANSITION: 409,
  INVALID_PROFILE_HOME_FEED_COLLECTION_RUN_STATUS_TRANSITION: 409,
};

function mapKnownError(
  code: string,
  statusCode: number,
  message: string,
): HttpErrorMapping {
  return {
    statusCode,
    body: {
      error: {
        code,
        message,
      },
    },
  };
}

function isFastifyValidationError(
  error: unknown,
): error is { readonly validation: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error
  );
}
