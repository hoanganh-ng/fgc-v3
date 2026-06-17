import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CollectionSchedule } from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { collectorCollectionSchedules } from "../schema/collector-runtime.schema";
import { DrizzleCollectionScheduleRepository } from "./drizzle-collection-schedule.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Collector Runtime PostgreSQL collection schedule repository integration",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Collector Runtime PostgreSQL collection schedule repository integration",
    () => {
      let client: DatabaseClient | undefined;
      let schedules: DrizzleCollectionScheduleRepository;
      let counter = 0;
      const trackedSourceGroupIds = new Set<string>();

      beforeAll(() => {
        const databaseClient = createDatabaseClient({
          poolConfig: {
            max: 2,
          },
        });
        client = databaseClient;
        schedules = new DrizzleCollectionScheduleRepository(databaseClient.db);
      });

      afterEach(async () => {
        if (client === undefined || trackedSourceGroupIds.size === 0) {
          return;
        }

        await client.db
          .delete(collectorCollectionSchedules)
          .where(
            inArray(
              collectorCollectionSchedules.sourceGroupId,
              [...trackedSourceGroupIds],
            ),
          );
        trackedSourceGroupIds.clear();
      });

      afterAll(async () => {
        await client?.close();
      });

      it("saves a new schedule and preserves createdAt on subsequent save", async () => {
        const firstSourceGroupId = nextSourceGroupId("insert");
        const initialSchedule = track(
          createSchedule({
            sourceGroupId: firstSourceGroupId,
            createdAt: "2026-06-17T10:00:00.000Z",
            updatedAt: "2026-06-17T10:00:00.000Z",
          }),
        );

        await schedules.save(initialSchedule);

        const inserted = await schedules.findBySourceGroupId(firstSourceGroupId);
        expect(inserted).toMatchObject({
          sourceGroupId: firstSourceGroupId,
          createdAt: "2026-06-17T10:00:00.000Z",
          updatedAt: "2026-06-17T10:00:00.000Z",
        });

        const updatedSchedule = createSchedule({
          sourceGroupId: firstSourceGroupId,
          enabled: false,
          intervalMinutes: 120,
          nextRunAt: "2026-06-17T12:00:00.000Z",
          parameters: { maxScrolls: 1 },
          createdAt: "2099-01-01T00:00:00.000Z",
          updatedAt: "2026-06-17T11:00:00.000Z",
        });

        await schedules.save(updatedSchedule);

        const updated = await schedules.findBySourceGroupId(firstSourceGroupId);
        expect(updated).toMatchObject({
          sourceGroupId: firstSourceGroupId,
          enabled: false,
          intervalMinutes: 120,
          nextRunAt: "2026-06-17T12:00:00.000Z",
          parameters: { maxScrolls: 1 },
          createdAt: "2026-06-17T10:00:00.000Z",
          updatedAt: "2026-06-17T11:00:00.000Z",
        });
      });

      it("findBySourceGroupId returns null when absent", async () => {
        const missingId = nextSourceGroupId("missing");

        await expect(
          schedules.findBySourceGroupId(missingId),
        ).resolves.toBeNull();
      });

      it("findBySourceGroupId returns the schedule when present", async () => {
        const id = nextSourceGroupId("find");
        const schedule = track(
          createSchedule({
            sourceGroupId: id,
            createdAt: "2026-06-17T10:00:00.000Z",
            updatedAt: "2026-06-17T10:00:00.000Z",
          }),
        );

        await schedules.save(schedule);

        await expect(schedules.findBySourceGroupId(id)).resolves.toMatchObject({
          sourceGroupId: id,
          enabled: schedule.enabled,
          intervalMinutes: schedule.intervalMinutes,
        });
      });

      it("lists schedules by next_run_at then source_group_id with exact total", async () => {
        const laterA = nextSourceGroupId("later-a");
        const earlierA = nextSourceGroupId("earlier-a");
        const earlierB = nextSourceGroupId("earlier-b");
        const earlierC = nextSourceGroupId("earlier-c");

        for (const seed of [
          { id: laterA, nextRunAt: "2026-06-17T13:00:00.000Z" },
          { id: earlierA, nextRunAt: "2026-06-17T11:00:00.000Z" },
          { id: earlierB, nextRunAt: "2026-06-17T11:00:00.000Z" },
          { id: earlierC, nextRunAt: "2026-06-17T11:00:00.000Z" },
        ]) {
          const seeded = createSchedule({
            sourceGroupId: seed.id,
            enabled: true,
            intervalMinutes: 30,
            nextRunAt: seed.nextRunAt,
            parameters: {},
            createdAt: "2026-06-17T10:00:00.000Z",
            updatedAt: "2026-06-17T10:00:00.000Z",
          });
          track(seeded);
          await schedules.save(seeded);
        }

        const pageOne = await schedules.list({ limit: 2, offset: 0 });
        expect(pageOne.items.map((item) => item.sourceGroupId)).toEqual([
          earlierA,
          earlierB,
        ]);
        expect(pageOne.total).toBe(4);

        const pageThree = await schedules.list({ limit: 2, offset: 2 });
        expect(pageThree.items.map((item) => item.sourceGroupId)).toEqual([
          earlierC,
          laterA,
        ]);
        expect(pageThree.total).toBe(4);
      });

      function nextSourceGroupId(label: string): string {
        counter += 1;

        return `schedule-db-it-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      function track(schedule: CollectionSchedule): CollectionSchedule {
        trackedSourceGroupIds.add(schedule.sourceGroupId);

        return schedule;
      }
    },
  );
}

function createSchedule(
  options: Partial<CollectionSchedule> = {},
): CollectionSchedule {
  return {
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 30,
    nextRunAt: options.nextRunAt ?? "2026-06-17T10:30:00.000Z",
    parameters: options.parameters ?? {},
    createdAt: options.createdAt ?? "2026-06-17T10:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-06-17T10:00:00.000Z",
  };
}