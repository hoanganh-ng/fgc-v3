import { describe, expect, it } from "vitest";
import {
  ImmutableFingerprintViolationError,
  InvalidProfileStateTransitionError,
  assignHardwareFingerprint,
  createPendingCollectorProfile,
  transitionProfileStatus,
  validateCollectorProfile,
} from "./index";
import type {
  CollectorProfile,
  HardwareFingerprint,
  ProfileStatus,
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

describe("profile domain errors", () => {
  it("throws InvalidProfileStateTransitionError for invalid transitions", () => {
    expect(() => transitionProfileStatus("READY", "PENDING_CONFIG")).toThrow(
      InvalidProfileStateTransitionError,
    );
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

function createMinimalProfile(): CollectorProfile {
  return createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt,
  });
}

function expectValidationIssue(
  result: ReturnType<typeof validateCollectorProfile>,
  path: string,
): void {
  expect(result.valid).toBe(false);

  if (!result.valid) {
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  }
}
