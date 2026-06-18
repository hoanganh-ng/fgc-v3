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