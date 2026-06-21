import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ProfileHomeFeedCollectionSchedule } from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { profileHomeFeedCollectionSchedules } from "../schema/collector-runtime.schema";
import { DrizzleProfileHomeFeedCollectionScheduleRepository } from "./drizzle-profile-home-feed-collection-schedule.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Collector Runtime PostgreSQL profile home-feed collection schedule repository integration",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Collector Runtime PostgreSQL profile home-feed collection schedule repository integration",
    () => {
      let client: DatabaseClient | undefined;
      let schedules: DrizzleProfileHomeFeedCollectionScheduleRepository;
      let counter = 0;
      const trackedProfileIds = new Set<string>();

      beforeAll(() => {
        const databaseClient = createDatabaseClient({
          poolConfig: {
            max: 2,
          },
        });
        client = databaseClient;
        schedules = new DrizzleProfileHomeFeedCollectionScheduleRepository(
          databaseClient.db,
        );
      });

      afterEach(async () => {
        if (client === undefined || trackedProfileIds.size === 0) {
          return;
        }

        await client.db
          .delete(profileHomeFeedCollectionSchedules)
          .where(
            inArray(
              profileHomeFeedCollectionSchedules.profileId,
              [...trackedProfileIds],
            ),
          );
        trackedProfileIds.clear();
      });

      afterAll(async () => {
        await client?.close();
      });

      it("saves a new schedule and preserves createdAt on update", async () => {
        const profileId = nextProfileId("upsert");
        const initial = track(
          createSchedule({
            profileId,
            createdAt: "2026-06-21T10:00:00.000Z",
            updatedAt: "2026-06-21T10:00:00.000Z",
          }),
        );

        await schedules.save(initial);

        await expect(schedules.findByProfileId(profileId)).resolves.toEqual(
          initial,
        );

        const updated = createSchedule({
          profileId,
          enabled: false,
          intervalMinutes: 120,
          nextRunAt: "2026-06-21T12:00:00.000Z",
          parameters: { maxPosts: 10 },
          createdAt: "2099-01-01T00:00:00.000Z",
          updatedAt: "2026-06-21T11:00:00.000Z",
        });

        await schedules.save(updated);

        await expect(schedules.findByProfileId(profileId)).resolves.toEqual({
          ...updated,
          createdAt: initial.createdAt,
        });
      });

      it("findByProfileId returns null when absent", async () => {
        await expect(
          schedules.findByProfileId(nextProfileId("missing")),
        ).resolves.toBeNull();
      });

      it("lists schedules by enabled filter, next_run_at, and profile_id", async () => {
        const profileIdPrefix = nextProfileId("list");
        const later = `${profileIdPrefix}-later`;
        const earlierA = `${profileIdPrefix}-earlier-a`;
        const earlierB = `${profileIdPrefix}-earlier-b`;
        const disabled = `${profileIdPrefix}-disabled`;

        for (const seed of [
          {
            profileId: later,
            enabled: true,
            nextRunAt: "2026-06-21T12:00:00.000Z",
          },
          {
            profileId: earlierB,
            enabled: true,
            nextRunAt: "2026-06-21T11:00:00.000Z",
          },
          {
            profileId: earlierA,
            enabled: true,
            nextRunAt: "2026-06-21T11:00:00.000Z",
          },
          {
            profileId: disabled,
            enabled: false,
            nextRunAt: "2026-06-21T10:00:00.000Z",
          },
        ]) {
          await schedules.save(track(createSchedule(seed)));
        }

        const result = await schedules.list({
          enabled: true,
          limit: 2,
          offset: 1,
        });

        expect(result.items.map((item) => item.profileId)).toEqual([
          earlierB,
          later,
        ]);
        expect(result.total).toBe(3);
      });

      function nextProfileId(label: string): string {
        counter += 1;

        return `phf-schedule-db-it-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      function track(
        schedule: ProfileHomeFeedCollectionSchedule,
      ): ProfileHomeFeedCollectionSchedule {
        trackedProfileIds.add(schedule.profileId);

        return schedule;
      }
    },
  );
}

function createSchedule(
  options: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: options.profileId ?? "profile-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 30,
    nextRunAt: options.nextRunAt ?? "2026-06-21T10:30:00.000Z",
    parameters: options.parameters ?? {},
    ...(options.lastAttemptedAt !== undefined
      ? { lastAttemptedAt: options.lastAttemptedAt }
      : {}),
    ...(options.lastDispatchStatus !== undefined
      ? { lastDispatchStatus: options.lastDispatchStatus }
      : {}),
    ...(options.lastFailureReason !== undefined
      ? { lastFailureReason: options.lastFailureReason }
      : {}),
    consecutiveFailures: options.consecutiveFailures ?? 0,
    createdAt: options.createdAt ?? "2026-06-21T10:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-06-21T10:00:00.000Z",
  };
}
