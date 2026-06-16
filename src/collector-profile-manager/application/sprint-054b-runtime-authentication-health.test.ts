import { describe, expect, it } from "vitest";
import {
  CheckoutProfileForAssistedGroupAccessUseCase,
  CheckoutProfileForExerciseUseCase,
  CheckoutProfileUseCase,
  CreateProfileUseCase,
  IngestProfileSessionUseCase,
  ProfileNotCheckoutEligibleError,
  ReleaseProfileLeaseUseCase,
  StartProfileProvisioningUseCase,
  UpdateProfileAccountStageUseCase,
  UpdateProfileConfigurationUseCase,
} from "./index";
import type {
  Clock,
  CollectorProfileRepositoryContext,
  LeaseIdGenerator,
  ProfileLeaseRepository,
  SourceGroupReferencePort,
  TokenGenerator,
  TransactionManager,
} from "./index";
import {
  InMemoryProfileLeaseRepository,
  InMemoryProfileRepository,
  InMemoryProfileSourceAccessRepository,
} from "./test-support/in-memory-repositories";
import {
  applyProfileAuthenticationHealthObservation,
  createPendingCollectorProfile,
  evaluateCheckoutEligibility,
  markCollectorProfileSessionIngested,
  type CollectorProfile,
  type ProfileAuthenticationHealth,
  type ProfileAuthenticationHealthObservation,
} from "../domain";

const checkoutNow = "2026-06-16T10:00:00.000Z";
const laterNow = "2026-06-16T10:30:00.000Z";
const tokenExpiry = "2026-06-16T11:00:00.000Z";

// ---------------------------------------------------------------------------
// Domain transition policy
// ---------------------------------------------------------------------------

describe("applyProfileAuthenticationHealthObservation", () => {
  it.each<{
    name: string;
    from: ProfileAuthenticationHealth;
    observation: ProfileAuthenticationHealthObservation;
    expected: ProfileAuthenticationHealth;
  }>([
    {
      name: "HEALTHY -> REAUTH_REQUIRED on LOGIN_REQUIRED",
      from: "HEALTHY",
      observation: "LOGIN_REQUIRED",
      expected: "REAUTH_REQUIRED",
    },
    {
      name: "HEALTHY -> CHECKPOINT_REVIEW_REQUIRED on CHECKPOINT_REQUIRED",
      from: "HEALTHY",
      observation: "CHECKPOINT_REQUIRED",
      expected: "CHECKPOINT_REVIEW_REQUIRED",
    },
    {
      name: "REAUTH_REQUIRED -> CHECKPOINT_REVIEW_REQUIRED on CHECKPOINT_REQUIRED",
      from: "REAUTH_REQUIRED",
      observation: "CHECKPOINT_REQUIRED",
      expected: "CHECKPOINT_REVIEW_REQUIRED",
    },
    {
      name: "NOT_PROVISIONED -> REAUTH_REQUIRED on LOGIN_REQUIRED",
      from: "NOT_PROVISIONED",
      observation: "LOGIN_REQUIRED",
      expected: "REAUTH_REQUIRED",
    },
    {
      name: "NOT_PROVISIONED -> CHECKPOINT_REVIEW_REQUIRED on CHECKPOINT_REQUIRED",
      from: "NOT_PROVISIONED",
      observation: "CHECKPOINT_REQUIRED",
      expected: "CHECKPOINT_REVIEW_REQUIRED",
    },
  ])("$name", ({ from, observation, expected }) => {
    const result = applyProfileAuthenticationHealthObservation(
      from,
      observation,
    );

    expect(result.nextHealth).toBe(expected);
    expect(result.changed).toBe(true);
  });

  it("CHECKPOINT_REVIEW_REQUIRED cannot be downgraded by LOGIN_REQUIRED", () => {
    const result = applyProfileAuthenticationHealthObservation(
      "CHECKPOINT_REVIEW_REQUIRED",
      "LOGIN_REQUIRED",
    );

    expect(result.nextHealth).toBe("CHECKPOINT_REVIEW_REQUIRED");
    expect(result.changed).toBe(false);
  });

  it("Repeated equivalent LOGIN_REQUIRED observations are idempotent", () => {
    const first = applyProfileAuthenticationHealthObservation(
      "HEALTHY",
      "LOGIN_REQUIRED",
    );
    expect(first.changed).toBe(true);
    expect(first.nextHealth).toBe("REAUTH_REQUIRED");

    const second = applyProfileAuthenticationHealthObservation(
      first.nextHealth,
      "LOGIN_REQUIRED",
    );
    expect(second.changed).toBe(false);
    expect(second.nextHealth).toBe("REAUTH_REQUIRED");
  });

  it("Repeated equivalent CHECKPOINT_REQUIRED observations are idempotent", () => {
    const first = applyProfileAuthenticationHealthObservation(
      "HEALTHY",
      "CHECKPOINT_REQUIRED",
    );
    expect(first.changed).toBe(true);

    const second = applyProfileAuthenticationHealthObservation(
      first.nextHealth,
      "CHECKPOINT_REQUIRED",
    );
    expect(second.changed).toBe(false);
    expect(second.nextHealth).toBe("CHECKPOINT_REVIEW_REQUIRED");
  });

  it("CHECKPOINT_REVIEW_REQUIRED -> CHECKPOINT_REVIEW_REQUIRED is idempotent", () => {
    const first = applyProfileAuthenticationHealthObservation(
      "CHECKPOINT_REVIEW_REQUIRED",
      "CHECKPOINT_REQUIRED",
    );
    expect(first.changed).toBe(false);
    expect(first.nextHealth).toBe("CHECKPOINT_REVIEW_REQUIRED");
  });

  it("runtime observations cannot transition to HEALTHY", () => {
    const login = applyProfileAuthenticationHealthObservation(
      "REAUTH_REQUIRED",
      "LOGIN_REQUIRED",
    );
    expect(login.nextHealth).not.toBe("HEALTHY");

    const checkpoint = applyProfileAuthenticationHealthObservation(
      "REAUTH_REQUIRED",
      "CHECKPOINT_REQUIRED",
    );
    expect(checkpoint.nextHealth).not.toBe("HEALTHY");
  });

  it("runtime observations cannot transition to NOT_PROVISIONED", () => {
    const login = applyProfileAuthenticationHealthObservation(
      "REAUTH_REQUIRED",
      "LOGIN_REQUIRED",
    );
    expect(login.nextHealth).not.toBe("NOT_PROVISIONED");
  });
});

// ---------------------------------------------------------------------------
// Domain-level checkout eligibility policy for the new reason
// ---------------------------------------------------------------------------

function createReadyProfile(): CollectorProfile {
  const base = createPendingCollectorProfile({
    id: "profile-1",
    displayName: "Profile 1",
    createdAt: checkoutNow,
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        credentials: { username: "user", password: "pass" },
      },
      killswitch: { enabled: true, failClosed: true },
    },
    hardwareFingerprint: {
      userAgent: "Mozilla/5.0",
      viewport: { width: 1366, height: 768 },
      languages: ["en-US"],
      hardwareConcurrency: 4,
    },
    behavioralPersona: {
      scrollStyle: "STEADY",
      microDelayMs: { min: 0, max: 0 },
      reverseScrollProbability: 0,
      dwellTimeMs: { min: 1000, max: 3000 },
    },
    temporalRoutine: {
      timezone: "UTC",
      chronotype: "MORNING",
      activeWindows: [
        { days: [1, 2, 3, 4, 5, 6, 0], startsAt: "00:00", endsAt: "23:59" },
      ],
      cooldownMinutes: 30,
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
  });
  const ingested = markCollectorProfileSessionIngested(
    {
      ...base,
      identity: {
        ...base.identity,
        status: "PENDING_LOGIN",
        updatedAt: checkoutNow,
      },
    },
    checkoutNow,
    {
      cookies: [
        {
          name: "session",
          value: "abc123",
          domain: "example.test",
          path: "/",
          expiresAt: null,
          httpOnly: true,
          secure: true,
        },
      ],
      localStorage: [],
      sessionExpiresAt: null,
    },
    {
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: checkoutNow,
      expiresAt: tokenExpiry,
      consumedAt: checkoutNow,
    },
  );
  return {
    ...ingested,
    identity: {
      ...ingested.identity,
      status: "READY",
      accountStage: "COLLECTION_READY",
      updatedAt: checkoutNow,
    },
  };
}

function withHealth(
  profile: CollectorProfile,
  health: ProfileAuthenticationHealth,
): CollectorProfile {
  return {
    ...profile,
    authenticationHealth: health,
    authenticationHealthUpdatedAt: checkoutNow,
  };
}

describe("evaluateCheckoutEligibility AUTHENTICATION_HEALTH_NOT_HEALTHY", () => {
  const base = createReadyProfile();

  const nonHealthy: readonly ProfileAuthenticationHealth[] = [
    "NOT_PROVISIONED",
    "REAUTH_REQUIRED",
    "CHECKPOINT_REVIEW_REQUIRED",
  ];

  for (const health of nonHealthy) {
    it(`rejects COLLECTION checkout for ${health} profile`, () => {
      const result = evaluateCheckoutEligibility(
        withHealth(base, health),
        new Date(checkoutNow),
      );

      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasons).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "AUTHENTICATION_HEALTH_NOT_HEALTHY",
            }),
          ]),
        );
      }
    });
  }

  for (const health of nonHealthy) {
    it(`rejects AMBIENT_EXERCISE checkout for ${health} profile`, () => {
      const result = evaluateCheckoutEligibility(
        withHealth(base, health),
        new Date(checkoutNow),
        { purpose: "AMBIENT_EXERCISE" },
      );

      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasons).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "AUTHENTICATION_HEALTH_NOT_HEALTHY",
            }),
          ]),
        );
      }
    });
  }

  for (const health of nonHealthy) {
    it(`rejects ASSISTED_GROUP_ACCESS checkout for ${health} profile`, () => {
      const result = evaluateCheckoutEligibility(
        withHealth(base, health),
        new Date(checkoutNow),
        { purpose: "ASSISTED_GROUP_ACCESS" },
      );

      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasons).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "AUTHENTICATION_HEALTH_NOT_HEALTHY",
            }),
          ]),
        );
      }
    });
  }

  it("accepts COLLECTION checkout for HEALTHY profile", () => {
    const result = evaluateCheckoutEligibility(
      withHealth(base, "HEALTHY"),
      new Date(checkoutNow),
    );

    expect(result.eligible).toBe(true);
  });

  it("accepts AMBIENT_EXERCISE checkout for HEALTHY profile", () => {
    const result = evaluateCheckoutEligibility(
      withHealth(base, "HEALTHY"),
      new Date(checkoutNow),
      { purpose: "AMBIENT_EXERCISE" },
    );

    expect(result.eligible).toBe(true);
  });

  it("accepts ASSISTED_GROUP_ACCESS checkout for HEALTHY profile", () => {
    const result = evaluateCheckoutEligibility(
      withHealth(base, "HEALTHY"),
      new Date(checkoutNow),
      { purpose: "ASSISTED_GROUP_ACCESS" },
    );

    expect(result.eligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Use-case release + checkout enforcement tests (test context)
// ---------------------------------------------------------------------------

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

class TestSourceGroupReference implements SourceGroupReferencePort {
  public readonly existingIds = new Set<string>(["source-group-1"]);

  public async exists(sourceGroupId: string): Promise<boolean> {
    return this.existingIds.has(sourceGroupId);
  }
}

class TestTokenGenerator implements TokenGenerator {
  private index = 0;

  public constructor(private readonly tokens: readonly string[]) {}

  public async generateToken(): Promise<string> {
    return this.tokens[this.index++] ?? "generated-token";
  }
}

class TestLeaseIdGenerator implements LeaseIdGenerator {
  private index = 0;

  public constructor(private readonly leaseIds: readonly string[]) {}

  public async generateLeaseId(): Promise<string> {
    return this.leaseIds[this.index++] ?? "generated-lease";
  }
}

interface TestContext {
  readonly profiles: InMemoryProfileRepository;
  readonly leases: InMemoryProfileLeaseRepository;
  readonly profileSourceAccess: InMemoryProfileSourceAccessRepository;
  readonly sourceGroupReference: TestSourceGroupReference;
  readonly tokens: TestTokenGenerator;
  readonly leaseIds: TestLeaseIdGenerator;
  readonly clock: FixedClock;
}

function createTestContext(): TestContext {
  return {
    profiles: new InMemoryProfileRepository(),
    leases: new InMemoryProfileLeaseRepository(),
    profileSourceAccess: new InMemoryProfileSourceAccessRepository(),
    sourceGroupReference: new TestSourceGroupReference(),
    tokens: new TestTokenGenerator(["provisioning-token-1"]),
    leaseIds: new TestLeaseIdGenerator(["lease-1"]),
    clock: new FixedClock(checkoutNow),
  };
}

async function seedReadyProfile(
  context: TestContext,
  options: { readonly accountStage?: "COLLECTION_READY" | "WARMING" } = {},
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
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        credentials: { username: "user", password: "pass" },
      },
      killswitch: { enabled: true, failClosed: true },
    },
    hardwareFingerprint: {
      userAgent: "Mozilla/5.0",
      viewport: { width: 1366, height: 768 },
      languages: ["en-US"],
      hardwareConcurrency: 4,
    },
    behavioralPersona: {
      scrollStyle: "STEADY",
      microDelayMs: { min: 0, max: 0 },
      reverseScrollProbability: 0,
      dwellTimeMs: { min: 1000, max: 3000 },
    },
    temporalRoutine: {
      timezone: "UTC",
      chronotype: "MORNING",
      activeWindows: [
        { days: [1, 2, 3, 4, 5, 6, 0], startsAt: "00:00", endsAt: "23:59" },
      ],
      cooldownMinutes: 30,
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
  });

  const started = await new StartProfileProvisioningUseCase(
    context.profiles,
    context.tokens,
    context.clock,
  ).execute({ profileId: "profile-1" });

  const ingested = await new IngestProfileSessionUseCase(
    context.profiles,
    context.clock,
  ).execute({
    provisioningToken: started.provisioningToken,
    cookies: [
      {
        name: "session",
        value: "abc123",
        domain: "example.test",
        path: "/",
        expiresAt: null,
        httpOnly: true,
        secure: true,
      },
    ],
    localStorage: [],
  });

  const stageTransitions = new UpdateProfileAccountStageUseCase(
    context.profiles,
    context.clock,
  );
  await stageTransitions.execute({ profileId: "profile-1", accountStage: "WARMING" });
  if (options.accountStage === "COLLECTION_READY" || options.accountStage === undefined) {
    await stageTransitions.execute({
      profileId: "profile-1",
      accountStage: "COLLECTION_READY",
    });
  }

  await context.profileSourceAccess.upsert({
    id: "access-1",
    profileId: ingested.identity.id,
    sourceGroupId: "source-group-1",
    accessState: "PUBLIC_ACCESSIBLE",
    lastCheckedAt: checkoutNow,
    lastSuccessfulAt: checkoutNow,
    lastFailureReason: null,
    joinRequestedAt: null,
    notes: undefined,
    createdAt: checkoutNow,
    updatedAt: checkoutNow,
  });

  const persistedProfile = await context.profiles.findById("profile-1");

  if (persistedProfile === null) {
    throw new Error(
      "Expected persisted profile after account-stage transitions in seedReadyProfile.",
    );
  }

  return persistedProfile;
}

async function checkoutProfile(
  context: TestContext,
): Promise<{ readonly leaseId: string }> {
  const result = await new CheckoutProfileUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
    context.sourceGroupReference,
    context.profileSourceAccess,
  ).execute({ sourceGroupId: "source-group-1" });

  return { leaseId: result.lease.id };
}

async function checkoutProfileForExercise(
  context: TestContext,
): Promise<{ readonly leaseId: string }> {
  const result = await new CheckoutProfileForExerciseUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
  ).execute({ profileId: "profile-1" });

  return { leaseId: result.lease.id };
}

async function checkoutProfileForAssistedGroupAccess(
  context: TestContext,
): Promise<{ readonly leaseId: string }> {
  const result = await new CheckoutProfileForAssistedGroupAccessUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
    context.sourceGroupReference,
  ).execute({ profileId: "profile-1", sourceGroupId: "source-group-1" });

  return { leaseId: result.lease.id };
}

// ---------------------------------------------------------------------------
// Use-case checkout rejection across all three purposes for non-HEALTHY
// ---------------------------------------------------------------------------

describe("Sprint 054B use-case checkout enforcement for non-HEALTHY profiles", () => {
  const nonHealthy: readonly ProfileAuthenticationHealth[] = [
    "NOT_PROVISIONED",
    "REAUTH_REQUIRED",
    "CHECKPOINT_REVIEW_REQUIRED",
  ];

  for (const health of nonHealthy) {
    it(`rejects COLLECTION checkout for ${health} profile`, async () => {
      const context = createTestContext();
      const profile = await seedReadyProfile(context);
      await context.profiles.save(withHealth(profile, health));

      try {
        await new CheckoutProfileUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
          context.profileSourceAccess,
        ).execute({
          sourceGroupId: "source-group-1",
          profileId: "profile-1",
        });
        throw new Error("Expected COLLECTION checkout to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);
        if (error instanceof ProfileNotCheckoutEligibleError) {
          expect(error.profileId).toBe("profile-1");
          expect(error.reasons).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                code: "AUTHENTICATION_HEALTH_NOT_HEALTHY",
              }),
            ]),
          );
        }
      }
    });
  }

  for (const health of nonHealthy) {
    it(`rejects AMBIENT_EXERCISE checkout for ${health} profile`, async () => {
      const context = createTestContext();
      const profile = await seedReadyProfile(context, {
        accountStage: "WARMING",
      });
      await context.profiles.save(withHealth(profile, health));

      try {
        await new CheckoutProfileForExerciseUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
        ).execute({ profileId: "profile-1" });
        throw new Error("Expected AMBIENT_EXERCISE checkout to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);
        if (error instanceof ProfileNotCheckoutEligibleError) {
          expect(error.profileId).toBe("profile-1");
          expect(error.reasons).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                code: "AUTHENTICATION_HEALTH_NOT_HEALTHY",
              }),
            ]),
          );
        }
      }
    });
  }

  for (const health of nonHealthy) {
    it(`rejects ASSISTED_GROUP_ACCESS checkout for ${health} profile`, async () => {
      const context = createTestContext();
      const profile = await seedReadyProfile(context, {
        accountStage: "WARMING",
      });
      await context.profiles.save(withHealth(profile, health));

      try {
        await new CheckoutProfileForAssistedGroupAccessUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
        ).execute({
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        });
        throw new Error("Expected ASSISTED_GROUP_ACCESS checkout to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);
        if (error instanceof ProfileNotCheckoutEligibleError) {
          expect(error.profileId).toBe("profile-1");
          expect(error.reasons).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                code: "AUTHENTICATION_HEALTH_NOT_HEALTHY",
              }),
            ]),
          );
        }
      }
    });
  }

  it("accepts COLLECTION checkout for HEALTHY profile", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);

    await expect(checkoutProfile(context)).resolves.toMatchObject({
      leaseId: "lease-1",
    });
  });

  it("accepts AMBIENT_EXERCISE checkout for HEALTHY profile", async () => {
    const context = createTestContext();
    await seedReadyProfile(context, { accountStage: "WARMING" });

    await expect(checkoutProfileForExercise(context)).resolves.toMatchObject({
      leaseId: "lease-1",
    });
  });

  it("accepts ASSISTED_GROUP_ACCESS checkout for HEALTHY profile", async () => {
    const context = createTestContext();
    await seedReadyProfile(context, { accountStage: "WARMING" });

    await expect(
      checkoutProfileForAssistedGroupAccess(context),
    ).resolves.toMatchObject({ leaseId: "lease-1" });
  });
});

// ---------------------------------------------------------------------------
// ReleaseProfileLeaseUseCase observation handling
// ---------------------------------------------------------------------------

describe("Sprint 054B ReleaseProfileLeaseUseCase observation handling", () => {
  it("release without observation preserves health and timestamp", async () => {
    const context = createTestContext();
    const profile = await seedReadyProfile(context);
    const originalHealth = profile.authenticationHealth;
    const originalTimestamp = profile.authenticationHealthUpdatedAt;
    const { leaseId } = await checkoutProfile(context);

    context.clock.setNow(laterNow);

    const result = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId });

    expect(result.profile.authenticationHealth).toBe(originalHealth);
    expect(result.profile.authenticationHealthUpdatedAt).toBe(
      originalTimestamp,
    );
  });

  it("release with LOGIN_REQUIRED observation transitions HEALTHY to REAUTH_REQUIRED", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);
    const { leaseId } = await checkoutProfile(context);

    context.clock.setNow(laterNow);

    const result = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId, authenticationObservation: "LOGIN_REQUIRED" });

    expect(result.profile.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(result.profile.authenticationHealthUpdatedAt).toBe(laterNow);

    const saved = await context.profiles.findById("profile-1");
    expect(saved?.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(saved?.authenticationHealthUpdatedAt).toBe(laterNow);
  });

  it("release with CHECKPOINT_REQUIRED observation transitions HEALTHY to CHECKPOINT_REVIEW_REQUIRED", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);
    const { leaseId } = await checkoutProfile(context);

    context.clock.setNow(laterNow);

    const result = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({
      leaseId,
      authenticationObservation: "CHECKPOINT_REQUIRED",
    });

    expect(result.profile.authenticationHealth).toBe(
      "CHECKPOINT_REVIEW_REQUIRED",
    );
    expect(result.profile.authenticationHealthUpdatedAt).toBe(laterNow);
  });

  it("release preserves profile status transition to READY alongside observation", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);
    const { leaseId } = await checkoutProfile(context);

    context.clock.setNow(laterNow);

    const result = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId, authenticationObservation: "LOGIN_REQUIRED" });

    expect(result.profile.identity.status).toBe("READY");
    expect(result.lease.status).toBe("RELEASED");
  });

  it("LOGIN_REQUIRED observation does not downgrade CHECKPOINT_REVIEW_REQUIRED", async () => {
    const context = createTestContext();
    const first = await seedReadyProfile(context);
    await context.profiles.save(
      withHealth(first, "CHECKPOINT_REVIEW_REQUIRED"),
    );

    const profileId = "profile-1";
    await context.leases.save({
      id: "lease-active",
      profileId,
      purpose: "COLLECTION",
      leasedAt: checkoutNow,
      expiresAt: "2026-06-16T10:45:00.000Z",
      releasedAt: null,
      status: "ACTIVE",
    });
    const stored = await context.profiles.findById(profileId);
    if (stored === null) {
      throw new Error("Expected stored profile.");
    }
    await context.profiles.save({
      ...stored,
      identity: { ...stored.identity, status: "BUSY" },
    });

    context.clock.setNow(laterNow);

    const result = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({
      leaseId: "lease-active",
      authenticationObservation: "LOGIN_REQUIRED",
    });

    expect(result.profile.authenticationHealth).toBe(
      "CHECKPOINT_REVIEW_REQUIRED",
    );
    expect(result.profile.authenticationHealthUpdatedAt).toBe(checkoutNow);
  });

  it("CHECKPOINT_REQUIRED observation on CHECKPOINT_REVIEW_REQUIRED is idempotent", async () => {
    const context = createTestContext();
    const first = await seedReadyProfile(context);
    await context.profiles.save(
      withHealth(first, "CHECKPOINT_REVIEW_REQUIRED"),
    );

    const profileId = "profile-1";
    await context.leases.save({
      id: "lease-active",
      profileId,
      purpose: "COLLECTION",
      leasedAt: checkoutNow,
      expiresAt: "2026-06-16T10:45:00.000Z",
      releasedAt: null,
      status: "ACTIVE",
    });
    const stored = await context.profiles.findById(profileId);
    if (stored === null) {
      throw new Error("Expected stored profile.");
    }
    await context.profiles.save({
      ...stored,
      identity: { ...stored.identity, status: "BUSY" },
    });

    context.clock.setNow(laterNow);

    const result = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({
      leaseId: "lease-active",
      authenticationObservation: "CHECKPOINT_REQUIRED",
    });

    expect(result.profile.authenticationHealth).toBe(
      "CHECKPOINT_REVIEW_REQUIRED",
    );
    expect(result.profile.authenticationHealthUpdatedAt).toBe(checkoutNow);
  });

  it("rejects release on an already RELEASED lease without mutation", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);
    const profileBefore = await context.profiles.findById("profile-1");
    if (profileBefore === null) {
      throw new Error("Expected seeded profile.");
    }
    const initialHealth = profileBefore.authenticationHealth;
    const initialTimestamp = profileBefore.authenticationHealthUpdatedAt;

    const { leaseId } = await checkoutProfile(context);

    context.clock.setNow(laterNow);

    await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId, authenticationObservation: "LOGIN_REQUIRED" });

    const profileAfterFirstRelease =
      await context.profiles.findById("profile-1");
    if (profileAfterFirstRelease === null) {
      throw new Error("Expected profile after first release.");
    }

    await expect(
      new ReleaseProfileLeaseUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId, authenticationObservation: "LOGIN_REQUIRED" }),
    ).rejects.toMatchObject({ code: "PROFILE_LEASE_ALREADY_CLOSED" });

    const profileAfterSecondRelease =
      await context.profiles.findById("profile-1");
    expect(profileAfterSecondRelease?.authenticationHealth).toBe(
      initialHealth === "HEALTHY" ? "REAUTH_REQUIRED" : initialHealth,
    );
    expect(profileAfterSecondRelease?.authenticationHealthUpdatedAt).toBe(
      profileAfterFirstRelease.authenticationHealthUpdatedAt,
    );
    expect(profileAfterSecondRelease?.authenticationHealthUpdatedAt).not.toBe(
      initialTimestamp,
    );
  });

  it("rejects release on an EXPIRED lease without mutation", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);
    const profileBefore = await context.profiles.findById("profile-1");
    if (profileBefore === null) {
      throw new Error("Expected seeded profile.");
    }
    const initialHealth = profileBefore.authenticationHealth;
    const initialTimestamp = profileBefore.authenticationHealthUpdatedAt;

    const { leaseId } = await checkoutProfile(context);

    context.clock.setNow("2026-06-16T15:00:00.000Z");

    await expect(
      new ReleaseProfileLeaseUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId, authenticationObservation: "LOGIN_REQUIRED" }),
    ).rejects.toMatchObject({ code: "PROFILE_LEASE_ALREADY_CLOSED" });

    const profileAfter = await context.profiles.findById("profile-1");
    expect(profileAfter?.authenticationHealth).toBe(initialHealth);
    expect(profileAfter?.authenticationHealthUpdatedAt).toBe(initialTimestamp);
  });

  it("uses transaction manager to prevent externally visible partial release when lease-status write fails", async () => {
    const context = createTestContext();
    await seedReadyProfile(context);
    const { leaseId } = await checkoutProfile(context);

    // Snapshot the externally visible (main) profile and lease before the
    // failed release attempt. The transaction abstraction must guarantee
    // that these remain unchanged when the inner lease-status write throws
    // after the profile health mutation has already been written to the
    // transaction-scoped repository.
    const mainProfileBefore = await context.profiles.findById("profile-1");
    const mainLeaseBefore = await context.leases.findById(leaseId);
    if (mainProfileBefore === null || mainLeaseBefore === null) {
      throw new Error("Expected seeded profile and lease before release.");
    }

    // Mirror the established "uses transaction-scoped repositories" pattern:
    // writes inside the transaction go to a separate scope and never touch the
    // externally visible (main) repositories.
    const transactionProfiles = new InMemoryProfileRepository();
    const transactionLeases = new InMemoryProfileLeaseRepository();
    await transactionProfiles.save(mainProfileBefore);
    await transactionLeases.save(mainLeaseBefore);

    // Wrap the transaction-scoped lease repository so that the lease-status
    // write (which happens after the profile save) fails. The profile save
    // above will still succeed, so without the transaction abstraction a
    // partial mutation would be observable.
    const failingTransactionLeases: ProfileLeaseRepository = {
      save: async (lease) => transactionLeases.save(lease),
      findById: async (id) => transactionLeases.findById(id),
      findActiveByProfileId: async (profileId) =>
        transactionLeases.findActiveByProfileId(profileId),
      updateStatus: async () => {
        throw new Error("Simulated lease status write failure.");
      },
    };

    const transactionManager: TransactionManager = {
      runInTransaction: async <T>(
        work: (repositories: CollectorProfileRepositoryContext) => Promise<T>,
      ): Promise<T> =>
        work({
          profiles: transactionProfiles,
          leases: failingTransactionLeases,
          profileSourceAccess: context.profileSourceAccess,
        }),
    };

    context.clock.setNow(laterNow);

    await expect(
      new ReleaseProfileLeaseUseCase(
        context.profiles,
        context.leases,
        context.clock,
        transactionManager,
      ).execute({
        leaseId,
        authenticationObservation: "LOGIN_REQUIRED",
      }),
    ).rejects.toThrow("Simulated lease status write failure.");

    // Externally visible (main) profile and lease are unchanged: the
    // transaction abstraction prevented the partial profile mutation
    // (already applied to the transaction-scoped profile) from leaking
    // out, even though the lease-status write failed.
    const mainProfileAfter = await context.profiles.findById("profile-1");
    const mainLeaseAfter = await context.leases.findById(leaseId);
    expect(mainProfileAfter).toEqual(mainProfileBefore);
    expect(mainLeaseAfter).toEqual(mainLeaseBefore);
    expect(mainProfileAfter?.authenticationHealth).toBe("HEALTHY");
    expect(mainProfileAfter?.authenticationHealthUpdatedAt).toBe(checkoutNow);
    expect(mainLeaseAfter?.status).toBe("ACTIVE");

    // Sanity check: the transaction-scoped profile did receive the partial
    // mutation before the lease-status write threw, while the transaction-
    // scoped lease remained ACTIVE.
    const profileInTxAfter = await transactionProfiles.findById("profile-1");
    const leaseInTxAfter = await transactionLeases.findById(leaseId);
    expect(profileInTxAfter?.authenticationHealth).toBe("REAUTH_REQUIRED");
    expect(profileInTxAfter?.authenticationHealthUpdatedAt).toBe(laterNow);
    expect(leaseInTxAfter?.status).toBe("ACTIVE");
  });
});
