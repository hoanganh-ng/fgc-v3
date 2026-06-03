import { describe, expect, it } from "vitest";
import { createProfileRequestSchema, profileReadSchema } from "../src/index.js";

describe("api contracts", () => {
  it("accepts a valid profile creation request", () => {
    expect(createProfileRequestSchema.parse({ displayName: "weekday-profile" })).toEqual({
      displayName: "weekday-profile"
    });
  });

  it("requires every pillar key on profile reads", () => {
    const profile = profileReadSchema.parse({
      id: "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
      status: "PENDING_CONFIG",
      version: 1,
      pillars: {
        identityMetadata: { displayName: "shell", tags: [] },
        networkContext: null,
        hardwareFingerprint: null,
        authenticationState: null,
        behavioralPersona: null,
        temporalRoutine: null,
        safetyThresholds: null,
        contentAffinities: null
      },
      provisioningTokenExpiresAt: null,
      nextAvailableWindowAt: null,
      activeLease: null,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    });

    expect(profile.pillars.hardwareFingerprint).toBeNull();
  });
});
