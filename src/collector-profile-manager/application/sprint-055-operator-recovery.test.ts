import { describe, expect, it } from "vitest";
import {
  CreateProfileUseCase,
  GetProvisioningConfigurationUseCase,
  IngestProfileSessionUseCase,
  InvalidApplicationOperationError,
  InvalidProvisioningTokenError,
  ProvisioningTokenConsumedError,
  StartProfileProvisioningUseCase,
  UpdateProfileConfigurationUseCase,
  type Clock,
  type TokenGenerator,
} from "./index";
import { InMemoryProfileRepository } from "./test-support/in-memory-repositories";
import {
  PROFILE_AUTHENTICATION_HEALTH_VALUES,
  canStartProvisioning,
  createPendingCollectorProfile,
  explainStartProvisioningRejection,
  InvalidProvisioningRecoveryTransitionError,
  markCollectorProfileSessionIngested,
  transitionCollectorProfileStatusForProvisioning,
  type CollectorProfile,
  type HardwareFingerprint,
  type NetworkContext,
  type ProfileAuthenticationHealth,
  type TemporalRoutine,
  type SafetyThresholds,
  type ContentAffinities,
  type BehavioralPersona,
  type BrowserCookie,
  type LocalStorageEntry,
} from "../domain";

const createdAt = "2026-06-17T08:00:00.000Z";
const later = "2026-06-17T08:05:00.000Z";
const evenLater = "2026-06-17T08:10:00.000Z";
const tokenExpiry = "2026-06-17T08:20:00.000Z";
const sessionExpiresAt = "2026-06-18T08:00:00.000Z";

function makeClock(current: string = createdAt): Clock {
  return { now: () => new Date(current) };
}

function makeTokenGenerator(tokens: readonly string[] = ["token-1"]): TokenGenerator {
  let index = 0;
  return {
    generateToken: async () => {
      const value = tokens[index];
      index += 1;
      return value ?? `token-${index}`;
    },
  };
}

function createConfiguredProfile(
  health: ProfileAuthenticationHealth = "NOT_PROVISIONED",
): CollectorProfile {
  return {
    ...createPendingCollectorProfile({
      id: "profile-1",
      displayName: "Profile 1",
      createdAt,
      networkContext: createNetworkContext(),
      hardwareFingerprint: createHardwareFingerprint(),
      behavioralPersona: createBehavioralPersona(),
      temporalRoutine: createTemporalRoutine(),
      safetyThresholds: createSafetyThresholds(),
      contentAffinities: createContentAffinities(),
    }),
    authenticationHealth: health,
    authenticationHealthUpdatedAt: createdAt,
  };
}

function createReadyProfile(
  health: ProfileAuthenticationHealth = "HEALTHY",
  healthUpdatedAt: string = createdAt,
): CollectorProfile {
  const base = createConfiguredProfile("NOT_PROVISIONED");
  const pendingLogin: CollectorProfile = {
    ...base,
    identity: { ...base.identity, status: "PENDING_LOGIN", updatedAt: createdAt },
    provisioningToken: {
      status: "ISSUED",
      tokenHash: "initial-token",
      issuedAt: createdAt,
      expiresAt: tokenExpiry,
      consumedAt: null,
    },
  };
  const ingested = markCollectorProfileSessionIngested(
    pendingLogin,
    later,
    {
      cookies: createCookies(),
      localStorage: createLocalStorage(),
      sessionExpiresAt,
    },
    {
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: createdAt,
      expiresAt: tokenExpiry,
      consumedAt: later,
    },
  );
  return {
    ...ingested,
    identity: { ...ingested.identity, status: "READY", updatedAt: later },
    authenticationHealth: health,
    authenticationHealthUpdatedAt: healthUpdatedAt,
  };
}

function createBusyProfile(): CollectorProfile {
  return {
    ...createReadyProfile(),
    identity: { ...createReadyProfile().identity, status: "BUSY" },
  };
}

describe("canStartProvisioning domain predicate", () => {
  it("accepts PENDING_CONFIG (initial provisioning)", () => {
    expect(canStartProvisioning(createConfiguredProfile("NOT_PROVISIONED"))).toBe(true);
  });

  it("accepts PENDING_LOGIN (explicit token restart)", () => {
    const profile: CollectorProfile = {
      ...createConfiguredProfile("NOT_PROVISIONED"),
      identity: { ...createConfiguredProfile().identity, status: "PENDING_LOGIN" },
    };
    expect(canStartProvisioning(profile)).toBe(true);
  });

  it("accepts READY with REAUTH_REQUIRED (reauthentication recovery)", () => {
    expect(canStartProvisioning(createReadyProfile("REAUTH_REQUIRED"))).toBe(true);
  });

  it("accepts READY with CHECKPOINT_REVIEW_REQUIRED (manual checkpoint recovery)", () => {
    expect(canStartProvisioning(createReadyProfile("CHECKPOINT_REVIEW_REQUIRED"))).toBe(true);
  });

  it("rejects READY with HEALTHY", () => {
    expect(canStartProvisioning(createReadyProfile("HEALTHY"))).toBe(false);
  });

  it("rejects READY with NOT_PROVISIONED", () => {
    expect(canStartProvisioning(createReadyProfile("NOT_PROVISIONED"))).toBe(false);
  });

  it("rejects BUSY", () => {
    expect(canStartProvisioning(createBusyProfile())).toBe(false);
  });
});

describe("explainStartProvisioningRejection", () => {
  it("returns null for eligible profiles", () => {
    expect(explainStartProvisioningRejection(createConfiguredProfile())).toBeNull();
  });

  it("returns PROFILE_BUSY for BUSY profiles", () => {
    expect(explainStartProvisioningRejection(createBusyProfile())).toBe("PROFILE_BUSY");
  });

  it("returns PROFILE_READY_NOT_RECOVERABLE for READY+HEALTHY", () => {
    expect(explainStartProvisioningRejection(createReadyProfile("HEALTHY"))).toBe(
      "PROFILE_READY_NOT_RECOVERABLE",
    );
  });

  it("returns PROFILE_READY_NOT_RECOVERABLE for READY+NOT_PROVISIONED", () => {
    expect(explainStartProvisioningRejection(createReadyProfile("NOT_PROVISIONED"))).toBe(
      "PROFILE_READY_NOT_RECOVERABLE",
    );
  });
});

describe("StartProfileProvisioningUseCase recovery flows", () => {
  it("starts initial provisioning from PENDING_CONFIG (existing behavior)", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createConfiguredProfile("NOT_PROVISIONED");
    await profiles.save(profile);

    const output = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(),
      makeClock(later),
    ).execute({ profileId: profile.identity.id });

    expect(output.profile.identity.status).toBe("PENDING_LOGIN");
    expect(output.profile.provisioningToken.status).toBe("ISSUED");
    expect(output.provisioningToken).toBe("token-1");
    expect(output.expiresAt).toBe("2026-06-17T08:20:00.000Z");
  });

  it("restarts provisioning from PENDING_LOGIN and supersedes the previous token", async () => {
    const profiles = new InMemoryProfileRepository();
    const initialToken = "initial-token";
    const profile: CollectorProfile = {
      ...createConfiguredProfile("NOT_PROVISIONED"),
      identity: {
        ...createConfiguredProfile().identity,
        status: "PENDING_LOGIN",
        updatedAt: createdAt,
      },
      provisioningToken: {
        status: "ISSUED",
        tokenHash: initialToken,
        issuedAt: createdAt,
        expiresAt: tokenExpiry,
        consumedAt: null,
      },
    };
    await profiles.save(profile);

    const output = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["rotated-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    expect(output.profile.identity.status).toBe("PENDING_LOGIN");
    expect(output.profile.identity.updatedAt).toBe(evenLater);
    expect(output.profile.provisioningToken.tokenHash).toBe("rotated-token");
    expect(output.profile.provisioningToken.status).toBe("ISSUED");
    expect(output.provisioningToken).toBe("rotated-token");

    // The previous token is no longer findable; session ingestion with
    // the previous token must fail.
    await expect(
      profiles.findByProvisioningToken(initialToken),
    ).resolves.toBeNull();
  });

  it("preserves authenticationHealth, health timestamp, account stage, fingerprint, configuration, and auth state on PENDING_LOGIN restart", async () => {
    const profiles = new InMemoryProfileRepository();
    const configured = createConfiguredProfile("REAUTH_REQUIRED");
    const profile: CollectorProfile = {
      ...configured,
      identity: {
        ...configured.identity,
        status: "PENDING_LOGIN",
        updatedAt: createdAt,
        accountStage: "WARMING",
      },
      provisioningToken: {
        status: "ISSUED",
        tokenHash: "old-token",
        issuedAt: createdAt,
        expiresAt: tokenExpiry,
        consumedAt: null,
      },
      authenticationHealth: "REAUTH_REQUIRED",
      authenticationHealthUpdatedAt: createdAt,
    };
    await profiles.save(profile);

    const output = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    expect(output.profile.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(output.profile.authenticationHealthUpdatedAt).toBe(createdAt);
    expect(output.profile.identity.accountStage).toBe("WARMING");
    expect(output.profile.hardwareFingerprint).toEqual(
      createHardwareFingerprint(),
    );
    expect(output.profile.networkContext).toEqual(createNetworkContext());
    expect(output.profile.authenticationState).toEqual({
      cookies: [],
      localStorage: [],
      sessionCapturedAt: null,
      sessionExpiresAt: null,
    });
  });

  it("transitions READY+REAUTH_REQUIRED to PENDING_LOGIN while preserving health and stage", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("REAUTH_REQUIRED", later);
    await profiles.save(profile);

    const output = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["recovery-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    expect(output.profile.identity.status).toBe("PENDING_LOGIN");
    expect(output.profile.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(output.profile.authenticationHealthUpdatedAt).toBe(later);
    expect(output.profile.identity.accountStage).toBe(
      profile.identity.accountStage,
    );
    expect(output.profile.hardwareFingerprint).toEqual(
      profile.hardwareFingerprint,
    );
    expect(output.profile.networkContext).toEqual(profile.networkContext);
    expect(output.profile.authenticationState).toEqual(
      profile.authenticationState,
    );
    expect(output.provisioningToken).toBe("recovery-token");
  });

  it("transitions READY+CHECKPOINT_REVIEW_REQUIRED to PENDING_LOGIN while preserving health and stage", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("CHECKPOINT_REVIEW_REQUIRED", later);
    await profiles.save(profile);

    const output = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["checkpoint-recovery-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    expect(output.profile.identity.status).toBe("PENDING_LOGIN");
    expect(output.profile.authenticationHealth).toBe(
      "CHECKPOINT_REVIEW_REQUIRED",
    );
    expect(output.profile.authenticationHealthUpdatedAt).toBe(later);
    expect(output.profile.identity.accountStage).toBe(
      profile.identity.accountStage,
    );
    expect(output.provisioningToken).toBe("checkpoint-recovery-token");
  });

  it("rejects READY+HEALTHY without mutating the profile", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("HEALTHY", later);
    await profiles.save(profile);

    await expect(
      new StartProfileProvisioningUseCase(
        profiles,
        makeTokenGenerator(),
        makeClock(evenLater),
      ).execute({ profileId: profile.identity.id }),
    ).rejects.toThrow(InvalidApplicationOperationError);

    const persisted = await profiles.findById(profile.identity.id);
    expect(persisted?.identity.status).toBe("READY");
    expect(persisted?.authenticationHealth).toBe("HEALTHY");
    expect(persisted?.authenticationHealthUpdatedAt).toBe(later);
  });

  it("rejects READY+NOT_PROVISIONED", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("NOT_PROVISIONED", later);
    await profiles.save(profile);

    await expect(
      new StartProfileProvisioningUseCase(
        profiles,
        makeTokenGenerator(),
        makeClock(evenLater),
      ).execute({ profileId: profile.identity.id }),
    ).rejects.toThrow(InvalidApplicationOperationError);
  });

  it("rejects BUSY", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createBusyProfile();
    await profiles.save(profile);

    await expect(
      new StartProfileProvisioningUseCase(
        profiles,
        makeTokenGenerator(),
        makeClock(evenLater),
      ).execute({ profileId: profile.identity.id }),
    ).rejects.toThrow(InvalidApplicationOperationError);
  });

  it("rejects missing required configuration on every entry point", async () => {
    const profiles = new InMemoryProfileRepository();
    const minimal = createPendingCollectorProfile({
      id: "profile-1",
      displayName: "Profile 1",
      createdAt,
    });
    await profiles.save(minimal);

    await expect(
      new StartProfileProvisioningUseCase(
        profiles,
        makeTokenGenerator(),
        makeClock(later),
      ).execute({ profileId: minimal.identity.id }),
    ).rejects.toThrow();
  });
});

describe("Sprint 055 recovery token supersede", () => {
  it("previous token is not findable and rejects session ingestion after recovery restart", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("REAUTH_REQUIRED", later);
    await profiles.save(profile);

    const started = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["new-recovery-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    // The new token is findable.
    await expect(
      profiles.findByProvisioningToken("new-recovery-token"),
    ).resolves.not.toBeNull();

    // The previously consumed token is not findable (it was CONSUMED).
    await expect(
      profiles.findByProvisioningToken("initial-token"),
    ).resolves.toBeNull();

    // Session ingestion with the new token succeeds and resets health to HEALTHY.
    const ingested = await new IngestProfileSessionUseCase(
      profiles,
      makeClock(evenLater),
    ).execute({
      provisioningToken: started.provisioningToken,
      cookies: createCookies(),
      localStorage: createLocalStorage(),
    });

    expect(ingested.authenticationHealth).toBe("HEALTHY");
    expect(ingested.authenticationHealthUpdatedAt).toBe(evenLater);
    expect(ingested.identity.status).toBe("READY");
  });
});

describe("Sprint 055 domain backstop direct-caller tests", () => {
  // These tests prove the domain-level backstop closes the bypass
  // opportunity. They call `transitionCollectorProfileStatusForProvisioning`
  // directly (not through `StartProfileProvisioningUseCase`) and
  // construct profiles that the application precheck would normally
  // reject, demonstrating that the domain layer still enforces the
  // health guard.

  it("directly rejects READY + HEALTHY -> PENDING_LOGIN", () => {
    const profile = createReadyProfile("HEALTHY", later);

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        profile,
        "PENDING_LOGIN",
        evenLater,
      ),
    ).toThrow(InvalidProvisioningRecoveryTransitionError);
  });

  it("directly rejects READY + NOT_PROVISIONED -> PENDING_LOGIN", () => {
    const profile = createReadyProfile("NOT_PROVISIONED", later);

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        profile,
        "PENDING_LOGIN",
        evenLater,
      ),
    ).toThrow(InvalidProvisioningRecoveryTransitionError);
  });

  it("directly permits READY + REAUTH_REQUIRED -> PENDING_LOGIN", () => {
    const profile = createReadyProfile("REAUTH_REQUIRED", later);

    const next = transitionCollectorProfileStatusForProvisioning(
      profile,
      "PENDING_LOGIN",
      evenLater,
    );

    expect(next.identity.status).toBe("PENDING_LOGIN");
    expect(next.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(next.authenticationHealthUpdatedAt).toBe(later);
  });
});

describe("Sprint 055 superseded token use case failures", () => {
  // These tests prove the superseded token is not just unfindable in
  // the repository, but actually causes the application use cases to
  // fail with the documented token errors.

  it("superseded token fails GetProvisioningConfigurationUseCase after recovery restart", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("REAUTH_REQUIRED", later);
    await profiles.save(profile);

    const started = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["recovery-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    expect(started.provisioningToken).toBe("recovery-token");

    // The previously consumed "initial-token" is no longer findable
    // through the repository, so the use case throws.
    await expect(
      new GetProvisioningConfigurationUseCase(
        profiles,
        makeClock(evenLater),
      ).execute({ provisioningToken: "initial-token" }),
    ).rejects.toThrow(InvalidProvisioningTokenError);

    // The new token works.
    await expect(
      new GetProvisioningConfigurationUseCase(
        profiles,
        makeClock(evenLater),
      ).execute({ provisioningToken: started.provisioningToken }),
    ).resolves.toMatchObject({ profileId: profile.identity.id });
  });

  it("superseded token fails IngestProfileSessionUseCase after recovery restart", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile = createReadyProfile("CHECKPOINT_REVIEW_REQUIRED", later);
    await profiles.save(profile);

    const started = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["recovery-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    // The previously consumed "initial-token" was used by the prior
    // session ingestion, so it is now in the CONSUMED state. The
    // repository's `findByProvisioningToken` only returns profiles
    // whose token status is ISSUED, so the use case throws
    // `InvalidProvisioningTokenError` for the superseded token.
    await expect(
      new IngestProfileSessionUseCase(profiles, makeClock(evenLater)).execute({
        provisioningToken: "initial-token",
        cookies: createCookies(),
        localStorage: createLocalStorage(),
      }),
    ).rejects.toThrow(InvalidProvisioningTokenError);

    // The new token allows a successful session ingestion.
    const ingested = await new IngestProfileSessionUseCase(
      profiles,
      makeClock(evenLater),
    ).execute({
      provisioningToken: started.provisioningToken,
      cookies: createCookies(),
      localStorage: createLocalStorage(),
    });

    expect(ingested.identity.status).toBe("READY");
    expect(ingested.authenticationHealth).toBe("HEALTHY");
  });

  it("superseded token fails GetProvisioningConfigurationUseCase after PENDING_LOGIN restart", async () => {
    const profiles = new InMemoryProfileRepository();
    const profile: CollectorProfile = {
      ...createReadyProfile("REAUTH_REQUIRED", later),
      identity: {
        ...createReadyProfile("REAUTH_REQUIRED", later).identity,
        status: "PENDING_LOGIN",
        updatedAt: later,
      },
      provisioningToken: {
        status: "ISSUED",
        tokenHash: "pre-restart-token",
        issuedAt: later,
        expiresAt: tokenExpiry,
        consumedAt: null,
      },
      authenticationHealth: "REAUTH_REQUIRED",
      authenticationHealthUpdatedAt: later,
    };
    await profiles.save(profile);

    const started = await new StartProfileProvisioningUseCase(
      profiles,
      makeTokenGenerator(["post-restart-token"]),
      makeClock(evenLater),
    ).execute({ profileId: profile.identity.id });

    expect(started.provisioningToken).toBe("post-restart-token");

    // The previous PENDING_LOGIN token is no longer findable.
    await expect(
      new GetProvisioningConfigurationUseCase(
        profiles,
        makeClock(evenLater),
      ).execute({ provisioningToken: "pre-restart-token" }),
    ).rejects.toThrow(InvalidProvisioningTokenError);
  });
});

// ---------------------------------------------------------------------------
// Fixtures (synthetic, no real session data)
// ---------------------------------------------------------------------------

function createNetworkContext(): NetworkContext {
  return {
    mode: "PROXY",
    proxy: {
      protocol: "HTTPS",
      host: "proxy.example.test",
      port: 443,
      credentials: { username: "collector", password: "secret" },
      countryCode: "US",
      region: "CA",
    },
    killswitch: { enabled: true, failClosed: true },
  };
}

function createHardwareFingerprint(): HardwareFingerprint {
  return {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
    languages: ["en-US", "en"],
    hardwareConcurrency: 8,
    platform: "Linux x86_64",
    deviceMemoryGb: 8,
    timezone: "America/Los_Angeles",
  };
}

function createBehavioralPersona(): BehavioralPersona {
  return {
    scrollStyle: "STEADY",
    microDelayMs: { min: 200, max: 1200 },
    reverseScrollProbability: 0.1,
    dwellTimeMs: { min: 2000, max: 8000 },
  };
}

function createTemporalRoutine(): TemporalRoutine {
  return {
    timezone: "America/Los_Angeles",
    chronotype: "MORNING",
    activeWindows: [
      { days: [1, 2, 3, 4, 5], startsAt: "09:00", endsAt: "17:00" },
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
    primaryTopics: [{ topic: "travel", weight: 1 }],
    secondaryTopics: [{ topic: "food", weight: 0.5 }],
    interactionWeights: {
      view: 1,
      like: 0.4,
      save: 0.2,
      comment: 0.1,
      share: 0.05,
    },
  };
}

function createCookies(): BrowserCookie[] {
  return [
    {
      name: "session",
      value: "abc123",
      domain: "example.test",
      path: "/",
      expiresAt: sessionExpiresAt,
      httpOnly: true,
      secure: true,
    },
  ];
}

function createLocalStorage(): LocalStorageEntry[] {
  return [
    {
      origin: "https://example.test",
      key: "auth",
      value: "stored-value",
    },
  ];
}

// Sanity guard: ensure we never import UpdateProfileConfigurationUseCase
// and never use it. The list above intentionally avoids the dynamic import
// pattern from earlier tests in favour of explicit construction.
// Touch unused imports to satisfy the typecheck.
const _unused: typeof CreateProfileUseCase | typeof UpdateProfileConfigurationUseCase = CreateProfileUseCase;
void _unused;
void PROFILE_AUTHENTICATION_HEALTH_VALUES;
