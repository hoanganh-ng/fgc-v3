import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CollectionRun } from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { collectorCollectionRuns } from "../schema/collector-runtime.schema";
import { DrizzleCollectionRunRepository } from "./drizzle-collection-run.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Collector Runtime PostgreSQL collection run repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Collector Runtime PostgreSQL collection run repository integration", () => {
    let client: DatabaseClient | undefined;
    let collectionRuns: DrizzleCollectionRunRepository;
    let nextId = 0;
    const createdCollectionRunIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 2,
        },
      });
      client = databaseClient;
      collectionRuns = new DrizzleCollectionRunRepository(databaseClient.db);
    });

    afterEach(async () => {
      if (client === undefined || createdCollectionRunIds.size === 0) {
        return;
      }

      await client.db
        .delete(collectorCollectionRuns)
        .where(
          inArray(collectorCollectionRuns.id, [...createdCollectionRunIds]),
        );
      createdCollectionRunIds.clear();
    });

    afterAll(async () => {
      await client?.close();
    });

    it("claims the oldest queued run and does not claim it twice", async () => {
      const newerRun = trackCollectionRun(
        createCollectionRun({
          id: nextTestId("newer"),
          requestedAt: "2026-04-01T10:05:00.000Z",
          createdAt: "2026-04-01T10:05:00.000Z",
        }),
      );
      const olderRun = trackCollectionRun(
        createCollectionRun({
          id: nextTestId("older"),
          requestedAt: "2026-04-01T10:00:00.000Z",
          createdAt: "2026-04-01T10:00:00.000Z",
        }),
      );

      await collectionRuns.save(newerRun);
      await collectionRuns.save(olderRun);

      await expect(
        collectionRuns.claimNextQueued("2026-04-01T11:00:00.000Z"),
      ).resolves.toMatchObject({
        id: olderRun.id,
        status: "RUNNING",
        startedAt: "2026-04-01T11:00:00.000Z",
      });
      await expect(
        collectionRuns.claimNextQueued("2026-04-01T11:01:00.000Z"),
      ).resolves.toMatchObject({
        id: newerRun.id,
        status: "RUNNING",
        startedAt: "2026-04-01T11:01:00.000Z",
      });
      await expect(
        collectionRuns.claimNextQueued("2026-04-01T11:02:00.000Z"),
      ).resolves.toBeNull();
    });

    it("does not claim canceled, running, succeeded, or failed runs", async () => {
      const terminalRuns = [
        createCollectionRun({
          id: nextTestId("canceled"),
          status: "CANCELED",
          finishedAt: "2026-04-01T10:05:00.000Z",
        }),
        createCollectionRun({
          id: nextTestId("running"),
          status: "RUNNING",
          startedAt: "2026-04-01T10:01:00.000Z",
        }),
        createCollectionRun({
          id: nextTestId("succeeded"),
          status: "SUCCEEDED",
          startedAt: "2026-04-01T10:01:00.000Z",
          finishedAt: "2026-04-01T10:05:00.000Z",
        }),
        createCollectionRun({
          id: nextTestId("failed"),
          status: "FAILED",
          startedAt: "2026-04-01T10:01:00.000Z",
          finishedAt: "2026-04-01T10:05:00.000Z",
          failureReason: {
            code: "WORKER_FAILED",
            message: "Worker failed.",
          },
        }),
      ].map(trackCollectionRun);

      for (const collectionRun of terminalRuns) {
        await collectionRuns.save(collectionRun);
      }

      await expect(
        collectionRuns.claimNextQueued("2026-04-01T11:00:00.000Z"),
      ).resolves.toBeNull();
    });

    function nextTestId(label: string): string {
      nextId += 1;

      return `collection-run-db-it-${process.pid}-${Date.now()}-${nextId}-${label}`;
    }

    function trackCollectionRun(collectionRun: CollectionRun): CollectionRun {
      createdCollectionRunIds.add(collectionRun.id);

      return collectionRun;
    }
  });
}

function createCollectionRun(
  options: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: options.id ?? "collection-run-1",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    status: options.status ?? "QUEUED",
    triggerType: options.triggerType ?? "MANUAL_API",
    parameters: options.parameters ?? {},
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? "2026-04-01T10:00:00.000Z",
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? "2026-04-01T10:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-04-01T10:00:00.000Z",
  };
}
