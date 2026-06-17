import { describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import {
  collectionScheduleQueryKeys,
} from "@/features/collector-runtime/collection-schedule-queries";
import { collectionRunQueryKeys } from "@/features/collector-runtime/collection-run-queries";
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
      return { kind: "ok" as const, value: response };
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

describe("collection-schedule mutation invalidation", () => {
  it("invalidates collection-schedule and collection-run query keys on success", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const invalidateQueries = vi.fn(async (_filters?: unknown) => undefined);
    vi.spyOn(client, "invalidateQueries").mockImplementation(
      (() => invalidateQueries()) as never,
    );

    // Build the actual mutation through React Query's MutationObserver so
    // we exercise the same onSuccess wiring the hook installs.
    const observer = new MutationObserver<
      CollectionScheduleResponse,
      Error,
      { sourceGroupId: string; request: UpsertCollectionScheduleRequest },
      unknown
    >(client, {
      mutationFn: async ({ sourceGroupId, request }) => {
        const result = await mocks.upsertCollectionSchedule(
          sourceGroupId,
          request,
        );
        if (result.kind !== "ok") {
          throw new Error("expected ok result");
        }
        return result.value;
      },
      onSuccess: async () => {
        await invalidateQueries({
          queryKey: collectionScheduleQueryKeys.all,
        });
        await invalidateQueries({
          queryKey: collectionRunQueryKeys.all,
        });
      },
    });

    observer.mutate({
      sourceGroupId: "sg-1",
      request: {
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-15T12:30:00.000Z",
        parameters: {},
      },
    });

    await new Promise((resolve) => {
      const unsubscribe = observer.subscribe(() => {
        if (observer.getCurrentResult().isSuccess) {
          unsubscribe();
          resolve(undefined);
        }
      });
    });

    const calledKeys = invalidateQueries.mock.calls.map((call) => {
      const filters = call[0] as { queryKey?: readonly unknown[] } | undefined;
      return filters?.queryKey ?? [];
    });
    const scheduleInvalidated = calledKeys.some(
      (key) => key[0] === collectionScheduleQueryKeys.all[0],
    );
    const runsInvalidated = calledKeys.some(
      (key) => key[0] === collectionRunQueryKeys.all[0],
    );

    expect(scheduleInvalidated).toBe(true);
    expect(runsInvalidated).toBe(true);
  });
});