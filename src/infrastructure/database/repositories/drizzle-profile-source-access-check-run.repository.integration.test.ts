import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ProfileSourceAccessCheckRun } from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { collectorProfileSourceAccessCheckRuns } from "../schema/collector-runtime.schema";
import { DrizzleProfileSourceAccessCheckRunRepository } from "./drizzle-profile-source-access-check-run.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Collector Runtime PostgreSQL profile-source access check run repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Collector Runtime PostgreSQL profile-source access check run repository integration", () => {
    let client: DatabaseClient | undefined;
    let checkRuns: DrizzleProfileSourceAccessCheckRunRepository;
    let nextId = 0;
    const createdCheckRunIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 4,
        },
      });
      client = databaseClient;
      checkRuns = new DrizzleProfileSourceAccessCheckRunRepository(
        databaseClient.db,
      );
    });

    afterEach(async () => {
      if (
        client === undefined ||
        createdCheckRunIds.size === 0
      ) {
        return;
      }

      await client.db
        .delete(collectorProfileSourceAccessCheckRuns)
        .where(
          inArray(
            collectorProfileSourceAccessCheckRuns.id,
            [...createdCheckRunIds],
          ),
        );
      createdCheckRunIds.clear();
    });

    afterAll(async () => {
      await client?.close();
    });

    it("saves and reloads a profile-source access check run", async () => {
      const run = trackCheckRun(
        createCheckRun({
          id: nextTestId("basic"),
        }),
      );

      await checkRuns.save(run);

      const reloaded = await checkRuns.findById(run.id);

      expect(reloaded).toEqual(run);
    });

    it("lists runs by status and sourceGroupId", async () => {
      const run1 = trackCheckRun(
        createCheckRun({
          id: nextTestId("list-queued"),
          status: "QUEUED",
          profileId: "profile-1",
          sourceGroupId: "group-1",
          createdAt: "2026-05-01T10:00:00.000Z",
        }),
      );
      const run2 = trackCheckRun(
        createCheckRun({
          id: nextTestId("list-running"),
          status: "RUNNING",
          profileId: "profile-1",
          sourceGroupId: "group-2",
          createdAt: "2026-05-01T10:01:00.000Z",
        }),
      );

      await checkRuns.save(run1);
      await checkRuns.save(run2);

      const listedQueued = await checkRuns.list({
        status: "QUEUED",
        limit: 10,
        offset: 0,
      });

      expect(listedQueued.items).toContainEqual(run1);
      expect(listedQueued.items).not.toContainEqual(run2);

      const listedGroup2 = await checkRuns.list({
        sourceGroupId: "group-2",
        limit: 10,
        offset: 0,
      });

      expect(listedGroup2.items).toContainEqual(run2);
      expect(listedGroup2.items).not.toContainEqual(run1);
    });

    it("finds by profile and source group ID", async () => {
      const run1 = trackCheckRun(
        createCheckRun({
          id: nextTestId("find-ps-1"),
          profileId: "profile-1",
          sourceGroupId: "group-1",
          createdAt: "2026-05-01T10:00:00.000Z",
        }),
      );
      const run2 = trackCheckRun(
        createCheckRun({
          id: nextTestId("find-ps-2"),
          profileId: "profile-1",
          sourceGroupId: "group-1",
          createdAt: "2026-05-01T10:01:00.000Z",
        }),
      );
      const run3 = trackCheckRun(
        createCheckRun({
          id: nextTestId("find-ps-3"),
          profileId: "profile-1",
          sourceGroupId: "group-2",
          createdAt: "2026-05-01T10:02:00.000Z",
        }),
      );

      await checkRuns.save(run1);
      await checkRuns.save(run2);
      await checkRuns.save(run3);

      const results = await checkRuns.findByProfileAndSourceGroup("profile-1", "group-1");

      expect(results).toHaveLength(2);
      expect(results).toContainEqual(run1);
      expect(results).toContainEqual(run2);
      expect(results[0]).toEqual(run2); // desc sorting
      expect(results[1]).toEqual(run1);
    });

    it("updates an existing check run", async () => {
      const run = trackCheckRun(
        createCheckRun({
          id: nextTestId("update"),
          status: "QUEUED",
        }),
      );

      await checkRuns.save(run);

      const updatedRun: ProfileSourceAccessCheckRun = {
        ...run,
        status: "RUNNING",
        startedAt: "2026-05-01T11:00:00.000Z",
        updatedAt: "2026-05-01T11:00:00.000Z",
      };

      await checkRuns.save(updatedRun);

      const reloaded = await checkRuns.findById(run.id);

      expect(reloaded).toEqual(updatedRun);
    });

    it("prevents multiple QUEUED or RUNNING runs for the same profile and source group", async () => {
      const run1 = trackCheckRun(
        createCheckRun({
          id: nextTestId("unique-1"),
          status: "QUEUED",
          profileId: "profile-unique",
          sourceGroupId: "group-unique",
        }),
      );

      const run2 = trackCheckRun(
        createCheckRun({
          id: nextTestId("unique-2"),
          status: "RUNNING",
          profileId: "profile-unique",
          sourceGroupId: "group-unique",
        }),
      );

      await checkRuns.save(run1);

      await expect(checkRuns.save(run2)).rejects.toThrow();
    });

    function nextTestId(prefix: string): string {
      nextId += 1;
      return `${prefix}-test-run-${Date.now()}-${nextId}`;
    }

    function trackCheckRun(
      run: ProfileSourceAccessCheckRun,
    ): ProfileSourceAccessCheckRun {
      createdCheckRunIds.add(run.id);
      return run;
    }

    function createCheckRun(
      overrides: Partial<ProfileSourceAccessCheckRun>,
    ): ProfileSourceAccessCheckRun {
      return {
        id: "check-run-1",
        profileId: "profile-1",
        sourceGroupId: "group-1",
        triggerType: "MANUAL",
        status: "QUEUED",
        accountStageAtRequest: "WARM",
        target: {
          platform: "FACEBOOK",
          routeType: "DIRECT_GROUP_URL",
          url: "https://www.facebook.com/groups/123",
        },
        requestedAt: "2026-05-01T10:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
        ...overrides,
      };
    }
  });
}
