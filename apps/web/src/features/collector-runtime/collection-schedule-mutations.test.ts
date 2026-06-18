import { describe, expect, it, vi } from "vitest";
import {
  invalidateCollectionScheduleQueries,
  upsertCollectionSchedule,
} from "@/features/collector-runtime/collection-schedule-mutations";
import { collectionRunQueryKeys } from "@/features/collector-runtime/collection-run-queries";
import { collectionScheduleQueryKeys } from "@/features/collector-runtime/collection-schedule-queries";
import type {
  CollectionScheduleResponse,
  UpsertCollectionScheduleRequest,
} from "@/lib/api/collector-runtime-client";

const mocks = vi.hoisted(() => ({
  upsertCollectionSchedule: vi.fn(
    async (_sourceGroupId: string, _request: UpsertCollectionScheduleRequest) => {
      const response: CollectionScheduleResponse = {
        collectionSchedule: {
          sourceGroupId: "sg-1",
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-06-15T12:30:00.000Z",
          parameters: {},
          createdAt: "2026-06-15T12:30:00.000Z",
          updatedAt: "2026-06-15T12:30:00.000Z",
        },
      };
      return { ok: true as const, data: response };
    },
  ),
}));

vi.mock("@/lib/api/collector-runtime-client", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@/lib/api/collector-runtime-client");
  return {
    ...actual,
    collectorRuntimeClient: {
      listCollectionSchedules: vi.fn(),
      getCollectionSchedule: vi.fn(),
      upsertCollectionSchedule: mocks.upsertCollectionSchedule,
      listCollectionRuns: vi.fn(),
      requestCollectionRun: vi.fn(),
      cancelCollectionRun: vi.fn(),
      listAccountExerciseRuns: vi.fn(),
      getAccountExerciseRun: vi.fn(),
      requestAccountExerciseRun: vi.fn(),
      cancelAccountExerciseRun: vi.fn(),
      listProfileSourceAccessCheckRuns: vi.fn(),
      getProfileSourceAccessCheckRun: vi.fn(),
      requestProfileSourceAccessCheckRun: vi.fn(),
      cancelProfileSourceAccessCheckRun: vi.fn(),
    },
  };
});

describe("collection-schedule mutation helpers", () => {
  it("upsertCollectionSchedule calls the production client and returns the schedule", async () => {
    const result = await upsertCollectionSchedule({
      sourceGroupId: "sg-1",
      request: {
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-15T12:30:00.000Z",
        parameters: {},
      },
    });

    expect(mocks.upsertCollectionSchedule).toHaveBeenCalledWith("sg-1", {
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-15T12:30:00.000Z",
      parameters: {},
    });
    expect(result.collectionSchedule.sourceGroupId).toBe("sg-1");
  });

  it("invalidateCollectionScheduleQueries invalidates both schedule and run query keys", async () => {
    const calls: unknown[] = [];

    await invalidateCollectionScheduleQueries({
      async invalidateQueries(filters) {
        calls.push(filters);
      },
    });

    expect(calls).toEqual([
      { queryKey: collectionScheduleQueryKeys.all },
      { queryKey: collectionRunQueryKeys.all },
    ]);
  });
});
