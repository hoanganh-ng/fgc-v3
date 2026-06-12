import { describe, expect, it } from "vitest";
import {
  GetRuntimeProfileConfigurationUseCase,
  ProfileLeaseAlreadyClosedError,
  ProfileLeaseNotFoundError,
  ProfileLeaseStateConflictError,
} from "./index";
import type { Clock } from "./index";
import {
  InMemoryProfileLeaseRepository,
  InMemoryProfileRepository,
} from "./test-support/in-memory-repositories";
import { createPendingCollectorProfile } from "../domain";
import type {
  AuthenticationState,
  BehavioralPersona,
  BrowserCookie,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  LocalStorageEntry,
  NetworkContext,
  ProfileLease,
  ProvisioningTokenState,
  SafetyThresholds,
  TemporalRoutine,
} from "../domain";

const now = "2026-01-05T18:00:00.000Z";
const leaseExpiresAt = "2026-01-05T18:45:00.000Z";

describe("runtime profile configuration use case", () => {
  it("returns browser runtime configuration for an active lease", async () => {
    const context = createTestContext();
    const profile = createProfile({
      status: "BUSY",
      authenticationState: createAuthenticationState(),
      provisioningToken: createIssuedProvisioningToken(),
    });

    await context.profiles.save(profile);
    await context.leases.save(createActiveLease());

    const configuration = await new GetRuntimeProfileConfigurationUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId: "lease-1" });
    const configurationJson = JSON.stringify(configuration);

    expect(configuration).toEqual({
      profileId: "profile-1",
      leaseId: "lease-1",
      leaseExpiresAt,
      hardwareFingerprint: createHardwareFingerprint(),
      networkContext: createNetworkContext(),
      authenticationState: createAuthenticationState(),
      temporalRoutine: createTemporalRoutine(),
      safetyThresholds: createSafetyThresholds(),
      contentAffinities: createContentAffinities(),
    });
    expect(configuration).not.toHaveProperty("provisioningToken");
    expect(configurationJson).not.toContain("provisioning-token-hash");
    expect(configurationJson).not.toContain("ISSUED");
  });

  it("rejects missing leases", async () => {
    const context = createTestContext();

    await expect(
      new GetRuntimeProfileConfigurationUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId: "missing-lease" }),
    ).rejects.toThrow(ProfileLeaseNotFoundError);
  });

  it("rejects released leases", async () => {
    const context = createTestContext();

    await context.profiles.save(createProfile({ status: "BUSY" }));
    await context.leases.save({
      ...createActiveLease(),
      releasedAt: "2026-01-05T18:10:00.000Z",
      status: "RELEASED",
    });

    await expectRuntimeConfigurationRejection(
      context,
      ProfileLeaseAlreadyClosedError,
    );
  });

  it("rejects expired active leases", async () => {
    const context = createTestContext();

    await context.profiles.save(createProfile({ status: "BUSY" }));
    await context.leases.save({
      ...createActiveLease(),
      expiresAt: "2026-01-05T17:59:00.000Z",
    });

    await expectRuntimeConfigurationRejection(
      context,
      ProfileLeaseAlreadyClosedError,
    );
  });

  it("rejects leases whose profile is no longer busy", async () => {
    const context = createTestContext();

    await context.profiles.save(createProfile({ status: "READY" }));
    await context.leases.save(createActiveLease());

    await expectRuntimeConfigurationRejection(
      context,
      ProfileLeaseStateConflictError,
    );
  });
});

interface TestContext {
  readonly profiles: InMemoryProfileRepository;
  readonly leases: InMemoryProfileLeaseRepository;
  readonly clock: FixedClock;
}

function createTestContext(): TestContext {
  return {
    profiles: new InMemoryProfileRepository(),
    leases: new InMemoryProfileLeaseRepository(),
    clock: new FixedClock(now),
  };
}

async function expectRuntimeConfigurationRejection(
  context: TestContext,
  expectedError:
    | typeof ProfileLeaseAlreadyClosedError
    | typeof ProfileLeaseStateConflictError,
): Promise<void> {
  await expect(
    new GetRuntimeProfileConfigurationUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId: "lease-1" }),
  ).rejects.toThrow(expectedError);
}

class FixedClock implements Clock {
  public constructor(private readonly isoDateTime: string) {}

  public now(): Date {
    return new Date(this.isoDateTime);
  }
}

interface CreateProfileOptions {
  readonly status?: CollectorProfile["identity"]["status"];
  readonly authenticationState?: AuthenticationState;
  readonly provisioningToken?: ProvisioningTokenState;
}

function createProfile(options: CreateProfileOptions = {}): CollectorProfile {
  const profile = createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt: now,
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
      status: options.status ?? "BUSY",
      updatedAt: now,
    },
    authenticationState:
      options.authenticationState ?? createAuthenticationState(),
    provisioningToken:
      options.provisioningToken ?? profile.provisioningToken,
  };
}

function createActiveLease(): ProfileLease {
  return {
    id: "lease-1",
    profileId: "profile-1",
    purpose: "COLLECTION",
    leasedAt: now,
    expiresAt: leaseExpiresAt,
    releasedAt: null,
    status: "ACTIVE",
  };
}

function createNetworkContext(): NetworkContext {
  return {
    proxy: {
      protocol: "HTTPS",
      host: "proxy.example.test",
      port: 443,
      credentials: {
        username: "collector",
        password: "proxy-password",
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
    cookies: createCookies(),
    localStorage: createLocalStorage(),
    sessionCapturedAt: now,
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

function createCookies(): BrowserCookie[] {
  return [
    {
      name: "session",
      value: "session-cookie-value",
      domain: "example.test",
      path: "/",
      expiresAt: "2026-01-06T18:00:00.000Z",
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
      value: "local-storage-value",
    },
  ];
}

function createIssuedProvisioningToken(): ProvisioningTokenState {
  return {
    status: "ISSUED",
    tokenHash: "provisioning-token-hash",
    issuedAt: now,
    expiresAt: "2026-01-05T18:15:00.000Z",
    consumedAt: null,
  };
}
