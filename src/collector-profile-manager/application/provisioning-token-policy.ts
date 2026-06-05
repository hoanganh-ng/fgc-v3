import {
  InvalidProvisioningTokenError,
  ProvisioningTokenConsumedError,
  ProvisioningTokenExpiredError,
} from "./application-errors";
import type { CollectorProfile } from "../domain";

export function assertUsableProvisioningToken(
  profile: CollectorProfile,
  token: string,
  now: Date,
): void {
  if (token.trim() === "") {
    throw new InvalidProvisioningTokenError();
  }

  const state = profile.provisioningToken;

  if (state.status === "CONSUMED") {
    throw new ProvisioningTokenConsumedError(profile.identity.id);
  }

  if (state.status === "EXPIRED") {
    throw new ProvisioningTokenExpiredError(profile.identity.id);
  }

  if (
    state.status !== "ISSUED" ||
    state.tokenHash === null ||
    state.tokenHash !== token ||
    state.issuedAt === null ||
    state.expiresAt === null
  ) {
    throw new InvalidProvisioningTokenError();
  }

  if (Date.parse(state.expiresAt) <= now.getTime()) {
    throw new ProvisioningTokenExpiredError(profile.identity.id);
  }
}

export function toIsoDateTime(date: Date): string {
  return date.toISOString();
}
