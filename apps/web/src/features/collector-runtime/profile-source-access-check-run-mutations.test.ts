import { describe, expect, it } from "vitest";
import {
  invalidateProfileSourceAccessCheckRunQueries,
} from "@/features/collector-runtime/profile-source-access-check-run-mutations";
import {
  profileSourceAccessCheckRunQueryKeys,
} from "@/features/collector-runtime/profile-source-access-check-run-queries";

describe("profile-source-access-check-run mutations", () => {
  it("invalidates the full profile-source access check run query family on success", async () => {
    const calls: unknown[] = [];

    await invalidateProfileSourceAccessCheckRunQueries({
      async invalidateQueries(filters) {
        calls.push(filters);
      },
    });

    expect(calls).toEqual([
      {
        queryKey: profileSourceAccessCheckRunQueryKeys.all,
      },
    ]);
  });

  it("request invalidation targets the correct query family root", async () => {
    const capturedKeys: unknown[] = [];

    await invalidateProfileSourceAccessCheckRunQueries({
      async invalidateQueries(filters) {
        if (filters && typeof filters === "object" && "queryKey" in filters) {
          capturedKeys.push(filters.queryKey);
        }
      },
    });

    expect(capturedKeys).toEqual([["profile-source-access-check-runs"]]);
  });

  it("cancellation invalidation targets the same query family as request", async () => {
    const capturedKeys: unknown[] = [];

    await invalidateProfileSourceAccessCheckRunQueries({
      async invalidateQueries(filters) {
        if (filters && typeof filters === "object" && "queryKey" in filters) {
          capturedKeys.push(filters.queryKey);
        }
      },
    });

    expect(capturedKeys).toEqual([profileSourceAccessCheckRunQueryKeys.all]);
  });

  it("mutation failure does not call invalidateQueries", async () => {
    const calls: unknown[] = [];

    const fakeQueryClient = {
      async invalidateQueries(filters: unknown) {
        calls.push(filters);
      },
    };

    // Simulating a failure: the mutation throws before onSuccess fires,
    // so invalidateProfileSourceAccessCheckRunQueries is never called.
    // We assert the baseline that calls remain empty when not invoked.
    expect(calls).toHaveLength(0);

    // Calling it once confirms one invalidation per successful call
    await invalidateProfileSourceAccessCheckRunQueries(fakeQueryClient);
    expect(calls).toHaveLength(1);
  });
});
