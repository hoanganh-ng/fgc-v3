import { describe, expect, it } from "vitest";
import {
  createPendingCollectorProfile,
  evaluateCheckoutEligibility,
  markCollectorProfileSessionIngested,
  type CollectorProfile,
  type NetworkContext,
} from "./index";

// ---------------------------------------------------------------------------
// Fixture: a READY + COLLECTION_READY profile with HEALTHY auth and a
// configured PROXY network context. UNCONFIGURED / DIRECT cases mutate mode
// explicitly — no eligibility bypass is required for supported DIRECT.
// ---------------------------------------------------------------------------

const createdAt = "2026-06-21T10:00:00.000Z";
const sessionCapturedAt = "2026-06-21T10:05:00.000Z";
const tokenExpiry = "2026-06-21T11:05:00.000Z";

function createReadyCollectionReadyProfile(
  networkContext: NetworkContext = {
    mode: "PROXY",
    proxy: {
      protocol: "HTTPS",
      host: "proxy.example.test",
      port: 443,
      credentials: { username: "user", password: "pass" },
    },
    killswitch: { enabled: true, failClosed: true },
  },
): CollectorProfile {
  const base = createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt,
    networkContext,
    hardwareFingerprint: {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      languages: ["en-US"],
      hardwareConcurrency: 4,
    },
    behavioralPersona: {
      scrollStyle: "STEADY",
      microDelayMs: { min: 0, max: 0 },
      reverseScrollProbability: 0,
      dwellTimeMs: { min: 1000, max: 3000 },
    },
    temporalRoutine: {
      timezone: "UTC",
      chronotype: "MORNING",
      activeWindows: [
        { days: [1, 2, 3, 4, 5, 6, 0], startsAt: "00:00", endsAt: "23:59" },
      ],
      cooldownMinutes: 30,
    },
    safetyThresholds: {
      maxSessionsPerDay: 3,
      maxSessionDurationMinutes: 45,
      maxMacroActionsPerDay: 100,
      minCooldownMinutes: 30,
    },
    contentAffinities: {
      primaryTopics: [{ topic: "news", weight: 1 }],
      secondaryTopics: [],
      interactionWeights: { view: 1, like: 0, save: 0, comment: 0, share: 0 },
    },
  });

  const ingested = markCollectorProfileSessionIngested(
    {
      ...base,
      identity: {
        ...base.identity,
        status: "PENDING_LOGIN",
        updatedAt: sessionCapturedAt,
      },
    },
    sessionCapturedAt,
    {
      cookies: [
        {
          name: "session",
          value: "abc123",
          domain: "example.test",
          path: "/",
          expiresAt: null,
          httpOnly: true,
          secure: true,
        },
      ],
      localStorage: [],
      sessionExpiresAt: tokenExpiry,
    },
    {
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: sessionCapturedAt,
      expiresAt: tokenExpiry,
      consumedAt: sessionCapturedAt,
    },
  );

  return {
    ...ingested,
    identity: {
      ...ingested.identity,
      status: "READY",
      accountStage: "COLLECTION_READY",
      updatedAt: sessionCapturedAt,
    },
  };
}

function withUnconfiguredNetwork(
  profile: CollectorProfile,
): CollectorProfile {
  return {
    ...profile,
    networkContext: {
      mode: "UNCONFIGURED",
      proxy: null,
      killswitch: profile.networkContext.killswitch,
    },
  };
}

function withDirectNetwork(profile: CollectorProfile): CollectorProfile {
  return {
    ...profile,
    networkContext: {
      mode: "DIRECT",
      proxy: null,
      killswitch: { enabled: false, failClosed: false },
    },
  };
}

// ---------------------------------------------------------------------------
// Network-mode checkout eligibility (Sprint 076A)
// UNCONFIGURED → NETWORK_CONTEXT_MISSING; DIRECT and PROXY accept
// COLLECTION and HOME_FEED_COLLECTION through the normal eligibility path.
// ---------------------------------------------------------------------------

describe("evaluateCheckoutEligibility network mode", () => {
  const proxyProfile = createReadyCollectionReadyProfile();
  const checkoutNow = new Date("2026-06-21T10:30:00.000Z");

  it("rejects COLLECTION checkout when network mode is UNCONFIGURED", () => {
    const result = evaluateCheckoutEligibility(
      withUnconfiguredNetwork(proxyProfile),
      checkoutNow,
      { purpose: "COLLECTION" },
    );

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "NETWORK_CONTEXT_MISSING",
            message: "Profile requires a configured network context.",
          }),
        ]),
      );
    }
  });

  it("rejects HOME_FEED_COLLECTION checkout when network mode is UNCONFIGURED", () => {
    const result = evaluateCheckoutEligibility(
      withUnconfiguredNetwork(proxyProfile),
      checkoutNow,
      { purpose: "HOME_FEED_COLLECTION" },
    );

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "NETWORK_CONTEXT_MISSING",
            message: "Profile requires a configured network context.",
          }),
        ]),
      );
    }
  });

  it("rejects default-purpose checkout when network mode is UNCONFIGURED", () => {
    const result = evaluateCheckoutEligibility(
      withUnconfiguredNetwork(proxyProfile),
      checkoutNow,
    );

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "NETWORK_CONTEXT_MISSING",
          }),
        ]),
      );
    }
  });

  it("accepts COLLECTION checkout when network mode is DIRECT", () => {
    const result = evaluateCheckoutEligibility(
      withDirectNetwork(proxyProfile),
      checkoutNow,
      { purpose: "COLLECTION" },
    );

    expect(result.eligible).toBe(true);
  });

  it("accepts HOME_FEED_COLLECTION checkout when network mode is DIRECT", () => {
    const result = evaluateCheckoutEligibility(
      withDirectNetwork(proxyProfile),
      checkoutNow,
      { purpose: "HOME_FEED_COLLECTION" },
    );

    expect(result.eligible).toBe(true);
  });

  it("accepts COLLECTION checkout when network mode is PROXY", () => {
    const result = evaluateCheckoutEligibility(proxyProfile, checkoutNow, {
      purpose: "COLLECTION",
    });

    expect(result.eligible).toBe(true);
  });

  it("accepts HOME_FEED_COLLECTION checkout when network mode is PROXY", () => {
    const result = evaluateCheckoutEligibility(proxyProfile, checkoutNow, {
      purpose: "HOME_FEED_COLLECTION",
    });

    expect(result.eligible).toBe(true);
  });
});
