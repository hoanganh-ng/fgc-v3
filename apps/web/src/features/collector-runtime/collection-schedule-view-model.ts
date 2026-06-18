import { z } from "zod";
import type {
  CollectionSchedule,
  CollectionScheduleParameters,
  UpsertCollectionScheduleRequest,
} from "@/lib/api/collector-runtime-client";
import type { SourceGroup } from "@/lib/api/content-manager-client";
import { apiErrorToMessage, type ApiResult } from "@/lib/api/http-client";

export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 10080;

const SourceGroupIdSchema = z.string().trim().min(1, "Source group is required.");

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

export const UpsertCollectionScheduleFormSchema = z
  .object({
    sourceGroupId: SourceGroupIdSchema,
    enabled: z.boolean(),
    intervalMinutes: IntervalStringSchema,
    nextRunAtLocal: z
      .string()
      .trim()
      .min(1, "Next run is required."),
    maxScrolls: PositiveIntegerStringSchema,
    maxDurationMs: PositiveDurationStringSchema,
  })
  .strict();

export type UpsertCollectionScheduleFormValues = z.input<
  typeof UpsertCollectionScheduleFormSchema
>;
export type ParsedUpsertCollectionScheduleFormValues = z.output<
  typeof UpsertCollectionScheduleFormSchema
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

function buildParameters(
  values: ParsedUpsertCollectionScheduleFormValues,
): CollectionScheduleParameters {
  const result: { maxScrolls?: number; maxDurationMs?: number } = {};
  if (values.maxScrolls !== undefined) {
    result.maxScrolls = values.maxScrolls;
  }
  if (values.maxDurationMs !== undefined) {
    result.maxDurationMs = values.maxDurationMs;
  }
  return result;
}

export function toUpsertCollectionScheduleRequest(
  values: ParsedUpsertCollectionScheduleFormValues,
): UpsertCollectionScheduleRequest {
  return {
    enabled: values.enabled,
    intervalMinutes: values.intervalMinutes,
    nextRunAt: toIsoDateTimeWithOffset(values.nextRunAtLocal),
    parameters: buildParameters(values),
  };
}

export function scheduleToFormValues(
  schedule: CollectionSchedule,
): UpsertCollectionScheduleFormValues {
  return {
    sourceGroupId: schedule.sourceGroupId,
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
  };
}

export function emptyScheduleFormValues(
  sourceGroupId = "",
): UpsertCollectionScheduleFormValues {
  return {
    sourceGroupId,
    enabled: true,
    intervalMinutes: "",
    nextRunAtLocal: "",
    maxScrolls: "",
    maxDurationMs: "",
  };
}

export function filterSchedulableSourceGroups(
  sourceGroups: readonly SourceGroup[],
): SourceGroup[] {
  return sourceGroups
    .filter(
      (sourceGroup) =>
        sourceGroup.platform === "FACEBOOK" &&
        (sourceGroup.status === "ACTIVE" ||
          sourceGroup.status === "PAUSED" ||
          sourceGroup.status === "ARCHIVED"),
    )
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function excludeScheduledSourceGroups(
  sourceGroups: readonly SourceGroup[],
  scheduledSourceGroupIds: ReadonlySet<string>,
): SourceGroup[] {
  if (scheduledSourceGroupIds.size === 0) {
    return sourceGroups.slice();
  }
  return sourceGroups.filter((group) => !scheduledSourceGroupIds.has(group.id));
}

export function findSourceGroupById<
  TSourceGroup extends { readonly id: string },
>(
  sourceGroups: readonly TSourceGroup[],
  sourceGroupId: string,
): TSourceGroup | undefined {
  return sourceGroups.find((group) => group.id === sourceGroupId);
}

export type CreateScheduleConflictCheckResult =
  | { readonly status: "not_found" }
  | { readonly status: "exists" }
  | { readonly status: "error"; readonly message: string };

/**
 * Probe a source-group id against the existing schedule resource before
 * permitting a Create submission. The check is independent of the current
 * paginated list page so a schedule that lives on another page still
 * blocks the create.
 */
export async function checkCreateScheduleConflict(
  sourceGroupId: string,
  fetchSchedule: () => Promise<ApiResult<unknown>>,
): Promise<CreateScheduleConflictCheckResult> {
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
}

export const CREATE_SCHEDULE_CONFLICT_EXISTS_MESSAGE =
  "A schedule already exists for this source group. Use Edit to modify it.";

export type ScheduleSubmitOutcome =
  | { readonly status: "submit" }
  | { readonly status: "exists"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

/**
 * Decide whether a Create or Edit submission may proceed. The Create
 * branch performs an independent GET against the existing schedule
 * resource so a schedule that lives outside the current paginated list
 * page still blocks the create. Edit skips the conflict probe.
 */
export async function resolveScheduleSubmit({
  mode,
  sourceGroupId,
  fetchSchedule,
}: {
  readonly mode: "create" | "edit";
  readonly sourceGroupId: string;
  readonly fetchSchedule: () => Promise<ApiResult<unknown>>;
}): Promise<ScheduleSubmitOutcome> {
  if (mode === "edit") {
    return { status: "submit" };
  }

  const conflict = await checkCreateScheduleConflict(
    sourceGroupId,
    fetchSchedule,
  );

  if (conflict.status === "not_found") {
    return { status: "submit" };
  }

  if (conflict.status === "exists") {
    return {
      status: "exists",
      message: CREATE_SCHEDULE_CONFLICT_EXISTS_MESSAGE,
    };
  }

  return {
    status: "error",
    message: `Could not verify that no schedule exists for this source group. ${conflict.message}`,
  };
}
