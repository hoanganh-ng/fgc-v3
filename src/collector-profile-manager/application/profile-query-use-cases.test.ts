import { describe, expect, it } from "vitest";
import {
  GetProfileUseCase,
  InvalidProfileQueryError,
  ListProfilesUseCase,
  MAX_PROFILE_LIST_LIMIT,
  ProfileNotFoundError,
} from "./index";
import { InMemoryProfileRepository } from "./test-support/in-memory-repositories";
import { createPendingCollectorProfile } from "../domain";
import type {
  AuthenticationState,
  BehavioralPersona,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  NetworkContext,
  ProfileStatus,
  ProvisioningTokenState,
  SafetyThresholds,
  TemporalRoutine,
} from "../domain";

const createdAt = "2026-01-05T18:00:00.000Z";

describe("collector profile query use cases", () => {
  it("gets a profile detail by id without exposing sensitive fields", async () => {
    const repository = new InMemoryProfileRepository();
    const profile = createProfile("profile-1", {
      status: "PENDING_LOGIN",
      authenticationState: createAuthenticationState(),
      provisioningToken: createIssuedProvisioningToken(),
    });

    await repository.save(profile);

    const detail = await new GetProfileUseCase(repository).execute({
      profileId: "profile-1",
    });
    const detailJson = JSON.stringify(detail);

    expect(detail).toMatchObject({
      id: "profile-1",
      displayName: "Profile profile-1",
      status: "PENDING_LOGIN",
      timezone: "America/Los_Angeles",
      hasAuthenticationState: true,
    });
    expect(detail.networkContext.proxy).not.toHaveProperty("credentials");
    expect(detail).not.toHaveProperty("authenticationState");
    expect(detail).not.toHaveProperty("provisioningToken");
    expect(detail).not.toHaveProperty("provisioningTokenStatus");
    expect(detailJson).not.toContain("session-cookie-value");
    expect(detailJson).not.toContain("local-storage-value");
    expect(detailJson).not.toContain("provisioning-token-secret");
    expect(detailJson).not.toContain("proxy-password");
  });

  it("throws ProfileNotFoundError when the profile is missing", async () => {
    const repository = new InMemoryProfileRepository();

    await expect(
      new GetProfileUseCase(repository).execute({
        profileId: "missing-profile",
      }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("lists profile summaries with offset pagination", async () => {
    const repository = new InMemoryProfileRepository();

    await repository.save(
      createProfile("profile-1", {
        createdAt: "2026-01-05T18:00:00.000Z",
      }),
    );
    await repository.save(
      createProfile("profile-2", {
        createdAt: "2026-01-05T18:01:00.000Z",
      }),
    );
    await repository.save(
      createProfile("profile-3", {
        createdAt: "2026-01-05T18:02:00.000Z",
      }),
    );

    const output = await new ListProfilesUseCase(repository).execute({
      limit: 2,
      offset: 1,
    });

    expect(output.items.map((profile) => profile.id)).toEqual([
      "profile-2",
      "profile-3",
    ]);
    expect(output.page).toEqual({
      limit: 2,
      offset: 1,
      total: 3,
    });
  });

  it("clamps large limits and rejects invalid pagination input", async () => {
    const repository = new InMemoryProfileRepository();

    await repository.save(createProfile("profile-1"));

    const output = await new ListProfilesUseCase(repository).execute({
      limit: MAX_PROFILE_LIST_LIMIT + 1,
    });

    expect(output.page.limit).toBe(MAX_PROFILE_LIST_LIMIT);
    await expect(
      new ListProfilesUseCase(repository).execute({
        limit: 0,
      }),
    ).rejects.toThrow(InvalidProfileQueryError);
    await expect(
      new ListProfilesUseCase(repository).execute({
        offset: -1,
      }),
    ).rejects.toThrow(InvalidProfileQueryError);
  });

  it("filters profile summaries by status", async () => {
    const repository = new InMemoryProfileRepository();

    await repository.save(createProfile("ready-profile", { status: "READY" }));
    await repository.save(createProfile("busy-profile", { status: "BUSY" }));

    const output = await new ListProfilesUseCase(repository).execute({
      status: "READY",
    });

    expect(output.items.map((profile) => profile.id)).toEqual([
      "ready-profile",
    ]);
  });

  it("omits authentication and provisioning state from list summaries", async () => {
    const repository = new InMemoryProfileRepository();

    await repository.save(
      createProfile("profile-1", {
        status: "PENDING_LOGIN",
        authenticationState: createAuthenticationState(),
        provisioningToken: createIssuedProvisioningToken(),
      }),
    );

    const output = await new ListProfilesUseCase(repository).execute();
    const outputJson = JSON.stringify(output);
    const summary = output.items[0];

    if (summary === undefined) {
      throw new Error("Expected list output to contain one profile summary.");
    }

    expect(summary).not.toHaveProperty("authenticationState");
    expect(summary).not.toHaveProperty("provisioningToken");
    expect(summary).not.toHaveProperty("provisioningTokenStatus");
    expect(outputJson).not.toContain("session-cookie-value");
    expect(outputJson).not.toContain("local-storage-value");
    expect(outputJson).not.toContain("provisioning-token-secret");
  });
});

interface CreateProfileOptions {
  readonly status?: ProfileStatus;
  readonly createdAt?: string;
  readonly authenticationState?: AuthenticationState;
  readonly provisioningToken?: ProvisioningTokenState;
}

function createProfile(
  id: string,
  options: CreateProfileOptions = {},
): CollectorProfile {
  const profileCreatedAt = options.createdAt ?? createdAt;
  const profile = createPendingCollectorProfile({
    id,
    displayName: `Profile ${id}`,
    createdAt: profileCreatedAt,
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
      status: options.status ?? profile.identity.status,
      updatedAt: profileCreatedAt,
    },
    authenticationState:
      options.authenticationState ?? profile.authenticationState,
    provisioningToken: options.provisioningToken ?? profile.provisioningToken,
  };
}

function createNetworkContext(): NetworkContext {
  return {
    proxy: {
      protocol: "HTTPS",
      host: "proxy.example.test",
      port: 443,
      credentials: {
        username: "proxy-user",
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
    cookies: [
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
    ],
    localStorage: [
      {
        origin: "https://example.test",
        key: "auth",
        value: "local-storage-value",
      },
    ],
    sessionCapturedAt: createdAt,
    sessionExpiresAt: "2026-01-06T18:00:00.000Z",
  };
}

function createIssuedProvisioningToken(): ProvisioningTokenState {
  return {
    status: "ISSUED",
    tokenHash: "provisioning-token-secret",
    issuedAt: createdAt,
    expiresAt: "2026-01-05T18:15:00.000Z",
    consumedAt: null,
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
