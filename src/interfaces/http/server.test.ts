import { describe, expect, it } from "vitest";
import {
  InvalidApplicationOperationError,
  ProfileNotFoundError,
  toProfileDetailDto,
  toProfileSummaryDto,
} from "../../collector-profile-manager/application";
import type {
  CheckoutProfileInput,
  CheckoutProfileOutput,
  CreateProfileInput,
  GetProfileInput,
  GetProvisioningConfigurationInput,
  IngestProfileSessionInput,
  ListProfilesInput,
  ListProfilesOutput,
  ProfileDetail,
  ProvisioningConfiguration,
  ReleaseProfileLeaseInput,
  ReleaseProfileLeaseOutput,
  StartProfileProvisioningInput,
  StartProfileProvisioningOutput,
  UpdateProfileConfigurationInput,
} from "../../collector-profile-manager/application";
import {
  createPendingCollectorProfile,
} from "../../collector-profile-manager/domain";
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
  SafetyThresholds,
  TemporalRoutine,
} from "../../collector-profile-manager/domain";
import { createHttpServer } from "./server";
import type {
  CollectorProfileManagerHttpService,
} from "./routes/collector-profile-manager.routes";
import {
  createFakeContentManagerHttpService,
} from "./test-support/content-manager-http-service";

const now = "2026-01-05T18:00:00.000Z";

describe("HTTP server", () => {
  it("returns health status", async () => {
    const { server } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("lists profiles through the Collector Profile Manager service", async () => {
    const { server, service } = createTestServer();

    service.listProfiles.setOutput({
      items: [
        toProfileSummaryDto(
          createProfile({
            status: "READY",
            authenticationState: createAuthenticationState(),
            provisioningTokenStatus: "CONSUMED",
          }),
        ),
      ],
      page: {
        limit: 10,
        offset: 0,
        total: 1,
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profiles?status=READY&limit=10&offset=0",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.listProfiles.calls).toEqual([
        {
          status: "READY",
          limit: 10,
          offset: 0,
        },
      ]);
      expect(body).toMatchObject({
        items: [
          {
            id: "profile-1",
            displayName: "Profile 1",
            status: "READY",
            timezone: "America/Los_Angeles",
            hasAuthenticationState: true,
          },
        ],
        page: {
          limit: 10,
          offset: 0,
          total: 1,
        },
      });
      expect(body.items[0]).not.toHaveProperty("authenticationState");
      expect(body.items[0]).not.toHaveProperty("provisioningToken");
      expect(body.items[0]).not.toHaveProperty("provisioningTokenStatus");
      expect(JSON.stringify(body)).not.toContain("session-cookie-value");
      expect(JSON.stringify(body)).not.toContain("local-storage-value");
      expect(JSON.stringify(body)).not.toContain("provisioning-token-1");
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid profile list status query", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profiles?status=UNKNOWN",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.listProfiles.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid profile list limit query", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profiles?limit=0",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.listProfiles.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("gets a profile detail through the Collector Profile Manager service", async () => {
    const { server, service } = createTestServer();

    service.getProfile.setOutput(
      toProfileDetailDto(
        createProfile({
          status: "PENDING_LOGIN",
          authenticationState: createAuthenticationState(),
          provisioningTokenStatus: "ISSUED",
        }),
      ),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profiles/profile-1",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.getProfile.calls).toEqual([
        {
          profileId: "profile-1",
        },
      ]);
      expect(body).toMatchObject({
        profile: {
          id: "profile-1",
          displayName: "Profile 1",
          status: "PENDING_LOGIN",
          timezone: "America/Los_Angeles",
          hasAuthenticationState: true,
        },
      });
      expect(body.profile.networkContext.proxy).not.toHaveProperty(
        "credentials",
      );
      expect(body.profile).not.toHaveProperty("authenticationState");
      expect(body.profile).not.toHaveProperty("provisioningToken");
      expect(body.profile).not.toHaveProperty("provisioningTokenStatus");
      expect(JSON.stringify(body)).not.toContain("session-cookie-value");
      expect(JSON.stringify(body)).not.toContain("local-storage-value");
      expect(JSON.stringify(body)).not.toContain("provisioning-token-1");
      expect(JSON.stringify(body)).not.toContain("secret");
    } finally {
      await server.close();
    }
  });

  it("maps missing profile details to 404", async () => {
    const { server, service } = createTestServer();

    service.getProfile.setError(new ProfileNotFoundError("missing-profile"));

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profiles/missing-profile",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "PROFILE_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("creates a profile through the Collector Profile Manager service", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles",
        payload: {
          id: "profile-1",
          displayName: "Profile 1",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(service.createProfile.calls).toEqual([
        {
          id: "profile-1",
          displayName: "Profile 1",
        },
      ]);
      expect(response.json()).toMatchObject({
        profile: {
          id: "profile-1",
          displayName: "Profile 1",
          status: "PENDING_CONFIG",
          hasAuthenticationState: false,
          hasHardwareFingerprint: false,
          provisioningTokenStatus: "NOT_ISSUED",
        },
      });
      expect(response.json().profile).not.toHaveProperty("authenticationState");
      expect(response.json().profile).not.toHaveProperty("provisioningToken");
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid request bodies before calling the service", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles",
        payload: {
          id: "",
          displayName: "",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.createProfile.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("starts profile provisioning and returns the one-time token", async () => {
    const { server, service } = createTestServer();

    service.startProfileProvisioning.setOutput({
      profile: createProfile({
        status: "PENDING_LOGIN",
        provisioningTokenStatus: "ISSUED",
      }),
      provisioningToken: "provisioning-token-1",
      expiresAt: "2026-01-05T18:15:00.000Z",
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles/profile-1/provisioning/start",
      });

      expect(response.statusCode).toBe(200);
      expect(service.startProfileProvisioning.calls).toEqual([
        {
          profileId: "profile-1",
        },
      ]);
      expect(response.json()).toMatchObject({
        provisioningToken: "provisioning-token-1",
        expiresAt: "2026-01-05T18:15:00.000Z",
        profile: {
          id: "profile-1",
          status: "PENDING_LOGIN",
          provisioningTokenStatus: "ISSUED",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("returns provisioning configuration without authentication state", async () => {
    const { server, service } = createTestServer();

    service.getProvisioningConfiguration.setOutput({
      profileId: "profile-1",
      networkContext: createNetworkContext(),
      hardwareFingerprint: createHardwareFingerprint(),
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/provisioning/provisioning-token-1/configuration",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.getProvisioningConfiguration.calls).toEqual([
        {
          provisioningToken: "provisioning-token-1",
        },
      ]);
      expect(body).toMatchObject({
        profileId: "profile-1",
        networkContext: createSafeNetworkContext(),
        hardwareFingerprint: createHardwareFingerprint(),
      });
      expect(body.networkContext.proxy).not.toHaveProperty("credentials");
      expect(body).not.toHaveProperty("authenticationState");
      expect(body).not.toHaveProperty("provisioningToken");
      expect(JSON.stringify(body)).not.toContain("session-cookie-value");
      expect(JSON.stringify(body)).not.toContain("local-storage-value");
      expect(JSON.stringify(body)).not.toContain("secret");
    } finally {
      await server.close();
    }
  });

  it("ingests a provisioning session", async () => {
    const { server, service } = createTestServer();
    const cookies = createCookies();
    const localStorage = createLocalStorage();

    service.ingestProfileSession.setOutput(
      createProfile({
        status: "READY",
        authenticationState: createAuthenticationState(),
        provisioningTokenStatus: "CONSUMED",
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/provisioning/provisioning-token-1/session",
        payload: {
          cookies,
          localStorage,
          sessionExpiresAt: "2026-01-06T18:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.ingestProfileSession.calls).toEqual([
        {
          provisioningToken: "provisioning-token-1",
          cookies,
          localStorage,
          sessionExpiresAt: "2026-01-06T18:00:00.000Z",
        },
      ]);
      expect(response.json()).toMatchObject({
        profile: {
          id: "profile-1",
          status: "READY",
          hasAuthenticationState: true,
          provisioningTokenStatus: "CONSUMED",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("checks out a profile and returns the lease payload", async () => {
    const { server, service } = createTestServer();
    const checkoutOutput = createCheckoutOutput();

    service.checkoutProfile.setOutput(checkoutOutput);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles/checkout",
        payload: {
          profileId: "profile-1",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.checkoutProfile.calls).toEqual([
        {
          profileId: "profile-1",
        },
      ]);
      expect(response.json()).toEqual(checkoutOutput);
    } finally {
      await server.close();
    }
  });

  it("releases a profile lease", async () => {
    const { server, service } = createTestServer();
    const lease = createReleasedLease();

    service.releaseProfileLease.setOutput({
      lease,
      profile: createProfile({
        status: "READY",
        authenticationState: createAuthenticationState(),
        provisioningTokenStatus: "CONSUMED",
      }),
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profile-leases/lease-1/release",
        payload: {
          macroActionsPerformed: 7,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.releaseProfileLease.calls).toEqual([
        {
          leaseId: "lease-1",
          macroActionsPerformed: 7,
        },
      ]);
      expect(response.json()).toMatchObject({
        lease,
        profile: {
          id: "profile-1",
          status: "READY",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps profile not found errors to 404", async () => {
    const { server, service } = createTestServer();

    service.startProfileProvisioning.setError(
      new ProfileNotFoundError("missing-profile"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles/missing-profile/provisioning/start",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "PROFILE_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps invalid state conflicts to 409", async () => {
    const { server, service } = createTestServer();

    service.startProfileProvisioning.setError(
      new InvalidApplicationOperationError("Profile is in the wrong state."),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles/profile-1/provisioning/start",
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: {
          code: "INVALID_APPLICATION_OPERATION",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps unexpected errors to 500 without stack traces", async () => {
    const { server, service } = createTestServer();

    service.createProfile.setError(
      new Error("database password and stack should not leak"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profiles",
        payload: {
          id: "profile-1",
          displayName: "Profile 1",
        },
      });
      const bodyText = response.body;

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
      });
      expect(bodyText).not.toContain("database password");
      expect(bodyText).not.toContain("stack should not leak");
    } finally {
      await server.close();
    }
  });
});

class StubUseCase<Input, Output> {
  public readonly calls: Input[] = [];
  private error: unknown;

  public constructor(private output: Output) {}

  public setOutput(output: Output): void {
    this.output = output;
  }

  public setError(error: unknown): void {
    this.error = error;
  }

  public async execute(input: Input): Promise<Output> {
    this.calls.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.output;
  }
}

interface FakeCollectorProfileManager extends CollectorProfileManagerHttpService {
  readonly createProfile: StubUseCase<CreateProfileInput, CollectorProfile>;
  readonly getProfile: StubUseCase<GetProfileInput, ProfileDetail>;
  readonly listProfiles: StubUseCase<ListProfilesInput, ListProfilesOutput>;
  readonly updateProfileConfiguration: StubUseCase<
    UpdateProfileConfigurationInput,
    CollectorProfile
  >;
  readonly startProfileProvisioning: StubUseCase<
    StartProfileProvisioningInput,
    StartProfileProvisioningOutput
  >;
  readonly getProvisioningConfiguration: StubUseCase<
    GetProvisioningConfigurationInput,
    ProvisioningConfiguration
  >;
  readonly ingestProfileSession: StubUseCase<
    IngestProfileSessionInput,
    CollectorProfile
  >;
  readonly checkoutProfile: StubUseCase<
    CheckoutProfileInput | undefined,
    CheckoutProfileOutput
  >;
  readonly releaseProfileLease: StubUseCase<
    ReleaseProfileLeaseInput,
    ReleaseProfileLeaseOutput
  >;
}

function createTestServer(): {
  readonly server: ReturnType<typeof createHttpServer>;
  readonly service: FakeCollectorProfileManager;
} {
  const profile = createProfile();
  const service: FakeCollectorProfileManager = {
    createProfile: new StubUseCase(profile),
    getProfile: new StubUseCase(toProfileDetailDto(profile)),
    listProfiles: new StubUseCase({
      items: [toProfileSummaryDto(profile)],
      page: {
        limit: 25,
        offset: 0,
        total: 1,
      },
    }),
    updateProfileConfiguration: new StubUseCase(profile),
    startProfileProvisioning: new StubUseCase({
      profile: createProfile({
        status: "PENDING_LOGIN",
        provisioningTokenStatus: "ISSUED",
      }),
      provisioningToken: "provisioning-token-1",
      expiresAt: "2026-01-05T18:15:00.000Z",
    }),
    getProvisioningConfiguration: new StubUseCase({
      profileId: "profile-1",
      networkContext: createNetworkContext(),
      hardwareFingerprint: createHardwareFingerprint(),
    }),
    ingestProfileSession: new StubUseCase(
      createProfile({
        status: "READY",
        authenticationState: createAuthenticationState(),
        provisioningTokenStatus: "CONSUMED",
      }),
    ),
    checkoutProfile: new StubUseCase(createCheckoutOutput()),
    releaseProfileLease: new StubUseCase({
      lease: createReleasedLease(),
      profile: createProfile({
        status: "READY",
        authenticationState: createAuthenticationState(),
        provisioningTokenStatus: "CONSUMED",
      }),
    }),
  };

  return {
    server: createHttpServer({
      collectorProfileManager: service,
      contentManager: createFakeContentManagerHttpService(),
    }),
    service,
  };
}

interface CreateProfileOptions {
  readonly status?: CollectorProfile["identity"]["status"];
  readonly authenticationState?: AuthenticationState;
  readonly provisioningTokenStatus?: CollectorProfile["provisioningToken"]["status"];
}

function createProfile(options: CreateProfileOptions = {}): CollectorProfile {
  const status = options.status ?? "PENDING_CONFIG";
  const profile = createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt: now,
    networkContext: createNetworkContext(),
    hardwareFingerprint:
      status === "PENDING_CONFIG" ? null : createHardwareFingerprint(),
    behavioralPersona: createBehavioralPersona(),
    temporalRoutine: createTemporalRoutine(),
    safetyThresholds: createSafetyThresholds(),
    contentAffinities: createContentAffinities(),
  });
  const provisioningTokenStatus =
    options.provisioningTokenStatus ?? "NOT_ISSUED";

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status,
    },
    authenticationState:
      options.authenticationState ?? profile.authenticationState,
    provisioningToken:
      provisioningTokenStatus === "ISSUED"
        ? {
            status: "ISSUED",
            tokenHash: "provisioning-token-1",
            issuedAt: now,
            expiresAt: "2026-01-05T18:15:00.000Z",
            consumedAt: null,
          }
        : provisioningTokenStatus === "CONSUMED"
          ? {
              status: "CONSUMED",
              tokenHash: null,
              issuedAt: now,
              expiresAt: "2026-01-05T18:15:00.000Z",
              consumedAt: now,
            }
          : profile.provisioningToken,
  };
}

function createCheckoutOutput(): CheckoutProfileOutput {
  return {
    lease: createActiveLease(),
    profile: {
      profileId: "profile-1",
      networkContext: createNetworkContext(),
      hardwareFingerprint: createHardwareFingerprint(),
      authenticationState: createAuthenticationState(),
      behavioralPersona: createBehavioralPersona(),
      temporalRoutine: createTemporalRoutine(),
      safetyThresholds: createSafetyThresholds(),
      contentAffinities: createContentAffinities(),
    },
  };
}

function createActiveLease(): ProfileLease {
  return {
    id: "lease-1",
    profileId: "profile-1",
    leasedAt: now,
    expiresAt: "2026-01-05T18:45:00.000Z",
    releasedAt: null,
    status: "ACTIVE",
  };
}

function createReleasedLease(): ProfileLease {
  return {
    ...createActiveLease(),
    releasedAt: "2026-01-05T18:10:00.000Z",
    status: "RELEASED",
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

function createSafeNetworkContext() {
  const networkContext = createNetworkContext();

  if (networkContext.proxy === null) {
    return networkContext;
  }

  const { credentials: _credentials, ...proxy } = networkContext.proxy;

  return {
    proxy,
    killswitch: networkContext.killswitch,
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
