import { describe, expect, it } from "vitest";
import {
  ImmutableFingerprintViolationError,
  InvalidProfileAccountStageTransitionError,
  InvalidProfileStateTransitionError,
  InvalidProvisioningRecoveryTransitionError,
  MissingRequiredProfileConfigurationError,
  assignHardwareFingerprint,
  createProfileSourceAccess,
  createPendingCollectorProfile,
  markCollectorProfileSessionIngested,
  transitionCollectorProfileStatusForProvisioning,
  transitionProfileAccountStage,
  transitionProfileStatus,
  updateProfileSourceAccess,
  validateCollectorProfile,
  validateProfileSourceAccess,
} from "./index";
import type {
  CollectorProfile,
  HardwareFingerprint,
  ProfileAccountStage,
  ProfileAuthenticationHealth,
  ProfileSourceAccess,
  ProfileStatus,
  ValidationIssue,
} from "./index";

const createdAt = "2026-01-01T00:00:00.000Z";
const updatedAt = "2026-01-01T00:05:00.000Z";

const hardwareFingerprint: HardwareFingerprint = {
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  viewport: {
    width: 1366,
    height: 768,
  },
  languages: ["en-US", "en"],
  hardwareConcurrency: 8,
};

describe("profile state machine", () => {
  const allowedTransitions: readonly (readonly [ProfileStatus, ProfileStatus])[] =
    [
      ["PENDING_CONFIG", "PENDING_LOGIN"],
      ["PENDING_LOGIN", "READY"],
      ["READY", "BUSY"],
      ["BUSY", "READY"],
    ];

  for (const [from, to] of allowedTransitions) {
    it(`allows ${from} -> ${to}`, () => {
      expect(transitionProfileStatus(from, to)).toBe(to);
    });
  }

  const invalidTransitions: readonly (readonly [ProfileStatus, ProfileStatus])[] =
    [
      ["PENDING_CONFIG", "READY"],
      ["PENDING_CONFIG", "BUSY"],
      ["PENDING_LOGIN", "BUSY"],
      ["PENDING_LOGIN", "PENDING_CONFIG"],
      ["BUSY", "PENDING_LOGIN"],
      ["PENDING_CONFIG", "PENDING_CONFIG"],
      ["PENDING_LOGIN", "PENDING_LOGIN"],
      ["READY", "READY"],
      ["BUSY", "BUSY"],
    ];

  // Sprint 055: READY -> PENDING_LOGIN is a guarded recovery transition
  // permitted by the state machine and orchestrated by
  // `StartProfileProvisioningUseCase`. The eligibility invariant lives
  // in `canStartProvisioning`; the state machine simply permits the
  // transition.
  it("permits READY -> PENDING_LOGIN (Sprint 055 recovery)", () => {
    expect(() => transitionProfileStatus("READY", "PENDING_LOGIN")).not.toThrow();
  });

  for (const [from, to] of invalidTransitions) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(() => transitionProfileStatus(from, to)).toThrow(
        InvalidProfileStateTransitionError,
      );
    });
  }
});

describe("profile account stage state machine", () => {
  const allowedTransitions: readonly (readonly [
    ProfileAccountStage,
    ProfileAccountStage,
  ])[] = [
    ["NEW_ACCOUNT", "WARMING"],
    ["NEW_ACCOUNT", "NEEDS_REVIEW"],
    ["WARMING", "COLLECTION_READY"],
    ["WARMING", "LIMITED"],
    ["WARMING", "NEEDS_REVIEW"],
    ["COLLECTION_READY", "LIMITED"],
    ["COLLECTION_READY", "NEEDS_REVIEW"],
    ["COLLECTION_READY", "RETIRED"],
    ["LIMITED", "WARMING"],
    ["LIMITED", "COLLECTION_READY"],
    ["LIMITED", "RETIRED"],
    ["NEEDS_REVIEW", "WARMING"],
    ["NEEDS_REVIEW", "RETIRED"],
  ];

  for (const [from, to] of allowedTransitions) {
    it(`allows ${from} -> ${to}`, () => {
      expect(transitionProfileAccountStage(from, to)).toBe(to);
    });
  }

  const invalidTransitions: readonly (readonly [
    ProfileAccountStage,
    ProfileAccountStage,
  ])[] = [
    ["RETIRED", "WARMING"],
    ["RETIRED", "COLLECTION_READY"],
    ["NEW_ACCOUNT", "COLLECTION_READY"],
    ["NEW_ACCOUNT", "RETIRED"],
    ["NEEDS_REVIEW", "COLLECTION_READY"],
    ["LIMITED", "NEW_ACCOUNT"],
    ["COLLECTION_READY", "NEW_ACCOUNT"],
    ["NEW_ACCOUNT", "NEW_ACCOUNT"],
  ];

  for (const [from, to] of invalidTransitions) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(() => transitionProfileAccountStage(from, to)).toThrow(
        InvalidProfileAccountStageTransitionError,
      );
    });
  }
});

describe("profile domain errors", () => {
  it("throws InvalidProfileStateTransitionError for invalid transitions", () => {
    expect(() => transitionProfileStatus("READY", "PENDING_CONFIG")).toThrow(
      InvalidProfileStateTransitionError,
    );
  });

  it("throws InvalidProfileAccountStageTransitionError for invalid account stage transitions", () => {
    expect(() =>
      transitionProfileAccountStage("NEEDS_REVIEW", "COLLECTION_READY"),
    ).toThrow(InvalidProfileAccountStageTransitionError);
  });

  it("throws ImmutableFingerprintViolationError when assigning hardware fingerprint twice", () => {
    const profile = createMinimalProfile();
    const assignedProfile = assignHardwareFingerprint(
      profile,
      hardwareFingerprint,
      updatedAt,
    );

    expect(() =>
      assignHardwareFingerprint(assignedProfile, hardwareFingerprint, updatedAt),
    ).toThrow(ImmutableFingerprintViolationError);
  });
});

describe("collector profile validation", () => {
  it("defaults new profiles to NEW_ACCOUNT", () => {
    expect(createMinimalProfile().identity.accountStage).toBe("NEW_ACCOUNT");
  });

  it("passes a valid minimal profile", () => {
    const result = validateCollectorProfile(createMinimalProfile());

    expect(result.valid).toBe(true);
  });

  it("fails when status is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      identity: {
        ...profile.identity,
        status: "UNKNOWN",
      },
    });

    expectValidationIssue(result, "identity.status");
  });

  it("fails when account stage is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      identity: {
        ...profile.identity,
        accountStage: "UNKNOWN",
      },
    });

    expectValidationIssue(result, "identity.accountStage");
  });

  it("fails when a required property group is missing", () => {
    const { networkContext: _networkContext, ...profileWithoutNetworkContext } =
      createMinimalProfile();

    const result = validateCollectorProfile(profileWithoutNetworkContext);

    expectValidationIssue(result, "networkContext");
  });

  it("accepts valid UNCONFIGURED, DIRECT, and PROXY network contexts", () => {
    const profile = createMinimalProfile();

    expect(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "UNCONFIGURED",
          proxy: null,
          killswitch: { enabled: true, failClosed: true },
        },
      }).valid,
    ).toBe(true);

    expect(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "DIRECT",
          proxy: null,
          killswitch: { enabled: false, failClosed: false },
        },
      }).valid,
    ).toBe(true);

    expect(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "PROXY",
          proxy: {
            protocol: "HTTPS",
            host: "proxy.example.test",
            port: 443,
            credentials: null,
          },
          killswitch: { enabled: true, failClosed: true },
        },
      }).valid,
    ).toBe(true);
  });

  it("rejects unknown and contradictory network modes", () => {
    const profile = createMinimalProfile();

    expectValidationIssue(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "VPN",
          proxy: null,
          killswitch: { enabled: false, failClosed: false },
        },
      }),
      "networkContext.mode",
    );

    expectValidationIssue(
      validateCollectorProfile({
        ...profile,
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
      }),
      "networkContext.proxy",
    );

    expectValidationIssue(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "DIRECT",
          proxy: null,
          killswitch: { enabled: true, failClosed: false },
        },
      }),
      "networkContext.killswitch",
    );

    expectValidationIssue(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "PROXY",
          proxy: null,
          killswitch: { enabled: true, failClosed: true },
        },
      }),
      "networkContext.proxy",
    );

    expectValidationIssue(
      validateCollectorProfile({
        ...profile,
        networkContext: {
          mode: "UNCONFIGURED",
          proxy: {
            protocol: "HTTPS",
            host: "proxy.example.test",
            port: 443,
            credentials: null,
          },
          killswitch: { enabled: true, failClosed: true },
        },
      }),
      "networkContext.proxy",
    );
  });

  it("treats UNCONFIGURED as missing required configuration and accepts DIRECT", () => {
    const unconfigured = createMinimalProfile();
    const configured = createPendingConfigProfile();
    const directConfigured: CollectorProfile = {
      ...configured,
      networkContext: {
        mode: "DIRECT",
        proxy: null,
        killswitch: { enabled: false, failClosed: false },
      },
    };

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        unconfigured,
        "PENDING_LOGIN",
        updatedAt,
      ),
    ).toThrow(MissingRequiredProfileConfigurationError);

    expect(
      transitionCollectorProfileStatusForProvisioning(
        directConfigured,
        "PENDING_LOGIN",
        updatedAt,
      ).identity.status,
    ).toBe("PENDING_LOGIN");
  });

  it("fails when provisioning token state is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      provisioningToken: {
        status: "ISSUED",
        tokenHash: null,
        issuedAt: createdAt,
        expiresAt: updatedAt,
        consumedAt: null,
      },
    });

    expectValidationIssue(result, "provisioningToken");
  });

  it("fails when cookie shape is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      authenticationState: {
        ...profile.authenticationState,
        cookies: [
          {
            name: "session",
            value: "abc",
            domain: "example.test",
            path: "/",
            expiresAt: null,
            httpOnly: "yes",
            secure: true,
          },
        ],
      },
    });

    expectValidationIssue(result, "authenticationState.cookies.0.httpOnly");
  });

  it("fails when local storage shape is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      authenticationState: {
        ...profile.authenticationState,
        localStorage: [
          {
            origin: "https://example.test",
            key: "",
            value: "stored-value",
          },
        ],
      },
    });

    expectValidationIssue(result, "authenticationState.localStorage.0.key");
  });

  it("fails when temporal window shape is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      temporalRoutine: {
        ...profile.temporalRoutine,
        activeWindows: [
          {
            days: [1, 2, 3],
            startsAt: "25:00",
            endsAt: "17:00",
          },
        ],
      },
    });

    expectValidationIssue(result, "temporalRoutine.activeWindows.0.startsAt");
  });

  it("fails when content affinity shape is invalid", () => {
    const profile = createMinimalProfile();
    const result = validateCollectorProfile({
      ...profile,
      contentAffinities: {
        ...profile.contentAffinities,
        primaryTopics: [
          {
            topic: "",
            weight: 1,
          },
        ],
      },
    });

    expectValidationIssue(result, "contentAffinities.primaryTopics.0.topic");
  });
});

describe("profile-source access domain", () => {
  it("creates access records with checked and success timestamps", () => {
    const access = createProfileSourceAccess({
      id: "access-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "PUBLIC_ACCESSIBLE",
      checkedAt: createdAt,
    });

    expect(access).toMatchObject({
      id: "access-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "PUBLIC_ACCESSIBLE",
      lastCheckedAt: createdAt,
      lastSuccessfulAt: createdAt,
      joinRequestedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    expect(validateProfileSourceAccess(access).valid).toBe(true);
  });

  it("updates timestamps while preserving createdAt", () => {
    const access = createProfileSourceAccess({
      id: "access-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "UNKNOWN",
      checkedAt: createdAt,
    });
    const updatedAccess = updateProfileSourceAccess(access, {
      accessState: "JOIN_REQUESTED",
      checkedAt: updatedAt,
    });

    expect(updatedAccess.createdAt).toBe(createdAt);
    expect(updatedAccess.updatedAt).toBe(updatedAt);
    expect(updatedAccess.lastCheckedAt).toBe(updatedAt);
    expect(updatedAccess.joinRequestedAt).toBe(updatedAt);
  });

  it("sets lastSuccessfulAt for joined access", () => {
    const access = createProfileSourceAccess({
      id: "access-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "JOINED_ACCESSIBLE",
      checkedAt: updatedAt,
    });

    expect(access.lastSuccessfulAt).toBe(updatedAt);
  });

  it("fails when access state is invalid", () => {
    const result = validateProfileSourceAccess({
      ...createMinimalProfileSourceAccess(),
      accessState: "MAYBE_ACCESSIBLE",
    });

    expectValidationIssue(result, "accessState");
  });

  it("fails when failure reason text is unsafe", () => {
    const result = validateProfileSourceAccess({
      ...createMinimalProfileSourceAccess(),
      lastFailureReason: {
        code: "COOKIE_VISIBLE",
        message: "Cookie value was present.",
      },
    });

    expectValidationIssue(result, "lastFailureReason.code");
  });
});

function createMinimalProfile(): CollectorProfile {
  return createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt,
  });
}

function createMinimalProfileSourceAccess(): ProfileSourceAccess {
  return createProfileSourceAccess({
    id: "access-1",
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    accessState: "UNKNOWN",
    checkedAt: createdAt,
  });
}

function expectValidationIssue(
  result:
    | {
        readonly valid: true;
        readonly value: unknown;
      }
    | {
        readonly valid: false;
        readonly issues: readonly ValidationIssue[];
      },
  path: string,
): void {
  expect(result.valid).toBe(false);

  if (!result.valid) {
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  }
}

describe("transitionCollectorProfileStatusForProvisioning domain backstop", () => {
  // Sprint 055 review finding 1: the full-profile mutation boundary
  // for the recovery transition must refuse to bypass the health
  // guard even if a direct caller (e.g. another use case) skips the
  // application precheck.

  it("rejects READY + HEALTHY -> PENDING_LOGIN", () => {
    const profile = createReadyProfileWithHealth("HEALTHY");

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        profile,
        "PENDING_LOGIN",
        updatedAt,
      ),
    ).toThrow(InvalidProvisioningRecoveryTransitionError);
  });

  it("rejects READY + NOT_PROVISIONED -> PENDING_LOGIN", () => {
    const profile = createReadyProfileWithHealth("NOT_PROVISIONED");

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        profile,
        "PENDING_LOGIN",
        updatedAt,
      ),
    ).toThrow(InvalidProvisioningRecoveryTransitionError);
  });

  it("includes the current health in the thrown domain error", () => {
    const profile = createReadyProfileWithHealth("HEALTHY");

    try {
      transitionCollectorProfileStatusForProvisioning(
        profile,
        "PENDING_LOGIN",
        updatedAt,
      );
      throw new Error("expected InvalidProvisioningRecoveryTransitionError");
    } catch (error) {
      expect(error).toBeInstanceOf(
        InvalidProvisioningRecoveryTransitionError as unknown as new (
          health: ProfileAuthenticationHealth,
        ) => Error,
      );
      const domainError = error as InstanceType<
        typeof InvalidProvisioningRecoveryTransitionError
      >;
      expect(domainError.currentHealth).toBe("HEALTHY");
      expect(domainError.code).toBe("INVALID_PROVISIONING_RECOVERY_TRANSITION");
      expect(domainError.profileId).toBe(profile.identity.id);
    }
  });

  it("permits READY + REAUTH_REQUIRED -> PENDING_LOGIN", () => {
    const profile = createReadyProfileWithHealth("REAUTH_REQUIRED");

    const next = transitionCollectorProfileStatusForProvisioning(
      profile,
      "PENDING_LOGIN",
      updatedAt,
    );

    expect(next.identity.status).toBe("PENDING_LOGIN");
    expect(next.identity.updatedAt).toBe(updatedAt);
    expect(next.authenticationHealth).toBe("REAUTH_REQUIRED");
  });

  it("permits READY + CHECKPOINT_REVIEW_REQUIRED -> PENDING_LOGIN", () => {
    const profile = createReadyProfileWithHealth("CHECKPOINT_REVIEW_REQUIRED");

    const next = transitionCollectorProfileStatusForProvisioning(
      profile,
      "PENDING_LOGIN",
      updatedAt,
    );

    expect(next.identity.status).toBe("PENDING_LOGIN");
    expect(next.identity.updatedAt).toBe(updatedAt);
    expect(next.authenticationHealth).toBe("CHECKPOINT_REVIEW_REQUIRED");
  });

  it("preserves health, health timestamp, and authentication state on the recovery transition", () => {
    const profile = createReadyProfileWithHealth(
      "REAUTH_REQUIRED",
      "2026-01-01T00:30:00.000Z",
    );
    const originalAuthState = profile.authenticationState;
    const originalAccountStage = profile.identity.accountStage;
    const originalHardwareFingerprint = profile.hardwareFingerprint;
    const originalNetworkContext = profile.networkContext;

    const next = transitionCollectorProfileStatusForProvisioning(
      profile,
      "PENDING_LOGIN",
      updatedAt,
    );

    expect(next.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(next.authenticationHealthUpdatedAt).toBe(
      "2026-01-01T00:30:00.000Z",
    );
    expect(next.authenticationState).toEqual(originalAuthState);
    expect(next.identity.accountStage).toBe(originalAccountStage);
    expect(next.hardwareFingerprint).toEqual(originalHardwareFingerprint);
    expect(next.networkContext).toEqual(originalNetworkContext);
  });

  it("permits PENDING_CONFIG -> PENDING_LOGIN with required configuration", () => {
    const profile = createPendingConfigProfile();

    const next = transitionCollectorProfileStatusForProvisioning(
      profile,
      "PENDING_LOGIN",
      updatedAt,
    );

    expect(next.identity.status).toBe("PENDING_LOGIN");
    expect(next.identity.updatedAt).toBe(updatedAt);
  });

  it("rejects PENDING_CONFIG -> PENDING_LOGIN when required configuration is missing", () => {
    const profile = createMinimalProfile();

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        profile,
        "PENDING_LOGIN",
        updatedAt,
      ),
    ).toThrow(MissingRequiredProfileConfigurationError);
  });

  it("preserves status and updates updatedAt on PENDING_LOGIN restart", () => {
    const profile = createPendingLoginProfile("REAUTH_REQUIRED");

    const next = transitionCollectorProfileStatusForProvisioning(
      profile,
      "PENDING_LOGIN",
      updatedAt,
    );

    expect(next.identity.status).toBe("PENDING_LOGIN");
    expect(next.identity.updatedAt).toBe(updatedAt);
    expect(next.authenticationHealth).toBe("REAUTH_REQUIRED");
  });

  it("rejects BUSY -> PENDING_LOGIN via the state machine", () => {
    const profile = createReadyProfileWithHealth("REAUTH_REQUIRED");
    const busy: CollectorProfile = {
      ...profile,
      identity: { ...profile.identity, status: "BUSY" },
    };

    expect(() =>
      transitionCollectorProfileStatusForProvisioning(
        busy,
        "PENDING_LOGIN",
        updatedAt,
      ),
    ).toThrow(InvalidProfileStateTransitionError);
  });
});

function createReadyProfileWithHealth(
  health: ProfileAuthenticationHealth,
  healthUpdatedAt: string = createdAt,
): CollectorProfile {
  const base = createPendingConfigProfile();
  const pendingLogin: CollectorProfile = {
    ...base,
    identity: { ...base.identity, status: "PENDING_LOGIN", updatedAt: createdAt },
    provisioningToken: {
      status: "ISSUED",
      tokenHash: "initial-token",
      issuedAt: createdAt,
      expiresAt: "2026-01-01T00:15:00.000Z",
      consumedAt: null,
    },
    authenticationHealth: "NOT_PROVISIONED",
    authenticationHealthUpdatedAt: createdAt,
  };
  const ingested = markCollectorProfileSessionIngested(
    pendingLogin,
    "2026-01-01T00:10:00.000Z",
    {
      cookies: [],
      localStorage: [],
      sessionExpiresAt: null,
    },
    {
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: createdAt,
      expiresAt: "2026-01-01T00:15:00.000Z",
      consumedAt: "2026-01-01T00:10:00.000Z",
    },
  );
  return {
    ...ingested,
    identity: { ...ingested.identity, status: "READY", updatedAt: "2026-01-01T00:10:00.000Z" },
    authenticationHealth: health,
    authenticationHealthUpdatedAt: healthUpdatedAt,
  };
}

function createPendingConfigProfile(): CollectorProfile {
  return createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt,
    networkContext: {
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
    },
    hardwareFingerprint: {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
      languages: ["en-US", "en"],
      hardwareConcurrency: 8,
      platform: "Linux x86_64",
      deviceMemoryGb: 8,
      timezone: "America/Los_Angeles",
    },
    behavioralPersona: {
      scrollStyle: "STEADY",
      microDelayMs: { min: 200, max: 1200 },
      reverseScrollProbability: 0.1,
      dwellTimeMs: { min: 2000, max: 8000 },
    },
    temporalRoutine: {
      timezone: "America/Los_Angeles",
      chronotype: "MORNING",
      activeWindows: [
        { days: [1, 2, 3, 4, 5], startsAt: "09:00", endsAt: "17:00" },
      ],
      cooldownMinutes: 30,
    },
    safetyThresholds: {
      maxSessionsPerDay: 3,
      maxSessionDurationMinutes: 45,
      maxMacroActionsPerDay: 150,
      minCooldownMinutes: 30,
    },
    contentAffinities: {
      primaryTopics: [{ topic: "travel", weight: 1 }],
      secondaryTopics: [{ topic: "food", weight: 0.5 }],
      interactionWeights: {
        view: 1,
        like: 0.4,
        save: 0.2,
        comment: 0.1,
        share: 0.05,
      },
    },
  });
}

function createPendingLoginProfile(
  health: ProfileAuthenticationHealth,
): CollectorProfile {
  const base = createPendingConfigProfile();
  return {
    ...base,
    identity: { ...base.identity, status: "PENDING_LOGIN", updatedAt: createdAt },
    provisioningToken: {
      status: "ISSUED",
      tokenHash: "restart-token",
      issuedAt: createdAt,
      expiresAt: "2026-01-01T00:15:00.000Z",
      consumedAt: null,
    },
    authenticationHealth: health,
    authenticationHealthUpdatedAt: createdAt,
  };
}
