export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(message: string) {
    super("INVALID_STATE_TRANSITION", message);
  }
}

export class InvalidProvisioningTokenError extends DomainError {
  constructor(message = "Provisioning token is invalid or expired") {
    super("INVALID_PROVISIONING_TOKEN", message);
  }
}

export class FingerprintMutationError extends DomainError {
  constructor() {
    super("FINGERPRINT_MUTATION_BLOCKED", "Hardware fingerprint cannot be changed after assignment");
  }
}

export class CooldownViolationError extends DomainError {
  constructor(message: string) {
    super("COOLDOWN_VIOLATION", message);
  }
}

export class SafetyLimitViolationError extends DomainError {
  constructor(message: string) {
    super("SAFETY_LIMIT_VIOLATION", message);
  }
}

export class ConfigurationIncompleteError extends DomainError {
  constructor(message: string) {
    super("CONFIGURATION_INCOMPLETE", message);
  }
}

export class LeaseConflictError extends DomainError {
  constructor(message: string) {
    super("LEASE_CONFLICT", message);
  }
}

export class ProfileNotFoundError extends DomainError {
  constructor(profileId: string) {
    super("PROFILE_NOT_FOUND", `Profile ${profileId} was not found`);
  }
}

export class NoEligibleProfileError extends DomainError {
  constructor(message = "No ready profile is currently eligible for checkout") {
    super("NO_ELIGIBLE_PROFILE", message);
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(message = "Profile version changed while the operation was in progress") {
    super("CONCURRENCY_CONFLICT", message);
  }
}
