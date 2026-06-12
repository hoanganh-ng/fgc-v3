import type {
  CheckoutIneligibilityReason,
  ProfileId,
  ProfileLeaseId,
  ProfileLeaseStatus,
  ProfileSourceAccessSourceGroupId,
  ValidationIssue,
} from "../domain";

export type CollectorProfileApplicationErrorCode =
  | "PROFILE_NOT_FOUND"
  | "PROFILE_ALREADY_EXISTS"
  | "INVALID_PROFILE_CONFIGURATION"
  | "INVALID_PROFILE_QUERY"
  | "INVALID_PROVISIONING_TOKEN"
  | "PROVISIONING_TOKEN_EXPIRED"
  | "PROVISIONING_TOKEN_CONSUMED"
  | "INVALID_APPLICATION_OPERATION"
  | "NO_ELIGIBLE_PROFILE_AVAILABLE"
  | "PROFILE_NOT_CHECKOUT_ELIGIBLE"
  | "PROFILE_LEASE_NOT_FOUND"
  | "PROFILE_LEASE_ALREADY_CLOSED"
  | "PROFILE_LEASE_STATE_CONFLICT"
  | "PROFILE_SOURCE_ACCESS_NOT_FOUND"
  | "INVALID_PROFILE_SOURCE_ACCESS";

export abstract class CollectorProfileApplicationError extends Error {
  public readonly code: CollectorProfileApplicationErrorCode;

  protected constructor(
    code: CollectorProfileApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProfileNotFoundError extends CollectorProfileApplicationError {
  public readonly profileId: string;

  public constructor(profileId: string) {
    super("PROFILE_NOT_FOUND", `Collector profile not found: ${profileId}.`);
    this.profileId = profileId;
  }
}

export class ProfileAlreadyExistsError extends CollectorProfileApplicationError {
  public readonly field: string;
  public readonly value: string;

  public constructor(field: string, value: string) {
    super(
      "PROFILE_ALREADY_EXISTS",
      `Collector profile already exists for ${field}: ${value}.`,
    );
    this.field = field;
    this.value = value;
  }
}

export class InvalidProfileConfigurationError extends CollectorProfileApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "INVALID_PROFILE_CONFIGURATION",
      "Collector profile configuration is invalid.",
    );
    this.issues = issues;
  }
}

export class InvalidProfileQueryError extends CollectorProfileApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super("INVALID_PROFILE_QUERY", "Collector profile query is invalid.");
    this.issues = issues;
  }
}

export class InvalidProvisioningTokenError extends CollectorProfileApplicationError {
  public constructor() {
    super("INVALID_PROVISIONING_TOKEN", "Provisioning token is invalid.");
  }
}

export class ProvisioningTokenExpiredError extends CollectorProfileApplicationError {
  public readonly profileId: string | undefined;

  public constructor(profileId?: string) {
    const suffix = profileId ? ` for profile ${profileId}` : "";
    super(
      "PROVISIONING_TOKEN_EXPIRED",
      `Provisioning token is expired${suffix}.`,
    );
    this.profileId = profileId;
  }
}

export class ProvisioningTokenConsumedError extends CollectorProfileApplicationError {
  public readonly profileId: string | undefined;

  public constructor(profileId?: string) {
    const suffix = profileId ? ` for profile ${profileId}` : "";
    super(
      "PROVISIONING_TOKEN_CONSUMED",
      `Provisioning token is already consumed${suffix}.`,
    );
    this.profileId = profileId;
  }
}

export class InvalidApplicationOperationError extends CollectorProfileApplicationError {
  public constructor(message: string) {
    super("INVALID_APPLICATION_OPERATION", message);
  }
}

export class NoEligibleProfileAvailableError extends CollectorProfileApplicationError {
  public readonly reasons: readonly CheckoutIneligibilityReason[];

  public constructor(reasons: readonly CheckoutIneligibilityReason[] = []) {
    super(
      "NO_ELIGIBLE_PROFILE_AVAILABLE",
      "No checkout-eligible collector profile is available.",
    );
    this.reasons = reasons;
  }
}

export class ProfileNotCheckoutEligibleError extends CollectorProfileApplicationError {
  public readonly profileId: ProfileId;
  public readonly reasons: readonly CheckoutIneligibilityReason[];

  public constructor(
    profileId: ProfileId,
    reasons: readonly CheckoutIneligibilityReason[],
  ) {
    super(
      "PROFILE_NOT_CHECKOUT_ELIGIBLE",
      `Collector profile is not checkout eligible: ${profileId}.`,
    );
    this.profileId = profileId;
    this.reasons = reasons;
  }
}

export class ProfileLeaseNotFoundError extends CollectorProfileApplicationError {
  public readonly leaseId: ProfileLeaseId;

  public constructor(leaseId: ProfileLeaseId) {
    super("PROFILE_LEASE_NOT_FOUND", `Profile lease not found: ${leaseId}.`);
    this.leaseId = leaseId;
  }
}

export class ProfileLeaseAlreadyClosedError extends CollectorProfileApplicationError {
  public readonly leaseId: ProfileLeaseId;
  public readonly status: ProfileLeaseStatus;

  public constructor(leaseId: ProfileLeaseId, status: ProfileLeaseStatus) {
    super(
      "PROFILE_LEASE_ALREADY_CLOSED",
      `Profile lease ${leaseId} is already ${status}.`,
    );
    this.leaseId = leaseId;
    this.status = status;
  }
}

export class ProfileLeaseStateConflictError extends CollectorProfileApplicationError {
  public constructor(message: string) {
    super("PROFILE_LEASE_STATE_CONFLICT", message);
  }
}

export class ProfileSourceAccessNotFoundError extends CollectorProfileApplicationError {
  public readonly profileId: ProfileId;
  public readonly sourceGroupId: ProfileSourceAccessSourceGroupId;

  public constructor(
    profileId: ProfileId,
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ) {
    super(
      "PROFILE_SOURCE_ACCESS_NOT_FOUND",
      `Profile-source access record not found: ${profileId}/${sourceGroupId}.`,
    );
    this.profileId = profileId;
    this.sourceGroupId = sourceGroupId;
  }
}

export class InvalidProfileSourceAccessError extends CollectorProfileApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "INVALID_PROFILE_SOURCE_ACCESS",
      "Profile-source access record is invalid.",
    );
    this.issues = issues;
  }
}
