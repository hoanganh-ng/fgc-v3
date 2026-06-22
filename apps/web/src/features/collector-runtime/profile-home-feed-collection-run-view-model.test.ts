import { describe, expect, it } from "vitest";
import { profileHomeFeedCollectionRunQueryKeys } from "@/features/collector-runtime/profile-home-feed-collection-run-queries";
import {
  RequestProfileHomeFeedCollectionRunFormSchema,
  canCancelProfileHomeFeedCollectionRun,
  filterEligibleProfileHomeFeedRunProfiles,
  formatProfileHomeFeedRunParameters,
  getPaginationModel,
  hasActiveProfileHomeFeedCollectionRuns,
  shouldShowPaginationControls,
  toRequestProfileHomeFeedCollectionRunRequest,
} from "@/features/collector-runtime/profile-home-feed-collection-run-view-model";

describe("profile-home-feed collection-run view model", () => {
  it("creates different query keys for different list inputs", () => {
    expect(
      profileHomeFeedCollectionRunQueryKeys.list({ status: "QUEUED" }),
    ).not.toEqual(
      profileHomeFeedCollectionRunQueryKeys.list({ status: "RUNNING" }),
    );
    expect(
      profileHomeFeedCollectionRunQueryKeys.list({ profileId: "profile-1" }),
    ).not.toEqual(
      profileHomeFeedCollectionRunQueryKeys.list({ profileId: "profile-2" }),
    );
  });

  it("polls only when displayed runs include queued or running runs", () => {
    expect(hasActiveProfileHomeFeedCollectionRuns([{ status: "QUEUED" }])).toBe(
      true,
    );
    expect(
      hasActiveProfileHomeFeedCollectionRuns([{ status: "RUNNING" }]),
    ).toBe(true);
    expect(
      hasActiveProfileHomeFeedCollectionRuns([{ status: "SUCCEEDED" }]),
    ).toBe(false);
    expect(hasActiveProfileHomeFeedCollectionRuns([{ status: "FAILED" }])).toBe(
      false,
    );
    expect(
      hasActiveProfileHomeFeedCollectionRuns([{ status: "CANCELED" }]),
    ).toBe(false);
  });

  it("shows cancellation only for queued and running runs", () => {
    expect(canCancelProfileHomeFeedCollectionRun("QUEUED")).toBe(true);
    expect(canCancelProfileHomeFeedCollectionRun("RUNNING")).toBe(true);
    expect(canCancelProfileHomeFeedCollectionRun("SUCCEEDED")).toBe(false);
    expect(canCancelProfileHomeFeedCollectionRun("FAILED")).toBe(false);
    expect(canCancelProfileHomeFeedCollectionRun("CANCELED")).toBe(false);
  });

  it("omits blank optional request fields and preserves zero maxScrolls", () => {
    const blankValues = RequestProfileHomeFeedCollectionRunFormSchema.parse({
      profileId: "profile-1",
      maxScrolls: "",
      maxDurationMs: "",
      maxPosts: "",
    });
    expect(toRequestProfileHomeFeedCollectionRunRequest(blankValues)).toEqual({
      profileId: "profile-1",
    });

    const zeroScrolls = RequestProfileHomeFeedCollectionRunFormSchema.parse({
      profileId: "profile-1",
      maxScrolls: "0",
      maxDurationMs: "",
      maxPosts: "",
    });
    expect(toRequestProfileHomeFeedCollectionRunRequest(zeroScrolls)).toEqual({
      profileId: "profile-1",
      maxScrolls: 0,
    });
  });

  it("validates integers locally without applying hard execution ceilings", () => {
    const overCeiling = RequestProfileHomeFeedCollectionRunFormSchema.safeParse({
      profileId: "profile-1",
      maxScrolls: "999",
      maxDurationMs: "999999",
      maxPosts: "999",
    });
    const fractional = RequestProfileHomeFeedCollectionRunFormSchema.safeParse({
      profileId: "profile-1",
      maxScrolls: "1.5",
      maxDurationMs: "",
      maxPosts: "",
    });
    const negative = RequestProfileHomeFeedCollectionRunFormSchema.safeParse({
      profileId: "profile-1",
      maxScrolls: "-1",
      maxDurationMs: "",
      maxPosts: "",
    });

    expect(overCeiling.success).toBe(true);
    expect(fractional.success).toBe(false);
    expect(negative.success).toBe(false);
  });

  it("filters eligible profiles to READY, COLLECTION_READY, and HEALTHY", () => {
    const profiles = [
      {
        id: "eligible",
        status: "READY",
        accountStage: "COLLECTION_READY",
        authenticationHealth: "HEALTHY",
      },
      {
        id: "busy",
        status: "BUSY",
        accountStage: "COLLECTION_READY",
        authenticationHealth: "HEALTHY",
      },
      {
        id: "warming",
        status: "READY",
        accountStage: "WARMING",
        authenticationHealth: "HEALTHY",
      },
      {
        id: "reauth",
        status: "READY",
        accountStage: "COLLECTION_READY",
        authenticationHealth: "REAUTH_REQUIRED",
      },
    ] as const;

    expect(filterEligibleProfileHomeFeedRunProfiles(profiles)).toEqual([
      profiles[0],
    ]);
  });

  it("calculates pagination using the existing page semantics", () => {
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
    expect(
      shouldShowPaginationControls({
        offset: 0,
        limit: 50,
        itemCount: 0,
      }),
    ).toBe(false);
  });

  it("formats request parameters safely", () => {
    expect(formatProfileHomeFeedRunParameters({})).toBe("-");
    expect(
      formatProfileHomeFeedRunParameters({
        maxScrolls: 3,
        maxDurationMs: 30000,
        maxPosts: 20,
      }),
    ).toBe("max scrolls: 3 · max duration: 30000 ms · max posts: 20");
  });
});
