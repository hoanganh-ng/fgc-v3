import { describe, expect, it } from "vitest";
import {
  hashProvisioningToken,
} from "../provisioning-token-hashing";
import {
  InvalidPersistedCollectorProfileError,
  toCollectorProfileDomain,
  toCollectorProfileRow,
} from "./collector-profile.mapper";
import { createPendingCollectorProfile } from "../../../collector-profile-manager/domain";
import type {
  AuthenticationState,
  BehavioralPersona,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  NetworkContext,
  SafetyThresholds,
  TemporalRoutine,
} from "../../../collector-profile-manager/domain";

const createdAt = "2026-01-05T18:00:00.000Z";

describe("collector profile database mapper", () => {
  it("maps domain profiles to rows and back while preserving all property groups", () => {
    const profile = createPersistableProfile();
    const row = toCollectorProfileRow(profile);
    const mappedProfile = toCollectorProfileDomain(row);

    expect(mappedProfile).toEqual(profile);
    expect(mappedProfile.identity).toEqual(profile.identity);
    expect(row.accountStage).toBe(profile.identity.accountStage);
    expect(mappedProfile.networkContext).toEqual(profile.networkContext);
    expect(mappedProfile.hardwareFingerprint).toEqual(
      profile.hardwareFingerprint,
    );
    expect(mappedProfile.authenticationState).toEqual(
      profile.authenticationState,
    );
    expect(mappedProfile.behavioralPersona).toEqual(profile.behavioralPersona);
    expect(mappedProfile.temporalRoutine).toEqual(profile.temporalRoutine);
    expect(mappedProfile.safetyThresholds).toEqual(profile.safetyThresholds);
    expect(mappedProfile.contentAffinities).toEqual(profile.contentAffinities);
  });

  it("rejects invalid JSONB profile data on read", () => {
    const row = {
      ...toCollectorProfileRow(createPersistableProfile()),
      networkContext: {
        proxy: null,
      },
    } as unknown as Parameters<typeof toCollectorProfileDomain>[0];

    expect(() => toCollectorProfileDomain(row)).toThrow(
      InvalidPersistedCollectorProfileError,
    );
  });

  it("rejects unknown persisted network modes", () => {
    const row = {
      ...toCollectorProfileRow(createPersistableProfile()),
      networkContext: {
        mode: "VPN",
        proxy: null,
        killswitch: { enabled: false, failClosed: false },
      },
    } as unknown as Parameters<typeof toCollectorProfileDomain>[0];

    expect(() => toCollectorProfileDomain(row)).toThrow(
      InvalidPersistedCollectorProfileError,
    );
  });

  it("rejects contradictory persisted DIRECT network contexts", () => {
    const row = {
      ...toCollectorProfileRow(createPersistableProfile()),
      networkContext: {
        mode: "DIRECT",
        proxy: {
          protocol: "HTTPS",
          host: "proxy.example.test",
          port: 443,
          credentials: null,
        },
        killswitch: { enabled: false, failClosed: false },
      },
    } as unknown as Parameters<typeof toCollectorProfileDomain>[0];

    expect(() => toCollectorProfileDomain(row)).toThrow(
      InvalidPersistedCollectorProfileError,
    );
  });

  it("rejects contradictory persisted PROXY network contexts", () => {
    const row = {
      ...toCollectorProfileRow(createPersistableProfile()),
      networkContext: {
        mode: "PROXY",
        proxy: null,
        killswitch: { enabled: true, failClosed: true },
      },
    } as unknown as Parameters<typeof toCollectorProfileDomain>[0];

    expect(() => toCollectorProfileDomain(row)).toThrow(
      InvalidPersistedCollectorProfileError,
    );
  });

  it("hashes provisioning tokens for persisted lookup and verifies lookup tokens deterministically", () => {
    const profile = createIssuedProvisioningProfile("provisioning-token-1");
    const row = toCollectorProfileRow(profile);

    expect(row.provisioningTokenHash).toBe(
      hashProvisioningToken("provisioning-token-1"),
    );
    expect(row.provisioningTokenHash).not.toBe("provisioning-token-1");
    expect(toCollectorProfileDomain(row).provisioningToken.tokenHash).toBe(
      hashProvisioningToken("provisioning-token-1"),
    );
    expect(
      toCollectorProfileDomain(row, {
        verifiedProvisioningToken: "provisioning-token-1",
      }).provisioningToken.tokenHash,
    ).toBe("provisioning-token-1");
  });
});

  it("maps authentication health fields to row and back", () => {
    const profile: CollectorProfile = {
      ...createPersistableProfile(),
      authenticationHealth: "HEALTHY",
      authenticationHealthUpdatedAt: createdAt,
    };
    const row = toCollectorProfileRow(profile);
    expect(row.authenticationHealth).toBe("HEALTHY");
    expect(row.authenticationHealthUpdatedAt).toBe(createdAt);

    const mapped = toCollectorProfileDomain(row);
    expect(mapped.authenticationHealth).toBe("HEALTHY");
    expect(mapped.authenticationHealthUpdatedAt).toBe(createdAt);
  });

  it("maps REAUTH_REQUIRED health round-trip", () => {
    const profile: CollectorProfile = {
      ...createPersistableProfile(),
      authenticationHealth: "REAUTH_REQUIRED",
      authenticationHealthUpdatedAt: createdAt,
    };
    const row = toCollectorProfileRow(profile);
    expect(row.authenticationHealth).toBe("REAUTH_REQUIRED");
    const mapped = toCollectorProfileDomain(row);
    expect(mapped.authenticationHealth).toBe("REAUTH_REQUIRED");
  });

  it("maps CHECKPOINT_REVIEW_REQUIRED health round-trip", () => {
    const profile: CollectorProfile = {
      ...createPersistableProfile(),
      authenticationHealth: "CHECKPOINT_REVIEW_REQUIRED",
      authenticationHealthUpdatedAt: createdAt,
    };
    const row = toCollectorProfileRow(profile);
    expect(row.authenticationHealth).toBe("CHECKPOINT_REVIEW_REQUIRED");
    const mapped = toCollectorProfileDomain(row);
    expect(mapped.authenticationHealth).toBe("CHECKPOINT_REVIEW_REQUIRED");
  });

  it("defaults null authentication_health row to NOT_PROVISIONED", () => {
    const row = {
      ...toCollectorProfileRow(createPersistableProfile()),
      authenticationHealth: null as any,
      authenticationHealthUpdatedAt: null as any,
    } as any;
    const mapped = toCollectorProfileDomain(row);
    expect(mapped.authenticationHealth).toBe("NOT_PROVISIONED");
  });

  it("falls back to updatedAt for authenticationHealthUpdatedAt when row value is null", () => {
    const profile = createPersistableProfile();
    const row = {
      ...toCollectorProfileRow(profile),
      authenticationHealthUpdatedAt: null as any,
    } as any;
    const mapped = toCollectorProfileDomain(row);
    expect(mapped.authenticationHealthUpdatedAt).toBe(createdAt);
  });



function createPersistableProfile(): CollectorProfile {
  const profile = createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt,
    networkContext: createNetworkContext(),
    hardwareFingerprint: createHardwareFingerprint(),
    behavioralPersona: createBehavioralPersona(),
    temporalRoutine: createTemporalRoutine(),
    safetyThresholds: createSafetyThresholds(),
    contentAffinities: createContentAffinities(),
  });

  return {
    ...profile,
    identity: {
      ...profile.identity,
      externalReference: "external-profile-1",
      labels: ["collector", "west-coast"],
    },
    authenticationState: createAuthenticationState(),
  };
}

function createIssuedProvisioningProfile(token: string): CollectorProfile {
  const profile = createPersistableProfile();

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: "PENDING_LOGIN",
      updatedAt: createdAt,
    },
    provisioningToken: {
      status: "ISSUED",
      tokenHash: token,
      issuedAt: createdAt,
      expiresAt: "2026-01-05T18:15:00.000Z",
      consumedAt: null,
    },
  };
}

function createNetworkContext(): NetworkContext {
  return {
    mode: "PROXY",
    proxy: {
      protocol: "HTTPS",
      host: "proxy.example.test",
      port: 443,
      credentials: {
        username: "collector",
        password: "secret",
      },
      countryCode: "US",
      region: "CA",
    },
    killswitch: {
      enabled: true,
      failClosed: true,
    },
  };
}

function createHardwareFingerprint(): HardwareFingerprint {
  return {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    viewport: {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
    },
    languages: ["en-US", "en"],
    hardwareConcurrency: 8,
    platform: "Linux x86_64",
    deviceMemoryGb: 8,
    timezone: "America/Los_Angeles",
  };
}

function createAuthenticationState(): AuthenticationState {
  return {
    cookies: [
      {
        name: "session",
        value: "abc123",
        domain: "example.test",
        path: "/",
        expiresAt: "2026-01-06T18:00:00.000Z",
        httpOnly: true,
        secure: true,
        sameSite: "LAX",
      },
    ],
    localStorage: [
      {
        origin: "https://example.test",
        key: "auth",
        value: "stored-value",
      },
    ],
    sessionCapturedAt: createdAt,
    sessionExpiresAt: "2026-01-06T18:00:00.000Z",
  };
}

function createBehavioralPersona(): BehavioralPersona {
  return {
    scrollStyle: "STEADY",
    microDelayMs: {
      min: 200,
      max: 1200,
    },
    reverseScrollProbability: 0.1,
    dwellTimeMs: {
      min: 2000,
      max: 8000,
    },
  };
}

function createTemporalRoutine(): TemporalRoutine {
  return {
    timezone: "America/Los_Angeles",
    chronotype: "MORNING",
    activeWindows: [
      {
        days: [1, 2, 3, 4, 5],
        startsAt: "09:00",
        endsAt: "17:00",
      },
    ],
    cooldownMinutes: 30,
  };
}

function createSafetyThresholds(): SafetyThresholds {
  return {
    maxSessionsPerDay: 3,
    maxSessionDurationMinutes: 45,
    maxMacroActionsPerDay: 150,
    minCooldownMinutes: 30,
  };
}

function createContentAffinities(): ContentAffinities {
  return {
    primaryTopics: [
      {
        topic: "travel",
        weight: 1,
      },
    ],
    secondaryTopics: [
      {
        topic: "food",
        weight: 0.5,
      },
    ],
    interactionWeights: {
      view: 1,
      like: 0.4,
      save: 0.2,
      comment: 0.1,
      share: 0.05,
    },
  };
}
