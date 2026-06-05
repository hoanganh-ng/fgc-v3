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
import { HttpRequestValidationError } from "../schemas/collector-profile-manager.http-schemas";

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

  if (error instanceof CollectorProfileApplicationError) {
    return mapKnownError(
      error.code,
      applicationErrorStatus[error.code],
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
};

const domainErrorStatus: Record<CollectorProfileDomainErrorCode, number> = {
  INVALID_PROFILE_STATE_TRANSITION: 409,
  MISSING_REQUIRED_PROFILE_CONFIGURATION: 400,
  INVALID_PROVISIONING_TOKEN_STATE: 400,
  IMMUTABLE_FINGERPRINT_VIOLATION: 409,
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
