import { describe, expect, it } from "vitest";
import {
  CheckoutProfileForExerciseUseCase,
  CheckoutProfileUseCase,
  CreateProfileUseCase,
  IngestProfileSessionUseCase,
  ProfileLeaseAlreadyClosedError,
  ProfileLeaseStateConflictError,
  ProfileNotCheckoutEligibleError,
  ReleaseProfileLeaseUseCase,
  StartProfileProvisioningUseCase,
  UpdateProfileAccountStageUseCase,
  UpdateProfileConfigurationUseCase,
} from "./index";
import type {
  Clock,
  LeaseIdGenerator,
  TokenGenerator,
} from "./index";
import {
  InMemoryProfileLeaseRepository,
  InMemoryProfileRepository,
} from "./test-support/in-memory-repositories";
import type {
  BehavioralPersona,
  BrowserCookie,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  LocalStorageEntry,
  NetworkContext,
  ProfileId,
  ProfileAccountStage,
  ProfileLease,
  ProfileLeaseId,
  SafetyThresholds,
  TemporalRoutine,
} from "../domain";

const checkoutNow = "2026-01-05T18:00:00.000Z";
const releaseNow = "2026-01-05T18:10:00.000Z";

describe("collector profile checkout use cases", () => {
  it("checks out a READY profile inside an active window", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);
    const output = await new CheckoutProfileUseCase(
      context.profiles,
      context.leases,
      context.leaseIds,
      context.clock,
    ).execute();
    const savedProfile = await context.profiles.findById(
      readyProfile.identity.id,
    );

    expect(output.lease).toEqual({
      id: "lease-1",
      profileId: readyProfile.identity.id,
      purpose: "COLLECTION",
      leasedAt: checkoutNow,
      expiresAt: "2026-01-05T18:45:00.000Z",
      releasedAt: null,
      status: "ACTIVE",
    });
    expect(output.profile.profileId).toBe(readyProfile.identity.id);
    expect(output.profile).not.toHaveProperty("provisioningToken");
    expect(savedProfile?.identity.status).toBe("BUSY");
    expect(savedProfile?.identity.lastCheckoutAt).toBe(checkoutNow);
    expect(savedProfile?.identity.dailyUsage).toMatchObject({
      localDate: "2026-01-05",
      sessionsStarted: 1,
    });
  });

  it("checks out a profile inside an overnight active window", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);

    await context.profiles.save({
      ...readyProfile,
      temporalRoutine: {
        ...readyProfile.temporalRoutine,
        activeWindows: [
          {
            days: [1],
            startsAt: "22:00",
            endsAt: "02:00",
          },
        ],
      },
    });
    context.clock.setNow("2026-01-06T09:00:00.000Z");

    const output = await checkoutProfile(context, readyProfile.identity.id);
    const savedProfile = await context.profiles.findById(
      readyProfile.identity.id,
    );

    expect(output.lease).toMatchObject({
      leasedAt: "2026-01-06T09:00:00.000Z",
      expiresAt: "2026-01-06T09:45:00.000Z",
      purpose: "COLLECTION",
      status: "ACTIVE",
    });
    expect(savedProfile?.identity.status).toBe("BUSY");
    expect(savedProfile?.identity.dailyUsage).toMatchObject({
      localDate: "2026-01-06",
      sessionsStarted: 1,
    });
  });

  it("rejects non-READY profiles", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);

    await context.profiles.save({
      ...readyProfile,
      identity: {
        ...readyProfile.identity,
        status: "PENDING_LOGIN",
      },
    });

    await expectCheckoutRejection(context, "PROFILE_NOT_READY");
  });

  const nonCollectionReadyStages: readonly ProfileAccountStage[] = [
    "NEW_ACCOUNT",
    "WARMING",
    "LIMITED",
    "NEEDS_REVIEW",
    "RETIRED",
  ];

  for (const accountStage of nonCollectionReadyStages) {
    it(`rejects READY profiles in ${accountStage}`, async () => {
      const context = createTestContext();

      await createReadyProfile(context, { accountStage });

      await expectCheckoutRejection(
        context,
        "ACCOUNT_STAGE_NOT_COLLECTION_READY",
      );
    });
  }

  it("rejects profiles outside their active window", async () => {
    const context = createTestContext();

    await createReadyProfile(context);
    context.clock.setNow("2026-01-06T03:00:00.000Z");

    await expectCheckoutRejection(context, "OUTSIDE_ACTIVE_WINDOW");
  });

  it("rejects profiles blocked by cooldown", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);

    await context.profiles.save({
      ...readyProfile,
      identity: {
        ...readyProfile.identity,
        nextAvailableAt: "2026-01-05T18:30:00.000Z",
      },
    });

    await expectCheckoutRejection(context, "COOLDOWN_ACTIVE");
  });

  it("rejects profiles blocked by the daily session limit", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);

    await context.profiles.save({
      ...readyProfile,
      identity: {
        ...readyProfile.identity,
        dailyUsage: {
          localDate: "2026-01-05",
          sessionsStarted: 3,
          activeDurationMinutes: 0,
          macroActions: 0,
        },
      },
    });

    await expectCheckoutRejection(context, "DAILY_SESSION_LIMIT_REACHED");
  });

  it("rejects checkout when authentication state is missing", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);

    await context.profiles.save({
      ...readyProfile,
      authenticationState: {
        cookies: [],
        localStorage: [],
        sessionCapturedAt: null,
        sessionExpiresAt: null,
      },
    });

    await expectCheckoutRejection(context, "AUTHENTICATION_MISSING");
  });

  it.each([
    "NEW_ACCOUNT",
    "WARMING",
    "LIMITED",
    "COLLECTION_READY",
  ] as const)(
    "checks out a READY profile in %s for ambient exercise",
    async (accountStage) => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context, {
        accountStage,
      });

      const output = await checkoutProfileForExercise(
        context,
        readyProfile.identity.id,
      );
      const savedProfile = await context.profiles.findById(
        readyProfile.identity.id,
      );

      expect(output.lease).toMatchObject({
        id: "lease-1",
        profileId: readyProfile.identity.id,
        purpose: "AMBIENT_EXERCISE",
        status: "ACTIVE",
      });
      expect(output.profile).toEqual({
        profileId: readyProfile.identity.id,
        accountStage,
      });
      expect(savedProfile?.identity.status).toBe("BUSY");
    },
  );

  it.each(["NEEDS_REVIEW", "RETIRED"] as const)(
    "rejects ambient exercise checkout for %s profiles",
    async (accountStage) => {
      const context = createTestContext();

      await createReadyProfile(context, { accountStage });

      await expectExerciseCheckoutRejection(
        context,
        "ACCOUNT_STAGE_NOT_EXERCISE_ELIGIBLE",
      );
    },
  );

  it("rejects ambient exercise checkout when the profile already has an active lease", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "NEW_ACCOUNT",
    });

    await context.leases.save({
      id: "lease-1",
      profileId: readyProfile.identity.id,
      purpose: "COLLECTION",
      leasedAt: checkoutNow,
      expiresAt: "2026-01-05T18:45:00.000Z",
      releasedAt: null,
      status: "ACTIVE",
    });

    await expect(
      checkoutProfileForExercise(context, readyProfile.identity.id),
    ).rejects.toThrow(ProfileLeaseStateConflictError);
  });

  it("releases a BUSY profile back to READY", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);
    const checkout = await checkoutProfile(context, readyProfile.identity.id);

    context.clock.setNow(releaseNow);

    const output = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({
      leaseId: checkout.lease.id,
      macroActionsPerformed: 7,
    });

    expect(output.lease).toEqual({
      ...checkout.lease,
      releasedAt: releaseNow,
      status: "RELEASED",
    });
    expect(output.profile.identity.status).toBe("READY");
    expect(output.profile.identity.lastReleasedAt).toBe(releaseNow);
    expect(output.profile.identity.nextAvailableAt).toBe(
      "2026-01-05T18:40:00.000Z",
    );
    expect(output.profile.identity.dailyUsage).toMatchObject({
      localDate: "2026-01-05",
      sessionsStarted: 1,
      activeDurationMinutes: 10,
      macroActions: 7,
    });
  });

  it("rejects releasing an already released lease", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context);
    const checkout = await checkoutProfile(context, readyProfile.identity.id);

    context.clock.setNow(releaseNow);

    await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId: checkout.lease.id });

    await expect(
      new ReleaseProfileLeaseUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId: checkout.lease.id }),
    ).rejects.toThrow(ProfileLeaseAlreadyClosedError);
  });
});

interface TestContext {
  readonly profiles: InMemoryProfileRepository;
  readonly leases: InMemoryProfileLeaseRepository;
  readonly tokens: FakeTokenGenerator;
  readonly leaseIds: FakeLeaseIdGenerator;
  readonly clock: FixedClock;
}

function createTestContext(
  leaseIds: readonly ProfileLeaseId[] = ["lease-1"],
): TestContext {
  return {
    profiles: new InMemoryProfileRepository(),
    leases: new InMemoryProfileLeaseRepository(),
    tokens: new FakeTokenGenerator(["provisioning-token-1"]),
    leaseIds: new FakeLeaseIdGenerator(leaseIds),
    clock: new FixedClock(checkoutNow),
  };
}

async function createReadyProfile(
  context: TestContext,
  options: { readonly accountStage?: ProfileAccountStage } = {},
): Promise<CollectorProfile> {
  await new CreateProfileUseCase(context.profiles, context.clock).execute({
    id: "profile-1",
    displayName: "Profile 1",
  });

  await new UpdateProfileConfigurationUseCase(
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

  const started = await new StartProfileProvisioningUseCase(
    context.profiles,
    context.tokens,
    context.clock,
  ).execute({ profileId: "profile-1" });

  const readyProfile = await new IngestProfileSessionUseCase(
    context.profiles,
    context.clock,
  ).execute({
    provisioningToken: started.provisioningToken,
    cookies: createCookies(),
    localStorage: createLocalStorage(),
    sessionExpiresAt: "2026-01-06T18:00:00.000Z",
  });

  return setProfileAccountStage(
    context,
    readyProfile.identity.id,
    options.accountStage ?? "COLLECTION_READY",
  );
}

async function setProfileAccountStage(
  context: TestContext,
  profileId: ProfileId,
  accountStage: ProfileAccountStage,
): Promise<CollectorProfile> {
  const transitionUseCase = new UpdateProfileAccountStageUseCase(
    context.profiles,
    context.clock,
  );

  if (accountStage === "NEW_ACCOUNT") {
    const profile = await context.profiles.findById(profileId);

    if (profile === null) {
      throw new Error("Expected profile to exist.");
    }

    return profile;
  }

  if (accountStage === "WARMING") {
    await transitionUseCase.execute({ profileId, accountStage: "WARMING" });
  } else if (accountStage === "COLLECTION_READY") {
    await transitionUseCase.execute({ profileId, accountStage: "WARMING" });
    await transitionUseCase.execute({
      profileId,
      accountStage: "COLLECTION_READY",
    });
  } else if (accountStage === "LIMITED") {
    await transitionUseCase.execute({ profileId, accountStage: "WARMING" });
    await transitionUseCase.execute({ profileId, accountStage: "LIMITED" });
  } else if (accountStage === "NEEDS_REVIEW") {
    await transitionUseCase.execute({
      profileId,
      accountStage: "NEEDS_REVIEW",
    });
  } else {
    await transitionUseCase.execute({
      profileId,
      accountStage: "NEEDS_REVIEW",
    });
    await transitionUseCase.execute({ profileId, accountStage: "RETIRED" });
  }

  const profile = await context.profiles.findById(profileId);

  if (profile === null) {
    throw new Error("Expected profile to exist.");
  }

  return profile;
}

async function checkoutProfile(
  context: TestContext,
  profileId: ProfileId,
): Promise<{ readonly lease: ProfileLease }> {
  return new CheckoutProfileUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
  ).execute({ profileId });
}

async function checkoutProfileForExercise(
  context: TestContext,
  profileId: ProfileId,
): Promise<{ readonly lease: ProfileLease; readonly profile: unknown }> {
  return new CheckoutProfileForExerciseUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
  ).execute({ profileId });
}

async function expectCheckoutRejection(
  context: TestContext,
  expectedCode: string,
): Promise<void> {
  try {
    await checkoutProfile(context, "profile-1");
    throw new Error("Expected checkout to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);

    if (error instanceof ProfileNotCheckoutEligibleError) {
      expect(error.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: expectedCode,
          }),
        ]),
      );
    }
  }
}

async function expectExerciseCheckoutRejection(
  context: TestContext,
  expectedCode: string,
): Promise<void> {
  try {
    await checkoutProfileForExercise(context, "profile-1");
    throw new Error("Expected exercise checkout to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);

    if (error instanceof ProfileNotCheckoutEligibleError) {
      expect(error.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: expectedCode,
          }),
        ]),
      );
    }
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

class FakeLeaseIdGenerator implements LeaseIdGenerator {
  private nextLeaseIndex = 0;

  public constructor(private readonly leaseIds: readonly ProfileLeaseId[]) {}

  public async generateLeaseId(): Promise<ProfileLeaseId> {
    const leaseId = this.leaseIds[this.nextLeaseIndex];
    this.nextLeaseIndex += 1;

    return leaseId ?? `generated-lease-${this.nextLeaseIndex}`;
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

  public setNow(isoDateTime: string): void {
    this.current = new Date(isoDateTime);
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
      value: "stored-value",
    },
  ];
}
