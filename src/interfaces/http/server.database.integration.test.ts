import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createCollectorProfileManagerFromDatabaseClient,
} from "../../composition/collector-profile-manager";
import type {
  CollectorProfileManagerService,
} from "../../composition/collector-profile-manager";
import {
  collectorProfileLeases,
  collectorProfiles,
  createDatabaseClient,
} from "../../infrastructure/database";
import type { DatabaseClient } from "../../infrastructure/database";
import { createHttpServer } from "./server";

const shouldRunHttpDbTests = process.env.RUN_HTTP_DB_TESTS === "true";
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!shouldRunHttpDbTests) {
  describe.skip("HTTP PostgreSQL integration", () => {
    it("runs only when RUN_HTTP_DB_TESTS=true", () => {});
  });
} else if (databaseUrl === undefined || databaseUrl === "") {
  describe("HTTP PostgreSQL integration", () => {
    it("requires DATABASE_URL when RUN_HTTP_DB_TESTS=true", () => {
      throw new Error(
        "DATABASE_URL is required when RUN_HTTP_DB_TESTS=true.",
      );
    });
  });
} else {
  describe("HTTP PostgreSQL integration", () => {
    let client: DatabaseClient | undefined;
    let service: CollectorProfileManagerService | undefined;
    let server: FastifyInstance | undefined;
    let nextId = 0;
    const createdProfileIds = new Set<string>();
    const createdLeaseIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        databaseUrl,
        poolConfig: {
          max: 1,
        },
      });
      client = databaseClient;
      service = createCollectorProfileManagerFromDatabaseClient(databaseClient);
      server = createHttpServer({
        collectorProfileManager: service,
      });
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
      await server?.close();

      if (service !== undefined) {
        await service.close();
        return;
      }

      await client?.close();
    });

    it("returns health status through a server created with real composition", async () => {
      const response = await getServer().inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });

    it("persists the profile lifecycle through HTTP, composition, use cases, repositories, and PostgreSQL", async () => {
      const profileId = trackProfileId(nextTestId("profile"));
      const displayName = `HTTP DB Integration ${profileId}`;

      const createResponse = await getServer().inject({
        method: "POST",
        url: "/collector/profiles",
        payload: {
          id: profileId,
          displayName,
        },
      });
      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json()).toMatchObject({
        profile: {
          id: profileId,
          displayName,
          status: "PENDING_CONFIG",
          hasHardwareFingerprint: false,
          hasAuthenticationState: false,
        },
      });

      const createdReadResponse = await getServer().inject({
        method: "GET",
        url: `/collector/profiles/${profileId}`,
      });
      const createdReadBody = createdReadResponse.json();
      expect(createdReadResponse.statusCode).toBe(200);
      expect(createdReadBody).toMatchObject({
        profile: {
          id: profileId,
          displayName,
          status: "PENDING_CONFIG",
        },
      });
      expectReadPayloadIsSafe(createdReadBody);

      const configuration = createConfiguration();
      const updateResponse = await getServer().inject({
        method: "PATCH",
        url: `/collector/profiles/${profileId}/configuration`,
        payload: configuration,
      });
      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({
        profile: {
          id: profileId,
          status: "PENDING_CONFIG",
          hasHardwareFingerprint: true,
        },
      });

      const configuredReadResponse = await getServer().inject({
        method: "GET",
        url: `/collector/profiles/${profileId}`,
      });
      const configuredReadBody = configuredReadResponse.json();
      expect(configuredReadResponse.statusCode).toBe(200);
      expect(configuredReadBody).toMatchObject({
        profile: {
          id: profileId,
          status: "PENDING_CONFIG",
          timezone: "Etc/UTC",
          networkContext: {
            proxy: {
              host: "proxy.integration.test",
              port: 443,
              protocol: "HTTPS",
            },
          },
          hardwareFingerprint: {
            timezone: "Etc/UTC",
          },
        },
      });
      expect(configuredReadBody.profile.networkContext.proxy).not.toHaveProperty(
        "credentials",
      );
      expectReadPayloadIsSafe(configuredReadBody);

      const startResponse = await getServer().inject({
        method: "POST",
        url: `/collector/profiles/${profileId}/provisioning/start`,
      });
      const startedBody = startResponse.json();
      expect(startResponse.statusCode).toBe(200);
      expect(startedBody).toMatchObject({
        profile: {
          id: profileId,
          status: "PENDING_LOGIN",
          provisioningTokenStatus: "ISSUED",
        },
      });
      expect(typeof startedBody.provisioningToken).toBe("string");
      expect(startedBody.provisioningToken.length).toBeGreaterThan(0);

      const provisioningToken = startedBody.provisioningToken as string;
      const pendingLoginReadResponse = await getServer().inject({
        method: "GET",
        url: `/collector/profiles/${profileId}`,
      });
      const pendingLoginReadBody = pendingLoginReadResponse.json();
      expect(pendingLoginReadResponse.statusCode).toBe(200);
      expect(pendingLoginReadBody).toMatchObject({
        profile: {
          id: profileId,
          status: "PENDING_LOGIN",
        },
      });
      expectReadPayloadIsSafe(pendingLoginReadBody, provisioningToken);

      const provisioningConfigurationResponse = await getServer().inject({
        method: "GET",
        url: `/collector/provisioning/${encodeURIComponent(
          provisioningToken,
        )}/configuration`,
      });
      const provisioningConfigurationBody =
        provisioningConfigurationResponse.json();
      expect(provisioningConfigurationResponse.statusCode).toBe(200);
      expect(provisioningConfigurationBody).toMatchObject({
        profileId,
        networkContext: {
          proxy: {
            host: "proxy.integration.test",
            port: 443,
            protocol: "HTTPS",
          },
        },
        hardwareFingerprint: {
          timezone: "Etc/UTC",
        },
      });
      expect(
        provisioningConfigurationBody.networkContext.proxy,
      ).not.toHaveProperty("credentials");
      expectReadPayloadIsSafe(
        provisioningConfigurationBody,
        provisioningToken,
      );

      const sessionPayload = createSessionPayload();
      const ingestResponse = await getServer().inject({
        method: "POST",
        url: `/collector/provisioning/${encodeURIComponent(
          provisioningToken,
        )}/session`,
        payload: sessionPayload,
      });
      expect(ingestResponse.statusCode).toBe(200);
      expect(ingestResponse.json()).toMatchObject({
        profile: {
          id: profileId,
          status: "READY",
          hasAuthenticationState: true,
          provisioningTokenStatus: "CONSUMED",
        },
      });

      const readyReadResponse = await getServer().inject({
        method: "GET",
        url: `/collector/profiles/${profileId}`,
      });
      const readyReadBody = readyReadResponse.json();
      expect(readyReadResponse.statusCode).toBe(200);
      expect(readyReadBody).toMatchObject({
        profile: {
          id: profileId,
          status: "READY",
          hasAuthenticationState: true,
        },
      });
      expectReadPayloadIsSafe(readyReadBody, provisioningToken);

      const listResponse = await getServer().inject({
        method: "GET",
        url: "/collector/profiles?status=READY&limit=100&offset=0",
      });
      const listBody = listResponse.json();
      expect(listResponse.statusCode).toBe(200);
      expect(
        listBody.items.some(
          (profile: { readonly id?: string }) => profile.id === profileId,
        ),
      ).toBe(true);
      expectReadPayloadIsSafe(listBody, provisioningToken);

      const replayResponse = await getServer().inject({
        method: "POST",
        url: `/collector/provisioning/${encodeURIComponent(
          provisioningToken,
        )}/session`,
        payload: sessionPayload,
      });
      expect(replayResponse.statusCode).toBe(401);
      expect(replayResponse.json()).toMatchObject({
        error: {
          code: "INVALID_PROVISIONING_TOKEN",
        },
      });

      const checkoutResponse = await getServer().inject({
        method: "POST",
        url: "/collector/profiles/checkout",
        payload: {
          profileId,
        },
      });
      const checkoutBody = checkoutResponse.json();
      const leaseId =
        typeof checkoutBody.lease?.id === "string"
          ? trackLeaseId(checkoutBody.lease.id)
          : undefined;

      expect(checkoutResponse.statusCode).toBe(200);
      expect(leaseId).toBeDefined();
      const activeLeaseId = leaseId ?? "missing-lease-id";
      expect(checkoutBody).toMatchObject({
        lease: {
          id: activeLeaseId,
          profileId,
          status: "ACTIVE",
        },
        profile: {
          profileId,
          authenticationState: sessionPayload,
        },
      });

      const busyReadResponse = await getServer().inject({
        method: "GET",
        url: `/collector/profiles/${profileId}`,
      });
      const busyReadBody = busyReadResponse.json();
      expect(busyReadResponse.statusCode).toBe(200);
      expect(busyReadBody).toMatchObject({
        profile: {
          id: profileId,
          status: "BUSY",
          hasAuthenticationState: true,
        },
      });
      expectReadPayloadIsSafe(busyReadBody, provisioningToken);

      const releaseResponse = await getServer().inject({
        method: "POST",
        url: `/collector/profile-leases/${activeLeaseId}/release`,
        payload: {
          macroActionsPerformed: 3,
        },
      });
      expect(releaseResponse.statusCode).toBe(200);
      expect(releaseResponse.json()).toMatchObject({
        lease: {
          id: activeLeaseId,
          profileId,
          status: "RELEASED",
        },
        profile: {
          id: profileId,
          status: "READY",
          hasAuthenticationState: true,
        },
      });

      const releasedReadResponse = await getServer().inject({
        method: "GET",
        url: `/collector/profiles/${profileId}`,
      });
      const releasedReadBody = releasedReadResponse.json();
      expect(releasedReadResponse.statusCode).toBe(200);
      expect(releasedReadBody).toMatchObject({
        profile: {
          id: profileId,
          status: "READY",
          hasAuthenticationState: true,
        },
      });
      expectReadPayloadIsSafe(releasedReadBody, provisioningToken);
    });

    function nextTestId(label: string): string {
      nextId += 1;

      return `http-db-it-${process.pid}-${Date.now()}-${nextId}-${label}`;
    }

    function trackProfileId(profileId: string): string {
      createdProfileIds.add(profileId);

      return profileId;
    }

    function trackLeaseId(leaseId: string): string {
      createdLeaseIds.add(leaseId);

      return leaseId;
    }

    function getServer(): FastifyInstance {
      if (server === undefined) {
        throw new Error("HTTP server was not initialized.");
      }

      return server;
    }
  });
}

function createConfiguration() {
  return {
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.integration.test",
        port: 443,
        credentials: {
          username: "collector",
          password: "proxy-password-secret",
        },
        countryCode: "US",
        region: "CA",
      },
      killswitch: {
        enabled: true,
        failClosed: true,
      },
    },
    hardwareFingerprint: {
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
      timezone: "Etc/UTC",
    },
    behavioralPersona: {
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
    },
    temporalRoutine: {
      timezone: "Etc/UTC",
      chronotype: "MORNING",
      activeWindows: [
        {
          days: [0, 1, 2, 3, 4, 5, 6],
          startsAt: "00:00",
          endsAt: "00:00",
        },
      ],
      cooldownMinutes: 0,
    },
    safetyThresholds: {
      maxSessionsPerDay: 10,
      maxSessionDurationMinutes: 1440,
      maxMacroActionsPerDay: 1000,
      minCooldownMinutes: 0,
    },
    contentAffinities: {
      primaryTopics: [
        {
          topic: "integration",
          weight: 1,
        },
      ],
      secondaryTopics: [
        {
          topic: "database",
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
    },
  };
}

function createSessionPayload() {
  return {
    cookies: [
      {
        name: "session",
        value: "session-cookie-secret",
        domain: "example.test",
        path: "/",
        expiresAt: "2099-01-01T00:00:00.000Z",
        httpOnly: true,
        secure: true,
        sameSite: "LAX",
      },
    ],
    localStorage: [
      {
        origin: "https://example.test",
        key: "auth",
        value: "local-storage-secret",
      },
    ],
    sessionExpiresAt: "2099-01-01T00:00:00.000Z",
  };
}

function expectReadPayloadIsSafe(
  payload: unknown,
  provisioningToken?: string,
): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("cookies");
  expect(serialized).not.toContain("session-cookie-secret");
  expect(serialized).not.toContain("localStorage");
  expect(serialized).not.toContain("local-storage-secret");
  expect(serialized).not.toContain("provisioningToken");
  expect(serialized).not.toContain("tokenHash");
  expect(serialized).not.toContain("credentials");
  expect(serialized).not.toContain("proxy-password-secret");

  if (provisioningToken !== undefined) {
    expect(serialized).not.toContain(provisioningToken);
  }
}
