import { expect, test } from "@playwright/test";

/**
 * Sprint 065C3 — Bounded Facebook Home-Feed Execution E2E regression.
 *
 * Sprint 065C3 adds the operator-invoked `pnpm profile:home-feed:run-next`
 * one-shot runner, which executes a queued `ProfileHomeFeedCollectionRun`
 * against the live Facebook home feed under bounded scroll/duration/post
 * limits. Manual live-Facebook validation is opt-in and is NOT performed
 * in this synthetic E2E spec — the spec exercises only the public
 * `POST /collector/profile-home-feed-collection-runs` and
 * `POST /collector/profile-home-feed-collection-runs/:id/cancel` HTTP
 * surface to assert that:
 *
 * - the existing Sprint 065B request → list → cancel HTTP flow is not
 *   regressed by Sprint 065C3 changes;
 * - request and cancel responses never leak sensitive fields.
 *
 * The runner itself is exercised at the unit-test layer with fake
 * Profile Manager / Content Manager / browser ports. Live Facebook
 * validation requires an authorized operator to run the CLI against a
 * provisioned profile and the live network; that validation has NOT
 * been performed.
 */
test.describe("Sprint 065C3 — Profile Home-Feed Run Next E2E", () => {
  const runStamp = "sprint-065c3-stable";
  const profileId = `sprint-065c3-profile-${runStamp}`;
  const displayName = `Sprint 065C3 Profile ${runStamp}`;
  let queuedRunId = "";

  test("creates a synthetic profile used as the run target", async ({
    request,
  }) => {
    const createResponse = await request.post("/collector/profiles", {
      data: { id: profileId, displayName },
    });
    expect(
      createResponse.status(),
      `create profile id=${profileId}`,
    ).toBe(201);
  });

  test("requests a queued profile home-feed run with bounded parameters", async ({
    request,
  }) => {
    const response = await request.post(
      "/collector/profile-home-feed-collection-runs",
      {
        data: {
          profileId,
          maxScrolls: 3,
          maxDurationMs: 30_000,
          maxPosts: 20,
        },
      },
    );
    expect(
      response.status(),
      "POST /collector/profile-home-feed-collection-runs",
    ).toBe(201);
    const body = await response.json();
    const run = body.profileHomeFeedCollectionRun;

    expect(run.profileId).toBe(profileId);
    expect(run.status).toBe("QUEUED");
    expect(run.target).toEqual({
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    });
    expect(run.parameters).toEqual({
      maxScrolls: 3,
      maxDurationMs: 30_000,
      maxPosts: 20,
    });
    expect(typeof run.id).toBe("string");
    queuedRunId = run.id;

    expectSafe(body);
  });

  test("cancels the queued run with sanitized response", async ({
    request,
  }) => {
    expect(queuedRunId.length, "queued run id present").toBeGreaterThan(0);
    const cancelResponse = await request.post(
      `/collector/profile-home-feed-collection-runs/${encodeURIComponent(queuedRunId)}/cancel`,
    );
    expect(
      cancelResponse.status(),
      "POST /collector/profile-home-feed-collection-runs/:id/cancel",
    ).toBe(200);
    const cancelBody = await cancelResponse.json();
    const canceledRun = cancelBody.profileHomeFeedCollectionRun;
    expect(canceledRun.id).toBe(queuedRunId);
    expect(canceledRun.status).toBe("CANCELED");
    expectSafe(cancelBody);
  });
});

const SENSITIVE_KEYS = [
  "rawPayload",
  "rawPayloadRef",
  "rawFacebookGraphqlPayload",
  "cookies",
  "cookie",
  "localStorage",
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
  "GraphQL",
  "networkContext",
  "hardwareFingerprint",
  "runtimeConfiguration",
  "sourceAccess",
] as const;

function expectSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  for (const key of SENSITIVE_KEYS) {
    expect(serialized, `must not leak "${key}"`).not.toContain(key);
  }
}
