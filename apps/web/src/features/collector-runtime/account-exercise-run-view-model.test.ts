import { describe, expect, it } from "vitest";
import { accountExerciseRunQueryKeys } from "@/features/collector-runtime/account-exercise-run-queries";
import {
  RequestAccountExerciseRunFormSchema,
  canCancelAccountExerciseRun,
  getPaginationModel,
  getProfileDisplay,
  getVisibleRange,
  hasActiveAccountExerciseRuns,
  shouldShowPaginationControls,
  toRequestAccountExerciseRunRequest,
} from "@/features/collector-runtime/account-exercise-run-view-model";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";

describe("account-exercise-run view model", () => {
  it("creates different query keys for list filters and detail records", () => {
    expect(accountExerciseRunQueryKeys.list({ status: "QUEUED" })).not.toEqual(
      accountExerciseRunQueryKeys.list({ status: "RUNNING" }),
    );
    expect(
      accountExerciseRunQueryKeys.list({ profileId: "profile-1" }),
    ).not.toEqual(accountExerciseRunQueryKeys.list({ profileId: "profile-2" }));
    expect(accountExerciseRunQueryKeys.list({ offset: 0 })).not.toEqual(
      accountExerciseRunQueryKeys.list({ offset: 50 }),
    );
    expect(accountExerciseRunQueryKeys.detail("run-1")).not.toEqual(
      accountExerciseRunQueryKeys.detail("run-2"),
    );
    expect(accountExerciseRunQueryKeys.detail("run-1")).not.toEqual(
      accountExerciseRunQueryKeys.list({ offset: 0 }),
    );
  });

  it("polls only when displayed account exercise runs include an active run", () => {
    expect(hasActiveAccountExerciseRuns([{ status: "QUEUED" }])).toBe(true);
    expect(hasActiveAccountExerciseRuns([{ status: "RUNNING" }])).toBe(true);
    expect(hasActiveAccountExerciseRuns([{ status: "SUCCEEDED" }])).toBe(false);
    expect(hasActiveAccountExerciseRuns([{ status: "FAILED" }])).toBe(false);
    expect(hasActiveAccountExerciseRuns([{ status: "CANCELED" }])).toBe(false);
  });

  it("enables item-count-aware next pagination", () => {
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

  it("keeps previous pagination tied to offset", () => {
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
        itemCount: 0,
      }).canGoBack,
    ).toBe(true);
  });

  it("calculates visible ranges and pagination visibility from item counts", () => {
    expect(getVisibleRange({ offset: 50, itemCount: 3 })).toEqual({
      start: 51,
      end: 53,
    });
    expect(getVisibleRange({ offset: 0, itemCount: 0 })).toBeUndefined();
    expect(
      shouldShowPaginationControls({
        offset: 0,
        limit: 50,
        itemCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowPaginationControls({
        offset: 50,
        limit: 50,
        itemCount: 0,
      }),
    ).toBe(true);
  });

  it("shows cancellation only for queued account exercise runs", () => {
    expect(canCancelAccountExerciseRun("QUEUED")).toBe(true);
    expect(canCancelAccountExerciseRun("RUNNING")).toBe(false);
    expect(canCancelAccountExerciseRun("SUCCEEDED")).toBe(false);
    expect(canCancelAccountExerciseRun("FAILED")).toBe(false);
    expect(canCancelAccountExerciseRun("CANCELED")).toBe(false);
  });

  it("serializes blank action-budget fields with current backend defaults and omits blank min dwell", () => {
    const values = RequestAccountExerciseRunFormSchema.parse({
      profileId: "profile-1",
      maxDurationMs: "",
      maxScrolls: "",
      minDwellMs: "",
    });

    expect(
      toRequestAccountExerciseRunRequest(values, createProfileSummary()),
    ).toEqual({
      profileId: "profile-1",
      stageAtStart: "NEW_ACCOUNT",
      maxDurationMs: 120_000,
      maxScrolls: 2,
    });
  });

  it("preserves valid zero values allowed by the backend contract", () => {
    const values = RequestAccountExerciseRunFormSchema.parse({
      profileId: "profile-1",
      maxDurationMs: "60000",
      maxScrolls: "0",
      minDwellMs: "0",
    });

    expect(
      toRequestAccountExerciseRunRequest(values, createProfileSummary()),
    ).toEqual({
      profileId: "profile-1",
      stageAtStart: "NEW_ACCOUNT",
      maxDurationMs: 60_000,
      maxScrolls: 0,
      minDwellMs: 0,
    });
  });

  it("falls back to profileId when safe profile enrichment fails", () => {
    expect(getProfileDisplay("profile-1", new Map())).toEqual({
      primary: "profile-1",
      secondary: "Profile details unavailable",
      found: false,
    });
  });

  it("uses safe profile display data when enrichment succeeds", () => {
    const profile = createProfileSummary({
      id: "profile-1",
      displayName: "Warming Profile",
      status: "READY",
      accountStage: "WARMING",
    });

    expect(getProfileDisplay("profile-1", new Map([[profile.id, profile]]))).toEqual({
      primary: "Warming Profile",
      secondary: "profile-1 / READY / WARMING",
      found: true,
    });
  });
});

function createProfileSummary(
  overrides: Partial<ProfileSummary> = {},
): ProfileSummary {
  return {
    id: "profile-1",
    displayName: "New Profile",
    status: "READY",
    accountStage: "NEW_ACCOUNT",
    timezone: "UTC",
    createdAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    lastCheckoutAt: null,
    lastReleasedAt: null,
    nextAvailableAt: null,
    dailyUsage: {
      localDate: null,
      sessionsStarted: 0,
      activeDurationMinutes: 0,
      macroActions: 0,
    },
    hasHardwareFingerprint: false,
    hasAuthenticationState: false,
    ...overrides,
  };
}
