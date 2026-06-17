import { describe, expect, it } from "vitest";
import {
  KnownProfileAuthenticationHealthSchema,
  ProfileDetailResponseSchema,
  ProfileDetailSchema,
  ProfileMutationResponseSchema,
  ProfileMutationSummarySchema,
  ProfileSummarySchema,
  ProfilesListResponseSchema,
  StartProfileProvisioningResponseSchema,
  type ProfileAuthenticationHealth,
} from "@/lib/api/profile-manager-client";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = "2026-06-16T10:00:00.000Z";

function makeBaseSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "profile-1",
    displayName: "Profile 1",
    status: "READY",
    accountStage: "NEW_ACCOUNT",
    timezone: "America/New_York",
    createdAt: now,
    updatedAt: now,
    lastCheckoutAt: null,
    lastReleasedAt: null,
    nextAvailableAt: null,
    dailyUsage: {
      localDate: null,
      sessionsStarted: 0,
      activeDurationMinutes: 0,
      macroActions: 0,
    },
    hasHardwareFingerprint: false,
    hasAuthenticationState: false,
    authenticationHealth: "NOT_PROVISIONED",
    authenticationHealthUpdatedAt: now,
    ...overrides,
  };
}

function makeMutationSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "profile-1",
    displayName: "Profile 1",
    status: "PENDING_CONFIG",
    accountStage: "NEW_ACCOUNT",
    createdAt: now,
    updatedAt: now,
    lastCheckoutAt: null,
    lastReleasedAt: null,
    nextAvailableAt: null,
    dailyUsage: {
      localDate: null,
      sessionsStarted: 0,
      activeDurationMinutes: 0,
      macroActions: 0,
    },
    hasHardwareFingerprint: false,
    hasAuthenticationState: false,
    provisioningTokenStatus: "NOT_ISSUED",
    authenticationHealth: "NOT_PROVISIONED",
    authenticationHealthUpdatedAt: now,
    ...overrides,
  };
}


function makeDetailProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...makeBaseSummary(),
    networkContext: {
      proxy: null,
      killswitch: { enabled: true, failClosed: true },
    },
    hardwareFingerprint: null,
    behavioralPersona: {
      scrollStyle: "STEADY",
      microDelayMs: { min: 100, max: 500 },
      reverseScrollProbability: 0,
      dwellTimeMs: { min: 1000, max: 3000 },
    },
    temporalRoutine: {
      timezone: "America/New_York",
      chronotype: "MORNING",
      activeWindows: [],
      cooldownMinutes: 0,
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// KnownProfileAuthenticationHealthSchema — strict closed enum
// ---------------------------------------------------------------------------

describe("KnownProfileAuthenticationHealthSchema", () => {
  it.each([
    "NOT_PROVISIONED",
    "HEALTHY",
    "REAUTH_REQUIRED",
    "CHECKPOINT_REVIEW_REQUIRED",
  ] as const)("accepts known value %s", (value) => {
    expect(KnownProfileAuthenticationHealthSchema.safeParse(value).success).toBe(true);
  });

  it("rejects unknown value", () => {
    expect(KnownProfileAuthenticationHealthSchema.safeParse("UNKNOWN").success).toBe(false);
  });

  it("rejects lowercase variant", () => {
    expect(KnownProfileAuthenticationHealthSchema.safeParse("healthy").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(KnownProfileAuthenticationHealthSchema.safeParse("").success).toBe(false);
  });

  it("infers the correct TypeScript type", () => {
    const _value: ProfileAuthenticationHealth = "HEALTHY";
    expect(_value).toBe("HEALTHY");
  });
});

// ---------------------------------------------------------------------------
// ProfileSummarySchema — list item shape
// ---------------------------------------------------------------------------

describe("ProfileSummarySchema", () => {
  it("parses backend-shaped summary with NOT_PROVISIONED health", () => {
    const result = ProfileSummarySchema.safeParse(makeBaseSummary());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authenticationHealth).toBe("NOT_PROVISIONED");
      expect(result.data.authenticationHealthUpdatedAt).toBe(now);
    }
  });

  it.each(["HEALTHY", "REAUTH_REQUIRED", "CHECKPOINT_REVIEW_REQUIRED"] as const)(
    "parses backend-shaped summary with %s health",
    (health) => {
      const result = ProfileSummarySchema.safeParse(
        makeBaseSummary({ authenticationHealth: health }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authenticationHealth).toBe(health);
      }
    },
  );

  it("rejects unknown authenticationHealth value", () => {
    expect(ProfileSummarySchema.safeParse(
      makeBaseSummary({ authenticationHealth: "COMPROMISED" }),
    ).success).toBe(false);
  });

  it("rejects missing authenticationHealth", () => {
    const { authenticationHealth: _ah, ...withoutHealth } = makeBaseSummary() as Record<string, unknown>;
    expect(ProfileSummarySchema.safeParse(withoutHealth).success).toBe(false);
  });

  it("rejects missing authenticationHealthUpdatedAt", () => {
    const { authenticationHealthUpdatedAt: _ahu, ...withoutTimestamp } = makeBaseSummary() as Record<string, unknown>;
    expect(ProfileSummarySchema.safeParse(withoutTimestamp).success).toBe(false);
  });

  it("rejects cookies, localStorage, authenticationState, or provisioningToken in response", () => {
    for (const extra of ["cookies", "localStorage", "authenticationState", "provisioningToken", "tokenHash"]) {
      const result = ProfileSummarySchema.safeParse({ ...makeBaseSummary(), [extra]: [] });
      expect(result.success, `should reject extra field: ${extra}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// ProfilesListResponseSchema
// ---------------------------------------------------------------------------

describe("ProfilesListResponseSchema", () => {
  it("parses backend-shaped list response", () => {
    const result = ProfilesListResponseSchema.safeParse({
      items: [makeBaseSummary()],
      page: { limit: 25, offset: 0, total: 1 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]?.authenticationHealth).toBe("NOT_PROVISIONED");
    }
  });

  it("rejects list response with missing health field in item", () => {
    const { authenticationHealth: _ah, ...withoutHealth } = makeBaseSummary() as Record<string, unknown>;
    const result = ProfilesListResponseSchema.safeParse({
      items: [withoutHealth],
      page: { limit: 25, offset: 0 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProfileDetailSchema
// ---------------------------------------------------------------------------

describe("ProfileDetailSchema", () => {
  it("parses backend-shaped detail response", () => {
    const result = ProfileDetailSchema.safeParse(makeDetailProfile());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authenticationHealth).toBe("NOT_PROVISIONED");
      expect(result.data.authenticationHealthUpdatedAt).toBe(now);
    }
  });

  it("parses detail response with HEALTHY health", () => {
    const result = ProfileDetailSchema.safeParse(
      makeDetailProfile({ authenticationHealth: "HEALTHY" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects detail response with unknown health value", () => {
    expect(ProfileDetailSchema.safeParse(
      makeDetailProfile({ authenticationHealth: "EXPIRED" }),
    ).success).toBe(false);
  });

  it("rejects missing authenticationHealth in detail", () => {
    const { authenticationHealth: _ah, ...withoutHealth } = makeDetailProfile() as Record<string, unknown>;
    expect(ProfileDetailSchema.safeParse(withoutHealth).success).toBe(false);
  });

  it("rejects authenticationState, cookies in detail response", () => {
    expect(ProfileDetailSchema.safeParse({
      ...makeDetailProfile(),
      authenticationState: { cookies: [], localStorage: [] },
    }).success).toBe(false);
  });
});

describe("ProfileDetailResponseSchema", () => {
  it("parses backend-shaped get-profile response", () => {
    const result = ProfileDetailResponseSchema.safeParse({
      profile: makeDetailProfile(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile.authenticationHealth).toBe("NOT_PROVISIONED");
    }
  });
});


// ---------------------------------------------------------------------------
// ProfileMutationSummarySchema
// ---------------------------------------------------------------------------

describe("ProfileMutationSummarySchema", () => {
  it("parses backend-shaped mutation summary with NOT_PROVISIONED health", () => {
    const result = ProfileMutationSummarySchema.safeParse(makeMutationSummary());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authenticationHealth).toBe("NOT_PROVISIONED");
    }
  });

  it("parses mutation summary with HEALTHY health after session ingestion", () => {
    const result = ProfileMutationSummarySchema.safeParse(
      makeMutationSummary({
        status: "READY",
        provisioningTokenStatus: "CONSUMED",
        authenticationHealth: "HEALTHY",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authenticationHealth).toBe("HEALTHY");
    }
  });

  it("rejects unknown authenticationHealth value", () => {
    expect(ProfileMutationSummarySchema.safeParse(
      makeMutationSummary({ authenticationHealth: "UNKNOWN_VALUE" }),
    ).success).toBe(false);
  });

  it("rejects missing authenticationHealth field", () => {
    const { authenticationHealth: _ah, ...withoutHealth } = makeMutationSummary() as Record<string, unknown>;
    expect(ProfileMutationSummarySchema.safeParse(withoutHealth).success).toBe(false);
  });

  it("rejects missing authenticationHealthUpdatedAt field", () => {
    const { authenticationHealthUpdatedAt: _ahu, ...without } = makeMutationSummary() as Record<string, unknown>;
    expect(ProfileMutationSummarySchema.safeParse(without).success).toBe(false);
  });

  it("rejects cookies, localStorage, authenticationState, tokenHash in mutation summary", () => {
    for (const extra of ["cookies", "authenticationState", "tokenHash"]) {
      const result = ProfileMutationSummarySchema.safeParse({
        ...makeMutationSummary(),
        [extra]: [],
      });
      expect(result.success, `should reject extra field: ${extra}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// ProfileMutationResponseSchema
// ---------------------------------------------------------------------------

describe("ProfileMutationResponseSchema", () => {
  it("parses backend-shaped create-profile response", () => {
    const result = ProfileMutationResponseSchema.safeParse({
      profile: makeMutationSummary(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile.authenticationHealth).toBe("NOT_PROVISIONED");
    }
  });

  it("parses backend-shaped ingest-session response with HEALTHY health", () => {
    const result = ProfileMutationResponseSchema.safeParse({
      profile: makeMutationSummary({
        status: "READY",
        provisioningTokenStatus: "CONSUMED",
        authenticationHealth: "HEALTHY",
      }),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile.authenticationHealth).toBe("HEALTHY");
    }
  });

  it("rejects mutation response with missing health field", () => {
    const { authenticationHealth: _ah, ...withoutHealth } = makeMutationSummary() as Record<string, unknown>;
    expect(ProfileMutationResponseSchema.safeParse({ profile: withoutHealth }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// StartProfileProvisioningResponseSchema
// ---------------------------------------------------------------------------

describe("StartProfileProvisioningResponseSchema", () => {
  it("parses backend-shaped start-provisioning response", () => {
    const result = StartProfileProvisioningResponseSchema.safeParse({
      profile: makeMutationSummary({
        status: "PENDING_LOGIN",
        provisioningTokenStatus: "ISSUED",
      }),
      provisioningToken: "token-value",
      expiresAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile.authenticationHealth).toBe("NOT_PROVISIONED");
    }
  });

  it("rejects start-provisioning response with missing health field", () => {
    const { authenticationHealth: _ah, ...withoutHealth } = makeMutationSummary() as Record<string, unknown>;
    expect(StartProfileProvisioningResponseSchema.safeParse({
      profile: withoutHealth,
    }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listProfiles query serialization
// ---------------------------------------------------------------------------

import { createHttpClient } from "@/lib/api/http-client";
import { createProfileManagerClient } from "@/lib/api/profile-manager-client";

describe("createProfileManagerClient.listProfiles query serialization", () => {
  it("serializes status, authenticationHealth, limit, and offset", async () => {
    let observedUrl: string | undefined;
    const httpClient = createHttpClient({
      baseUrl: "http://api.test",
      fetchImpl: async (input) => {
        observedUrl = String(input);
        return new Response(
          JSON.stringify({
            items: [],
            page: { limit: 25, offset: 0, total: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    const client = createProfileManagerClient(httpClient);

    await client.listProfiles({
      status: "READY",
      authenticationHealth: "REAUTH_REQUIRED",
      limit: 25,
      offset: 50,
    });

    expect(observedUrl).toBe(
      "http://api.test/collector/profiles?status=READY&authenticationHealth=REAUTH_REQUIRED&limit=25&offset=50",
    );
  });

  it("omits undefined filter values from the query string", async () => {
    let observedUrl: string | undefined;
    const httpClient = createHttpClient({
      baseUrl: "http://api.test",
      fetchImpl: async (input) => {
        observedUrl = String(input);
        return new Response(
          JSON.stringify({
            items: [],
            page: { limit: 25, offset: 0, total: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    const client = createProfileManagerClient(httpClient);

    await client.listProfiles({ limit: 25, offset: 0 });

    expect(observedUrl).toBe(
      "http://api.test/collector/profiles?limit=25&offset=0",
    );
  });
});
