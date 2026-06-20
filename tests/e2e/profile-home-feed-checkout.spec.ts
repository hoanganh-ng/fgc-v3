import { expect, test } from "@playwright/test";
import { buildRunStamp } from "./fixtures/synthetic-payloads";

/**
 * Sprint 065C2 — Profile-Bound Home-Feed Checkout E2E flow.
 *
 * Proves the new `POST /collector/profiles/:profileId/home-feed/checkout`
 * route through Nginx → Fastify → Collector Profile Manager application →
 * PostgreSQL using only synthetic fixtures. The spec exercises the
 * public gateway only (`http://web-gateway`) and asserts:
 *
 * - a fully synthetic eligible profile is created, configured,
 *   provisioned, and reaches READY + COLLECTION_READY without a
 *   Source Group or profile-source access record;
 * - the home-feed checkout response carries a HOME_FEED_COLLECTION
 *   lease with the matching BUSY profile id and `accountStage`;
 * - duplicate home-feed checkout is rejected with 409;
 * - release returns the lease to RELEASED and the profile to READY;
 * - the response never leaks `cookies`, `localStorage`, proxy
 *   credentials, fingerprint data, provisioning tokens, source group
 *   data, source-access data, or runtime configuration.
 *
 * The spec never touches Facebook and never references real cookies,
 * localStorage, sessions, tokens, authorization headers, proxy
 * credentials, screenshots, raw HTML, viewer data, or raw GraphQL
 * payloads.
 */
test.describe("Sprint 065C2 — Profile-Bound Home-Feed Checkout E2E", () => {
  const runStamp = "sprint-065c2-stable";
  const profileId = `sprint-065c2-profile-${runStamp}`;
  const displayName = `Sprint 065C2 Profile ${runStamp}`;
  let provisioningToken = "";
  let activeLeaseId = "";

  test("creates a synthetic eligible profile without a Source Group", async ({
    request,
  }) => {
    const createResponse = await request.post("/collector/profiles", {
      data: {
        id: profileId,
        displayName,
      },
    });
    expect(
      createResponse.status(),
      `create id=${profileId} POST /collector/profiles`,
    ).toBe(201);
    expectSafeExceptProfileDetail(await createResponse.json());
  });

  test("configures the profile with synthetic network and behavioral settings", async ({
    request,
  }) => {
    const configureResponse = await request.patch(
      `/collector/profiles/${encodeURIComponent(profileId)}/configuration`,
      { data: buildSyntheticProfileConfiguration() },
    );
    expect(
      configureResponse.status(),
      "PATCH /collector/profiles/:id/configuration",
    ).toBe(200);
    expectSafeExceptProfileDetail(await configureResponse.json());
  });

  test("starts provisioning and ingests a synthetic session", async ({
    request,
  }) => {
    const startResponse = await request.post(
      `/collector/profiles/${encodeURIComponent(profileId)}/provisioning/start`,
    );
    expect(
      startResponse.status(),
      "POST /collector/profiles/:id/provisioning/start",
    ).toBe(200);
    const startBody = await startResponse.json();
    provisioningToken = startBody.provisioningToken;
    expect(
      typeof provisioningToken === "string" && provisioningToken.length > 0,
      "provisioning token is returned",
    ).toBe(true);
    expectSafeExceptProfileDetail(startBody);

    const sessionResponse = await request.post(
      `/collector/provisioning/${encodeURIComponent(provisioningToken)}/session`,
      { data: buildSyntheticSessionPayload() },
    );
    expect(
      sessionResponse.status(),
      "POST /collector/provisioning/:token/session",
    ).toBe(200);
    expectSafeExceptProfileDetail(await sessionResponse.json());

    const warmingResponse = await request.patch(
      `/collector/profiles/${encodeURIComponent(profileId)}/account-stage`,
      { data: { accountStage: "WARMING" } },
    );
    expect(
      warmingResponse.status(),
      "PATCH /collector/profiles/:id/account-stage WARMING",
    ).toBe(200);

    const collectionReadyResponse = await request.patch(
      `/collector/profiles/${encodeURIComponent(profileId)}/account-stage`,
      { data: { accountStage: "COLLECTION_READY" } },
    );
    expect(
      collectionReadyResponse.status(),
      "PATCH /collector/profiles/:id/account-stage COLLECTION_READY",
    ).toBe(200);

    const profileResponse = await request.get(
      `/collector/profiles/${encodeURIComponent(profileId)}`,
    );
    expect(
      profileResponse.status(),
      "GET /collector/profiles/:id after session",
    ).toBe(200);
    const profileBody = await profileResponse.json();
    expect(profileBody.profile.status).toBe("READY");
    expect(profileBody.profile.accountStage).toBe("COLLECTION_READY");
    expectSafeExceptProfileDetail(profileBody);
  });

  test("checks out the exact profile for home-feed collection", async ({
    request,
  }) => {
    const checkoutResponse = await request.post(
      `/collector/profiles/${encodeURIComponent(profileId)}/home-feed/checkout`,
    );
    expect(
      checkoutResponse.status(),
      "POST /collector/profiles/:id/home-feed/checkout",
    ).toBe(200);
    const checkoutBody = await checkoutResponse.json();

    expect(checkoutBody.lease).toBeDefined();
    expect(checkoutBody.lease.profileId).toBe(profileId);
    expect(checkoutBody.lease.purpose).toBe("HOME_FEED_COLLECTION");
    expect(checkoutBody.lease.status).toBe("ACTIVE");
    expect(typeof checkoutBody.lease.id).toBe("string");
    expect(checkoutBody.lease.id.length).toBeGreaterThan(0);
    activeLeaseId = checkoutBody.lease.id;

    expect(checkoutBody.profile.profileId).toBe(profileId);
    expect(checkoutBody.profile.accountStage).toBe("COLLECTION_READY");
    expect(checkoutBody.profile).not.toHaveProperty("sourceGroupId");

    const bodyText = JSON.stringify(checkoutBody);
    expectSafe(checkoutBody);
    expect(bodyText).not.toContain("sourceGroupId");
    expect(bodyText).not.toContain("proxy");
    expect(bodyText).not.toContain("fingerprint");
  });

  test("rejects duplicate home-feed checkout for the same profile", async ({
    request,
  }) => {
    const duplicateResponse = await request.post(
      `/collector/profiles/${encodeURIComponent(profileId)}/home-feed/checkout`,
    );
    expect(
      duplicateResponse.status(),
      "duplicate POST /collector/profiles/:id/home-feed/checkout",
    ).toBe(409);
    const duplicateBody = await duplicateResponse.json();
    expect(
      duplicateBody.error?.code,
      "duplicate checkout is rejected with PROFILE_NOT_CHECKOUT_ELIGIBLE",
    ).toBe("PROFILE_NOT_CHECKOUT_ELIGIBLE");
    expectSafe(duplicateBody);
  });

  test("releases the home-feed lease and returns the profile to READY", async ({
    request,
  }) => {
    const listLeasesResponse = await request.get(
      `/collector/profiles/${encodeURIComponent(profileId)}`,
    );
    expect(listLeasesResponse.status()).toBe(200);
    const listLeasesBody = await listLeasesResponse.json();
    expect(listLeasesBody.profile.status).toBe("BUSY");
    expectSafeExceptProfileDetail(listLeasesBody);

    const releaseResponse = await request.post(
      `/collector/profile-leases/${encodeURIComponent(activeLeaseId ?? "")}/release`,
      { data: {} },
    );
    expect(
      releaseResponse.status(),
      "POST /collector/profile-leases/:leaseId/release",
    ).toBe(200);
    const releaseBody = await releaseResponse.json();
    expect(releaseBody.lease.id).toBe(activeLeaseId);
    expect(releaseBody.lease.purpose).toBe("HOME_FEED_COLLECTION");
    expect(releaseBody.lease.status).toBe("RELEASED");
    expect(releaseBody.profile.id).toBe(profileId);
    expect(releaseBody.profile.status).toBe("READY");
    expectSafeExceptProfileDetail(releaseBody);

    const profileAfterReleaseResponse = await request.get(
      `/collector/profiles/${encodeURIComponent(profileId)}`,
    );
    expect(profileAfterReleaseResponse.status()).toBe(200);
    const profileAfterReleaseBody = await profileAfterReleaseResponse.json();
    expect(profileAfterReleaseBody.profile.status).toBe("READY");
    expect(profileAfterReleaseBody.profile.accountStage).toBe(
      "COLLECTION_READY",
    );
    expectSafeExceptProfileDetail(profileAfterReleaseBody);
  });
});

const SENSITIVE_KEYS = [
  "rawPayload",
  "rawPayloadRef",
  "rawFacebookGraphqlPayload",
  "collectionProvenance",
  "cookies",
  "cookie",
  "localStorage",
  "localStorageEntry",
  "token",
  "tokens",
  "tokenHash",
  "authorization",
  "authorizationHeader",
  "headers",
  "viewerId",
  "accountId",
  "proxy",
  "proxyCredentials",
  "fingerprint",
  "screenshot",
  "diagnostics",
  "s3://",
  "GraphQL",
  "networkContext",
  "hardwareFingerprint",
  "runtimeConfiguration",
  "sourceGroupId",
  "sourceAccess",
] as const;

function expectSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  for (const key of SENSITIVE_KEYS) {
    expect(serialized, `must not leak "${key}"`).not.toContain(key);
  }
}

function expectSafeExceptProfileDetail(payload: unknown): void {
  // The profile detail DTO intentionally returns the safe proxy metadata
  // (host/port/countryCode, no credentials) and the safe hardware
  // fingerprint metadata so the operator UI can render it. The
  // home-feed checkout contract MUST NOT return it. For end-to-end
  // setup steps that read the profile detail, we relax only the
  // proxy/networkContext/hardwareFingerprint leakage checks.
  const serialized = JSON.stringify(payload);
  const safeKeys = SENSITIVE_KEYS.filter(
    (k) =>
      k !== "proxy" &&
      k !== "networkContext" &&
      k !== "hardwareFingerprint" &&
      k !== "fingerprint",
  );
  for (const key of safeKeys) {
    expect(serialized, `must not leak "${key}"`).not.toContain(key);
  }
}

function buildSyntheticProfileConfiguration(): Record<string, unknown> {
  return {
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.invalid",
        port: 443,
        credentials: {
          username: "synthetic-collector",
          password: "synthetic-proxy-password",
        },
        countryCode: "US",
      },
      killswitch: {
        enabled: true,
        failClosed: true,
      },
    },
    hardwareFingerprint: {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) Sprint-065C2-Synthetic-Browser",
      viewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
      },
      languages: ["en-US"],
      hardwareConcurrency: 4,
      platform: "Linux x86_64",
      deviceMemoryGb: 8,
      timezone: "America/Los_Angeles",
    },
    behavioralPersona: {
      scrollStyle: "STEADY",
      microDelayMs: { min: 50, max: 250 },
      reverseScrollProbability: 0.05,
      dwellTimeMs: { min: 1500, max: 4500 },
    },
    temporalRoutine: {
      timezone: "America/Los_Angeles",
      chronotype: "MORNING",
      activeWindows: [
        {
          days: [0, 1, 2, 3, 4, 5, 6],
          startsAt: "00:00",
          endsAt: "23:59",
        },
      ],
      cooldownMinutes: 0,
    },
    safetyThresholds: {
      maxSessionsPerDay: 3,
      maxSessionDurationMinutes: 30,
      maxMacroActionsPerDay: 60,
      minCooldownMinutes: 0,
    },
    contentAffinities: {
      primaryTopics: [
        { topic: "synthetic-home-feed-topic", weight: 1 },
      ],
      secondaryTopics: [],
      interactionWeights: {
        view: 1,
        like: 0,
        save: 0,
        comment: 0,
        share: 0,
      },
    },
  };
}

function buildSyntheticSessionPayload(): Record<string, unknown> {
  return {
    cookies: [
      {
        name: "synthetic_session",
        value: "synthetic-session-value",
        domain: ".example.invalid",
        path: "/",
        expiresAt: "2027-01-01T00:00:00.000Z",
        httpOnly: true,
        secure: true,
        sameSite: "LAX",
      },
    ],
    localStorage: [
      {
        origin: "https://example.invalid",
        key: "synthetic_local_storage_key",
        value: "synthetic-local-storage-value",
      },
    ],
    sessionExpiresAt: "2027-01-01T00:00:00.000Z",
  };
}
