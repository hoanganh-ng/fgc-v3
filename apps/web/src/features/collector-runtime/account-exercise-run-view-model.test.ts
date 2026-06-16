import { describe, expect, it } from "vitest";
import { RequestAccountExerciseRunRequestSchema } from "@/lib/api/collector-runtime-client";
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
  deriveEligibleCategoryBrowseRoutes,
  getSourceGroupAvailabilityHint,
  getSourceGroupAvailabilityState,
  getSourceGroupDisplayName,
  deriveRequestPreviewModel,
  isRequestSubmitDisabled,
  handleExerciseTypeChange,
  handleSourceGroupChange,
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

  describe("Sprint 049 - Category Browse support", () => {
    describe("RequestAccountExerciseRunRequestSchema schema discrimination", () => {
      it("accepts valid AMBIENT_ACCOUNT request and rejects unknown/target fields", () => {
        const validAmbient = {
          profileId: "profile-1",
          stageAtStart: "NEW_ACCOUNT",
          exerciseType: "AMBIENT_ACCOUNT",
          maxDurationMs: 60000,
          maxScrolls: 5,
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(validAmbient).success).toBe(true);

        const invalidAmbient = {
          ...validAmbient,
          sourceGroupId: "source-1",
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(invalidAmbient).success).toBe(false);
      });

      it("accepts CATEGORY_BROWSE request with sourceGroupId and optional entryRouteId", () => {
        const validCategory = {
          profileId: "profile-1",
          stageAtStart: "NEW_ACCOUNT",
          exerciseType: "CATEGORY_BROWSE",
          sourceGroupId: "source-1",
          maxDurationMs: 60000,
          maxScrolls: 5,
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(validCategory).success).toBe(true);

        const withRoute = {
          ...validCategory,
          entryRouteId: "route-1",
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(withRoute).success).toBe(true);

        const withoutSource = {
          ...validCategory,
          sourceGroupId: undefined,
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(withoutSource).success).toBe(false);
      });

      it("preserves compatibility with ambient requests that omit exerciseType", () => {
        const omittedType = {
          profileId: "profile-1",
          stageAtStart: "NEW_ACCOUNT",
          maxDurationMs: 60000,
          maxScrolls: 5,
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(omittedType).success).toBe(true);
      });

      it("rejects unknown fields via strict evaluation", () => {
        const withUnknown = {
          profileId: "profile-1",
          stageAtStart: "NEW_ACCOUNT",
          maxDurationMs: 60000,
          maxScrolls: 5,
          unknownField: "yes",
        };
        expect(RequestAccountExerciseRunRequestSchema.safeParse(withUnknown).success).toBe(false);
      });
    });

    describe("toRequestAccountExerciseRunRequest request builder", () => {
      it("builds correct request for Ambient (emits no target fields)", () => {
        const values = {
          profileId: "profile-1",
          exerciseType: "AMBIENT_ACCOUNT" as const,
          sourceGroupId: "",
          entryRouteId: "",
          maxDurationMs: "",
          maxScrolls: "",
          minDwellMs: "",
        };
        const request = toRequestAccountExerciseRunRequest(
          RequestAccountExerciseRunFormSchema.parse(values),
          createProfileSummary({ accountStage: "WARMING" })
        );
        expect(request).toEqual({
          profileId: "profile-1",
          stageAtStart: "WARMING",
          maxDurationMs: 120000,
          maxScrolls: 2,
        });
        expect((request as any).sourceGroupId).toBeUndefined();
        expect((request as any).entryRouteId).toBeUndefined();
      });

      it("builds correct request for Category Browse", () => {
        const values = {
          profileId: "profile-1",
          exerciseType: "CATEGORY_BROWSE" as const,
          sourceGroupId: "source-1",
          entryRouteId: "route-1",
          maxDurationMs: "60000",
          maxScrolls: "10",
          minDwellMs: "",
        };
        const request = toRequestAccountExerciseRunRequest(
          RequestAccountExerciseRunFormSchema.parse(values),
          createProfileSummary({ accountStage: "COLLECTION_READY" })
        );
        expect(request).toEqual({
          profileId: "profile-1",
          stageAtStart: "COLLECTION_READY",
          exerciseType: "CATEGORY_BROWSE",
          sourceGroupId: "source-1",
          entryRouteId: "route-1",
          maxDurationMs: 60000,
          maxScrolls: 10,
        });
      });

      it("omits entryRouteId when it is blank/empty", () => {
        const values = {
          profileId: "profile-1",
          exerciseType: "CATEGORY_BROWSE" as const,
          sourceGroupId: "source-1",
          entryRouteId: "   ",
          maxDurationMs: "60000",
          maxScrolls: "10",
          minDwellMs: "",
        };
        const request = toRequestAccountExerciseRunRequest(
          RequestAccountExerciseRunFormSchema.parse(values),
          createProfileSummary({ accountStage: "COLLECTION_READY" })
        );
        expect((request as any).entryRouteId).toBeUndefined();
      });
    });

    describe("Form validation rules", () => {
      it("validates Ambient form values correctly", () => {
        const validValues = {
          profileId: "profile-1",
          exerciseType: "AMBIENT_ACCOUNT" as const,
          sourceGroupId: "",
          entryRouteId: "",
          maxDurationMs: "",
          maxScrolls: "",
          minDwellMs: "",
        };
        expect(RequestAccountExerciseRunFormSchema.safeParse(validValues).success).toBe(true);

        const invalidValues = {
          ...validValues,
          sourceGroupId: "source-1",
        };
        expect(RequestAccountExerciseRunFormSchema.safeParse(invalidValues).success).toBe(false);
      });

      it("validates Category Browse form values correctly", () => {
        const validValues = {
          profileId: "profile-1",
          exerciseType: "CATEGORY_BROWSE" as const,
          sourceGroupId: "source-1",
          entryRouteId: "",
          maxDurationMs: "",
          maxScrolls: "",
          minDwellMs: "",
        };
        expect(RequestAccountExerciseRunFormSchema.safeParse(validValues).success).toBe(true);

        const invalidValues = {
          ...validValues,
          sourceGroupId: "",
        };
        expect(RequestAccountExerciseRunFormSchema.safeParse(invalidValues).success).toBe(false);
      });
    });

    describe("Extracted View-Model Helpers", () => {
      it("deriveEligibleCategoryBrowseRoutes filters correctly", () => {
        const routes = [
          { id: "r1", type: "CATEGORY_ENTRY_URL", url: "url1", riskLevel: "LOW" },
          { id: "r2", type: "CATEGORY_ENTRY_URL", url: "url2", riskLevel: "MEDIUM" },
          { id: "r3", type: "CATEGORY_ENTRY_URL", url: "url3", riskLevel: "HIGH" },
          { id: "r4", type: "DIRECT_GROUP_URL", url: "url4", riskLevel: "LOW" },
        ];
        const result = deriveEligibleCategoryBrowseRoutes(routes);
        expect(result).toHaveLength(2);
        const [first, second] = result;
        expect(first?.id).toBe("r1");
        expect(second?.id).toBe("r2");
      });

      it("getSourceGroupAvailabilityState & getSourceGroupAvailabilityHint handles different route availabilities", () => {
        // No category route at all
        const noCategoryRoutes = [
          { id: "r1", type: "DIRECT_GROUP_URL", url: "url1", riskLevel: "LOW" },
        ];
        expect(getSourceGroupAvailabilityState(noCategoryRoutes)).toBe("NO_CATEGORY_ROUTE");
        expect(getSourceGroupAvailabilityHint(noCategoryRoutes)).toBe("no Category Browse route");

        // High risk only
        const highRiskOnlyRoutes = [
          { id: "r1", type: "CATEGORY_ENTRY_URL", url: "url1", riskLevel: "HIGH" },
        ];
        expect(getSourceGroupAvailabilityState(highRiskOnlyRoutes)).toBe("HIGH_RISK_ONLY");
        expect(getSourceGroupAvailabilityHint(highRiskOnlyRoutes)).toBe("high-risk-only");

        // Eligible
        const eligibleRoutes = [
          { id: "r1", type: "CATEGORY_ENTRY_URL", url: "url1", riskLevel: "LOW" },
        ];
        expect(getSourceGroupAvailabilityState(eligibleRoutes)).toBe("ELIGIBLE");
        expect(getSourceGroupAvailabilityHint(eligibleRoutes)).toBe("eligible");
      });

      it("getSourceGroupDisplayName enriches name and falls back to categoryId", () => {
        const sg = { name: "Group Name", categoryId: "cat-1" };
        const categoriesById = new Map([["cat-1", { name: "Category Name" }]]);

        // Category found
        expect(getSourceGroupDisplayName(sg, categoriesById)).toBe("Category Name / Group Name");

        // Category not found fallback to categoryId
        expect(getSourceGroupDisplayName(sg, new Map())).toBe("cat-1 / Group Name");
      });

      it("handleExerciseTypeChange and handleSourceGroupChange transition values correctly", () => {
        const values: Record<string, string> = {
          sourceGroupId: "old-sg",
          entryRouteId: "old-er",
        };
        const setValue = (field: string, value: string) => {
          values[field] = value;
        };
        const clearedErrors: string[] = [];
        const clearErrors = (fields: string[]) => {
          clearedErrors.push(...fields);
        };

        handleExerciseTypeChange("AMBIENT_ACCOUNT", setValue, clearErrors);
        expect(values.sourceGroupId).toBe("");
        expect(values.entryRouteId).toBe("");
        expect(clearedErrors).toContain("sourceGroupId");
        expect(clearedErrors).toContain("entryRouteId");

        values.entryRouteId = "old-er";
        handleSourceGroupChange(setValue);
        expect(values.entryRouteId).toBe("");
      });

      it("isRequestSubmitDisabled handles submission blocks and failures correctly", () => {
        // Ambient remains enabled even if source groups fail or are missing
        expect(isRequestSubmitDisabled({
          exerciseType: "AMBIENT_ACCOUNT",
          profilesLoading: false,
          hasProfilesError: false,
          hasProfiles: true,
          requestPending: false,
          sourceGroupsPending: false,
          sourceGroupsError: true,
          hasSourceGroups: false,
        })).toBe(false);

        // Category Browse is disabled if source groups query is erroring
        expect(isRequestSubmitDisabled({
          exerciseType: "CATEGORY_BROWSE",
          profilesLoading: false,
          hasProfilesError: false,
          hasProfiles: true,
          requestPending: false,
          sourceGroupsPending: false,
          sourceGroupsError: true,
          hasSourceGroups: true, // cached items present
        })).toBe(true);

        // Category Browse is disabled if source groups query is pending
        expect(isRequestSubmitDisabled({
          exerciseType: "CATEGORY_BROWSE",
          profilesLoading: false,
          hasProfilesError: false,
          hasProfiles: true,
          requestPending: false,
          sourceGroupsPending: true,
          sourceGroupsError: false,
          hasSourceGroups: true,
        })).toBe(true);
      });

      it("deriveRequestPreviewModel derives values for automatic and explicit routes", () => {
        const profileById = new Map([["p1", { displayName: "Profile One" }]]);
        const sourceGroups = [
          {
            id: "sg1",
            name: "Source Group One",
            categoryId: "c1",
            entryRoutes: [
              { id: "r1", type: "CATEGORY_ENTRY_URL", url: "url1", riskLevel: "LOW", label: "Low Route Label" },
            ],
          },
        ];
        const categoriesById = new Map([["c1", { name: "Cat One" }]]);

        // Automatic route selection preview
        const previewAuto = deriveRequestPreviewModel({
          profileId: "p1",
          sourceGroupId: "sg1",
          entryRouteId: "",
          profileById,
          sourceGroups,
          categoriesById,
        });
        expect(previewAuto).toEqual({
          profileName: "Profile One",
          categoryName: "Cat One",
          sourceGroupName: "Source Group One",
          routeName: "Auto-select safest eligible route",
        });

        // Explicit route selection preview
        const previewExplicit = deriveRequestPreviewModel({
          profileId: "p1",
          sourceGroupId: "sg1",
          entryRouteId: "r1",
          profileById,
          sourceGroups,
          categoriesById,
        });
        expect(previewExplicit).toEqual({
          profileName: "Profile One",
          categoryName: "Cat One",
          sourceGroupName: "Source Group One",
          routeName: "LOW - Low Route Label",
        });
      });
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
    authenticationHealth: "NOT_PROVISIONED",
    authenticationHealthUpdatedAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}
