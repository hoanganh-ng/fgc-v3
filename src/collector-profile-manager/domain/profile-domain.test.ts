import { describe, expect, it } from "vitest";
import {
  ImmutableFingerprintViolationError,
  InvalidProfileAccountStageTransitionError,
  InvalidProfileStateTransitionError,
  assignHardwareFingerprint,
  createProfileSourceAccess,
  createPendingCollectorProfile,
  updateProfileSourceAccess,
  transitionProfileAccountStage,
  transitionProfileStatus,
  validateCollectorProfile,
  validateProfileSourceAccess,
} from "./index";
import type {
  CollectorProfile,
  HardwareFingerprint,
  ProfileAccountStage,
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
      ["READY", "PENDING_LOGIN"],
      ["BUSY", "PENDING_LOGIN"],
      ["PENDING_CONFIG", "PENDING_CONFIG"],
      ["PENDING_LOGIN", "PENDING_LOGIN"],
      ["READY", "READY"],
      ["BUSY", "BUSY"],
    ];

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
