import { z } from "zod";
import type {
  AccountExerciseRun,
  AccountExerciseRunStatus,
  RequestAccountExerciseRunRequest,
} from "@/lib/api/collector-runtime-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";

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
    maxDurationMs: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : Number(value)))
      .pipe(z.number().int().min(1).optional()),
    maxScrolls: OptionalNonNegativeIntegerStringSchema,
    minDwellMs: OptionalNonNegativeIntegerStringSchema,
  })
  .strict();

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
  return {
    profileId: values.profileId,
    stageAtStart: profile.accountStage,
    maxDurationMs:
      values.maxDurationMs ?? DEFAULT_ACCOUNT_EXERCISE_MAX_DURATION_MS,
    maxScrolls: values.maxScrolls ?? DEFAULT_ACCOUNT_EXERCISE_MAX_SCROLLS,
    ...(values.minDwellMs !== undefined
      ? { minDwellMs: values.minDwellMs }
      : {}),
  };
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
