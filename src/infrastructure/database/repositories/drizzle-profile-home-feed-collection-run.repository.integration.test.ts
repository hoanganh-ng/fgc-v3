import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ProfileHomeFeedCollectionRunAlreadyExistsError,
  ProfileHomeFeedCollectionRunConflictError,
} from "../../../collector-runtime/application";
import type { ProfileHomeFeedCollectionRun } from "../../../collector-runtime/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { profileHomeFeedCollectionRuns } from "../schema/collector-runtime.schema";
import { DrizzleProfileHomeFeedCollectionRunRepository } from "./drizzle-profile-home-feed-collection-run.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Collector Runtime PostgreSQL profile home-feed collection run repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Collector Runtime PostgreSQL profile home-feed collection run repository integration", () => {
    let client: DatabaseClient | undefined;
    let runs: DrizzleProfileHomeFeedCollectionRunRepository;
    let nextId = 0;
    const createdRunIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 6,
        },
      });
      client = databaseClient;
      runs = new DrizzleProfileHomeFeedCollectionRunRepository(
        databaseClient.db,
      );
    });

    afterEach(async () => {
      if (client === undefined || createdRunIds.size === 0) {
        return;
      }

      await client.db
        .delete(profileHomeFeedCollectionRuns)
        .where(inArray(profileHomeFeedCollectionRuns.id, [...createdRunIds]));
      createdRunIds.clear();
    });

    afterAll(async () => {
      await client?.close();
    });

    it("creates and reloads a profile home-feed collection run", async () => {
      const run = trackRun(
        createRun({
          id: nextTestId("basic"),
        }),
      );

      await runs.create(run);

      await expect(runs.findById(run.id)).resolves.toEqual(run);
    });

    it("lists profile home-feed collection runs by status and profileId", async () => {
      const run1 = trackRun(
        createRun({
          id: nextTestId("list-queued"),
          profileId: "profile-list-1",
          status: "QUEUED",
          createdAt: "2026-06-19T10:00:00.000Z",
        }),
      );
      const run2 = trackRun(
        createRun({
          id: nextTestId("list-running"),
          profileId: "profile-list-2",
          status: "RUNNING",
          startedAt: "2026-06-19T10:01:00.000Z",
          createdAt: "2026-06-19T10:01:00.000Z",
        }),
      );

      await runs.create(run1);
      await runs.create(run2);

      const listed = await runs.list({
        status: "RUNNING",
        profileId: "profile-list-2",
        limit: 10,
        offset: 0,
      });

      expect(listed.items).toEqual([run2]);
      expect(listed.total).toBe(1);
    });

    it("prevents multiple active home-feed runs for the same profile atomically", async () => {
      const profileId = nextTestId("profile-active");
      const run1 = trackRun(
        createRun({
          id: nextTestId("active-1"),
          profileId,
          status: "QUEUED",
        }),
      );
      const run2 = trackRun(
        createRun({
          id: nextTestId("active-2"),
          profileId,
          status: "RUNNING",
          startedAt: "2026-06-19T10:01:00.000Z",
        }),
      );

      const results = await Promise.allSettled([
        runs.create(run1),
        runs.create(run2),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(
        ProfileHomeFeedCollectionRunConflictError,
      );
    });

    it("allows a new active run after the previous run is terminal", async () => {
      const profileId = nextTestId("profile-terminal");
      const run1 = trackRun(
        createRun({
          id: nextTestId("terminal-1"),
          profileId,
          status: "SUCCEEDED",
          startedAt: "2026-06-19T10:01:00.000Z",
          finishedAt: "2026-06-19T10:02:00.000Z",
        }),
      );
      const run2 = trackRun(
        createRun({
          id: nextTestId("terminal-2"),
          profileId,
          status: "QUEUED",
        }),
      );

      await runs.create(run1);
      await runs.create(run2);

      await expect(runs.findById(run2.id)).resolves.toEqual(run2);
    });

    it("claims queued home-feed runs concurrently without double-claiming", async () => {
      const startedAt = "2026-06-19T11:00:00.000Z";
      const run1 = trackRun(
        createRun({
          id: nextTestId("claim-b"),
          profileId: nextTestId("profile-claim-b"),
          requestedAt: "2026-06-19T10:00:00.000Z",
        }),
      );
      const run2 = trackRun(
        createRun({
          id: nextTestId("claim-a"),
          profileId: nextTestId("profile-claim-a"),
          requestedAt: "2026-06-19T10:00:00.000Z",
        }),
      );

      await runs.create(run1);
      await runs.create(run2);

      const [claim1, claim2, claim3] = await Promise.all([
        runs.claimNextQueued(startedAt),
        runs.claimNextQueued(startedAt),
        runs.claimNextQueued(startedAt),
      ]);

      expect([claim1?.id, claim2?.id].sort()).toEqual(
        [run1.id, run2.id].sort(),
      );
      expect(claim1?.status).toBe("RUNNING");
      expect(claim2?.status).toBe("RUNNING");
      expect(claim3).toBeNull();
      expect((await runs.findById(run1.id))?.startedAt).toBe(startedAt);
      expect((await runs.findById(run2.id))?.startedAt).toBe(startedAt);
    });

    it("claims oldest queued home-feed run by requestedAt then id", async () => {
      const startedAt = "2026-06-19T11:00:00.000Z";
      const bRun = trackRun(
        createRun({
          id: `b-${nextTestId("order")}`,
          profileId: nextTestId("profile-order-b"),
          requestedAt: "2026-06-19T10:00:00.000Z",
        }),
      );
      const aRun = trackRun(
        createRun({
          id: `a-${nextTestId("order")}`,
          profileId: nextTestId("profile-order-a"),
          requestedAt: "2026-06-19T10:00:00.000Z",
        }),
      );

      await runs.create(bRun);
      await runs.create(aRun);

      const claimed = await runs.claimNextQueued(startedAt);

      expect(claimed?.id).toBe(aRun.id);
    });

    it("keeps claim and cancel transitions atomic under competition", async () => {
      const startedAt = "2026-06-19T11:00:00.000Z";
      const canceledAt = "2026-06-19T11:00:01.000Z";
      const run = trackRun(
        createRun({
          id: nextTestId("claim-cancel"),
          profileId: nextTestId("profile-claim-cancel"),
        }),
      );

      await runs.create(run);

      const [claimResult, cancelResult] = await Promise.all([
        runs.claimNextQueued(startedAt),
        runs.transitionStatus({
          runId: run.id,
          expectedStatus: "QUEUED",
          nextStatus: "CANCELED",
          finishedAt: canceledAt,
          updatedAt: canceledAt,
        }),
      ]);
      const persisted = await runs.findById(run.id);

      if (claimResult !== null) {
        expect(claimResult.status).toBe("RUNNING");
        expect(cancelResult).toMatchObject({
          ok: false,
          reason: "status_conflict",
        });
        expect(persisted).toMatchObject({
          status: "RUNNING",
          startedAt,
        });
      } else {
        expect(cancelResult).toMatchObject({
          ok: true,
          run: {
            status: "CANCELED",
          },
        });
        expect(persisted).toMatchObject({
          status: "CANCELED",
          finishedAt: canceledAt,
        });
      }
    });

    it("allows only one terminal transition under success and failure competition", async () => {
      const finishedAt = "2026-06-19T11:00:00.000Z";
      const run = trackRun(
        createRun({
          id: nextTestId("succeed-fail"),
          profileId: nextTestId("profile-succeed-fail"),
          status: "RUNNING",
          startedAt: "2026-06-19T10:01:00.000Z",
        }),
      );

      await runs.create(run);

      const results = await Promise.all([
        runs.transitionStatus({
          runId: run.id,
          expectedStatus: "RUNNING",
          nextStatus: "SUCCEEDED",
          summary: createSummary(),
          finishedAt,
          updatedAt: finishedAt,
        }),
        runs.transitionStatus({
          runId: run.id,
          expectedStatus: "RUNNING",
          nextStatus: "FAILED",
          failureReason: {
            code: "CAPTURE_FAILED",
            message: "Home-feed collection failed.",
          },
          finishedAt,
          updatedAt: finishedAt,
        }),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.filter(
          (result) => !result.ok && result.reason === "status_conflict",
        ),
      ).toHaveLength(1);
      expect(["SUCCEEDED", "FAILED"]).toContain((await runs.findById(run.id))?.status);
    });

    it("rejects repeated terminal transitions without overwriting the row", async () => {
      const run = trackRun(
        createRun({
          id: nextTestId("repeat-terminal"),
          profileId: nextTestId("profile-repeat-terminal"),
          status: "SUCCEEDED",
          startedAt: "2026-06-19T10:01:00.000Z",
          finishedAt: "2026-06-19T10:02:00.000Z",
        }),
      );

      await runs.create(run);

      const result = await runs.transitionStatus({
        runId: run.id,
        expectedStatus: "RUNNING",
        nextStatus: "FAILED",
        failureReason: {
          code: "CAPTURE_FAILED",
          message: "Home-feed collection failed.",
        },
        finishedAt: "2026-06-19T11:00:00.000Z",
        updatedAt: "2026-06-19T11:00:00.000Z",
      });

      expect(result).toMatchObject({
        ok: false,
        reason: "status_conflict",
        currentRun: {
          status: "SUCCEEDED",
        },
      });
      await expect(runs.findById(run.id)).resolves.toMatchObject({
        status: "SUCCEEDED",
        finishedAt: "2026-06-19T10:02:00.000Z",
      });
    });

    it("rejects a duplicate primary key without modifying the existing row", async () => {
      const id = nextTestId("duplicate-pkey");
      const original = trackRun(
        createRun({
          id,
          profileId: nextTestId("profile-duplicate-original"),
          status: "SUCCEEDED",
          startedAt: "2026-06-19T10:01:00.000Z",
          finishedAt: "2026-06-19T10:02:00.000Z",
          summary: createSummary(),
        }),
      );

      await runs.create(original);

      await expect(
        runs.create(
          createRun({
            id,
            profileId: nextTestId("profile-duplicate-attempt"),
            status: "QUEUED",
          }),
        ),
      ).rejects.toBeInstanceOf(ProfileHomeFeedCollectionRunAlreadyExistsError);

      await expect(runs.findById(id)).resolves.toEqual(original);
    });

    it("does not let a fresh queued create replace a terminal run with the same id", async () => {
      const id = nextTestId("terminal-no-replace");
      const terminal = trackRun(
        createRun({
          id,
          profileId: nextTestId("profile-terminal-no-replace"),
          status: "CANCELED",
          finishedAt: "2026-06-19T10:05:00.000Z",
        }),
      );

      await runs.create(terminal);

      await expect(
        runs.create(
          createRun({
            id,
            profileId: nextTestId("profile-terminal-replacement"),
            status: "QUEUED",
          }),
        ),
      ).rejects.toBeInstanceOf(ProfileHomeFeedCollectionRunAlreadyExistsError);

      await expect(runs.findById(id)).resolves.toMatchObject({
        status: "CANCELED",
        finishedAt: "2026-06-19T10:05:00.000Z",
      });
    });

    it("distinguishes not-found transitions from stale expected status conflicts", async () => {
      const missing = await runs.transitionStatus({
        runId: nextTestId("missing-transition"),
        expectedStatus: "RUNNING",
        nextStatus: "SUCCEEDED",
        summary: createSummary(),
        finishedAt: "2026-06-19T11:00:00.000Z",
        updatedAt: "2026-06-19T11:00:00.000Z",
      });
      const run = trackRun(
        createRun({
          id: nextTestId("stale-transition"),
          profileId: nextTestId("profile-stale-transition"),
          status: "RUNNING",
          startedAt: "2026-06-19T10:01:00.000Z",
        }),
      );

      await runs.create(run);

      const stale = await runs.transitionStatus({
        runId: run.id,
        expectedStatus: "QUEUED",
        nextStatus: "CANCELED",
        finishedAt: "2026-06-19T11:00:00.000Z",
        updatedAt: "2026-06-19T11:00:00.000Z",
      });

      expect(missing).toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(stale).toMatchObject({
        ok: false,
        reason: "status_conflict",
        currentRun: {
          status: "RUNNING",
        },
      });
    });

    function nextTestId(prefix: string): string {
      nextId += 1;

      return `${prefix}-profile-home-feed-run-${process.pid}-${Date.now()}-${nextId}`;
    }

    function trackRun(
      run: ProfileHomeFeedCollectionRun,
    ): ProfileHomeFeedCollectionRun {
      createdRunIds.add(run.id);

      return run;
    }
  });
}

function createRun(
  options: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  const status = options.status ?? "QUEUED";

  return {
    id: options.id ?? "home-feed-run-1",
    profileId: options.profileId ?? "profile-1",
    triggerType: options.triggerType ?? "MANUAL_API",
    status,
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: options.parameters ?? {},
    ...(options.summary !== undefined
      ? { summary: options.summary }
      : status === "SUCCEEDED"
        ? { summary: createSummary() }
        : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? "2026-06-19T10:00:00.000Z",
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? "2026-06-19T10:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-06-19T10:00:00.000Z",
  };
}

function createSummary(): NonNullable<ProfileHomeFeedCollectionRun["summary"]> {
  return {
    capturedPayloads: 2,
    extractorCandidates: 1,
    sourcePublishersObserved: 1,
    contentItemsSubmitted: 0,
    failedPublisherObservations: 0,
    failedContentSubmissions: 0,
    leaseReleased: true,
  };
}
