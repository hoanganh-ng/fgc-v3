import { describe, expect, it } from "vitest";
import { collectionRunQueryKeys } from "@/features/collector-runtime/collection-run-queries";
import {
  RequestCollectionRunFormSchema,
  canCancelCollectionRun,
  filterRequestableSourceGroups,
  getPaginationModel,
  getVisibleRange,
  hasActiveCollectionRuns,
  toRequestCollectionRunRequest,
} from "@/features/collector-runtime/collection-run-view-model";

describe("collection-run view model", () => {
  it("creates different query keys for different list inputs", () => {
    expect(collectionRunQueryKeys.list({ status: "QUEUED" })).not.toEqual(
      collectionRunQueryKeys.list({ status: "RUNNING" }),
    );
    expect(collectionRunQueryKeys.list({ sourceGroupId: "sg-1" })).not.toEqual(
      collectionRunQueryKeys.list({ sourceGroupId: "sg-2" }),
    );
    expect(collectionRunQueryKeys.list({ offset: 0 })).not.toEqual(
      collectionRunQueryKeys.list({ offset: 50 }),
    );
  });

  it("polls only when the displayed runs include an active run", () => {
    expect(hasActiveCollectionRuns([{ status: "QUEUED" }])).toBe(true);
    expect(hasActiveCollectionRuns([{ status: "RUNNING" }])).toBe(true);
    expect(hasActiveCollectionRuns([{ status: "SUCCEEDED" }])).toBe(false);
    expect(hasActiveCollectionRuns([{ status: "FAILED" }])).toBe(false);
  });

  it("enables next with total only while records remain", () => {
    expect(
      getPaginationModel({
        offset: 0,
        limit: 50,
        itemCount: 50,
        total: 120,
      }).canGoNext,
    ).toBe(true);
    expect(
      getPaginationModel({
        offset: 100,
        limit: 50,
        itemCount: 20,
        total: 120,
      }).canGoNext,
    ).toBe(false);
  });

  it("enables next without total only when the page is full", () => {
    expect(
      getPaginationModel({
        offset: 0,
        limit: 50,
        itemCount: 50,
      }).canGoNext,
    ).toBe(true);
    expect(
      getPaginationModel({
        offset: 0,
        limit: 50,
        itemCount: 49,
      }).canGoNext,
    ).toBe(false);
  });

  it("keeps previous disabled at offset zero", () => {
    expect(
      getPaginationModel({
        offset: 0,
        limit: 50,
        itemCount: 50,
      }).canGoBack,
    ).toBe(false);
    expect(
      getPaginationModel({
        offset: 50,
        limit: 50,
        itemCount: 50,
      }).canGoBack,
    ).toBe(true);
  });

  it("calculates visible ranges from the current item count", () => {
    expect(getVisibleRange({ offset: 50, itemCount: 3 })).toEqual({
      start: 51,
      end: 53,
    });
    expect(getVisibleRange({ offset: 0, itemCount: 0 })).toBeUndefined();
  });

  it("shows cancellation only for queued runs", () => {
    expect(canCancelCollectionRun("QUEUED")).toBe(true);
    expect(canCancelCollectionRun("RUNNING")).toBe(false);
    expect(canCancelCollectionRun("SUCCEEDED")).toBe(false);
    expect(canCancelCollectionRun("FAILED")).toBe(false);
    expect(canCancelCollectionRun("CANCELED")).toBe(false);
  });

  it("omits blank optional request fields", () => {
    const values = RequestCollectionRunFormSchema.parse({
      sourceGroupId: "sg-1",
      maxScrolls: "",
      maxDurationMs: "",
    });

    expect(toRequestCollectionRunRequest(values)).toEqual({
      sourceGroupId: "sg-1",
    });
  });

  it("preserves maxScrolls zero", () => {
    const values = RequestCollectionRunFormSchema.parse({
      sourceGroupId: "sg-1",
      maxScrolls: "0",
      maxDurationMs: "",
    });

    expect(toRequestCollectionRunRequest(values)).toEqual({
      sourceGroupId: "sg-1",
      maxScrolls: 0,
    });
  });

  it("filters requestable source groups to active Facebook groups", () => {
    const sourceGroups = [
      { id: "sg-active", platform: "FACEBOOK", status: "ACTIVE" },
      { id: "sg-paused", platform: "FACEBOOK", status: "PAUSED" },
      { id: "sg-other", platform: "INSTAGRAM", status: "ACTIVE" },
    ];

    expect(filterRequestableSourceGroups(sourceGroups)).toEqual([
      { id: "sg-active", platform: "FACEBOOK", status: "ACTIVE" },
    ]);
  });
});
