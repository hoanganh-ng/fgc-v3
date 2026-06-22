import { z } from "zod";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunStatus,
  RequestProfileHomeFeedCollectionRunRequest,
} from "@/lib/api/collector-runtime-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";

const OptionalNonNegativeIntegerStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : Number(value)))
  .pipe(z.number().int().min(0).optional());

const OptionalPositiveIntegerStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : Number(value)))
  .pipe(z.number().int().min(1).optional());

export const RequestProfileHomeFeedCollectionRunFormSchema = z
  .object({
    profileId: z.string().trim().min(1, "Profile is required."),
    maxScrolls: OptionalNonNegativeIntegerStringSchema,
    maxDurationMs: OptionalPositiveIntegerStringSchema,
    maxPosts: OptionalPositiveIntegerStringSchema,
  })
  .strict();

export type RequestProfileHomeFeedCollectionRunFormValues = z.input<
  typeof RequestProfileHomeFeedCollectionRunFormSchema
>;
export type ParsedRequestProfileHomeFeedCollectionRunFormValues = z.output<
  typeof RequestProfileHomeFeedCollectionRunFormSchema
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

export function hasActiveProfileHomeFeedCollectionRuns(
  runs: readonly Pick<ProfileHomeFeedCollectionRun, "status">[],
): boolean {
  return runs.some((run) => canCancelProfileHomeFeedCollectionRun(run.status));
}

export function canCancelProfileHomeFeedCollectionRun(
  status: ProfileHomeFeedCollectionRunStatus,
): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

export function filterEligibleProfileHomeFeedRunProfiles<
  TProfile extends Pick<
    ProfileSummary,
    "status" | "accountStage" | "authenticationHealth"
  >,
>(profiles: readonly TProfile[]): TProfile[] {
  return profiles.filter(
    (profile) =>
      profile.status === "READY" &&
      profile.accountStage === "COLLECTION_READY" &&
      profile.authenticationHealth === "HEALTHY",
  );
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

export function toRequestProfileHomeFeedCollectionRunRequest(
  values: ParsedRequestProfileHomeFeedCollectionRunFormValues,
): RequestProfileHomeFeedCollectionRunRequest {
  return {
    profileId: values.profileId,
    ...(values.maxScrolls !== undefined ? { maxScrolls: values.maxScrolls } : {}),
    ...(values.maxDurationMs !== undefined
      ? { maxDurationMs: values.maxDurationMs }
      : {}),
    ...(values.maxPosts !== undefined ? { maxPosts: values.maxPosts } : {}),
  };
}

export function formatProfileHomeFeedRunParameters(
  parameters: ProfileHomeFeedCollectionRun["parameters"],
): string {
  const parts: string[] = [];
  if (parameters.maxScrolls !== undefined) {
    parts.push(`max scrolls: ${parameters.maxScrolls}`);
  }
  if (parameters.maxDurationMs !== undefined) {
    parts.push(`max duration: ${parameters.maxDurationMs} ms`);
  }
  if (parameters.maxPosts !== undefined) {
    parts.push(`max posts: ${parameters.maxPosts}`);
  }
  return parts.length === 0 ? "-" : parts.join(" · ");
}
