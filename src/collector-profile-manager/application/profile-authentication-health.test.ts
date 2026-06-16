import { describe, expect, it } from "vitest";
import {
  CreateProfileUseCase,
  IngestProfileSessionUseCase,
  StartProfileProvisioningUseCase,
  UpdateProfileAccountStageUseCase,
  UpdateProfileConfigurationUseCase,
} from "./index";
import type { Clock, TokenGenerator } from "./index";
import { InMemoryProfileRepository } from "./test-support/in-memory-repositories";
import {
  PROFILE_AUTHENTICATION_HEALTH_VALUES,
  createPendingCollectorProfile,
  markCollectorProfileSessionIngested,
} from "../domain";
import type {
  BrowserCookie,
  CollectorProfile,
  HardwareFingerprint,
  IsoDateTime,
  LocalStorageEntry,
  NetworkContext,
  TemporalRoutine,
  SafetyThresholds,
  ContentAffinities,
  BehavioralPersona,
} from "../domain";
import { toProfileSummaryDto, toProfileDetailDto } from "./profile-read-dtos";
import {
  PROFILE_AUTHENTICATION_HEALTH_VALUES as _health,
} from "../domain";

const now = "2026-06-16T10:00:00.000Z";
const later = "2026-06-16T10:15:00.000Z";
const tokenExpiry = "2026-06-16T10:30:00.000Z";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeClock(current: string = now): Clock {
  return { now: () => new Date(current) };
}

function makeTokenGenerator(token: string = "provisioning-token-1"): TokenGenerator {
  return { generateToken: async () => token };
}

function createMinimalProfile(id: string = "profile-1"): CollectorProfile {
  return createPendingCollectorProfile({
    id,
    displayName: `Profile ${id}`,
    createdAt: now,
  });
}

function createConfiguredProfile(id: string = "profile-1"): CollectorProfile {
  return createPendingCollectorProfile({
    id,
    displayName: `Profile ${id}`,
    createdAt: now,
    networkContext: createNetworkContext(),
    hardwareFingerprint: createHardwareFingerprint(),
    behavioralPersona: createBehavioralPersona(),
    temporalRoutine: createTemporalRoutine(),
    safetyThresholds: createSafetyThresholds(),
    contentAffinities: createContentAffinities(),
  });
}

function createPendingLoginProfile(): CollectorProfile {
  const profile = createConfiguredProfile();
  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: "PENDING_LOGIN",
      updatedAt: now,
    },
    provisioningToken: {
      status: "ISSUED",
      tokenHash: "provisioning-token-1",
      issuedAt: now,
      expiresAt: tokenExpiry,
      consumedAt: null,
    },
  };
}

function createReadyProfile(id: string = "profile-1"): CollectorProfile {
  const base = createConfiguredProfile(id);
  const consumed = markCollectorProfileSessionIngested(
    { ...base, identity: { ...base.identity, status: "PENDING_LOGIN", updatedAt: now } },
    now,
    { cookies: createCookies(), localStorage: createLocalStorage(), sessionExpiresAt: null },
    { status: "CONSUMED", tokenHash: null, issuedAt: now, expiresAt: tokenExpiry, consumedAt: now },
  );
  return {
    ...consumed,
    identity: { ...consumed.identity, status: "READY", updatedAt: now },
  };
}

// ---------------------------------------------------------------------------
// Domain: enum validation
// ---------------------------------------------------------------------------

describe("ProfileAuthenticationHealth enum", () => {
  it("contains exactly the four expected values", () => {
    expect(PROFILE_AUTHENTICATION_HEALTH_VALUES).toEqual([
      "NOT_PROVISIONED",
      "HEALTHY",
      "REAUTH_REQUIRED",
      "CHECKPOINT_REVIEW_REQUIRED",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Domain: creation defaults
// ---------------------------------------------------------------------------

describe("createPendingCollectorProfile authentication health defaults", () => {
  it("starts with NOT_PROVISIONED", () => {
    const profile = createMinimalProfile();
    expect(profile.authenticationHealth).toBe("NOT_PROVISIONED");
  });

  it("sets authenticationHealthUpdatedAt to createdAt", () => {
    const profile = createMinimalProfile();
    expect(profile.authenticationHealthUpdatedAt).toBe(profile.identity.createdAt);
  });
});

// ---------------------------------------------------------------------------
// Domain: required fields for complete profile
// ---------------------------------------------------------------------------

describe("CollectorProfile required authentication health fields", () => {
  it("profile must carry authenticationHealth and authenticationHealthUpdatedAt", () => {
    const profile = createMinimalProfile();
    expect("authenticationHealth" in profile).toBe(true);
    expect("authenticationHealthUpdatedAt" in profile).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Domain: markCollectorProfileSessionIngested -> HEALTHY
// ---------------------------------------------------------------------------

describe("markCollectorProfileSessionIngested", () => {
  it("sets authenticationHealth to HEALTHY", () => {
    const profile = createPendingLoginProfile();
    const result = markCollectorProfileSessionIngested(
      profile,
      later,
      { cookies: createCookies(), localStorage: createLocalStorage(), sessionExpiresAt: null },
      { status: "CONSUMED", tokenHash: null, issuedAt: now, expiresAt: tokenExpiry, consumedAt: later },
    );
    expect(result.authenticationHealth).toBe("HEALTHY");
  });

  it("sets authenticationHealthUpdatedAt to sessionCapturedAt", () => {
    const profile = createPendingLoginProfile();
    const result = markCollectorProfileSessionIngested(
      profile,
      later,
      { cookies: createCookies(), localStorage: createLocalStorage(), sessionExpiresAt: null },
      { status: "CONSUMED", tokenHash: null, issuedAt: now, expiresAt: tokenExpiry, consumedAt: later },
    );
    expect(result.authenticationHealthUpdatedAt).toBe(later);
  });

  it("reprovisioning an UNHEALTHY profile sets health back to HEALTHY", () => {
    const unhealthy: CollectorProfile = {
      ...createPendingLoginProfile(),
      authenticationHealth: "REAUTH_REQUIRED",
      authenticationHealthUpdatedAt: now,
    };
    const result = markCollectorProfileSessionIngested(
      unhealthy,
      later,
      { cookies: createCookies(), localStorage: createLocalStorage(), sessionExpiresAt: null },
      { status: "CONSUMED", tokenHash: null, issuedAt: now, expiresAt: tokenExpiry, consumedAt: later },
    );
    expect(result.authenticationHealth).toBe("HEALTHY");
    expect(result.authenticationHealthUpdatedAt).toBe(later);
  });

  it("reprovisioning a CHECKPOINT_REVIEW_REQUIRED profile sets health to HEALTHY", () => {
    const unhealthy: CollectorProfile = {
      ...createPendingLoginProfile(),
      authenticationHealth: "CHECKPOINT_REVIEW_REQUIRED",
      authenticationHealthUpdatedAt: now,
    };
    const result = markCollectorProfileSessionIngested(
      unhealthy,
      later,
      { cookies: createCookies(), localStorage: createLocalStorage(), sessionExpiresAt: null },
      { status: "CONSUMED", tokenHash: null, issuedAt: now, expiresAt: tokenExpiry, consumedAt: later },
    );
    expect(result.authenticationHealth).toBe("HEALTHY");
  });
});

// ---------------------------------------------------------------------------
// Application: IngestProfileSessionUseCase -> HEALTHY atomically
// ---------------------------------------------------------------------------

describe("IngestProfileSessionUseCase authentication health", () => {
  it("sets health to HEALTHY and status to READY atomically on successful ingestion", async () => {
    const profiles = new InMemoryProfileRepository();
    const pendingLogin = createPendingLoginProfile();
    await profiles.save(pendingLogin);

    const result = await new IngestProfileSessionUseCase(
      profiles,
      makeClock(later),
    ).execute({
      provisioningToken: "provisioning-token-1",
      cookies: createCookies(),
      localStorage: createLocalStorage(),
    });

    expect(result.authenticationHealth).toBe("HEALTHY");
    expect(result.authenticationHealthUpdatedAt).toBe(later);
    expect(result.identity.status).toBe("READY");
    const saved = await profiles.findById(pendingLogin.identity.id);
    expect(saved?.authenticationHealth).toBe("HEALTHY");
  });
});

// ---------------------------------------------------------------------------
// Preservation: configuration, account-stage, start-provisioning
// ---------------------------------------------------------------------------

describe("authentication health preservation", () => {
  it("UpdateProfileConfigurationUseCase preserves health and timestamp", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile();
    await profiles.save(profile);

    const { UpdateProfileConfigurationUseCase } = await import(
      "./use-cases/update-profile-configuration.use-case"
    );
    await new UpdateProfileConfigurationUseCase(
      profiles,
      makeClock(later),
    ).execute({
      profileId: profile.identity.id,
      networkContext: createNetworkContext(),
    });

    const updated = await profiles.findById(profile.identity.id);
    expect(updated?.authenticationHealth).toBe(profile.authenticationHealth);
    expect(updated?.authenticationHealthUpdatedAt).toBe(
      profile.authenticationHealthUpdatedAt,
    );
  });

  it("UpdateProfileAccountStageUseCase preserves health and timestamp", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile();
    await profiles.save(profile);

    const { UpdateProfileAccountStageUseCase } = await import(
      "./use-cases/update-profile-account-stage.use-case"
    );
    await new UpdateProfileAccountStageUseCase(
      profiles,
      makeClock(later),
    ).execute({
      profileId: profile.identity.id,
      accountStage: "WARMING",
    });

    const updated = await profiles.findById(profile.identity.id);
    expect(updated?.authenticationHealth).toBe(profile.authenticationHealth);
    expect(updated?.authenticationHealthUpdatedAt).toBe(
      profile.authenticationHealthUpdatedAt,
    );
  });

  it("StartProfileProvisioningUseCase does not mark profile healthy", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createConfiguredProfile();
    await profiles.save(profile);

    const { StartProfileProvisioningUseCase } = await import(
      "./use-cases/start-profile-provisioning.use-case"
    );
    const result = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(),
      makeClock(later),
    ).execute({ profileId: profile.identity.id });

    expect(result.profile.authenticationHealth).toBe("NOT_PROVISIONED");
    const saved = await profiles.findById(profile.identity.id);
    expect(saved?.authenticationHealth).toBe("NOT_PROVISIONED");
  });

  it("starting provisioning again from PENDING_LOGIN does not mark healthy", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile: CollectorProfile = {
      ...createPendingLoginProfile(),
      authenticationHealth: "REAUTH_REQUIRED",
      authenticationHealthUpdatedAt: now,
    };
    await profiles.save(profile);

    // Simulate a reprovision: put back to PENDING_CONFIG so provisioning can start
    const resetProfile: CollectorProfile = {
      ...profile,
      identity: { ...profile.identity, status: "PENDING_CONFIG" },
      provisioningToken: {
        status: "NOT_ISSUED",
        tokenHash: null,
        issuedAt: null,
        expiresAt: null,
        consumedAt: null,
      },
    };
    await profiles.save(resetProfile);

    const { StartProfileProvisioningUseCase } = await import(
      "./use-cases/start-profile-provisioning.use-case"
    );
    const result = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(),
      makeClock(later),
    ).execute({ profileId: profile.identity.id });

    expect(result.profile.authenticationHealth).toBe("REAUTH_REQUIRED");
  });
});

// ---------------------------------------------------------------------------
// Safe DTO: list and detail
// ---------------------------------------------------------------------------

describe("safe DTO builders expose authentication health fields", () => {
  it("toProfileSummaryDto includes authenticationHealth and authenticationHealthUpdatedAt", () => {
    const profile = createReadyProfile();
    const dto = toProfileSummaryDto(profile);
    expect(dto.authenticationHealth).toBe("HEALTHY");
    expect(dto.authenticationHealthUpdatedAt).toBe(profile.authenticationHealthUpdatedAt);
  });

  it("toProfileDetailDto includes authenticationHealth through summary", () => {
    const profile = createReadyProfile();
    const dto = toProfileDetailDto(profile);
    expect(dto.authenticationHealth).toBe("HEALTHY");
    expect(dto.authenticationHealthUpdatedAt).toBe(profile.authenticationHealthUpdatedAt);
  });

  it("NOT_PROVISIONED profile summary shows NOT_PROVISIONED health", () => {
    const profile = createMinimalProfile();
    const dto = toProfileSummaryDto(profile);
    expect(dto.authenticationHealth).toBe("NOT_PROVISIONED");
  });

  it("does not expose cookies, localStorage, provisioning tokens, or proxy credentials", () => {
    const profile = createReadyProfile();
    const dto = toProfileSummaryDto(profile) as unknown as Record<string, unknown>;
    const forbidden = ["cookies", "localStorage", "provisioningToken", "tokenHash", "authenticationState"];
    for (const key of forbidden) {
      expect(key in dto, `DTO must not expose '${key}'`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Mapper round-trip (domain-level via createPendingCollectorProfile)
// ---------------------------------------------------------------------------

describe("authentication health mapper round-trip", () => {
  it("NOT_PROVISIONED round-trips through create", () => {
    const profile = createMinimalProfile();
    expect(profile.authenticationHealth).toBe("NOT_PROVISIONED");
    expect(profile.authenticationHealthUpdatedAt).toBe(now);
  });

  it("HEALTHY round-trips through markCollectorProfileSessionIngested", () => {
    const pendingLogin = createPendingLoginProfile();
    const result = markCollectorProfileSessionIngested(
      pendingLogin,
      later,
      { cookies: createCookies(), localStorage: createLocalStorage(), sessionExpiresAt: null },
      { status: "CONSUMED", tokenHash: null, issuedAt: now, expiresAt: tokenExpiry, consumedAt: later },
    );
    expect(result.authenticationHealth).toBe("HEALTHY");
    expect(result.authenticationHealthUpdatedAt).toBe(later);
  });
});

// ---------------------------------------------------------------------------
// InMemoryProfileRepository: health survives save/findById
// ---------------------------------------------------------------------------

describe("InMemoryProfileRepository preserves authentication health", () => {
  it("saves and retrieves health value unchanged", async () => {
    const repo = new InMemoryProfileRepository();
    const profile: CollectorProfile = {
      ...createMinimalProfile(),
      authenticationHealth: "REAUTH_REQUIRED",
      authenticationHealthUpdatedAt: now,
    };
    await repo.save(profile);
    const found = await repo.findById(profile.identity.id);
    expect(found?.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(found?.authenticationHealthUpdatedAt).toBe(now);
  });

  it("HEALTHY value survives save and list", async () => {
    const repo = new InMemoryProfileRepository();
    const profile = createReadyProfile();
    await repo.save(profile);
    const { items } = await repo.listProfiles({ limit: 10 });
    expect(items[0]?.authenticationHealth).toBe("HEALTHY");
  });
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function createNetworkContext(): NetworkContext {
  return {
    proxy: {
      protocol: "HTTPS",
      host: "proxy.example.test",
      port: 443,
      credentials: { username: "user", password: "pass" },
    },
    killswitch: { enabled: true, failClosed: true },
  };
}

function createHardwareFingerprint(): HardwareFingerprint {
  return {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    viewport: { width: 1366, height: 768 },
    languages: ["en-US"],
    hardwareConcurrency: 4,
  };
}

function createBehavioralPersona(): BehavioralPersona {
  return {
    scrollStyle: "STEADY",
    microDelayMs: { min: 100, max: 500 },
    reverseScrollProbability: 0,
    dwellTimeMs: { min: 1000, max: 3000 },
  };
}

function createTemporalRoutine(): TemporalRoutine {
  return {
    timezone: "America/New_York",
    chronotype: "MORNING",
    activeWindows: [{ days: [1, 2, 3, 4, 5], startsAt: "09:00", endsAt: "17:00" }],
    cooldownMinutes: 30,
  };
}

function createSafetyThresholds(): SafetyThresholds {
  return {
    maxSessionsPerDay: 3,
    maxSessionDurationMinutes: 45,
    maxMacroActionsPerDay: 100,
    minCooldownMinutes: 30,
  };
}

function createContentAffinities(): import("../domain").ContentAffinities {
  return {
    primaryTopics: [{ topic: "news", weight: 1 }],
    secondaryTopics: [],
    interactionWeights: { view: 1, like: 0, save: 0, comment: 0, share: 0 },
  };
}

function createCookies(): BrowserCookie[] {
  return [
    {
      name: "session",
      value: "abc123",
      domain: "example.test",
      path: "/",
      expiresAt: null,
      httpOnly: true,
      secure: true,
    },
  ];
}

function createLocalStorage(): LocalStorageEntry[] {
  return [{ origin: "https://example.test", key: "auth", value: "val" }];
}
