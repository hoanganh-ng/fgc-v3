import { describe, expect, it, vi } from "vitest";
import {
  cancelProfileHomeFeedCollectionRun,
  invalidateProfileHomeFeedCollectionRunQueries,
  requestProfileHomeFeedCollectionRun,
} from "@/features/collector-runtime/profile-home-feed-collection-run-mutations";
import { profileHomeFeedCollectionRunQueryKeys } from "@/features/collector-runtime/profile-home-feed-collection-run-queries";
import type {
  ProfileHomeFeedCollectionRunResponse,
  RequestProfileHomeFeedCollectionRunRequest,
} from "@/lib/api/collector-runtime-client";

const timestamp = "2026-06-15T12:30:00.000Z";

const mocks = vi.hoisted(() => ({
  requestProfileHomeFeedCollectionRun: vi.fn(
    async (_request: RequestProfileHomeFeedCollectionRunRequest) => {
      const response: ProfileHomeFeedCollectionRunResponse = {
        profileHomeFeedCollectionRun: {
          id: "home-feed-run-1",
          profileId: "profile-1",
          triggerType: "MANUAL_API",
          status: "QUEUED",
          accountStageAtRequest: "COLLECTION_READY",
          target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
          parameters: {},
          requestedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      };
      return { ok: true as const, data: response };
    },
  ),
  cancelProfileHomeFeedCollectionRun: vi.fn(async (_runId: string) => {
    const response: ProfileHomeFeedCollectionRunResponse = {
      profileHomeFeedCollectionRun: {
        id: "home-feed-run-1",
        profileId: "profile-1",
        triggerType: "MANUAL_API",
        status: "CANCELED",
        accountStageAtRequest: "COLLECTION_READY",
        target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
        parameters: {},
        requestedAt: timestamp,
        finishedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    };
    return { ok: true as const, data: response };
  }),
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
      listProfileHomeFeedCollectionRuns: vi.fn(),
      getProfileHomeFeedCollectionRun: vi.fn(),
      requestProfileHomeFeedCollectionRun:
        mocks.requestProfileHomeFeedCollectionRun,
      cancelProfileHomeFeedCollectionRun:
        mocks.cancelProfileHomeFeedCollectionRun,
      listCollectionSchedules: vi.fn(),
      getCollectionSchedule: vi.fn(),
      upsertCollectionSchedule: vi.fn(),
      listProfileHomeFeedCollectionSchedules: vi.fn(),
      getProfileHomeFeedCollectionSchedule: vi.fn(),
      upsertProfileHomeFeedCollectionSchedule: vi.fn(),
    },
  };
});

describe("profile-home-feed collection-run mutation helpers", () => {
  it("requestProfileHomeFeedCollectionRun calls the production client", async () => {
    const result = await requestProfileHomeFeedCollectionRun({
      profileId: "profile-1",
      maxPosts: 20,
    });

    expect(mocks.requestProfileHomeFeedCollectionRun).toHaveBeenCalledWith({
      profileId: "profile-1",
      maxPosts: 20,
    });
    expect(result.profileHomeFeedCollectionRun.id).toBe("home-feed-run-1");
  });

  it("cancelProfileHomeFeedCollectionRun calls the production client", async () => {
    const result = await cancelProfileHomeFeedCollectionRun({
      profileHomeFeedCollectionRunId: "home-feed-run-1",
    });

    expect(mocks.cancelProfileHomeFeedCollectionRun).toHaveBeenCalledWith(
      "home-feed-run-1",
    );
    expect(result.profileHomeFeedCollectionRun.status).toBe("CANCELED");
  });

  it("invalidateProfileHomeFeedCollectionRunQueries invalidates run query keys", async () => {
    const calls: unknown[] = [];

    await invalidateProfileHomeFeedCollectionRunQueries({
      async invalidateQueries(filters) {
        calls.push(filters);
      },
    });

    expect(calls).toEqual([
      { queryKey: profileHomeFeedCollectionRunQueryKeys.all },
    ]);
  });
});
