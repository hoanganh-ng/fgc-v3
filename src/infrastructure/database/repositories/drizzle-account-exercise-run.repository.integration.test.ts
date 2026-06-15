import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AccountExerciseRun } from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { collectorAccountExerciseRuns } from "../schema/collector-runtime.schema";
import { DrizzleAccountExerciseRunRepository } from "./drizzle-account-exercise-run.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Collector Runtime PostgreSQL account exercise run repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Collector Runtime PostgreSQL account exercise run repository integration", () => {
    let client: DatabaseClient | undefined;
    let accountExerciseRuns: DrizzleAccountExerciseRunRepository;
    let nextId = 0;
    const createdAccountExerciseRunIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 4,
        },
      });
      client = databaseClient;
      accountExerciseRuns = new DrizzleAccountExerciseRunRepository(
        databaseClient.db,
      );
    });

    afterEach(async () => {
      if (
        client === undefined ||
        createdAccountExerciseRunIds.size === 0
      ) {
        return;
      }

      await client.db
        .delete(collectorAccountExerciseRuns)
        .where(
          inArray(
            collectorAccountExerciseRuns.id,
            [...createdAccountExerciseRunIds],
          ),
        );
      createdAccountExerciseRunIds.clear();
    });

    afterAll(async () => {
      await client?.close();
    });

    it("claims the oldest queued run and does not claim it twice", async () => {
      const newerRun = trackAccountExerciseRun(
        createAccountExerciseRun({
          id: nextTestId("newer"),
          requestedAt: "2026-05-01T10:05:00.000Z",
          createdAt: "2026-05-01T10:05:00.000Z",
        }),
      );
      const olderRun = trackAccountExerciseRun(
        createAccountExerciseRun({
          id: nextTestId("older"),
          requestedAt: "2026-05-01T10:00:00.000Z",
          createdAt: "2026-05-01T10:00:00.000Z",
        }),
      );

      await accountExerciseRuns.save(newerRun);
      await accountExerciseRuns.save(olderRun);

      await expect(
        accountExerciseRuns.claimNextQueued("2026-05-01T11:00:00.000Z"),
      ).resolves.toMatchObject({
        id: olderRun.id,
        status: "RUNNING",
        startedAt: "2026-05-01T11:00:00.000Z",
      });
      await expect(
        accountExerciseRuns.claimNextQueued("2026-05-01T11:01:00.000Z"),
      ).resolves.toMatchObject({
        id: newerRun.id,
        status: "RUNNING",
        startedAt: "2026-05-01T11:01:00.000Z",
      });
      await expect(
        accountExerciseRuns.claimNextQueued("2026-05-01T11:02:00.000Z"),
      ).resolves.toBeNull();
    });

    it("does not claim canceled, running, succeeded, or failed runs", async () => {
      const terminalRuns = [
        createAccountExerciseRun({
          id: nextTestId("canceled"),
          status: "CANCELED",
          finishedAt: "2026-05-01T10:05:00.000Z",
        }),
        createAccountExerciseRun({
          id: nextTestId("running"),
          status: "RUNNING",
          startedAt: "2026-05-01T10:01:00.000Z",
        }),
        createAccountExerciseRun({
          id: nextTestId("succeeded"),
          status: "SUCCEEDED",
          startedAt: "2026-05-01T10:01:00.000Z",
          finishedAt: "2026-05-01T10:05:00.000Z",
          safeSummary: createSafeSummary(),
        }),
        createAccountExerciseRun({
          id: nextTestId("failed"),
          status: "FAILED",
          startedAt: "2026-05-01T10:01:00.000Z",
          finishedAt: "2026-05-01T10:05:00.000Z",
          failureReason: {
            code: "WORKER_FAILED",
            message: "Worker failed.",
          },
        }),
      ].map(trackAccountExerciseRun);

      for (const accountExerciseRun of terminalRuns) {
        await accountExerciseRuns.save(accountExerciseRun);
      }

      await expect(
        accountExerciseRuns.claimNextQueued("2026-05-01T11:00:00.000Z"),
      ).resolves.toBeNull();
    });

    it("does not return the same queued run to concurrent claimers", async () => {
      const firstRun = trackAccountExerciseRun(
        createAccountExerciseRun({
          id: nextTestId("first"),
          requestedAt: "2026-05-01T10:00:00.000Z",
          createdAt: "2026-05-01T10:00:00.000Z",
        }),
      );
      const secondRun = trackAccountExerciseRun(
        createAccountExerciseRun({
          id: nextTestId("second"),
          requestedAt: "2026-05-01T10:01:00.000Z",
          createdAt: "2026-05-01T10:01:00.000Z",
        }),
      );

      await accountExerciseRuns.save(firstRun);
      await accountExerciseRuns.save(secondRun);

      const claimedRuns = await Promise.all([
        accountExerciseRuns.claimNextQueued("2026-05-01T11:00:00.000Z"),
        accountExerciseRuns.claimNextQueued("2026-05-01T11:00:01.000Z"),
      ]);

      expect(new Set(claimedRuns.map((run) => run?.id))).toEqual(
        new Set([firstRun.id, secondRun.id]),
      );
    });

    function nextTestId(label: string): string {
      nextId += 1;

      return `account-exercise-run-db-it-${process.pid}-${Date.now()}-${nextId}-${label}`;
    }

    function trackAccountExerciseRun(
      accountExerciseRun: AccountExerciseRun,
    ): AccountExerciseRun {
      createdAccountExerciseRunIds.add(accountExerciseRun.id);

      return accountExerciseRun;
    }
  });
}

function createAccountExerciseRun(
  options: Partial<AccountExerciseRun> = {},
): AccountExerciseRun {
  return {
    id: options.id ?? "account-exercise-run-1",
    profileId: options.profileId ?? "profile-1",
    ...(options.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
    exerciseType: options.exerciseType ?? "AMBIENT_ACCOUNT",
    status: options.status ?? "QUEUED",
    stageAtStart: options.stageAtStart ?? "NEW_ACCOUNT",
    actionBudget: options.actionBudget ?? {
      maxDurationMs: 120_000,
      maxScrolls: 2,
      minDwellMs: 2_000,
    },
    ...(options.safeSummary !== undefined
      ? { safeSummary: options.safeSummary }
      : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? "2026-05-01T10:00:00.000Z",
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? "2026-05-01T10:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-05-01T10:00:00.000Z",
  };
}

function createSafeSummary(): NonNullable<AccountExerciseRun["safeSummary"]> {
  return {
    pageLoaded: true,
    loginRequired: false,
    checkpointDetected: false,
    scrollsPerformed: 2,
    durationMs: 10_000,
    leaseReleased: true,
  };
}
