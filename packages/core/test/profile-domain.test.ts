import { describe, expect, it } from "vitest";
import {
  attachProvisioningToken,
  checkoutProfile,
  configureProfile,
  createProfile,
  FingerprintMutationError,
  ingestAuthenticationState,
  InvalidStateTransitionError,
  releaseProfileLease
} from "../src/index.js";
import type { ProfileConfigurationInput } from "../src/index.js";

const now = new Date("2026-06-01T10:00:00.000Z");

describe("profile domain", () => {
  it("creates a pending shell with all eight pillar keys", () => {
    const profile = createProfile({
      id: "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
      displayName: "shell",
      now
    });

    expect(profile.status).toBe("PENDING_CONFIG");
    expect(Object.keys(profile.pillars)).toEqual([
      "identityMetadata",
      "networkContext",
      "hardwareFingerprint",
      "authenticationState",
      "behavioralPersona",
      "temporalRoutine",
      "safetyThresholds",
      "contentAffinities"
    ]);
  });

  it("moves from pending config to pending login when configured", () => {
    const profile = createProfile({
      id: "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
      displayName: "shell",
      now
    });

    const configured = configureProfile(profile, configuration(), now);
    const withToken = attachProvisioningToken(configured, "hash", new Date("2026-06-01T10:30:00.000Z"), now);

    expect(withToken.status).toBe("PENDING_LOGIN");
    expect(withToken.provisioningTokenHash).toBe("hash");
  });

  it("blocks unexpected state transitions", () => {
    const profile = createProfile({
      id: "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
      displayName: "shell",
      now
    });

    expect(() => checkoutProfile(profile, {
      leaseId: "f0f313f1-8f48-4f08-8d68-8482b135f5db",
      leaseTtlMinutes: 30,
      now
    })).toThrow(InvalidStateTransitionError);
  });

  it("prevents hardware fingerprint mutation after assignment", () => {
    const profile = createProfile({
      id: "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
      displayName: "shell",
      now
    });
    const configured = configureProfile(profile, configuration(), now);
    const ready = ingestAuthenticationState(
      attachProvisioningToken(configured, "hash", new Date("2026-06-01T10:30:00.000Z"), now),
      "hash",
      { cookies: [], localStorage: [], capturedAt: now },
      now
    );

    expect(() => configureProfile(ready, {
      ...configuration(),
      hardwareFingerprint: {
        ...configuration().hardwareFingerprint,
        hardwareConcurrency: 16
      }
    }, now)).toThrow(FingerprintMutationError);
  });

  it("checks out and releases only inside an active temporal window", () => {
    const profile = createProfile({
      id: "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
      displayName: "shell",
      now
    });
    const configured = configureProfile(profile, configuration(), now);
    const ready = ingestAuthenticationState(
      attachProvisioningToken(configured, "hash", new Date("2026-06-01T10:30:00.000Z"), now),
      "hash",
      { cookies: [], localStorage: [], capturedAt: now },
      now
    );

    const lease = checkoutProfile(ready, {
      leaseId: "f0f313f1-8f48-4f08-8d68-8482b135f5db",
      requestedBy: "worker-a",
      leaseTtlMinutes: 30,
      now
    });
    const released = releaseProfileLease(lease.profile, lease.leaseId, 12, 3, now);

    expect(lease.profile.status).toBe("BUSY");
    expect(released.status).toBe("READY");
    expect(released.nextAvailableWindowAt?.toISOString()).toBe("2026-06-01T10:05:00.000Z");
  });
});

function configuration(): ProfileConfigurationInput {
  return {
    networkContext: {
      proxy: {
        host: "203.0.113.10",
        port: 8080
      },
      killswitchEnabled: true
    },
    hardwareFingerprint: {
      userAgent: "Mozilla/5.0",
      viewport: {
        width: 1366,
        height: 768
      },
      languageHeaders: ["en-US", "en"],
      hardwareConcurrency: 8
    },
    behavioralPersona: {
      scrollingStyle: "SMOOTH",
      microDelayMs: {
        min: 120,
        max: 900
      },
      reverseScrollProbability: 0.08
    },
    temporalRoutine: {
      timezone: "UTC",
      activeWindows: [
        {
          dayOfWeek: 1,
          start: "09:00",
          end: "17:00"
        }
      ],
      cooldownMinutes: 5
    },
    safetyThresholds: {
      maxSessionsPerDay: 3,
      maxSessionDurationMinutes: 45,
      maxMacroActionsPerDay: 100
    },
    contentAffinities: {
      primaryTopics: ["news"],
      secondaryTopics: ["technology"],
      interactionWeights: {
        like: 0.3,
        comment: 0.1
      }
    }
  };
}
