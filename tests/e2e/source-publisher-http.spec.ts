import { expect, test } from "@playwright/test";
import {
  buildRunStamp,
  buildSourcePublisherObservationFixture,
  buildSourcePublisherSecondObservationFixture,
} from "./fixtures/synthetic-payloads";

/**
 * Sprint 063C Source Publisher HTTP E2E flow.
 *
 * Proves the observation, get, and list HTTP contracts for the Content
 * Manager-owned `SourcePublisher` aggregate through Nginx → Fastify →
 * Content Manager application → PostgreSQL using only synthetic fixtures.
 *
 * All API traffic goes through the configured baseURL
 * (`http://web-gateway`); the spec never references the API service
 * directly and never uses a host port.
 *
 * The spec is independent from `stack-baseline.spec.ts`. It owns its
 * own fixtures and does not depend on variables or records created by
 * another spec.
 */
test.describe("Sprint 063C — Source Publisher HTTP E2E", () => {
  const runStamp = buildRunStamp();

  test("observes, re-observes, reads, and lists a SourcePublisher through web-gateway", async ({
    request,
  }) => {
    const firstObservation = buildSourcePublisherObservationFixture(runStamp, {
      kind: "GROUP",
    });
    const secondObservation = buildSourcePublisherSecondObservationFixture(
      firstObservation,
      { observedAt: "2026-06-18T13:30:00.000Z" },
    );

    const firstResponse = await request.post(
      "/collector/source-publishers/observations",
      { data: firstObservation },
    );
    expect(
      firstResponse.status(),
      "POST /collector/source-publishers/observations",
    ).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody.sourcePublisher).toBeDefined();
    expect(firstBody.sourcePublisher.status).toBe("DISCOVERED");
    expect(firstBody.sourcePublisher.observationCount).toBe(1);
    expect(firstBody.sourcePublisher.externalPublisherId).toBe(
      firstObservation.externalPublisherId,
    );
    expect(firstBody.sourcePublisher.kind).toBe("GROUP");
    expect(firstBody.sourcePublisher.platform).toBe("FACEBOOK");
    expectSourcePublisherIsSafe(firstBody);

    const sourcePublisherId: string = firstBody.sourcePublisher.id;
    expect(sourcePublisherId, "durable source publisher id").toBeTruthy();

    const secondResponse = await request.post(
      "/collector/source-publishers/observations",
      { data: secondObservation },
    );
    expect(
      secondResponse.status(),
      "POST /collector/source-publishers/observations (second)",
    ).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.sourcePublisher.id).toBe(sourcePublisherId);
    expect(secondBody.sourcePublisher.observationCount).toBe(2);
    expect(secondBody.sourcePublisher.displayName).toBe(
      secondObservation.displayName,
    );
    expect(secondBody.sourcePublisher.canonicalUrl).toBe(
      secondObservation.canonicalUrl,
    );
    expect(secondBody.sourcePublisher.lastObservedAt).toBe(
      secondObservation.observedAt,
    );
    expectSourcePublisherIsSafe(secondBody);

    const getResponse = await request.get(
      `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}`,
    );
    expect(
      getResponse.status(),
      "GET /collector/source-publishers/:id",
    ).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.sourcePublisher).toBeDefined();
    expect(getBody.sourcePublisher.id).toBe(sourcePublisherId);
    expect(getBody.sourcePublisher.externalPublisherId).toBe(
      firstObservation.externalPublisherId,
    );
    expect(getBody.sourcePublisher.observationCount).toBe(2);
    expect(getBody.sourcePublisher.displayName).toBe(
      secondObservation.displayName,
    );
    expectSourcePublisherIsSafe(getBody);

    const listResponse = await request.get(
      `/collector/source-publishers?status=DISCOVERED&kind=GROUP&platform=FACEBOOK&limit=100&offset=0`,
    );
    expect(
      listResponse.status(),
      "GET /collector/source-publishers (list)",
    ).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.items).toBeDefined();
    expect(listBody.page).toBeDefined();
    expect(listBody.page.limit).toBe(100);
    expect(listBody.page.offset).toBe(0);
    expect(listBody.page.total).toBeGreaterThanOrEqual(1);
    const matched = listBody.items.find(
      (item: { readonly id: string }) => item.id === sourcePublisherId,
    );
    expect(matched, "list contains the observed source publisher").toBeDefined();
    expectSourcePublisherIsSafe(listBody);
  });

  test("patches a SourcePublisher status through web-gateway", async ({
    request,
  }) => {
    const observation = buildSourcePublisherObservationFixture(runStamp, {
      kind: "GROUP",
    });

    // 1. Observe a fresh SourcePublisher through the existing route.
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
    expect(observeBody.sourcePublisher.status).toBe("DISCOVERED");
    expectSourcePublisherIsSafe(observeBody);

    // 2. PATCH the status to APPROVED.
    const patchResponse = await request.patch(
      `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}/status`,
      { data: { status: "APPROVED" } },
    );
    expect(
      patchResponse.status(),
      "PATCH /collector/source-publishers/:id/status",
    ).toBe(200);
    const patchBody = await patchResponse.json();
    expect(patchBody.sourcePublisher.id).toBe(sourcePublisherId);
    expect(patchBody.sourcePublisher.status).toBe("APPROVED");
    expectSourcePublisherIsSafe(patchBody);

    // 3. GET back to confirm durable status persistence through web-gateway.
    const getResponse = await request.get(
      `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}`,
    );
    expect(
      getResponse.status(),
      "GET /collector/source-publishers/:id",
    ).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.sourcePublisher.id).toBe(sourcePublisherId);
    expect(getBody.sourcePublisher.status).toBe("APPROVED");
    expectSourcePublisherIsSafe(getBody);
  });
});

const SENSITIVE_KEYS = [
  "rawPayload",
  "rawPayloadRef",
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
] as const;

function expectSourcePublisherIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  for (const key of SENSITIVE_KEYS) {
    expect(serialized).not.toContain(`"${key}"`);
  }
}