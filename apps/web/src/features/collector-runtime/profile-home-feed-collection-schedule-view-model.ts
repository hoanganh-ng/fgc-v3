import { z } from "zod";
import type {
  ProfileHomeFeedCollectionSchedule,
  UpsertProfileHomeFeedCollectionScheduleRequest,
} from "@/lib/api/collector-runtime-client";
import { apiErrorToMessage, type ApiResult } from "@/lib/api/http-client";

export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 10080;

const ProfileIdSchema = z
  .string()
  .trim()
  .min(1, "Profile is required.");

const IntervalStringSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Interval is required.",
      });
      return z.NEVER;
    }
    if (!/^\d+$/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Interval must be a positive whole number of minutes.",
      });
      return z.NEVER;
    }
    const parsed = Number(value);
    if (
      !Number.isInteger(parsed) ||
      parsed < MIN_INTERVAL_MINUTES ||
      parsed > MAX_INTERVAL_MINUTES
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes.`,
      });
      return z.NEVER;
    }
    return parsed;
  })
  .pipe(z.number().int().min(MIN_INTERVAL_MINUTES).max(MAX_INTERVAL_MINUTES));

const PositiveIntegerStringSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) {
      return undefined;
    }
    if (!/^\d+$/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Value must be a positive whole number.",
      });
      return z.NEVER;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Value must be a non-negative whole number.",
      });
      return z.NEVER;
    }
    return parsed;
  })
  .pipe(z.number().int().min(0).optional());

const PositiveDurationStringSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) {
      return undefined;
    }
    if (!/^\d+$/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Duration must be a positive whole number of milliseconds.",
      });
      return z.NEVER;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Duration must be a positive whole number of milliseconds.",
      });
      return z.NEVER;
    }
    return parsed;
  })
  .pipe(z.number().int().min(1).optional());

const PositivePostsStringSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) {
      return undefined;
    }
    if (!/^\d+$/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Post limit must be a positive whole number.",
      });
      return z.NEVER;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Post limit must be a positive whole number.",
      });
      return z.NEVER;
    }
    return parsed;
  })
  .pipe(z.number().int().min(1).optional());

export const UpsertProfileHomeFeedCollectionScheduleFormSchema = z
  .object({
    profileId: ProfileIdSchema,
    enabled: z.boolean(),
    intervalMinutes: IntervalStringSchema,
    nextRunAtLocal: z
      .string()
      .trim()
      .min(1, "Next run is required."),
    maxScrolls: PositiveIntegerStringSchema,
    maxDurationMs: PositiveDurationStringSchema,
    maxPosts: PositivePostsStringSchema,
  })
  .strict();

export type UpsertProfileHomeFeedCollectionScheduleFormValues = z.input<
  typeof UpsertProfileHomeFeedCollectionScheduleFormSchema
>;
export type ParsedUpsertProfileHomeFeedCollectionScheduleFormValues = z.output<
  typeof UpsertProfileHomeFeedCollectionScheduleFormSchema
>;

export function toLocalDateTimeInputValue(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function toIsoDateTimeWithOffset(localDateTimeValue: string): string {
  const date = new Date(localDateTimeValue);
  if (Number.isNaN(date.getTime())) {
    return localDateTimeValue;
  }
  return date.toISOString();
}

export function formatLocalDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatLocalDateTimeSeconds(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export function toUpsertProfileHomeFeedCollectionScheduleRequest(
  values: ParsedUpsertProfileHomeFeedCollectionScheduleFormValues,
): UpsertProfileHomeFeedCollectionScheduleRequest {
  const request: UpsertProfileHomeFeedCollectionScheduleRequest = {
    enabled: values.enabled,
    intervalMinutes: values.intervalMinutes,
    nextRunAt: toIsoDateTimeWithOffset(values.nextRunAtLocal),
  };
  if (values.maxScrolls !== undefined) {
    request.maxScrolls = values.maxScrolls;
  }
  if (values.maxDurationMs !== undefined) {
    request.maxDurationMs = values.maxDurationMs;
  }
  if (values.maxPosts !== undefined) {
    request.maxPosts = values.maxPosts;
  }
  return request;
}

export function profileHomeFeedScheduleToFormValues(
  schedule: ProfileHomeFeedCollectionSchedule,
): UpsertProfileHomeFeedCollectionScheduleFormValues {
  return {
    profileId: schedule.profileId,
    enabled: schedule.enabled,
    intervalMinutes: String(schedule.intervalMinutes),
    nextRunAtLocal: toLocalDateTimeInputValue(schedule.nextRunAt),
    maxScrolls:
      schedule.parameters.maxScrolls !== undefined
        ? String(schedule.parameters.maxScrolls)
        : "",
    maxDurationMs:
      schedule.parameters.maxDurationMs !== undefined
        ? String(schedule.parameters.maxDurationMs)
        : "",
    maxPosts:
      schedule.parameters.maxPosts !== undefined
        ? String(schedule.parameters.maxPosts)
        : "",
  };
}

export function emptyProfileHomeFeedScheduleFormValues(
  profileId = "",
): UpsertProfileHomeFeedCollectionScheduleFormValues {
  return {
    profileId,
    enabled: true,
    intervalMinutes: "",
    nextRunAtLocal: "",
    maxScrolls: "",
    maxDurationMs: "",
    maxPosts: "",
  };
}

export type ProfileHomeFeedCreateScheduleConflictCheckResult =
  | { readonly status: "not_found" }
  | { readonly status: "exists" }
  | { readonly status: "error"; readonly message: string };

export function checkCreateProfileHomeFeedScheduleConflict(
  profileId: string,
  fetchSchedule: () => Promise<ApiResult<unknown>>,
): Promise<ProfileHomeFeedCreateScheduleConflictCheckResult> {
  return (async (): Promise<ProfileHomeFeedCreateScheduleConflictCheckResult> => {
    const result = await fetchSchedule();

    if (result.ok) {
      return { status: "exists" };
    }

    if (result.error.kind === "http" && result.error.status === 404) {
      return { status: "not_found" };
    }

    return {
      status: "error",
      message: apiErrorToMessage(result.error),
    };
  })();
}

export const CREATE_PROFILE_HOME_FEED_SCHEDULE_CONFLICT_EXISTS_MESSAGE =
  "A schedule already exists for this profile. Use Edit to modify it.";

export type ProfileHomeFeedScheduleSubmitOutcome =
  | { readonly status: "submit" }
  | { readonly status: "exists"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

export async function resolveProfileHomeFeedScheduleSubmit({
  mode,
  profileId,
  fetchSchedule,
}: {
  readonly mode: "create" | "edit";
  readonly profileId: string;
  readonly fetchSchedule: () => Promise<ApiResult<unknown>>;
}): Promise<ProfileHomeFeedScheduleSubmitOutcome> {
  if (mode === "edit") {
    return { status: "submit" };
  }

  const conflict = await checkCreateProfileHomeFeedScheduleConflict(
    profileId,
    fetchSchedule,
  );

  if (conflict.status === "not_found") {
    return { status: "submit" };
  }

  if (conflict.status === "exists") {
    return {
      status: "exists",
      message: CREATE_PROFILE_HOME_FEED_SCHEDULE_CONFLICT_EXISTS_MESSAGE,
    };
  }

  return {
    status: "error",
    message: `Could not verify that no schedule exists for this profile. ${conflict.message}`,
  };
}