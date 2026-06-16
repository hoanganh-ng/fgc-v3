import { z } from "zod";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunStatus,
  ProfileSourceAccessCheckRunOutcome,
  RequestProfileSourceAccessCheckRunRequest,
} from "@/lib/api/collector-runtime-client";
import { type StatusBadgeTone } from "@/components/ui/status-badge";

export const RequestProfileSourceAccessCheckRunFormSchema = z
  .object({
    profileId: z.string().trim().min(1, "Profile is required."),
    sourceGroupId: z.string().trim().min(1, "Source group is required."),
  })
  .strict();

export type RequestProfileSourceAccessCheckRunFormValues = z.input<
  typeof RequestProfileSourceAccessCheckRunFormSchema
>;
export type ParsedRequestProfileSourceAccessCheckRunFormValues = z.output<
  typeof RequestProfileSourceAccessCheckRunFormSchema
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

export interface SourceGroupDisplay {
  readonly primary: string;
  readonly secondary: string;
  readonly found: boolean;
}

export interface OutcomePresentation {
  readonly label: string;
  readonly tone: StatusBadgeTone;
}

export function hasActiveProfileSourceAccessCheckRuns(
  runs: readonly Pick<ProfileSourceAccessCheckRun, "status">[],
): boolean {
  return runs.some((run) => run.status === "QUEUED" || run.status === "RUNNING");
}

export function canCancelProfileSourceAccessCheckRun(
  status: ProfileSourceAccessCheckRunStatus,
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

export function toRequestProfileSourceAccessCheckRunRequest(
  values: ParsedRequestProfileSourceAccessCheckRunFormValues,
): RequestProfileSourceAccessCheckRunRequest {
  return {
    profileId: values.profileId,
    sourceGroupId: values.sourceGroupId,
  };
}

export function getProfileDisplay(
  profileId: string,
  profileById: ReadonlyMap<string, { id: string; displayName: string; status: string; accountStage: string }>,
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

export function getSourceGroupDisplay(
  sourceGroupId: string,
  sourceGroupById: ReadonlyMap<string, { id: string; name: string; platform: string; status: string }>,
): SourceGroupDisplay {
  const sourceGroup = sourceGroupById.get(sourceGroupId);

  if (sourceGroup === undefined) {
    return {
      primary: sourceGroupId,
      secondary: "Source group details unavailable",
      found: false,
    };
  }

  return {
    primary: sourceGroup.name,
    secondary: `${sourceGroup.platform} / ${sourceGroup.status}`,
    found: true,
  };
}

export function getOutcomePresentation(
  outcome: ProfileSourceAccessCheckRunOutcome,
): OutcomePresentation {
  switch (outcome) {
    case "PUBLIC_ACCESSIBLE":
      return { label: "Public Accessible", tone: "success" };
    case "JOIN_REQUIRED":
      return { label: "Join Required", tone: "warning" };
    case "JOINED_ACCESSIBLE":
      return { label: "Joined Accessible", tone: "success" };
    case "ACCESS_DENIED":
      return { label: "Access Denied", tone: "danger" };
    case "LOGIN_REQUIRED":
      return { label: "Login Required", tone: "danger" };
    case "CHECKPOINT_REQUIRED":
      return { label: "Checkpoint Required", tone: "danger" };
    case "NEEDS_MANUAL_REVIEW":
      return { label: "Needs Manual Review", tone: "warning" };
  }
}
