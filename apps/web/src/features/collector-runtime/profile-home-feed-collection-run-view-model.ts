import { z } from "zod";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunStatus,
  ProfileHomeFeedDiagnosticFailureStage,
  ProfileHomeFeedDiagnosticSummary,
  ProfileHomeFeedDiagnosticWarningCode,
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

export interface ProfileHomeFeedDiagnosticRow {
  readonly label: string;
  readonly value: string;
}

export interface ProfileHomeFeedDiagnosticWarningRow {
  readonly code: ProfileHomeFeedDiagnosticWarningCode;
  readonly label: string;
  readonly count: number;
}

const PROFILE_HOME_FEED_WARNING_LABELS: Record<
  ProfileHomeFeedDiagnosticWarningCode,
  string
> = {
  DUPLICATE_POST_CANDIDATE: "Duplicate post candidate",
  EXCLUDED_PERSONAL_PROFILE_POST: "Excluded personal profile post",
  EXCLUDED_SPONSORED_POST: "Excluded sponsored post",
  MISSING_OPTIONAL_AUTHOR: "Missing optional author",
  MISSING_POSTED_AT: "Missing posted at",
  MISSING_SOURCE_URL: "Missing source URL",
  MISSING_STABLE_PUBLISHER_ID: "Missing stable publisher id",
  SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT: "Skipped post without body text",
  SKIPPED_CANDIDATE_WITHOUT_POST_ID: "Skipped post without post id",
  SKIPPED_COMMENT_WITHOUT_BODY_TEXT: "Skipped comment without body text",
  SKIPPED_COMMENT_WITHOUT_ID: "Skipped comment without id",
  UNKNOWN_PUBLISHER_KIND: "Unknown publisher kind",
  UNSUPPORTED_PAYLOAD_SHAPE: "Unsupported payload shape",
};

const PROFILE_HOME_FEED_CAPTURE_STAGE_LABELS: Record<
  NonNullable<ProfileHomeFeedDiagnosticSummary["captureStage"]>,
  string
> = {
  NOT_STARTED: "Capture not started",
  IN_PROGRESS: "Capture in progress",
  SUCCEEDED: "Capture succeeded",
  CAPTURE_FAILED: "Capture failed",
  INTERRUPTED: "Capture interrupted",
};

const PROFILE_HOME_FEED_FAILURE_STAGE_LABELS: Record<
  ProfileHomeFeedDiagnosticFailureStage,
  string
> = {
  BOUNDS_EXCEEDED: "Execution bounds exceeded",
  CHECKOUT: "Profile checkout",
  CAPTURE: "Browser capture",
  PUBLISHER_OBSERVATION: "Source publisher observation",
  CONTENT_SUBMISSION: "Content submission",
  LEASE_RELEASE: "Profile lease release",
  PARTIAL: "Partial completion",
  INTERRUPTED: "Execution interrupted",
  EXECUTION: "Execution error",
};

export function formatProfileHomeFeedDiagnosticWarningCode(
  code: ProfileHomeFeedDiagnosticWarningCode,
): string {
  return PROFILE_HOME_FEED_WARNING_LABELS[code];
}

export function getProfileHomeFeedDiagnosticCaptureStageLabel(
  stage: NonNullable<ProfileHomeFeedDiagnosticSummary["captureStage"]>,
): string {
  return PROFILE_HOME_FEED_CAPTURE_STAGE_LABELS[stage];
}

export function getProfileHomeFeedDiagnosticFailureStageLabel(
  stage: ProfileHomeFeedDiagnosticFailureStage,
): string {
  return PROFILE_HOME_FEED_FAILURE_STAGE_LABELS[stage];
}

export function getProfileHomeFeedDiagnosticCaptureCounters(
  diagnostics: ProfileHomeFeedDiagnosticSummary,
): readonly ProfileHomeFeedDiagnosticRow[] {
  if (diagnostics.capture === undefined) {
    return [];
  }
  const capture = diagnostics.capture;
  const rows: ProfileHomeFeedDiagnosticRow[] = [];
  if (capture.pageContextFetchCaptureCount !== undefined) {
    rows.push({
      label: "Page context fetch captures",
      value: String(capture.pageContextFetchCaptureCount),
    });
  }
  if (capture.pageContextXhrCaptureCount !== undefined) {
    rows.push({
      label: "Page context XHR captures",
      value: String(capture.pageContextXhrCaptureCount),
    });
  }
  if (capture.networkListenerCaptureCount !== undefined) {
    rows.push({
      label: "Network listener captures",
      value: String(capture.networkListenerCaptureCount),
    });
  }
  if (capture.parseFailureCount !== undefined) {
    rows.push({
      label: "Capture parse failures",
      value: String(capture.parseFailureCount),
    });
  }
  if (capture.totalPayloadsPassedToExtractor !== undefined) {
    rows.push({
      label: "Payloads passed to extractor",
      value: String(capture.totalPayloadsPassedToExtractor),
    });
  }
  return rows;
}

export function getProfileHomeFeedDiagnosticExtractorCounters(
  diagnostics: ProfileHomeFeedDiagnosticSummary,
): readonly ProfileHomeFeedDiagnosticRow[] {
  if (diagnostics.extractor === undefined) {
    return [];
  }
  const extractor = diagnostics.extractor;
  const rows: ProfileHomeFeedDiagnosticRow[] = [];
  if (extractor.extractedCandidateCount !== undefined) {
    rows.push({
      label: "Extracted candidates",
      value: String(extractor.extractedCandidateCount),
    });
  }
  if (extractor.deduplicatedCandidateCount !== undefined) {
    rows.push({
      label: "After extractor dedup",
      value: String(extractor.deduplicatedCandidateCount),
    });
  }
  return rows;
}

export function getProfileHomeFeedDiagnosticWarningRows(
  diagnostics: ProfileHomeFeedDiagnosticSummary,
): readonly ProfileHomeFeedDiagnosticWarningRow[] {
  if (diagnostics.warningCounts === undefined) {
    return [];
  }
  return Object.entries(diagnostics.warningCounts)
    .filter(
      (entry): entry is [ProfileHomeFeedDiagnosticWarningCode, number] =>
        entry[0] !== "" &&
        typeof entry[1] === "number" &&
        Number.isInteger(entry[1]) &&
        entry[1] > 0,
    )
    .map(([code, count]) => ({
      code,
      label: formatProfileHomeFeedDiagnosticWarningCode(code),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export function hasProfileHomeFeedDiagnosticData(
  diagnostics: ProfileHomeFeedDiagnosticSummary,
): boolean {
  return (
    diagnostics.capture !== undefined ||
    diagnostics.captureStage !== undefined ||
    diagnostics.captureFinalPageUrl !== undefined ||
    diagnostics.captureLoginRedirectSuspected !== undefined ||
    diagnostics.extractor !== undefined ||
    (diagnostics.warningCounts !== undefined &&
      Object.keys(diagnostics.warningCounts).length > 0) ||
    diagnostics.unsupportedPayloadCount !== undefined ||
    diagnostics.runOutcome !== undefined
  );
}
