import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createActiveProfileLease,
  createPendingCollectorProfile,
  releaseProfileLease,
} from "../../../collector-profile-manager/domain";
import type {
  AuthenticationState,
  BehavioralPersona,
  BrowserCookie,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  IsoDateTime,
  LocalStorageEntry,
  NetworkContext,
  ProfileLease,
  SafetyThresholds,
  TemporalRoutine,
} from "../../../collector-profile-manager/domain";
import { createDatabaseClient } from "../client";
import type { DatabaseClient } from "../client";
import {
  InvalidPersistedCollectorProfileError,
  toCollectorProfileRow,
} from "../mappers/collector-profile.mapper";
import {
  hashProvisioningToken,
} from "../provisioning-token-hashing";
import {
  collectorProfileLeases,
  collectorProfiles,
} from "../schema/collector-profile-manager.schema";
import { DrizzleTransactionManager } from "../transaction/drizzle-transaction-manager";
import { DrizzleProfileLeaseRepository } from "./drizzle-profile-lease.repository";
import { DrizzleProfileRepository } from "./drizzle-profile.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("PostgreSQL repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("PostgreSQL repository integration", () => {
    let client: DatabaseClient | undefined;
    let profiles: DrizzleProfileRepository;
    let leases: DrizzleProfileLeaseRepository;
    let transactionManager: DrizzleTransactionManager;
    let nextId = 0;
    const createdProfileIds = new Set<string>();
    const createdLeaseIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 1,
        },
      });
      client = databaseClient;
      profiles = new DrizzleProfileRepository(databaseClient.db);
      leases = new DrizzleProfileLeaseRepository(databaseClient.db);
      transactionManager = new DrizzleTransactionManager(databaseClient.db);
    });

    afterEach(async () => {
      if (client === undefined) {
        return;
      }

      const leaseIds = [...createdLeaseIds];
      const profileIds = [...createdProfileIds];

      if (leaseIds.length > 0) {
        await client.db
          .delete(collectorProfileLeases)
          .where(inArray(collectorProfileLeases.id, leaseIds));
      }

      if (profileIds.length > 0) {
        await client.db
          .delete(collectorProfiles)
          .where(inArray(collectorProfiles.id, profileIds));
      }

      createdLeaseIds.clear();
      createdProfileIds.clear();
    });

    afterAll(async () => {
      await client?.close();
    });

    it("saves profiles and loads them by id while preserving JSONB property groups", async () => {
      const profile = trackProfile(
        createPersistableProfile(nextTestId("profile-round-trip")),
      );

      await profiles.save(profile);

      const loadedProfile = await profiles.findById(profile.identity.id);

      expect(loadedProfile).toEqual(profile);
      expect(loadedProfile?.networkContext).toEqual(profile.networkContext);
      expect(loadedProfile?.hardwareFingerprint).toEqual(
        profile.hardwareFingerprint,
      );
      expect(loadedProfile?.authenticationState).toEqual(
        profile.authenticationState,
      );
      expect(loadedProfile?.behavioralPersona).toEqual(
        profile.behavioralPersona,
      );
      expect(loadedProfile?.temporalRoutine).toEqual(profile.temporalRoutine);
      expect(loadedProfile?.safetyThresholds).toEqual(
        profile.safetyThresholds,
      );
      expect(loadedProfile?.contentAffinities).toEqual(
        profile.contentAffinities,
      );
    });

    it("finds profiles by provisioning token through persisted hash lookup", async () => {
      const token = `token-${nextTestId("issued")}`;
      const profile = trackProfile(
        createIssuedProvisioningProfile(nextTestId("profile-issued"), token),
      );

      await profiles.save(profile);

      const [row] = await getClient()
        .db
        .select()
        .from(collectorProfiles)
        .where(inArray(collectorProfiles.id, [profile.identity.id]))
        .limit(1);
      const loadedProfile = await profiles.findByProvisioningToken(token);

      expect(row?.provisioningTokenHash).toBe(hashProvisioningToken(token));
      expect(row?.provisioningTokenHash).not.toBe(token);
      expect(loadedProfile).toEqual(profile);
      await expect(
        profiles.findByProvisioningToken("missing-token"),
      ).resolves.toBeNull();
    });

    it("does not return consumed or expired persisted tokens as usable", async () => {
      const consumedToken = `token-${nextTestId("consumed")}`;
      const expiredToken = `token-${nextTestId("expired")}`;
      const consumedProfile = trackProfile(
        createIssuedProvisioningProfile(
          nextTestId("profile-consumed"),
          consumedToken,
        ),
      );
      const expiredProfile = trackProfile(
        createIssuedProvisioningProfile(
          nextTestId("profile-expired"),
          expiredToken,
        ),
      );

      await getClient().db.insert(collectorProfiles).values({
        ...toCollectorProfileRow(consumedProfile),
        provisioningTokenStatus: "CONSUMED",
        provisioningTokenConsumedAt: "2026-01-05T18:02:00.000Z",
      });
      await getClient().db.insert(collectorProfiles).values({
        ...toCollectorProfileRow(expiredProfile),
        provisioningTokenStatus: "EXPIRED",
        provisioningTokenExpiresAt: "2026-01-05T17:59:00.000Z",
      });

      await expect(
        profiles.findByProvisioningToken(consumedToken),
      ).resolves.toBeNull();
      await expect(
        profiles.findByProvisioningToken(expiredToken),
      ).resolves.toBeNull();
    });

    it("finds checkout candidates by status and availability", async () => {
      const readyNow = trackProfile(
        createReadyProfile(nextTestId("ready-now"), {
          createdAt: "2026-01-05T18:00:00.000Z",
        }),
      );
      const readyAfterCooldown = trackProfile(
        createReadyProfile(nextTestId("ready-after-cooldown"), {
          createdAt: "2026-01-05T18:01:00.000Z",
          nextAvailableAt: "2026-01-05T17:59:00.000Z",
        }),
      );
      const readyInFuture = trackProfile(
        createReadyProfile(nextTestId("ready-in-future"), {
          createdAt: "2026-01-05T18:02:00.000Z",
          nextAvailableAt: "2026-01-05T18:01:00.000Z",
        }),
      );
      const busy = trackProfile(createBusyProfile(nextTestId("busy")));

      await profiles.save(readyNow);
      await profiles.save(readyAfterCooldown);
      await profiles.save(readyInFuture);
      await profiles.save(busy);

      const candidates = await profiles.findCheckoutCandidates({
        status: "READY",
        availableAt: "2026-01-05T18:00:00.000Z",
      });
      const limitedCandidates = await profiles.findCheckoutCandidates({
        status: "READY",
        availableAt: "2026-01-05T18:00:00.000Z",
        limit: 1,
      });

      expect(candidates.map((profile) => profile.identity.id)).toEqual([
        readyNow.identity.id,
        readyAfterCooldown.identity.id,
      ]);
      expect(limitedCandidates.map((profile) => profile.identity.id)).toEqual([
        readyNow.identity.id,
      ]);
    });

    it("rejects invalid persisted JSONB profile data on read", async () => {
      const profile = trackProfile(
        createPersistableProfile(nextTestId("profile-invalid-jsonb")),
      );

      await getClient().db.insert(collectorProfiles).values({
        ...toCollectorProfileRow(profile),
        networkContext: {
          proxy: null,
        } as unknown as NetworkContext,
      });

      await expect(profiles.findById(profile.identity.id)).rejects.toThrow(
        InvalidPersistedCollectorProfileError,
      );
    });

    it("saves leases, finds active leases by profile id, and updates status", async () => {
      const profile = trackProfile(
        createReadyProfile(nextTestId("lease-profile")),
      );
      const lease = trackLease(
        createLease(nextTestId("lease"), profile.identity.id),
      );

      await profiles.save(profile);
      await leases.save(lease);

      await expect(leases.findById(lease.id)).resolves.toEqual(lease);
      await expect(
        leases.findActiveByProfileId(profile.identity.id),
      ).resolves.toEqual(lease);

      const releasedLease = releaseProfileLease(
        lease,
        "2026-01-05T18:10:00.000Z",
      );

      await leases.updateStatus(releasedLease);

      await expect(leases.findById(lease.id)).resolves.toEqual(releasedLease);
      await expect(
        leases.findActiveByProfileId(profile.identity.id),
      ).resolves.toBeNull();
    });

    it("enforces one active lease per profile with the partial unique index", async () => {
      const profile = trackProfile(
        createReadyProfile(nextTestId("unique-lease-profile")),
      );
      const firstLease = trackLease(
        createLease(nextTestId("active-lease-1"), profile.identity.id),
      );
      const secondLease = trackLease(
        createLease(nextTestId("active-lease-2"), profile.identity.id),
      );

      await profiles.save(profile);
      await leases.save(firstLease);

      await expect(leases.save(secondLease)).rejects.toThrow();
    });

    it("commits profile and lease writes inside a transaction", async () => {
      const profile = trackProfile(
        createReadyProfile(nextTestId("tx-commit-profile")),
      );
      const lease = trackLease(
        createLease(nextTestId("tx-commit-lease"), profile.identity.id),
      );

      await transactionManager.runInTransaction(async (repositories) => {
        await repositories.profiles.save(profile);
        await repositories.leases.save(lease);
      });

      await expect(profiles.findById(profile.identity.id)).resolves.toEqual(
        profile,
      );
      await expect(leases.findById(lease.id)).resolves.toEqual(lease);
    });

    it("rolls back profile and lease writes when a transaction fails", async () => {
      const profile = trackProfile(
        createReadyProfile(nextTestId("tx-rollback-profile")),
      );
      const lease = trackLease(
        createLease(nextTestId("tx-rollback-lease"), profile.identity.id),
      );

      await expect(
        transactionManager.runInTransaction(async (repositories) => {
          await repositories.profiles.save(profile);
          await repositories.leases.save(lease);

          throw new Error("force transaction rollback");
        }),
      ).rejects.toThrow("force transaction rollback");

      await expect(profiles.findById(profile.identity.id)).resolves.toBeNull();
      await expect(leases.findById(lease.id)).resolves.toBeNull();
    });

    function nextTestId(label: string): string {
      nextId += 1;

      return `db-it-${process.pid}-${Date.now()}-${nextId}-${label}`;
    }

    function trackProfile(profile: CollectorProfile): CollectorProfile {
      createdProfileIds.add(profile.identity.id);

      return profile;
    }

    function trackLease(lease: ProfileLease): ProfileLease {
      createdLeaseIds.add(lease.id);

      return lease;
    }

    function getClient(): DatabaseClient {
      if (client === undefined) {
        throw new Error("Database client was not initialized.");
      }

      return client;
    }
  });
}

interface PersistableProfileOptions {
  readonly displayName?: string;
  readonly createdAt?: IsoDateTime;
}

interface ReadyProfileOptions extends PersistableProfileOptions {
  readonly nextAvailableAt?: IsoDateTime | null;
}

const defaultCreatedAt = "2026-01-05T18:00:00.000Z";

function createPersistableProfile(
  id: string,
  options: PersistableProfileOptions = {},
): CollectorProfile {
  const createdAt = options.createdAt ?? defaultCreatedAt;
  const profile = createPendingCollectorProfile({
    id,
    displayName: options.displayName ?? id,
    createdAt,
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
      externalReference: `external-${id}`,
      labels: ["db-integration", id],
    },
    authenticationState: createAuthenticationState(),
  };
}

function createIssuedProvisioningProfile(
  id: string,
  token: string,
): CollectorProfile {
  const profile = createPersistableProfile(id);

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: "PENDING_LOGIN",
      updatedAt: defaultCreatedAt,
    },
    provisioningToken: {
      status: "ISSUED",
      tokenHash: token,
      issuedAt: defaultCreatedAt,
      expiresAt: "2026-01-05T18:15:00.000Z",
      consumedAt: null,
    },
  };
}

function createReadyProfile(
  id: string,
  options: ReadyProfileOptions = {},
): CollectorProfile {
  const profile = createPersistableProfile(id, options);

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: "READY",
      nextAvailableAt: options.nextAvailableAt ?? null,
    },
    provisioningToken: {
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: defaultCreatedAt,
      expiresAt: "2026-01-05T18:15:00.000Z",
      consumedAt: defaultCreatedAt,
    },
  };
}

function createBusyProfile(id: string): CollectorProfile {
  const profile = createReadyProfile(id);

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status: "BUSY",
      lastCheckoutAt: defaultCreatedAt,
      dailyUsage: {
        localDate: "2026-01-05",
        sessionsStarted: 1,
        activeDurationMinutes: 0,
        macroActions: 0,
      },
    },
  };
}

function createLease(id: string, profileId: string): ProfileLease {
  return createActiveProfileLease({
    id,
    profileId,
    leasedAt: defaultCreatedAt,
    expiresAt: "2026-01-05T18:45:00.000Z",
  });
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

function createAuthenticationState(): AuthenticationState {
  return {
    cookies: createCookies(),
    localStorage: createLocalStorage(),
    sessionCapturedAt: defaultCreatedAt,
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
