import type { ProfileStatus } from "./profile-status";

export type CollectorProfileDomainErrorCode =
  | "INVALID_PROFILE_STATE_TRANSITION"
  | "MISSING_REQUIRED_PROFILE_CONFIGURATION"
  | "INVALID_PROVISIONING_TOKEN_STATE"
  | "IMMUTABLE_FINGERPRINT_VIOLATION";

export abstract class CollectorProfileDomainError extends Error {
  public readonly code: CollectorProfileDomainErrorCode;

  protected constructor(code: CollectorProfileDomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidProfileStateTransitionError extends CollectorProfileDomainError {
  public readonly from: ProfileStatus;
  public readonly to: ProfileStatus;

  public constructor(from: ProfileStatus, to: ProfileStatus) {
    super(
      "INVALID_PROFILE_STATE_TRANSITION",
      `Invalid profile state transition: ${from} -> ${to}.`,
    );
    this.from = from;
    this.to = to;
  }
}

export class MissingRequiredProfileConfigurationError extends CollectorProfileDomainError {
  public readonly missingFields: readonly string[];

  public constructor(missingFields: readonly string[]) {
    const suffix =
      missingFields.length > 0 ? `: ${missingFields.join(", ")}.` : ".";
    super(
      "MISSING_REQUIRED_PROFILE_CONFIGURATION",
      `Missing required profile configuration${suffix}`,
    );
    this.missingFields = missingFields;
  }
}

export class InvalidProvisioningTokenStateError extends CollectorProfileDomainError {
  public readonly profileId: string | undefined;
  public readonly reason: string;

  public constructor(reason: string, profileId?: string) {
    const prefix = profileId
      ? `Invalid provisioning token state for profile ${profileId}`
      : "Invalid provisioning token state";

    super("INVALID_PROVISIONING_TOKEN_STATE", `${prefix}: ${reason}.`);
    this.profileId = profileId;
    this.reason = reason;
  }
}

export class ImmutableFingerprintViolationError extends CollectorProfileDomainError {
  public readonly profileId: string | undefined;

  public constructor(profileId?: string) {
    const suffix = profileId ? ` for profile ${profileId}` : "";
    super(
      "IMMUTABLE_FINGERPRINT_VIOLATION",
      `Hardware fingerprint is immutable once assigned${suffix}.`,
    );
    this.profileId = profileId;
  }
}
