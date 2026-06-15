import { z } from "zod";
import type {
  AccountExerciseRun,
  AccountExerciseRunStatus,
  RequestAccountExerciseRunRequest,
} from "@/lib/api/collector-runtime-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";
import type {
  SourceGroup,
  SourceGroupEntryRoute,
} from "@/lib/api/content-manager-client";

export const DEFAULT_ACCOUNT_EXERCISE_MAX_DURATION_MS = 120_000;
export const DEFAULT_ACCOUNT_EXERCISE_MAX_SCROLLS = 2;

const OptionalNonNegativeIntegerStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : Number(value)))
  .pipe(z.number().int().min(0).optional());

export const RequestAccountExerciseRunFormSchema = z
  .object({
    profileId: z.string().trim().min(1, "Profile is required."),
    exerciseType: z.enum(["AMBIENT_ACCOUNT", "CATEGORY_BROWSE"]).optional(),
    sourceGroupId: z.string().trim().optional(),
    entryRouteId: z.string().trim().optional(),
    maxDurationMs: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : Number(value)))
      .pipe(z.number().int().min(1).optional()),
    maxScrolls: OptionalNonNegativeIntegerStringSchema,
    minDwellMs: OptionalNonNegativeIntegerStringSchema,
  })
  .strict()
  .superRefine((values, context) => {
    const exerciseType = values.exerciseType ?? "AMBIENT_ACCOUNT";
    if (exerciseType === "CATEGORY_BROWSE") {
      if (values.sourceGroupId === undefined || values.sourceGroupId.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceGroupId"],
          message: "Source group is required for Category Browse.",
        });
      }
    } else {
      // AMBIENT_ACCOUNT
      if (values.sourceGroupId !== undefined && values.sourceGroupId.trim().length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceGroupId"],
          message: "Ambient account exercise runs must not include sourceGroupId.",
        });
      }
      if (values.entryRouteId !== undefined && values.entryRouteId.trim().length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entryRouteId"],
          message: "Ambient account exercise runs must not include entryRouteId.",
        });
      }
    }
  });

export type RequestAccountExerciseRunFormValues = z.input<
  typeof RequestAccountExerciseRunFormSchema
>;
export type ParsedRequestAccountExerciseRunFormValues = z.output<
  typeof RequestAccountExerciseRunFormSchema
>;

export interface PaginationInput {
  readonly offset: number;
  readonly limit: number;
  readonly itemCount: number;
  readonly total?: number | undefined;
}

export interface VisibleRange {
  readonly start: number;
  readonly end: number;
}

export interface PaginationModel {
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  readonly visibleRange: VisibleRange | undefined;
}

export interface ProfileDisplay {
  readonly primary: string;
  readonly secondary: string;
  readonly found: boolean;
}

export function hasActiveAccountExerciseRuns(
  runs: readonly Pick<AccountExerciseRun, "status">[],
): boolean {
  return runs.some((run) => run.status === "QUEUED" || run.status === "RUNNING");
}

export function canCancelAccountExerciseRun(
  status: AccountExerciseRunStatus,
): boolean {
  return status === "QUEUED";
}

export function getVisibleRange({
  offset,
  itemCount,
}: Pick<PaginationInput, "offset" | "itemCount">): VisibleRange | undefined {
  if (itemCount === 0) {
    return undefined;
  }

  return {
    start: offset + 1,
    end: offset + itemCount,
  };
}

export function getPaginationModel(input: PaginationInput): PaginationModel {
  const visibleRange = getVisibleRange(input);
  const canGoNext =
    input.total !== undefined
      ? input.offset + input.itemCount < input.total
      : input.itemCount >= input.limit;

  return {
    canGoBack: input.offset > 0,
    canGoNext,
    visibleRange,
  };
}

export function shouldShowPaginationControls(input: PaginationInput): boolean {
  if (input.offset > 0 || input.itemCount > 0) {
    return true;
  }

  return getPaginationModel(input).canGoNext;
}

export function toRequestAccountExerciseRunRequest(
  values: ParsedRequestAccountExerciseRunFormValues,
  profile: Pick<ProfileSummary, "accountStage">,
): RequestAccountExerciseRunRequest {
  const base = {
    profileId: values.profileId,
    stageAtStart: profile.accountStage,
    maxDurationMs:
      values.maxDurationMs ?? DEFAULT_ACCOUNT_EXERCISE_MAX_DURATION_MS,
    maxScrolls: values.maxScrolls ?? DEFAULT_ACCOUNT_EXERCISE_MAX_SCROLLS,
    ...(values.minDwellMs !== undefined
      ? { minDwellMs: values.minDwellMs }
      : {}),
  };

  const exerciseType = values.exerciseType ?? "AMBIENT_ACCOUNT";

  if (exerciseType === "CATEGORY_BROWSE") {
    return {
      ...base,
      exerciseType: "CATEGORY_BROWSE",
      sourceGroupId: values.sourceGroupId!,
      ...(values.entryRouteId && values.entryRouteId.trim().length > 0
        ? { entryRouteId: values.entryRouteId }
        : {}),
    };
  }

  return base;
}

export function getProfileDisplay(
  profileId: string,
  profileById: ReadonlyMap<string, ProfileSummary>,
): ProfileDisplay {
  const profile = profileById.get(profileId);

  if (profile === undefined) {
    return {
      primary: profileId,
      secondary: "Profile details unavailable",
      found: false,
    };
  }

  return {
    primary: profile.displayName,
    secondary: `${profile.id} / ${profile.status} / ${profile.accountStage}`,
    found: true,
  };
}

export interface SourceGroupRoute {
  readonly id: string;
  readonly type: string;
  readonly url: string;
  readonly riskLevel: string;
  readonly label?: string | null | undefined;
}

export type SourceGroupAvailabilityState = "ELIGIBLE" | "NO_CATEGORY_ROUTE" | "HIGH_RISK_ONLY";

export interface RequestPreviewModel {
  readonly profileName: string;
  readonly categoryName: string;
  readonly sourceGroupName: string;
  readonly routeName: string;
}

/**
 * Filter routes: only CATEGORY_ENTRY_URL types and LOW/MEDIUM risk levels.
 */
export function deriveEligibleCategoryBrowseRoutes(
  entryRoutes: readonly SourceGroupRoute[],
): SourceGroupRoute[] {
  return entryRoutes.filter(
    (route) =>
      route.type === "CATEGORY_ENTRY_URL" &&
      (route.riskLevel === "LOW" || route.riskLevel === "MEDIUM"),
  );
}

/**
 * Derives availability state for source group options.
 */
export function getSourceGroupAvailabilityState(
  entryRoutes: readonly SourceGroupRoute[],
): SourceGroupAvailabilityState {
  const hasCategoryBrowseRoute = entryRoutes.some(
    (r) => r.type === "CATEGORY_ENTRY_URL",
  );
  if (!hasCategoryBrowseRoute) {
    return "NO_CATEGORY_ROUTE";
  }
  const hasLowOrMediumRisk = entryRoutes.some(
    (r) =>
      r.type === "CATEGORY_ENTRY_URL" &&
      (r.riskLevel === "LOW" || r.riskLevel === "MEDIUM"),
  );
  if (!hasLowOrMediumRisk) {
    return "HIGH_RISK_ONLY";
  }
  return "ELIGIBLE";
}

/**
 * Derives human-readable status hint for a source group option.
 */
export function getSourceGroupAvailabilityHint(
  entryRoutes: readonly SourceGroupRoute[],
): string {
  const state = getSourceGroupAvailabilityState(entryRoutes);
  if (state === "NO_CATEGORY_ROUTE") {
    return "no Category Browse route";
  }
  if (state === "HIGH_RISK_ONLY") {
    return "high-risk-only";
  }
  return "eligible";
}

/**
 * Get source group display name.
 */
export function getSourceGroupDisplayName(
  sourceGroup: { readonly name: string; readonly categoryId: string },
  categoriesById: ReadonlyMap<string, { readonly name: string }>,
): string {
  const categoryName = categoriesById.get(sourceGroup.categoryId)?.name ?? sourceGroup.categoryId;
  return `${categoryName} / ${sourceGroup.name}`;
}

/**
 * Derive human-readable values for the Category Browse request preview.
 */
export function deriveRequestPreviewModel({
  profileId,
  sourceGroupId,
  entryRouteId,
  profileById,
  sourceGroups,
  categoriesById,
}: {
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly entryRouteId: string | undefined;
  readonly profileById: ReadonlyMap<string, { readonly displayName: string }>;
  readonly sourceGroups: readonly {
    readonly id: string;
    readonly name: string;
    readonly categoryId: string;
    readonly entryRoutes: readonly SourceGroupRoute[];
  }[];
  readonly categoriesById: ReadonlyMap<string, { readonly name: string }>;
}): RequestPreviewModel {
  const profile = profileById.get(profileId);
  const profileName = profile?.displayName ?? profileId ?? "(none)";

  const sourceGroup = sourceGroups.find((sg) => sg.id === sourceGroupId);
  const sourceGroupName = sourceGroup?.name ?? "(none)";

  const categoryId = sourceGroup?.categoryId;
  const categoryName = categoryId
    ? (categoriesById.get(categoryId)?.name ?? categoryId)
    : "(none)";

  let routeName = "Auto-select safest eligible route";
  if (entryRouteId && entryRouteId.trim().length > 0) {
    const route = sourceGroup?.entryRoutes.find((r) => r.id === entryRouteId);
    if (route) {
      const label = route.label || route.id;
      routeName = `${route.riskLevel} - ${label}`;
    } else {
      routeName = entryRouteId;
    }
  }

  return {
    profileName,
    categoryName,
    sourceGroupName,
    routeName,
  };
}

/**
 * Computes whether the submit button is disabled.
 */
export function isRequestSubmitDisabled({
  exerciseType,
  profilesLoading,
  hasProfilesError,
  hasProfiles,
  requestPending,
  sourceGroupsPending,
  sourceGroupsError,
  hasSourceGroups,
}: {
  readonly exerciseType: "AMBIENT_ACCOUNT" | "CATEGORY_BROWSE";
  readonly profilesLoading: boolean;
  readonly hasProfilesError: boolean;
  readonly hasProfiles: boolean;
  readonly requestPending: boolean;
  readonly sourceGroupsPending: boolean;
  readonly sourceGroupsError: boolean;
  readonly hasSourceGroups: boolean;
}): boolean {
  if (profilesLoading || hasProfilesError || !hasProfiles || requestPending) {
    return true;
  }
  if (exerciseType === "CATEGORY_BROWSE") {
    return sourceGroupsPending || sourceGroupsError || !hasSourceGroups;
  }
  return false;
}

export function handleExerciseTypeChange(
  newType: "AMBIENT_ACCOUNT" | "CATEGORY_BROWSE",
  setValue: (field: any, value: string) => void,
  clearErrors: (fields: any[]) => void,
): void {
  setValue("sourceGroupId", "");
  setValue("entryRouteId", "");
  clearErrors(["sourceGroupId", "entryRouteId"]);
}

export function handleSourceGroupChange(
  setValue: (field: any, value: string) => void,
): void {
  setValue("entryRouteId", "");
}
