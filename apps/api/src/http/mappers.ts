import type { ProfileRead } from "@dtpm/contracts";
import type { ProfileAggregate } from "@dtpm/core";

export function toProfileRead(profile: ProfileAggregate): ProfileRead {
  return {
    id: profile.id,
    status: profile.status,
    version: profile.version,
    pillars: {
      ...profile.pillars,
      authenticationState: profile.pillars.authenticationState === null ? null : {
        ...profile.pillars.authenticationState,
        capturedAt: profile.pillars.authenticationState.capturedAt.toISOString()
      }
    },
    provisioningTokenExpiresAt: profile.provisioningTokenExpiresAt?.toISOString() ?? null,
    nextAvailableWindowAt: profile.nextAvailableWindowAt?.toISOString() ?? null,
    activeLease: profile.activeLease === null ? null : {
      ...profile.activeLease,
      expiresAt: profile.activeLease.expiresAt.toISOString()
    },
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}
