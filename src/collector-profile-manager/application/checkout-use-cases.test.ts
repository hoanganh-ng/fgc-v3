import { describe, expect, it } from "vitest";
import {
  CheckoutProfileForAssistedGroupAccessUseCase,
  CheckoutProfileForExerciseUseCase,
  CheckoutProfileUseCase,
  CreateProfileUseCase,
  IngestProfileSessionUseCase,
  GetRuntimeProfileConfigurationUseCase,
  NoEligibleProfileAvailableError,
  ProfileLeaseAlreadyClosedError,
  ProfileLeaseStateConflictError,
  ProfileNotCheckoutEligibleError,
  ReleaseProfileLeaseUseCase,
  SourceGroupNotFoundError,
  StartProfileProvisioningUseCase,
  UpdateProfileAccountStageUseCase,
  UpdateProfileConfigurationUseCase,
} from "./index";
import type {
  Clock,
  LeaseIdGenerator,
  SourceGroupReferencePort,
  TokenGenerator,
} from "./index";
import {
  InMemoryProfileLeaseRepository,
  InMemoryProfileRepository,
  InMemoryProfileSourceAccessRepository,
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
  ProfileSourceAccessState,
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
      context.sourceGroupReference,
      context.profileSourceAccess,
    ).execute({ sourceGroupId: "source-group-1" });
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

  it.each(["WARMING", "COLLECTION_READY"] as const)(
    "checks out a READY profile in %s for assisted group access",
    async (accountStage) => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context, {
        accountStage,
        sourceAccess: null,
      });

      const output = await checkoutProfileForAssistedGroupAccess(
        context,
        readyProfile.identity.id,
      );
      const savedProfile = await context.profiles.findById(
        readyProfile.identity.id,
      );

      expect(output.lease).toMatchObject({
        id: "lease-1",
        profileId: readyProfile.identity.id,
        purpose: "ASSISTED_GROUP_ACCESS",
        status: "ACTIVE",
      });
      expect(output.profile).toEqual({
        profileId: readyProfile.identity.id,
        accountStage,
      });
      expect(savedProfile?.identity.status).toBe("BUSY");
      await expect(
        context.profileSourceAccess.getByProfileAndSourceGroup(
          readyProfile.identity.id,
          "source-group-1",
        ),
      ).resolves.toBeNull();
    },
  );

  it.each(["NEW_ACCOUNT", "LIMITED", "NEEDS_REVIEW", "RETIRED"] as const)(
    "rejects assisted group access checkout for %s profiles",
    async (accountStage) => {
      const context = createTestContext();

      await createReadyProfile(context, {
        accountStage,
        sourceAccess: null,
      });

      await expectAssistedGroupAccessCheckoutRejection(
        context,
        "ACCOUNT_STAGE_NOT_ASSISTED_GROUP_ACCESS_ELIGIBLE",
      );
    },
  );

  it.each([
    {
      name: "non-READY profile",
      updateProfile: (profile: CollectorProfile) => ({
        ...profile,
        identity: {
          ...profile.identity,
          status: "PENDING_LOGIN" as const,
        },
      }),
      code: "PROFILE_NOT_READY",
    },
    {
      name: "missing authentication",
      updateProfile: (profile: CollectorProfile) => ({
        ...profile,
        authenticationState: {
          cookies: [],
          localStorage: [],
          sessionCapturedAt: null,
          sessionExpiresAt: null,
        },
      }),
      code: "AUTHENTICATION_MISSING",
    },
    {
      name: "missing network context",
      updateProfile: (profile: CollectorProfile) => ({
        ...profile,
        networkContext: {
          ...profile.networkContext,
          proxy: null,
        },
      }),
      code: "NETWORK_CONTEXT_MISSING",
    },
    {
      name: "missing hardware fingerprint",
      updateProfile: (profile: CollectorProfile) => ({
        ...profile,
        hardwareFingerprint: null,
      }),
      code: "HARDWARE_FINGERPRINT_MISSING",
    },
    {
      name: "cooldown",
      updateProfile: (profile: CollectorProfile) => ({
        ...profile,
        identity: {
          ...profile.identity,
          nextAvailableAt: "2026-01-05T18:30:00.000Z",
        },
      }),
      code: "COOLDOWN_ACTIVE",
    },
    {
      name: "daily safety limit",
      updateProfile: (profile: CollectorProfile) => ({
        ...profile,
        identity: {
          ...profile.identity,
          dailyUsage: {
            localDate: "2026-01-05",
            sessionsStarted: 3,
            activeDurationMinutes: 0,
            macroActions: 0,
          },
        },
      }),
      code: "DAILY_SESSION_LIMIT_REACHED",
    },
  ])("rejects assisted group access checkout for $name", async (testCase) => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
    });

    await context.profiles.save(testCase.updateProfile(readyProfile));

    await expectAssistedGroupAccessCheckoutRejection(context, testCase.code);
  });

  it("rejects assisted group access checkout outside the active window", async () => {
    const context = createTestContext();

    await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
    });
    context.clock.setNow("2026-01-06T03:00:00.000Z");

    await expectAssistedGroupAccessCheckoutRejection(
      context,
      "OUTSIDE_ACTIVE_WINDOW",
    );
  });

  it("rejects assisted group access checkout when the profile already has an active lease", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
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
      checkoutProfileForAssistedGroupAccess(context, readyProfile.identity.id),
    ).rejects.toThrow(ProfileLeaseStateConflictError);
  });

  it("validates assisted group access source group before entering the transaction", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
    });
    const transactionManager = {
      runInTransaction: async <T>(): Promise<T> => {
        throw new Error("Transaction should not be opened.");
      },
    };

    await expect(
      new CheckoutProfileForAssistedGroupAccessUseCase(
        context.profiles,
        context.leases,
        context.leaseIds,
        context.clock,
        context.sourceGroupReference,
        transactionManager,
      ).execute({
        profileId: readyProfile.identity.id,
        sourceGroupId: "unknown-group",
      }),
    ).rejects.toThrow(SourceGroupNotFoundError);
    expect(context.sourceGroupReference.calls).toEqual(["unknown-group"]);
  });

  it("does not mutate existing profile-source access records during assisted group access checkout", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: "JOIN_REQUESTED",
    });
    const accessRecordBefore =
      await context.profileSourceAccess.getByProfileAndSourceGroup(
        readyProfile.identity.id,
        "source-group-1",
      );

    await checkoutProfileForAssistedGroupAccess(
      context,
      readyProfile.identity.id,
    );

    await expect(
      context.profileSourceAccess.getByProfileAndSourceGroup(
        readyProfile.identity.id,
        "source-group-1",
      ),
    ).resolves.toEqual(accessRecordBefore);
  });

  it("uses transaction-scoped repositories during assisted group access checkout", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
    });
    const transactionProfiles = new InMemoryProfileRepository();
    const transactionLeases = new InMemoryProfileLeaseRepository();
    const transactionProfileSourceAccess =
      new InMemoryProfileSourceAccessRepository();
    const profileInTx = await context.profiles.findById(
      readyProfile.identity.id,
    );

    if (profileInTx === null) {
      throw new Error("Expected profile to exist.");
    }

    await transactionProfiles.save(profileInTx);

    const transactionManager = {
      runInTransaction: async <T>(
        work: (repositories: {
          profiles: InMemoryProfileRepository;
          leases: InMemoryProfileLeaseRepository;
          profileSourceAccess: InMemoryProfileSourceAccessRepository;
        }) => Promise<T>,
      ): Promise<T> =>
        work({
          profiles: transactionProfiles,
          leases: transactionLeases,
          profileSourceAccess: transactionProfileSourceAccess,
        }),
    };

    const output = await new CheckoutProfileForAssistedGroupAccessUseCase(
      context.profiles,
      context.leases,
      context.leaseIds,
      context.clock,
      context.sourceGroupReference,
      transactionManager,
    ).execute({
      profileId: readyProfile.identity.id,
      sourceGroupId: "source-group-1",
    });

    await expect(transactionLeases.findById(output.lease.id)).resolves.toEqual(
      output.lease,
    );
    await expect(context.leases.findById(output.lease.id)).resolves.toBeNull();
    await expect(
      transactionProfiles.findById(readyProfile.identity.id),
    ).resolves.toMatchObject({
      identity: expect.objectContaining({ status: "BUSY" }),
    });
    await expect(
      context.profiles.findById(readyProfile.identity.id),
    ).resolves.toMatchObject({
      identity: expect.objectContaining({ status: "READY" }),
    });
  });

  it("releases assisted group access leases back to READY", async () => {
    const context = createTestContext();
    const readyProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
    });
    const checkout = await checkoutProfileForAssistedGroupAccess(
      context,
      readyProfile.identity.id,
    );

    context.clock.setNow(releaseNow);

    const output = await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({
      leaseId: checkout.lease.id,
    });

    expect(output.lease).toEqual({
      ...checkout.lease,
      releasedAt: releaseNow,
      status: "RELEASED",
    });
    expect(output.profile.identity.status).toBe("READY");
  });

  it("allows runtime configuration for active assisted group access lease and rejects it after release or expiry", async () => {
    const context = createTestContext(["lease-active", "lease-released", "lease-expired"]);
    const activeProfile = await createReadyProfile(context, {
      accountStage: "WARMING",
      sourceAccess: null,
    });
    const activeCheckout = await checkoutProfileForAssistedGroupAccess(
      context,
      activeProfile.identity.id,
    );

    await expect(
      new GetRuntimeProfileConfigurationUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId: activeCheckout.lease.id }),
    ).resolves.toMatchObject({
      profileId: activeProfile.identity.id,
      leaseId: activeCheckout.lease.id,
    });

    const releasedProfile = await createAdditionalReadyProfile(
      context,
      "profile-released",
      "Profile Released",
      "provisioning-token-released",
      "WARMING",
    );
    const releasedCheckout = await checkoutProfileForAssistedGroupAccess(
      context,
      releasedProfile.identity.id,
    );
    context.clock.setNow(releaseNow);
    await new ReleaseProfileLeaseUseCase(
      context.profiles,
      context.leases,
      context.clock,
    ).execute({ leaseId: releasedCheckout.lease.id });

    await expect(
      new GetRuntimeProfileConfigurationUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId: releasedCheckout.lease.id }),
    ).rejects.toThrow(ProfileLeaseAlreadyClosedError);

    context.clock.setNow(checkoutNow);
    const expiredProfile = await createAdditionalReadyProfile(
      context,
      "profile-expired",
      "Profile Expired",
      "provisioning-token-expired",
      "WARMING",
    );
    const expiredCheckout = await checkoutProfileForAssistedGroupAccess(
      context,
      expiredProfile.identity.id,
    );
    context.clock.setNow("2026-01-05T18:46:00.000Z");

    await expect(
      new GetRuntimeProfileConfigurationUseCase(
        context.profiles,
        context.leases,
        context.clock,
      ).execute({ leaseId: expiredCheckout.lease.id }),
    ).rejects.toThrow(ProfileLeaseAlreadyClosedError);
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

  describe("source-aware checkout gate", () => {
    it("checks out a profile with JOINED_ACCESSIBLE state", async () => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context, {
        sourceAccess: "JOINED_ACCESSIBLE",
      });

      const output = await new CheckoutProfileUseCase(
        context.profiles,
        context.leases,
        context.leaseIds,
        context.clock,
        context.sourceGroupReference,
        context.profileSourceAccess,
      ).execute({ sourceGroupId: "source-group-1" });

      expect(output.profile.profileId).toBe(readyProfile.identity.id);
      expect(output.lease.status).toBe("ACTIVE");
    });

    it("rejects explicit profile with missing access record", async () => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context);
      // Don't create a source access record for "source-group-2"
      context.sourceGroupReference.existingIds.add("source-group-2");

      try {
        await new CheckoutProfileUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
          context.profileSourceAccess,
        ).execute({
          profileId: "profile-1",
          sourceGroupId: "source-group-2",
        });
        throw new Error("Expected checkout to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);
        if (error instanceof ProfileNotCheckoutEligibleError) {
          expect(error.profileId).toBe(readyProfile.identity.id);
          expect(error.reasons).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                code: "SOURCE_ACCESS_UNSUCCESSFUL",
              }),
            ]),
          );
        }
      }

      // Verify no lease was created
      const activeLease = await context.leases.findActiveByProfileId(
        readyProfile.identity.id,
      );
      expect(activeLease).toBeNull();

      // Verify profile remains READY
      const savedProfile = await context.profiles.findById(
        readyProfile.identity.id,
      );
      expect(savedProfile?.identity.status).toBe("READY");
    });

    it("rejects unknown source group with 404", async () => {
      const context = createTestContext();
      await createReadyProfile(context);

      await expect(
        new CheckoutProfileUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
          context.profileSourceAccess,
        ).execute({
          sourceGroupId: "unknown-group",
        }),
      ).rejects.toThrow(SourceGroupNotFoundError);
    });

    it("skips inaccessible profiles and leases accessible profile during automatic selection", async () => {
      const context = createTestContext();

      // First profile: READY but with unsuccessful access state
      const profile1 = await createReadyProfile(context, {
        sourceAccess: "ACCESS_DENIED",
      });

      // Second profile: READY with successful access state
      await new CreateProfileUseCase(context.profiles, context.clock).execute({
        id: "profile-2",
        displayName: "Profile 2",
      });
      await new UpdateProfileConfigurationUseCase(
        context.profiles,
        context.clock,
      ).execute({
        profileId: "profile-2",
        networkContext: createNetworkContext(),
        hardwareFingerprint: createHardwareFingerprint(),
        behavioralPersona: createBehavioralPersona(),
        temporalRoutine: createTemporalRoutine(),
        safetyThresholds: createSafetyThresholds(),
        contentAffinities: createContentAffinities(),
      });
      const started2 = await new StartProfileProvisioningUseCase(
        context.profiles,
        context.tokens,
        context.clock,
      ).execute({ profileId: "profile-2" });
      const readyProfile2 = await new IngestProfileSessionUseCase(
        context.profiles,
        context.clock,
      ).execute({
        provisioningToken: started2.provisioningToken,
        cookies: createCookies(),
        localStorage: createLocalStorage(),
        sessionExpiresAt: "2026-01-06T18:00:00.000Z",
      });
      await context.profileSourceAccess.upsert({
        id: "access-2",
        profileId: readyProfile2.identity.id,
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
      await setProfileAccountStage(
        context,
        readyProfile2.identity.id,
        "COLLECTION_READY",
      );

      // Automatic checkout should skip profile-1 and lease profile-2
      const output = await new CheckoutProfileUseCase(
        context.profiles,
        context.leases,
        context.leaseIds,
        context.clock,
        context.sourceGroupReference,
        context.profileSourceAccess,
      ).execute({ sourceGroupId: "source-group-1" });

      expect(output.profile.profileId).toBe("profile-2");
      expect(output.lease.status).toBe("ACTIVE");

      // Verify first profile remains READY (unchanged)
      const savedProfile1 = await context.profiles.findById(
        profile1.identity.id,
      );
      expect(savedProfile1?.identity.status).toBe("READY");
    });

    it("skips profiles with unsuccessful access states during automatic selection", async () => {
      const states: ProfileSourceAccessState[] = [
        "UNKNOWN",
        "JOIN_REQUIRED",
        "JOIN_REQUESTED",
        "ACCESS_DENIED",
        "LOGIN_REQUIRED",
        "CHECKPOINT_REQUIRED",
        "NEEDS_MANUAL_REVIEW",
      ];

      for (let i = 0; i < states.length; i++) {
        const state = states[i]!;
        const context = createTestContext();
        await createReadyProfile(context, {
          sourceAccess: state,
        });

        await expect(
          new CheckoutProfileUseCase(
            context.profiles,
            context.leases,
            context.leaseIds,
            context.clock,
            context.sourceGroupReference,
            context.profileSourceAccess,
          ).execute({ sourceGroupId: "source-group-1" }),
        ).rejects.toThrow(NoEligibleProfileAvailableError);
      }
    });

    it("rejects explicit profile with unsuccessful access state", async () => {
      const context = createTestContext();
      await createReadyProfile(context, { sourceAccess: "ACCESS_DENIED" });

      await expect(
        new CheckoutProfileUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
          context.profileSourceAccess,
        ).execute({
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        }),
      ).rejects.toThrow(ProfileNotCheckoutEligibleError);
    });

    it("reports ordinary eligibility before source access for explicit profile checkout", async () => {
      const context = createTestContext();
      const profile = await createReadyProfile(context, {
        accountStage: "WARMING",
        sourceAccess: "ACCESS_DENIED",
      });

      try {
        await new CheckoutProfileUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
          context.profileSourceAccess,
        ).execute({
          profileId: profile.identity.id,
          sourceGroupId: "source-group-1",
        });
        throw new Error("Expected checkout to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileNotCheckoutEligibleError);

        if (error instanceof ProfileNotCheckoutEligibleError) {
          expect(error.profileId).toBe(profile.identity.id);
          expect(error.reasons).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                code: "ACCOUNT_STAGE_NOT_COLLECTION_READY",
              }),
            ]),
          );
          expect(error.reasons).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                code: "SOURCE_ACCESS_UNSUCCESSFUL",
              }),
            ]),
          );
        }
      }
    });

    it("does not mutate access records during successful checkout", async () => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context);

      // Capture access record before checkout
      const accessRecordBefore =
        await context.profileSourceAccess.getByProfileAndSourceGroup(
          readyProfile.identity.id,
          "source-group-1",
        );
      expect(accessRecordBefore).not.toBeNull();

      // Execute successful checkout
      await new CheckoutProfileUseCase(
        context.profiles,
        context.leases,
        context.leaseIds,
        context.clock,
        context.sourceGroupReference,
        context.profileSourceAccess,
      ).execute({ sourceGroupId: "source-group-1" });

      // Verify access record is unchanged
      const accessRecordAfter =
        await context.profileSourceAccess.getByProfileAndSourceGroup(
          readyProfile.identity.id,
          "source-group-1",
        );
      expect(accessRecordAfter).toEqual(accessRecordBefore);
      expect(accessRecordAfter?.lastCheckedAt).toBe(
        accessRecordBefore?.lastCheckedAt,
      );
      expect(accessRecordAfter?.lastSuccessfulAt).toBe(
        accessRecordBefore?.lastSuccessfulAt,
      );
      expect(accessRecordAfter?.updatedAt).toBe(
        accessRecordBefore?.updatedAt,
      );
      expect(accessRecordAfter?.notes).toBe(accessRecordBefore?.notes);
      expect(accessRecordAfter?.lastFailureReason).toBe(
        accessRecordBefore?.lastFailureReason,
      );
    });

    it("does not mutate access records during rejected checkout", async () => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context, {
        sourceAccess: "ACCESS_DENIED",
      });

      // Capture access record before checkout
      const accessRecordBefore =
        await context.profileSourceAccess.getByProfileAndSourceGroup(
          readyProfile.identity.id,
          "source-group-1",
        );
      expect(accessRecordBefore).not.toBeNull();

      // Execute rejected checkout
      try {
        await new CheckoutProfileUseCase(
          context.profiles,
          context.leases,
          context.leaseIds,
          context.clock,
          context.sourceGroupReference,
          context.profileSourceAccess,
        ).execute({
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify access record is unchanged
      const accessRecordAfter =
        await context.profileSourceAccess.getByProfileAndSourceGroup(
          readyProfile.identity.id,
          "source-group-1",
        );
      expect(accessRecordAfter).toEqual(accessRecordBefore);
      expect(accessRecordAfter?.lastCheckedAt).toBe(
        accessRecordBefore?.lastCheckedAt,
      );
      expect(accessRecordAfter?.lastSuccessfulAt).toBe(
        accessRecordBefore?.lastSuccessfulAt,
      );
      expect(accessRecordAfter?.updatedAt).toBe(
        accessRecordBefore?.updatedAt,
      );
      expect(accessRecordAfter?.notes).toBe(accessRecordBefore?.notes);
      expect(accessRecordAfter?.lastFailureReason).toBe(
        accessRecordBefore?.lastFailureReason,
      );
    });

    it("finds profile IDs by source group and successful states", async () => {
      const context = createTestContext();

      // Create three profiles with different access states
      await context.profileSourceAccess.upsert({
        id: "access-1",
        profileId: "profile-1",
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
      await context.profileSourceAccess.upsert({
        id: "access-2",
        profileId: "profile-2",
        sourceGroupId: "source-group-1",
        accessState: "JOINED_ACCESSIBLE",
        lastCheckedAt: checkoutNow,
        lastSuccessfulAt: checkoutNow,
        lastFailureReason: null,
        joinRequestedAt: null,
        notes: undefined,
        createdAt: checkoutNow,
        updatedAt: checkoutNow,
      });
      await context.profileSourceAccess.upsert({
        id: "access-3",
        profileId: "profile-3",
        sourceGroupId: "source-group-1",
        accessState: "ACCESS_DENIED",
        lastCheckedAt: checkoutNow,
        lastSuccessfulAt: null,
        lastFailureReason: null,
        joinRequestedAt: null,
        notes: undefined,
        createdAt: checkoutNow,
        updatedAt: checkoutNow,
      });
      await context.profileSourceAccess.upsert({
        id: "access-4",
        profileId: "profile-4",
        sourceGroupId: "source-group-2",
        accessState: "PUBLIC_ACCESSIBLE",
        lastCheckedAt: checkoutNow,
        lastSuccessfulAt: checkoutNow,
        lastFailureReason: null,
        joinRequestedAt: null,
        notes: undefined,
        createdAt: checkoutNow,
        updatedAt: checkoutNow,
      });

      const profileIds =
        await context.profileSourceAccess.findProfileIdsBySourceGroupAndStates(
          "source-group-1",
          ["PUBLIC_ACCESSIBLE", "JOINED_ACCESSIBLE"],
        );

      expect(profileIds).toEqual(
        expect.arrayContaining(["profile-1", "profile-2"]),
      );
      expect(profileIds).not.toContain("profile-3");
      expect(profileIds).not.toContain("profile-4");
    });

    it("returns empty array when no matching source group", async () => {
      const context = createTestContext();
      await context.profileSourceAccess.upsert({
        id: "access-1",
        profileId: "profile-1",
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

      const profileIds =
        await context.profileSourceAccess.findProfileIdsBySourceGroupAndStates(
          "nonexistent-group",
          ["PUBLIC_ACCESSIBLE"],
        );

      expect(profileIds).toEqual([]);
    });

    it("excludes unsuccessful states from query results", async () => {
      const context = createTestContext();
      await context.profileSourceAccess.upsert({
        id: "access-1",
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        accessState: "UNKNOWN",
        lastCheckedAt: checkoutNow,
        lastSuccessfulAt: null,
        lastFailureReason: null,
        joinRequestedAt: null,
        notes: undefined,
        createdAt: checkoutNow,
        updatedAt: checkoutNow,
      });
      await context.profileSourceAccess.upsert({
        id: "access-2",
        profileId: "profile-2",
        sourceGroupId: "source-group-1",
        accessState: "JOIN_REQUIRED",
        lastCheckedAt: checkoutNow,
        lastSuccessfulAt: null,
        lastFailureReason: null,
        joinRequestedAt: null,
        notes: undefined,
        createdAt: checkoutNow,
        updatedAt: checkoutNow,
      });

      const profileIds =
        await context.profileSourceAccess.findProfileIdsBySourceGroupAndStates(
          "source-group-1",
          ["PUBLIC_ACCESSIBLE", "JOINED_ACCESSIBLE"],
        );

      expect(profileIds).toEqual([]);
    });

    it("uses transaction-scoped repositories when transaction manager is configured", async () => {
      const context = createTestContext();
      const readyProfile = await createReadyProfile(context);

      // Create separate repositories for transaction scope
      const transactionProfiles = new InMemoryProfileRepository();
      const transactionLeases = new InMemoryProfileLeaseRepository();
      const transactionProfileSourceAccess =
        new InMemoryProfileSourceAccessRepository();

      // Copy profile to transaction scope
      const profileInTx = await context.profiles.findById(
        readyProfile.identity.id,
      );
      if (profileInTx) {
        await transactionProfiles.save(profileInTx);
      }

      // Copy access record to transaction scope
      const accessRecord =
        await context.profileSourceAccess.getByProfileAndSourceGroup(
          readyProfile.identity.id,
          "source-group-1",
        );
      if (accessRecord) {
        await transactionProfileSourceAccess.upsert(accessRecord);
      }

      // Create mock transaction manager
      const transactionManager = {
        runInTransaction: async <T>(
          work: (repositories: {
            profiles: InMemoryProfileRepository;
            leases: InMemoryProfileLeaseRepository;
            profileSourceAccess: InMemoryProfileSourceAccessRepository;
          }) => Promise<T>,
        ): Promise<T> => {
          return work({
            profiles: transactionProfiles,
            leases: transactionLeases,
            profileSourceAccess: transactionProfileSourceAccess,
          });
        },
      };

      // Execute checkout with transaction manager
      const output = await new CheckoutProfileUseCase(
        context.profiles,
        context.leases,
        context.leaseIds,
        context.clock,
        context.sourceGroupReference,
        context.profileSourceAccess,
        transactionManager,
      ).execute({ sourceGroupId: "source-group-1" });

      // Verify lease was created in transaction scope
      const leaseInTx = await transactionLeases.findById(output.lease.id);
      expect(leaseInTx).not.toBeNull();
      expect(leaseInTx?.status).toBe("ACTIVE");

      // Verify profile was updated in transaction scope
      const profileInTxAfter = await transactionProfiles.findById(
        readyProfile.identity.id,
      );
      expect(profileInTxAfter?.identity.status).toBe("BUSY");

      // Verify non-transaction repositories were NOT modified
      const leaseInMain = await context.leases.findById(output.lease.id);
      expect(leaseInMain).toBeNull();

      const profileInMainAfter = await context.profiles.findById(
        readyProfile.identity.id,
      );
      expect(profileInMainAfter?.identity.status).toBe("READY");
    });
  });
});

interface TestContext {
  readonly profiles: InMemoryProfileRepository;
  readonly leases: InMemoryProfileLeaseRepository;
  readonly profileSourceAccess: InMemoryProfileSourceAccessRepository;
  readonly sourceGroupReference: FakeSourceGroupReference;
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
    profileSourceAccess: new InMemoryProfileSourceAccessRepository(),
    sourceGroupReference: new FakeSourceGroupReference(),
    tokens: new FakeTokenGenerator(["provisioning-token-1"]),
    leaseIds: new FakeLeaseIdGenerator(leaseIds),
    clock: new FixedClock(checkoutNow),
  };
}

async function createReadyProfile(
  context: TestContext,
  options: {
    readonly accountStage?: ProfileAccountStage;
    readonly sourceAccess?: ProfileSourceAccessState | null;
  } = {},
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

  if (options.sourceAccess !== null) {
    await context.profileSourceAccess.upsert({
      id: "access-1",
      profileId: readyProfile.identity.id,
      sourceGroupId: "source-group-1",
      accessState: options.sourceAccess ?? "PUBLIC_ACCESSIBLE",
      lastCheckedAt: checkoutNow,
      lastSuccessfulAt:
        options.sourceAccess === undefined ||
        options.sourceAccess === "PUBLIC_ACCESSIBLE" ||
        options.sourceAccess === "JOINED_ACCESSIBLE"
          ? checkoutNow
          : null,
      lastFailureReason: null,
      joinRequestedAt: null,
      notes: undefined,
      createdAt: checkoutNow,
      updatedAt: checkoutNow,
    });
  }

  return setProfileAccountStage(
    context,
    readyProfile.identity.id,
    options.accountStage ?? "COLLECTION_READY",
  );
}

async function createAdditionalReadyProfile(
  context: TestContext,
  profileId: ProfileId,
  displayName: string,
  provisioningToken: string,
  accountStage: ProfileAccountStage,
): Promise<CollectorProfile> {
  await new CreateProfileUseCase(context.profiles, context.clock).execute({
    id: profileId,
    displayName,
  });

  await new UpdateProfileConfigurationUseCase(
    context.profiles,
    context.clock,
  ).execute({
    profileId,
    networkContext: createNetworkContext(),
    hardwareFingerprint: createHardwareFingerprint(),
    behavioralPersona: createBehavioralPersona(),
    temporalRoutine: createTemporalRoutine(),
    safetyThresholds: createSafetyThresholds(),
    contentAffinities: createContentAffinities(),
  });

  const tokenGenerator = new FakeTokenGenerator([provisioningToken]);
  const started = await new StartProfileProvisioningUseCase(
    context.profiles,
    tokenGenerator,
    context.clock,
  ).execute({ profileId });

  const readyProfile = await new IngestProfileSessionUseCase(
    context.profiles,
    context.clock,
  ).execute({
    provisioningToken: started.provisioningToken,
    cookies: createCookies(),
    localStorage: createLocalStorage(),
    sessionExpiresAt: "2026-01-06T18:00:00.000Z",
  });

  return setProfileAccountStage(context, readyProfile.identity.id, accountStage);
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
  sourceGroupId: string = "source-group-1",
): Promise<{ readonly lease: ProfileLease }> {
  return new CheckoutProfileUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
    context.sourceGroupReference,
    context.profileSourceAccess,
  ).execute({ profileId, sourceGroupId });
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

async function checkoutProfileForAssistedGroupAccess(
  context: TestContext,
  profileId: ProfileId,
): Promise<{ readonly lease: ProfileLease; readonly profile: unknown }> {
  return new CheckoutProfileForAssistedGroupAccessUseCase(
    context.profiles,
    context.leases,
    context.leaseIds,
    context.clock,
    context.sourceGroupReference,
  ).execute({
    profileId,
    sourceGroupId: "source-group-1",
  });
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

async function expectAssistedGroupAccessCheckoutRejection(
  context: TestContext,
  expectedCode: string,
): Promise<void> {
  try {
    await checkoutProfileForAssistedGroupAccess(context, "profile-1");
    throw new Error("Expected assisted group access checkout to fail.");
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

class FakeSourceGroupReference implements SourceGroupReferencePort {
  public existingIds = new Set<string>(["source-group-1"]);
  public calls: string[] = [];

  public async exists(sourceGroupId: string): Promise<boolean> {
    this.calls.push(sourceGroupId);
    return this.existingIds.has(sourceGroupId);
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
