import { expect, test } from "@playwright/test";
import {
  buildHomeFeedContentFixture,
  buildRunStamp,
  buildSourcePublisherObservationFixture,
} from "./fixtures/synthetic-payloads";

/**
 * Sprint 065C1 — Home-Feed Content Ingestion E2E flow.
 *
 * Proves the new `/collector/content-items/home-feed` ingestion route
 * through Nginx → Fastify → Content Manager application → PostgreSQL
 * using only synthetic fixtures. The spec exercises the public
 * gateway only (`http://web-gateway`) and asserts:
 *
 * - the response envelope omits `sourceGroupId` (not `null`);
 * - the response omits `collectionProvenance` and all sensitive keys;
 * - the ingested item is readable through the public gateway without
 *   leaking raw payloads, cookies, localStorage, tokens, headers,
 *   proxy credentials, viewer data, or other private fields;
 * - the item appears in the safe content list.
 *
 * The spec never touches Facebook and never references real cookies,
 * localStorage, sessions, tokens, authorization headers, proxy
 * credentials, screenshots, raw HTML, viewer data, or raw GraphQL
 * payloads.
 */
test.describe("Sprint 065C1 — Home-Feed Content Ingestion E2E", () => {
  const runStamp = buildRunStamp();

  test("ingests a home-feed candidate and exposes a safe DTO through web-gateway", async ({
    request,
  }) => {
    const observation = buildSourcePublisherObservationFixture(runStamp, {
      kind: "PAGE",
    });

    const observeResponse = await request.post(
      "/collector/source-publishers/observations",
      { data: observation },
    );
    expect(
      observeResponse.status(),
      "POST /collector/source-publishers/observations",
    ).toBe(200);
    const observeBody = await observeResponse.json();
    const sourcePublisherId: string = observeBody.sourcePublisher.id;
    expect(
      sourcePublisherId,
      "durable source publisher id returned from observation",
    ).toBeTruthy();
    expectSafe(observeBody);

    const ingestPayload = buildHomeFeedContentFixture(
      runStamp,
      sourcePublisherId,
    );

    const ingestResponse = await request.post(
      "/collector/content-items/home-feed",
      { data: ingestPayload },
    );
    expect(
      ingestResponse.status(),
      "POST /collector/content-items/home-feed",
    ).toBe(200);
    const ingestBody = await ingestResponse.json();

    expect(ingestBody.contentItem).toBeDefined();
    expect(ingestBody.contentItem.id).toBeTruthy();
    expect(ingestBody.contentItem.platform).toBe("FACEBOOK");
    expect(ingestBody.contentItem.status).toBe("COLLECTED");
    expect(ingestBody.contentItem.externalPostId).toBe(
      ingestPayload.externalPostId,
    );

    // 4. sourceGroupId is absent — never `null`, never a leaked id.
    expect(ingestBody.contentItem).not.toHaveProperty("sourceGroupId");
    expect(ingestBody.contentItem).not.toHaveProperty("sourceGroupId:null");
    expectSafe(ingestBody);

    const contentItemId: string = ingestBody.contentItem.id;

    const getResponse = await request.get(
      `/collector/content-items/${encodeURIComponent(contentItemId)}`,
    );
    expect(getResponse.status(), "GET /collector/content-items/:id").toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.contentItem.id).toBe(contentItemId);
    expect(getBody.contentItem).not.toHaveProperty("sourceGroupId");
    expect(getBody.contentItem).not.toHaveProperty("sourceGroupId:null");
    expectSafe(getBody);

    const listResponse = await request.get(
      "/collector/content-items?limit=100&offset=0",
    );
    expect(listResponse.status(), "GET /collector/content-items list").toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.items).toBeDefined();
    expect(Array.isArray(listBody.items)).toBe(true);
    const matched = listBody.items.find(
      (item: { readonly id: string }) => item.id === contentItemId,
    );
    expect(
      matched,
      "list contains the ingested home-feed content item",
    ).toBeDefined();
    if (matched !== undefined) {
      expect(matched).not.toHaveProperty("sourceGroupId");
      expect(matched).not.toHaveProperty("sourceGroupId:null");
    }
    expectSafe(listBody);
  });
});

const SENSITIVE_KEYS = [
  "rawPayload",
  "rawPayloadRef",
  "rawFacebookGraphqlPayload",
  "collectionProvenance",
  "cookies",
  "localStorage",
  "token",
  "tokens",
  "tokenHash",
  "authorization",
  "authorizationHeader",
  "headers",
  "viewerId",
  "accountId",
  "session",
  "proxy",
  "proxyCredentials",
  "fingerprint",
  "screenshot",
  "diagnostics",
  "s3://",
  "GraphQL",
] as const;

function expectSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  for (const key of SENSITIVE_KEYS) {
    expect(serialized, `must not leak "${key}"`).not.toContain(key);
  }
}
