import { inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionSchedule,
} from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import {
  profileHomeFeedCollectionRuns,
  profileHomeFeedCollectionSchedules,
} from "../schema/collector-runtime.schema";
import { DrizzleDispatchNextDueProfileHomeFeedCollectionScheduleRepository } from "./drizzle-dispatch-next-due-profile-home-feed-collection-schedule.repository";
import { DrizzleProfileHomeFeedCollectionRunRepository } from "./drizzle-profile-home-feed-collection-run.repository";
import { DrizzleProfileHomeFeedCollectionScheduleRepository } from "./drizzle-profile-home-feed-collection-schedule.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Collector Runtime PostgreSQL profile home-feed scheduled dispatch repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Collector Runtime PostgreSQL profile home-feed scheduled dispatch repository integration", () => {
    let client: DatabaseClient | undefined;
    let dispatcher: DrizzleDispatchNextDueProfileHomeFeedCollectionScheduleRepository;
    let schedules: DrizzleProfileHomeFeedCollectionScheduleRepository;
    let runs: DrizzleProfileHomeFeedCollectionRunRepository;
    let counter = 0;
    const trackedProfileIds = new Set<string>();
    const trackedRunIds = new Set<string>();

    beforeAll(async () => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 8,
        },
      });
      client = databaseClient;
      dispatcher =
        new DrizzleDispatchNextDueProfileHomeFeedCollectionScheduleRepository(
          databaseClient.db,
        );
      schedules = new DrizzleProfileHomeFeedCollectionScheduleRepository(
        databaseClient.db,
      );
      runs = new DrizzleProfileHomeFeedCollectionRunRepository(
        databaseClient.db,
      );
      await dropForceUpdateTrigger(client);
    });

    afterEach(async () => {
      if (client === undefined) {
        return;
      }

      if (trackedRunIds.size > 0) {
        await client.db
          .delete(profileHomeFeedCollectionRuns)
          .where(inArray(profileHomeFeedCollectionRuns.id, [...trackedRunIds]));
        trackedRunIds.clear();
      }

      if (trackedProfileIds.size > 0) {
        await client.db
          .delete(profileHomeFeedCollectionSchedules)
          .where(
            inArray(
              profileHomeFeedCollectionSchedules.profileId,
              [...trackedProfileIds],
            ),
          );
        trackedProfileIds.clear();
      }

      await dropForceUpdateTrigger(client);
    });

    afterAll(async () => {
      await dropForceUpdateTrigger(client);
      await client?.close();
    });

    it("dispatches one due schedule into a queued SCHEDULED run and advances cadence atomically", async () => {
      const profileId = nextProfileId("dispatch");
      const runId = nextRunId("dispatch");
      await schedules.save(trackSchedule(createSchedule({ profileId })));
      trackRunId(runId);

      const candidate = await dispatcher.findNextDueCandidate(dispatchAt);
      const result = await dispatcher.dispatchOrSkipActiveRun({
        profileId,
        expectedNextRunAt: candidate?.schedule.nextRunAt ?? "",
        dispatchAt,
        runId,
        accountStageAtRequest: "WARMING",
      });

      expect(candidate?.schedule.profileId).toBe(profileId);
      expect(result).toMatchObject({
        outcome: "DISPATCHED",
        schedule: {
          profileId,
          nextRunAt: "2026-06-21T11:00:00.000Z",
          lastAttemptedAt: dispatchAt,
          lastDispatchStatus: "DISPATCHED",
          consecutiveFailures: 0,
        },
        run: {
          id: runId,
          profileId,
          triggerType: "SCHEDULED",
          status: "QUEUED",
          requestedAt: "2026-06-21T10:00:00.000Z",
          createdAt: dispatchAt,
          updatedAt: dispatchAt,
        },
      });
      await expect(runs.findById(runId)).resolves.toMatchObject({
        triggerType: "SCHEDULED",
        status: "QUEUED",
      });
    });

    it("skips and advances when an active run already exists for the profile", async () => {
      // Sprint 068B1-H race coverage: proves the gap between
      // `findNextDueCandidate` (no row lock, see adapter lines 30-51) and
      // `dispatchOrSkipActiveRun` (locks the schedule row FOR UPDATE). A
      // MANUAL_API run inserted between candidate selection and dispatch is
      // caught by the in-transaction active-run check, returning
      // SKIPPED_ACTIVE_RUN.
      const profileId = nextProfileId("active-skip");
      const activeRun = trackRun(
        createRun({
          id: nextRunId("active"),
          profileId,
        }),
      );
      await schedules.save(trackSchedule(createSchedule({ profileId })));
      await runs.create(activeRun);

      const result = await dispatcher.dispatchOrSkipActiveRun({
        profileId,
        expectedNextRunAt: "2026-06-21T10:00:00.000Z",
        dispatchAt,
        runId: nextRunId("would-not-insert"),
        accountStageAtRequest: "WARMING",
      });

      expect(result).toMatchObject({
        outcome: "SKIPPED_ACTIVE_RUN",
        schedule: {
          profileId,
          nextRunAt: "2026-06-21T11:00:00.000Z",
          lastDispatchStatus: "SKIPPED_ACTIVE_RUN",
        },
      });
      expect(await runs.list({ profileId, limit: 10, offset: 0 })).toMatchObject({
        total: 1,
      });
    });

    it("returns race lost without creating a run or advancing when expected nextRunAt is stale", async () => {
      const profileId = nextProfileId("race");
      const runId = nextRunId("race");
      await schedules.save(trackSchedule(createSchedule({ profileId })));
      trackRunId(runId);

      const result = await dispatcher.dispatchOrSkipActiveRun({
        profileId,
        expectedNextRunAt: "2026-06-21T09:30:00.000Z",
        dispatchAt,
        runId,
        accountStageAtRequest: "WARMING",
      });

      expect(result).toEqual({ outcome: "RACE_LOST" });
      await expect(runs.findById(runId)).resolves.toBeNull();
      const persisted = await schedules.findByProfileId(profileId);
      expect(persisted).toMatchObject({
        nextRunAt: "2026-06-21T10:00:00.000Z",
      });
      expect(persisted).not.toHaveProperty("lastDispatchStatus");
    });

    it("records profile-not-found and disables the schedule without creating a run", async () => {
      const profileId = nextProfileId("not-found");
      await schedules.save(trackSchedule(createSchedule({ profileId })));

      const result = await dispatcher.recordProfileNotFound({
        profileId,
        expectedNextRunAt: "2026-06-21T10:00:00.000Z",
        dispatchAt,
      });

      expect(result).toMatchObject({
        outcome: "UPDATED",
        schedule: {
          enabled: false,
          lastDispatchStatus: "PROFILE_NOT_FOUND",
          lastFailureReason: {
            code: "PROFILE_NOT_FOUND",
            message: "Profile was not found.",
          },
          consecutiveFailures: 1,
        },
      });
      expect(await runs.list({ profileId, limit: 10, offset: 0 })).toMatchObject({
        total: 0,
      });
    });

    it("records lookup failure and excludes the schedule until deterministic backoff expires", async () => {
      const profileId = nextProfileId("lookup-failed");
      await schedules.save(trackSchedule(createSchedule({ profileId })));

      await dispatcher.recordProfileLookupFailed({
        profileId,
        expectedNextRunAt: "2026-06-21T10:00:00.000Z",
        dispatchAt,
        failureReason: {
          code: "PROFILE_REFERENCE_LOOKUP_FAILED",
          message: "Profile Manager returned an error.",
        },
      });

      await expect(
        dispatcher.findNextDueCandidate(dispatchAt),
      ).resolves.toBeNull();
      await expect(
        dispatcher.findNextDueCandidate("2026-06-21T10:36:00.000Z"),
      ).resolves.toMatchObject({
        schedule: {
          profileId,
          lastDispatchStatus: "PROFILE_LOOKUP_FAILED",
          consecutiveFailures: 1,
        },
      });
    });

    it("concurrent dispatchers against one due home-feed schedule create at most one queued run and advance the schedule exactly once", async () => {
      const profileId = nextProfileId("concurrent-single");
      await schedules.save(trackSchedule(createSchedule({ profileId })));

      const runA = nextRunId("concurrent-a");
      const runB = nextRunId("concurrent-b");
      trackRunId(runA);
      trackRunId(runB);

      const [first, second] = await Promise.all([
        dispatcher.dispatchOrSkipActiveRun({
          profileId,
          expectedNextRunAt: "2026-06-21T10:00:00.000Z",
          dispatchAt,
          runId: runA,
          accountStageAtRequest: "WARMING",
        }),
        dispatcher.dispatchOrSkipActiveRun({
          profileId,
          expectedNextRunAt: "2026-06-21T10:00:00.000Z",
          dispatchAt,
          runId: runB,
          accountStageAtRequest: "WARMING",
        }),
      ]);

      const outcomes = [first.outcome, second.outcome];
      expect(outcomes.filter((outcome) => outcome === "DISPATCHED")).toHaveLength(
        1,
      );
      expect(
        outcomes.filter(
          (outcome) =>
            outcome === "RACE_LOST" || outcome === "SKIPPED_ACTIVE_RUN",
        ),
      ).toHaveLength(1);

      const winner = first.outcome === "DISPATCHED" ? first : second;
      if (winner.outcome !== "DISPATCHED") {
        throw new Error("Expected exactly one DISPATCHED outcome.");
      }
      expect(winner.run.profileId).toBe(profileId);
      expect(winner.run.triggerType).toBe("SCHEDULED");
      expect(winner.run.status).toBe("QUEUED");

      const persisted = await client!.db
        .select()
        .from(profileHomeFeedCollectionRuns)
        .where(
          sql`${profileHomeFeedCollectionRuns.profileId} = ${profileId}
              AND ${profileHomeFeedCollectionRuns.triggerType} = 'SCHEDULED'`,
        );
      expect(persisted).toHaveLength(1);
      expect([runA, runB]).toContain(persisted[0]?.id);

      const stored = await schedules.findByProfileId(profileId);
      expect(stored?.nextRunAt).toBe("2026-06-21T11:00:00.000Z");
      expect(stored?.updatedAt).toBe(dispatchAt);
      expect(stored?.lastDispatchStatus).toBe("DISPATCHED");
    });

    it("concurrent dispatchers against two due home-feed schedules dispatch both without cross-profile blocking", async () => {
      const profileA = nextProfileId("concurrent-disjoint-a");
      const profileB = nextProfileId("concurrent-disjoint-b");
      await schedules.save(trackSchedule(createSchedule({ profileId: profileA })));
      await schedules.save(trackSchedule(createSchedule({ profileId: profileB })));

      const runA = nextRunId("concurrent-disjoint-a");
      const runB = nextRunId("concurrent-disjoint-b");
      trackRunId(runA);
      trackRunId(runB);

      const [resultA, resultB] = await Promise.all([
        dispatcher.dispatchOrSkipActiveRun({
          profileId: profileA,
          expectedNextRunAt: "2026-06-21T10:00:00.000Z",
          dispatchAt,
          runId: runA,
          accountStageAtRequest: "WARMING",
        }),
        dispatcher.dispatchOrSkipActiveRun({
          profileId: profileB,
          expectedNextRunAt: "2026-06-21T10:00:00.000Z",
          dispatchAt,
          runId: runB,
          accountStageAtRequest: "WARMING",
        }),
      ]);

      expect(resultA.outcome).toBe("DISPATCHED");
      expect(resultB.outcome).toBe("DISPATCHED");
      if (resultA.outcome !== "DISPATCHED" || resultB.outcome !== "DISPATCHED") {
        throw new Error("Expected both outcomes to be DISPATCHED.");
      }
      expect(resultA.run.profileId).toBe(profileA);
      expect(resultB.run.profileId).toBe(profileB);

      const persisted = await client!.db
        .select()
        .from(profileHomeFeedCollectionRuns)
        .where(inArray(profileHomeFeedCollectionRuns.id, [runA, runB]));
      expect(persisted).toHaveLength(2);
      for (const row of persisted) {
        expect(row.triggerType).toBe("SCHEDULED");
        expect(row.status).toBe("QUEUED");
      }
    });

    it("rolls back the schedule advance when the post-insert UPDATE fails", async () => {
      const profileId = nextProfileId("rollback-update");
      await schedules.save(trackSchedule(createSchedule({ profileId })));

      await installForceUpdateTrigger(client!, profileId);

      const attemptedRunId = nextRunId("rollback-update");
      trackRunId(attemptedRunId);

      await expect(
        dispatcher.dispatchOrSkipActiveRun({
          profileId,
          expectedNextRunAt: "2026-06-21T10:00:00.000Z",
          dispatchAt,
          runId: attemptedRunId,
          accountStageAtRequest: "WARMING",
        }),
      ).rejects.toBeDefined();

      const stored = await schedules.findByProfileId(profileId);
      expect(stored?.nextRunAt).toBe("2026-06-21T10:00:00.000Z");
      expect(stored?.updatedAt).toBe("2026-06-21T09:00:00.000Z");
      expect(stored?.lastDispatchStatus).toBeUndefined();

      const scheduledRuns = await client!.db
        .select()
        .from(profileHomeFeedCollectionRuns)
        .where(
          sql`${profileHomeFeedCollectionRuns.profileId} = ${profileId}
              AND ${profileHomeFeedCollectionRuns.triggerType} = 'SCHEDULED'`,
        );
      expect(scheduledRuns).toHaveLength(0);

      expect(await runs.findById(attemptedRunId)).toBeNull();
    });

    function nextProfileId(label: string): string {
      counter += 1;

      return `phf-dispatch-db-it-${process.pid}-${Date.now()}-${counter}-${label}`;
    }

    function nextRunId(label: string): string {
      counter += 1;

      return `phf-dispatch-run-db-it-${process.pid}-${Date.now()}-${counter}-${label}`;
    }

    function trackSchedule(
      schedule: ProfileHomeFeedCollectionSchedule,
    ): ProfileHomeFeedCollectionSchedule {
      trackedProfileIds.add(schedule.profileId);

      return schedule;
    }

    function trackRun(run: ProfileHomeFeedCollectionRun): ProfileHomeFeedCollectionRun {
      trackedRunIds.add(run.id);

      return run;
    }

    function trackRunId(runId: string): void {
      trackedRunIds.add(runId);
    }
  });
}

const dispatchAt = "2026-06-21T10:35:00.000Z";

function createSchedule(
  options: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: options.profileId ?? "profile-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 30,
    nextRunAt: options.nextRunAt ?? "2026-06-21T10:00:00.000Z",
    parameters: options.parameters ?? { maxPosts: 10 },
    consecutiveFailures: options.consecutiveFailures ?? 0,
    createdAt: options.createdAt ?? "2026-06-21T09:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-06-21T09:00:00.000Z",
  };
}

function createRun(
  options: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id: options.id ?? "run-1",
    profileId: options.profileId ?? "profile-1",
    triggerType: options.triggerType ?? "MANUAL_API",
    status: options.status ?? "QUEUED",
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: options.parameters ?? {},
    requestedAt: options.requestedAt ?? "2026-06-21T10:10:00.000Z",
    createdAt: options.createdAt ?? "2026-06-21T10:10:00.000Z",
    updatedAt: options.updatedAt ?? "2026-06-21T10:10:00.000Z",
  };
}

const FORCE_UPDATE_TRIGGER_NAME =
  "sprint_068b1_h_force_schedule_update_failure";
const FORCE_UPDATE_FUNCTION_NAME =
  "public.sprint_068b1_h_force_schedule_update_failure";

async function installForceUpdateTrigger(
  client: DatabaseClient,
  profileId: string,
): Promise<void> {
  await client.db.execute(sql`
    CREATE OR REPLACE FUNCTION ${sql.raw(FORCE_UPDATE_FUNCTION_NAME)}()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'sprint-068b1-h forced schedule update failure for %', OLD.profile_id
        USING ERRCODE = 'P0001';
    END;
    $$
  `);
  await client.db.execute(sql`
    DROP TRIGGER IF EXISTS ${sql.raw(FORCE_UPDATE_TRIGGER_NAME)}
      ON "collector_profile_home_feed_collection_schedules"
  `);
  await client.db.execute(
    sql.raw(
      `CREATE TRIGGER "${FORCE_UPDATE_TRIGGER_NAME}"
        BEFORE UPDATE ON "collector_profile_home_feed_collection_schedules"
        FOR EACH ROW
        WHEN (OLD.profile_id = '${profileId.replace(/'/g, "''")}')
        EXECUTE FUNCTION ${FORCE_UPDATE_FUNCTION_NAME}()`,
    ),
  );
}

async function dropForceUpdateTrigger(
  client: DatabaseClient | undefined,
): Promise<void> {
  if (client === undefined) {
    return;
  }
  await client.db.execute(sql`
    DROP TRIGGER IF EXISTS ${sql.raw(FORCE_UPDATE_TRIGGER_NAME)}
      ON "collector_profile_home_feed_collection_schedules"
  `);
  await client.db.execute(sql`
    DROP FUNCTION IF EXISTS ${sql.raw(FORCE_UPDATE_FUNCTION_NAME)}()
  `);
}
