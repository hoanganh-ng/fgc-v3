import { describe, expect, it, vi } from "vitest";
import {
  invalidateProfileHomeFeedCollectionScheduleQueries,
  upsertProfileHomeFeedCollectionSchedule,
} from "@/features/collector-runtime/profile-home-feed-collection-schedule-mutations";
import { profileHomeFeedCollectionScheduleQueryKeys } from "@/features/collector-runtime/profile-home-feed-collection-schedule-queries";
import type {
  ProfileHomeFeedCollectionScheduleResponse,
  UpsertProfileHomeFeedCollectionScheduleRequest,
} from "@/lib/api/collector-runtime-client";

const mocks = vi.hoisted(() => ({
  upsertProfileHomeFeedCollectionSchedule: vi.fn(
    async (
      _profileId: string,
      _request: UpsertProfileHomeFeedCollectionScheduleRequest,
    ) => {
      const response: ProfileHomeFeedCollectionScheduleResponse = {
        schedule: {
          profileId: "profile-1",
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-06-15T12:30:00.000Z",
          parameters: {},
          consecutiveFailures: 0,
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
      listCollectionSchedules: vi.fn(),
      getCollectionSchedule: vi.fn(),
      upsertCollectionSchedule: vi.fn(),
      listProfileHomeFeedCollectionSchedules: vi.fn(),
      getProfileHomeFeedCollectionSchedule: vi.fn(),
      upsertProfileHomeFeedCollectionSchedule:
        mocks.upsertProfileHomeFeedCollectionSchedule,
    },
  };
});

describe("profile-home-feed-schedule mutation helpers", () => {
  it("upsertProfileHomeFeedCollectionSchedule calls the production client and returns the schedule", async () => {
    const result = await upsertProfileHomeFeedCollectionSchedule({
      profileId: "profile-1",
      request: {
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-15T12:30:00.000Z",
      },
    });

    expect(
      mocks.upsertProfileHomeFeedCollectionSchedule,
    ).toHaveBeenCalledWith("profile-1", {
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-15T12:30:00.000Z",
    });
    expect(result.schedule.profileId).toBe("profile-1");
  });

  it("invalidateProfileHomeFeedCollectionScheduleQueries invalidates schedule query keys", async () => {
    const calls: unknown[] = [];

    await invalidateProfileHomeFeedCollectionScheduleQueries({
      async invalidateQueries(filters) {
        calls.push(filters);
      },
    });

    expect(calls).toEqual([
      { queryKey: profileHomeFeedCollectionScheduleQueryKeys.all },
    ]);
  });
});
