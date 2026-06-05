import { describe, expect, it } from "vitest";
import {
  CreateProfileUseCase,
  GetProvisioningConfigurationUseCase,
  IngestProfileSessionUseCase,
  InvalidApplicationOperationError,
  InvalidProfileConfigurationError,
  InvalidProvisioningTokenError,
  StartProfileProvisioningUseCase,
  UpdateProfileConfigurationUseCase,
} from "./index";
import type {
  Clock,
  ProfileRepository,
  TokenGenerator,
} from "./index";
import type {
  BehavioralPersona,
  BrowserCookie,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  LocalStorageEntry,
  NetworkContext,
  ProfileId,
  SafetyThresholds,
  TemporalRoutine,
} from "../domain";

const now = "2026-01-01T10:00:00.000Z";

describe("collector profile application use cases", () => {
  it("creates a PENDING_CONFIG profile shell", async () => {
    const context = createTestContext();
    const profile = await new CreateProfileUseCase(
      context.profiles,
      context.clock,
    ).execute({
      id: "profile-1",
      displayName: "Profile 1",
    });

    expect(profile.identity.status).toBe("PENDING_CONFIG");
    expect(profile.networkContext).toBeDefined();
    expect(profile.hardwareFingerprint).toBeNull();
    expect(profile.authenticationState).toEqual({
      cookies: [],
      localStorage: [],
      sessionCapturedAt: null,
      sessionExpiresAt: null,
    });
    expect(profile.behavioralPersona).toBeDefined();
    expect(profile.temporalRoutine).toBeDefined();
    expect(profile.safetyThresholds).toBeDefined();
    expect(profile.contentAffinities).toBeDefined();
    expect(profile.provisioningToken).toEqual({
      status: "NOT_ISSUED",
      tokenHash: null,
      issuedAt: null,
      expiresAt: null,
      consumedAt: null,
    });
    await expect(context.profiles.findById("profile-1")).resolves.toEqual(
      profile,
    );
  });

  it("starts provisioning only from PENDING_CONFIG", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);

    await context.profiles.save({
      ...profile,
      identity: {
        ...profile.identity,
        status: "PENDING_LOGIN",
      },
      provisioningToken: {
        status: "ISSUED",
        tokenHash: "existing-token",
        issuedAt: now,
        expiresAt: "2026-01-01T10:15:00.000Z",
        consumedAt: null,
      },
    });

    await expect(
      new StartProfileProvisioningUseCase(
        context.profiles,
        context.tokens,
        context.clock,
      ).execute({ profileId: profile.identity.id }),
    ).rejects.toThrow(InvalidApplicationOperationError);
  });

  it("rejects provisioning when required configuration is missing", async () => {
    const context = createTestContext();

    await new CreateProfileUseCase(context.profiles, context.clock).execute({
      id: "profile-1",
      displayName: "Profile 1",
    });

    await expect(
      new StartProfileProvisioningUseCase(
        context.profiles,
        context.tokens,
        context.clock,
      ).execute({ profileId: "profile-1" }),
    ).rejects.toThrow(InvalidProfileConfigurationError);
  });

  it("assigns a token and moves the profile to PENDING_LOGIN", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);
    const output = await new StartProfileProvisioningUseCase(
      context.profiles,
      context.tokens,
      context.clock,
    ).execute({ profileId: profile.identity.id });

    expect(output.provisioningToken).toBe("provisioning-token-1");
    expect(output.expiresAt).toBe("2026-01-01T10:15:00.000Z");
    expect(output.profile.identity.status).toBe("PENDING_LOGIN");
    expect(output.profile.provisioningToken).toEqual({
      status: "ISSUED",
      tokenHash: "provisioning-token-1",
      issuedAt: now,
      expiresAt: "2026-01-01T10:15:00.000Z",
      consumedAt: null,
    });
  });

  it("returns provisioning configuration without session state", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);
    const started = await startProvisioning(context, profile.identity.id);
    const configuration = await new GetProvisioningConfigurationUseCase(
      context.profiles,
      context.clock,
    ).execute({
      provisioningToken: started.provisioningToken,
    });

    expect(configuration).toEqual({
      profileId: profile.identity.id,
      networkContext: createNetworkContext(),
      hardwareFingerprint: createHardwareFingerprint(),
    });
    expect(configuration).not.toHaveProperty("authenticationState");
    expect(configuration).not.toHaveProperty("provisioningToken");
  });

  it("ingests a session, consumes the token, and moves the profile to READY", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);
    const started = await startProvisioning(context, profile.identity.id);
    const readyProfile = await ingestSession(
      context,
      started.provisioningToken,
    );

    expect(readyProfile.identity.status).toBe("READY");
    expect(readyProfile.authenticationState).toEqual({
      cookies: createCookies(),
      localStorage: createLocalStorage(),
      sessionCapturedAt: now,
      sessionExpiresAt: "2026-01-02T10:00:00.000Z",
    });
    expect(readyProfile.provisioningToken).toEqual({
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: now,
      expiresAt: "2026-01-01T10:15:00.000Z",
      consumedAt: now,
    });
    await expect(
      context.profiles.findByProvisioningToken(started.provisioningToken),
    ).resolves.toBeNull();
  });

  it("rejects reused provisioning tokens", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);
    const started = await startProvisioning(context, profile.identity.id);

    await ingestSession(context, started.provisioningToken);

    await expect(
      new IngestProfileSessionUseCase(
        context.profiles,
        context.clock,
      ).execute({
        provisioningToken: started.provisioningToken,
        cookies: createCookies(),
        localStorage: createLocalStorage(),
      }),
    ).rejects.toThrow(InvalidProvisioningTokenError);
  });

  it("updates configuration without mutating authentication state", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);
    const started = await startProvisioning(context, profile.identity.id);
    const authenticatedProfile = await ingestSession(
      context,
      started.provisioningToken,
    );
    const updatedProfile = await new UpdateProfileConfigurationUseCase(
      context.profiles,
      context.clock,
    ).execute({
      profileId: profile.identity.id,
      networkContext: createAlternateNetworkContext(),
    });

    expect(updatedProfile.authenticationState).toEqual(
      authenticatedProfile.authenticationState,
    );
    expect(updatedProfile.networkContext).toEqual(
      createAlternateNetworkContext(),
    );
    expect(updatedProfile.identity.status).toBe("READY");
  });

  it("rejects hardware fingerprint overwrite", async () => {
    const context = createTestContext();
    const profile = await createConfiguredPendingProfile(context);

    await expect(
      new UpdateProfileConfigurationUseCase(
        context.profiles,
        context.clock,
      ).execute({
        profileId: profile.identity.id,
        hardwareFingerprint: createAlternateHardwareFingerprint(),
      }),
    ).rejects.toThrow(InvalidApplicationOperationError);

    await expect(context.profiles.findById(profile.identity.id)).resolves.toEqual(
      profile,
    );
  });
});

interface TestContext {
  readonly profiles: InMemoryProfileRepository;
  readonly tokens: FakeTokenGenerator;
  readonly clock: FixedClock;
}

function createTestContext(): TestContext {
  return {
    profiles: new InMemoryProfileRepository(),
    tokens: new FakeTokenGenerator(["provisioning-token-1"]),
    clock: new FixedClock(now),
  };
}

async function createConfiguredPendingProfile(
  context: TestContext,
): Promise<CollectorProfile> {
  await new CreateProfileUseCase(context.profiles, context.clock).execute({
    id: "profile-1",
    displayName: "Profile 1",
  });

  return new UpdateProfileConfigurationUseCase(
    context.profiles,
    context.clock,
  ).execute({
    profileId: "profile-1",
    networkContext: createNetworkContext(),
    hardwareFingerprint: createHardwareFingerprint(),
    behavioralPersona: createBehavioralPersona(),
    temporalRoutine: createTemporalRoutine(),
    safetyThresholds: createSafetyThresholds(),
    contentAffinities: createContentAffinities(),
  });
}

async function startProvisioning(
  context: TestContext,
  profileId: ProfileId,
): Promise<{ readonly provisioningToken: string }> {
  return new StartProfileProvisioningUseCase(
    context.profiles,
    context.tokens,
    context.clock,
  ).execute({ profileId });
}

async function ingestSession(
  context: TestContext,
  provisioningToken: string,
): Promise<CollectorProfile> {
  return new IngestProfileSessionUseCase(
    context.profiles,
    context.clock,
  ).execute({
    provisioningToken,
    cookies: createCookies(),
    localStorage: createLocalStorage(),
    sessionExpiresAt: "2026-01-02T10:00:00.000Z",
  });
}

class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<ProfileId, CollectorProfile>();

  public async save(profile: CollectorProfile): Promise<void> {
    this.profiles.set(profile.identity.id, profile);
  }

  public async findById(id: ProfileId): Promise<CollectorProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  public async findReadyProfiles(): Promise<readonly CollectorProfile[]> {
    return [...this.profiles.values()].filter(
      (profile) => profile.identity.status === "READY",
    );
  }

  public async findByProvisioningToken(
    token: string,
  ): Promise<CollectorProfile | null> {
    for (const profile of this.profiles.values()) {
      if (
        profile.provisioningToken.status === "ISSUED" &&
        profile.provisioningToken.tokenHash === token
      ) {
        return profile;
      }
    }

    return null;
  }

  public async existsByDisplayName(
    displayName: string,
    excludeProfileId?: ProfileId,
  ): Promise<boolean> {
    for (const profile of this.profiles.values()) {
      if (
        profile.identity.displayName === displayName &&
        profile.identity.id !== excludeProfileId
      ) {
        return true;
      }
    }

    return false;
  }
}

class FakeTokenGenerator implements TokenGenerator {
  private nextTokenIndex = 0;

  public constructor(private readonly tokens: readonly string[]) {}

  public async generateToken(): Promise<string> {
    const token = this.tokens[this.nextTokenIndex];
    this.nextTokenIndex += 1;

    return token ?? `generated-token-${this.nextTokenIndex}`;
  }
}

class FixedClock implements Clock {
  private current: Date;

  public constructor(isoDateTime: string) {
    this.current = new Date(isoDateTime);
  }

  public now(): Date {
    return new Date(this.current.getTime());
  }
}

function createNetworkContext(): NetworkContext {
  return {
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

function createAlternateNetworkContext(): NetworkContext {
  return {
    proxy: {
      protocol: "SOCKS5",
      host: "backup-proxy.example.test",
      port: 1080,
      credentials: null,
      countryCode: "US",
      region: "NY",
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

function createAlternateHardwareFingerprint(): HardwareFingerprint {
  return {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15",
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
    languages: ["en-US"],
    hardwareConcurrency: 10,
    platform: "MacIntel",
    deviceMemoryGb: 16,
    timezone: "America/New_York",
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

function createCookies(): BrowserCookie[] {
  return [
    {
      name: "session",
      value: "abc123",
      domain: "example.test",
      path: "/",
      expiresAt: "2026-01-02T10:00:00.000Z",
      httpOnly: true,
      secure: true,
      sameSite: "LAX",
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
