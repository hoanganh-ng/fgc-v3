import { inArray, like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  CollectionRun,
  CollectionSchedule,
} from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { collectorCollectionRuns, collectorCollectionSchedules } from "../schema/collector-runtime.schema";
import { DrizzleDispatchNextDueCollectionScheduleRepository } from "./drizzle-dispatch-next-due-collection-schedule.repository";
import { DrizzleCollectionScheduleRepository } from "./drizzle-collection-schedule.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Collector Runtime PostgreSQL dispatch-next-due schedule repository integration",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Collector Runtime PostgreSQL dispatch-next-due schedule repository integration",
    () => {
      let client: DatabaseClient | undefined;
      let schedules: DrizzleCollectionScheduleRepository;
      let dispatcher: DrizzleDispatchNextDueCollectionScheduleRepository;
      let counter = 0;
      const trackedSourceGroupIds = new Set<string>();
      const trackedRunIds = new Set<string>();

      beforeAll(async () => {
        const databaseClient = createDatabaseClient({
          poolConfig: {
            max: 4,
          },
        });
        client = databaseClient;
        schedules = new DrizzleCollectionScheduleRepository(databaseClient.db);
        dispatcher = new DrizzleDispatchNextDueCollectionScheduleRepository(
          databaseClient.db,
        );
        await client.db
          .delete(collectorCollectionRuns)
          .where(like(collectorCollectionRuns.id, "dispatch-run-%"));
        await client.db
          .delete(collectorCollectionSchedules)
          .where(
            sql`${collectorCollectionSchedules.sourceGroupId} LIKE 'dispatch-it-%' OR ${collectorCollectionSchedules.sourceGroupId} LIKE 'schedule-db-it-%'`,
          );
      });

      afterEach(async () => {
        if (client === undefined) {
          return;
        }

        if (trackedRunIds.size > 0) {
          await client.db
            .delete(collectorCollectionRuns)
            .where(inArray(collectorCollectionRuns.id, [...trackedRunIds]));
          trackedRunIds.clear();
        }

        if (trackedSourceGroupIds.size > 0) {
          await client.db
            .delete(collectorCollectionSchedules)
            .where(
              inArray(
                collectorCollectionSchedules.sourceGroupId,
                [...trackedSourceGroupIds],
              ),
            );
          trackedSourceGroupIds.clear();
        }
      });

      afterAll(async () => {
        await client?.close();
      });

      it("returns null when no schedule is due", async () => {
        const id = nextSourceGroupId("empty");

        await expect(
          dispatcher.dispatchNextDue({
            dispatchAt: "2030-01-01T10:00:00.000Z",
            collectionRunId: nextRunId("empty"),
          }),
        ).resolves.toBeNull();

        expect(id).toMatch(/^dispatch-it-/);
      });

      it("returns null when all schedules are disabled or in the future", async () => {
        const disabledId = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("disabled"),
            enabled: false,
            nextRunAt: "2030-01-01T10:00:00.000Z",
          }),
        );
        const futureId = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("future"),
            enabled: true,
            nextRunAt: "2030-01-01T11:00:00.000Z",
          }),
        );

        expect(disabledId).toBeTruthy();
        expect(futureId).toBeTruthy();

        await expect(
          dispatcher.dispatchNextDue({
            dispatchAt: "2030-01-01T10:30:00.000Z",
            collectionRunId: nextRunId("none"),
          }),
        ).resolves.toBeNull();
      });

      it("dispatches one due schedule and advances its nextRunAt by the cadence", async () => {
        const schedule = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("due"),
            enabled: true,
            intervalMinutes: 30,
            nextRunAt: "2030-01-01T10:00:00.000Z",
            parameters: { maxScrolls: 3, maxDurationMs: 12_000 },
            createdAt: "2030-01-01T09:00:00.000Z",
            updatedAt: "2030-01-01T09:00:00.000Z",
          }),
        );

        const dispatchAt = "2030-01-01T10:35:00.000Z";
        const collectionRunId = nextRunId("due");
        trackedRunIds.add(collectionRunId);

        const result = await dispatcher.dispatchNextDue({
          dispatchAt,
          collectionRunId,
        });

        expect(result).not.toBeNull();
        expect(result?.schedule).toMatchObject({
          sourceGroupId: schedule.sourceGroupId,
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2030-01-01T11:00:00.000Z",
          createdAt: "2030-01-01T09:00:00.000Z",
          updatedAt: dispatchAt,
        });
        expect(result?.collectionRun).toEqual({
          id: collectionRunId,
          sourceGroupId: schedule.sourceGroupId,
          status: "QUEUED",
          triggerType: "SCHEDULED",
          parameters: { maxScrolls: 3, maxDurationMs: 12_000 },
          requestedAt: "2030-01-01T10:00:00.000Z",
          createdAt: dispatchAt,
          updatedAt: dispatchAt,
        });
        expect(result?.collectionRun.startedAt).toBeUndefined();
        expect(result?.collectionRun.finishedAt).toBeUndefined();
        expect(result?.collectionRun.summary).toBeUndefined();
        expect(result?.collectionRun.failureReason).toBeUndefined();
      });

      it("picks the earliest nextRunAt first and tiebreaks by sourceGroupId ASC", async () => {
        const earlierA = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("earlier-a"),
            enabled: true,
            nextRunAt: "2030-01-01T10:00:00.000Z",
          }),
        );
        const earlierB = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("earlier-b"),
            enabled: true,
            nextRunAt: "2030-01-01T10:00:00.000Z",
          }),
        );
        const later = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("later"),
            enabled: true,
            nextRunAt: "2030-01-01T10:20:00.000Z",
          }),
        );

        const dispatchAt = "2030-01-01T10:30:00.000Z";

        const firstRunId = nextRunId("first");
        trackedRunIds.add(firstRunId);
        const first = await dispatcher.dispatchNextDue({
          dispatchAt,
          collectionRunId: firstRunId,
        });
        expect(first?.collectionRun.sourceGroupId).toBe(earlierA.sourceGroupId);

        const secondRunId = nextRunId("second");
        trackedRunIds.add(secondRunId);
        const second = await dispatcher.dispatchNextDue({
          dispatchAt,
          collectionRunId: secondRunId,
        });
        expect(second?.collectionRun.sourceGroupId).toBe(
          earlierB.sourceGroupId,
        );

        const thirdRunId = nextRunId("third");
        trackedRunIds.add(thirdRunId);
        const third = await dispatcher.dispatchNextDue({
          dispatchAt,
          collectionRunId: thirdRunId,
        });
        expect(third?.collectionRun.sourceGroupId).toBe(later.sourceGroupId);
      });

      it("leaves pre-existing MANUAL_API collection runs untouched", async () => {
        const manualRunId = nextRunId("manual");
        trackedRunIds.add(manualRunId);
        await client!.db.insert(collectorCollectionRuns).values({
          id: manualRunId,
          sourceGroupId: "source-group-manual",
          status: "QUEUED",
          triggerType: "MANUAL_API",
          parameters: {},
          summary: null,
          failureReason: null,
          requestedAt: "2030-01-01T10:00:00.000Z",
          startedAt: null,
          finishedAt: null,
          createdAt: "2030-01-01T10:00:00.000Z",
          updatedAt: "2030-01-01T10:00:00.000Z",
        });

        await expect(
          dispatcher.dispatchNextDue({
            dispatchAt: "2030-01-01T10:00:00.000Z",
            collectionRunId: nextRunId("after-manual"),
          }),
        ).resolves.toBeNull();

        const [row] = await client!.db
          .select()
          .from(collectorCollectionRuns)
          .where(inArray(collectorCollectionRuns.id, [manualRunId]));
        expect(row?.triggerType).toBe("MANUAL_API");
      });

      it("exposes SCHEDULED in the collection_run_trigger_type enum", async () => {
        const result = await client!.db.execute<{ enumlabel: string }>(sql`
          SELECT enumlabel
          FROM pg_enum
          WHERE enumtypid = 'public.collection_run_trigger_type'::regtype
          ORDER BY enumsortorder
        `);
        const labels = result.rows.map((row) => row.enumlabel);
        expect(labels).toContain("SCHEDULED");
        expect(labels).toContain("MANUAL_API");
      });

      it("rolls back the schedule update when the run insert collides on primary key", async () => {
        const schedule = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("rollback"),
            enabled: true,
            intervalMinutes: 30,
            nextRunAt: "2030-01-01T10:00:00.000Z",
            createdAt: "2030-01-01T09:00:00.000Z",
            updatedAt: "2030-01-01T09:00:00.000Z",
          }),
        );

        const collidingRunId = nextRunId("collision");
        trackedRunIds.add(collidingRunId);
        await client!.db.insert(collectorCollectionRuns).values({
          id: collidingRunId,
          sourceGroupId: schedule.sourceGroupId,
          status: "QUEUED",
          triggerType: "MANUAL_API",
          parameters: {},
          summary: null,
          failureReason: null,
          requestedAt: "2030-01-01T09:30:00.000Z",
          startedAt: null,
          finishedAt: null,
          createdAt: "2030-01-01T09:30:00.000Z",
          updatedAt: "2030-01-01T09:30:00.000Z",
        });

        await expect(
          dispatcher.dispatchNextDue({
            dispatchAt: "2030-01-01T10:30:00.000Z",
            collectionRunId: collidingRunId,
          }),
        ).rejects.toBeDefined();

        const stored = await schedules.findBySourceGroupId(
          schedule.sourceGroupId,
        );
        expect(stored?.nextRunAt).toBe("2030-01-01T10:00:00.000Z");
        expect(stored?.updatedAt).toBe("2030-01-01T09:00:00.000Z");

        const collisionRunIds = new Set([collidingRunId]);
        const runs = await client!.db
          .select()
          .from(collectorCollectionRuns)
          .where(inArray(collectorCollectionRuns.id, [...collisionRunIds]));
        expect(runs).toHaveLength(1);
        expect(runs[0]?.triggerType).toBe("MANUAL_API");
      });

      it("concurrent dispatchers against one due schedule create exactly one run", async () => {
        const schedule = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("concurrent"),
            enabled: true,
            intervalMinutes: 30,
            nextRunAt: "2030-01-01T10:00:00.000Z",
            createdAt: "2030-01-01T09:00:00.000Z",
            updatedAt: "2030-01-01T09:00:00.000Z",
          }),
        );

        const dispatchAt = "2030-01-01T10:30:00.000Z";
        const firstRunId = nextRunId("concurrent-a");
        const secondRunId = nextRunId("concurrent-b");
        trackedRunIds.add(firstRunId);
        trackedRunIds.add(secondRunId);

        const [first, second] = await Promise.all([
          dispatcher.dispatchNextDue({
            dispatchAt,
            collectionRunId: firstRunId,
          }),
          dispatcher.dispatchNextDue({
            dispatchAt,
            collectionRunId: secondRunId,
          }),
        ]);

        const winners = [first, second].filter((value) => value !== null);
        expect(winners).toHaveLength(1);
        expect(winners[0]?.collectionRun.id).toBe(firstRunId);
        expect(winners[0]?.schedule.sourceGroupId).toBe(
          schedule.sourceGroupId,
        );

        const stored = await schedules.findBySourceGroupId(
          schedule.sourceGroupId,
        );
        expect(stored?.nextRunAt).toBe("2030-01-01T11:00:00.000Z");
      });

      it("concurrent dispatchers claim separate due schedules", async () => {
        const first = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("disjoint-a"),
            enabled: true,
            intervalMinutes: 30,
            nextRunAt: "2030-01-01T10:00:00.000Z",
          }),
        );
        const second = track(
          await seedSchedule({
            sourceGroupId: nextSourceGroupId("disjoint-b"),
            enabled: true,
            intervalMinutes: 60,
            nextRunAt: "2030-01-01T10:05:00.000Z",
          }),
        );

        const dispatchAt = "2030-01-01T10:30:00.000Z";
        const runA = nextRunId("disjoint-a");
        const runB = nextRunId("disjoint-b");
        trackedRunIds.add(runA);
        trackedRunIds.add(runB);

        const [resultA, resultB] = await Promise.all([
          dispatcher.dispatchNextDue({
            dispatchAt,
            collectionRunId: runA,
          }),
          dispatcher.dispatchNextDue({
            dispatchAt,
            collectionRunId: runB,
          }),
        ]);

        expect(resultA?.collectionRun.sourceGroupId).toBe(
          first.sourceGroupId,
        );
        expect(resultB?.collectionRun.sourceGroupId).toBe(
          second.sourceGroupId,
        );
      });

      async function seedSchedule(
        options: Partial<CollectionSchedule> & {
          sourceGroupId: string;
        },
      ): Promise<CollectionSchedule> {
        const schedule: CollectionSchedule = {
          sourceGroupId: options.sourceGroupId as CollectionSchedule["sourceGroupId"],
          enabled: options.enabled ?? true,
          intervalMinutes: options.intervalMinutes ?? 30,
          nextRunAt: options.nextRunAt ?? "2030-01-01T10:00:00.000Z",
          parameters: options.parameters ?? {},
          createdAt: options.createdAt ?? "2030-01-01T09:00:00.000Z",
          updatedAt: options.updatedAt ?? "2030-01-01T09:00:00.000Z",
        };

        await schedules.save(schedule);

        return schedule;
      }

      function track(schedule: CollectionSchedule): CollectionSchedule {
        trackedSourceGroupIds.add(schedule.sourceGroupId);

        return schedule;
      }

      function nextSourceGroupId(label: string): string {
        counter += 1;

        return `dispatch-it-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      function nextRunId(label: string): string {
        counter += 1;

        return `dispatch-run-${process.pid}-${Date.now()}-${counter}-${label}`;
      }
    },
  );
}