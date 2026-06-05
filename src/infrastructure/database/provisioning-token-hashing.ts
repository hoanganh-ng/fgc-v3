import { createHash } from "node:crypto";

const HASH_PREFIX = "sha256:";
const SHA256_HEX_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function hashProvisioningToken(token: string): string {
  return `${HASH_PREFIX}${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function isPersistedProvisioningTokenHash(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}

export function toPersistedProvisioningTokenHash(
  tokenOrHash: string | null,
): string | null {
  if (tokenOrHash === null) {
    return null;
  }

  if (isPersistedProvisioningTokenHash(tokenOrHash)) {
    return tokenOrHash;
  }

  return hashProvisioningToken(tokenOrHash);
}
