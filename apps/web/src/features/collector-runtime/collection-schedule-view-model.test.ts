import { describe, expect, it } from "vitest";
import {
  CollectionScheduleListResponseSchema,
  CollectionScheduleResponseSchema,
  CollectionScheduleSchema,
  UpsertCollectionScheduleRequestSchema,
  toListCollectionSchedulesQueryParams,
  type CollectionSchedule,
  type CollectionScheduleListResponse,
} from "@/lib/api/collector-runtime-client";
import {
  MAX_INTERVAL_MINUTES,
  UpsertCollectionScheduleFormSchema,
  emptyScheduleFormValues,
  filterSchedulableSourceGroups,
  findSourceGroupById,
  formatLocalDateTime,
  formatLocalDateTimeSeconds,
  scheduleToFormValues,
  toIsoDateTimeWithOffset,
  toLocalDateTimeInputValue,
  toUpsertCollectionScheduleRequest,
} from "@/features/collector-runtime/collection-schedule-view-model";
import type { SourceGroup } from "@/lib/api/content-manager-client";

const timestamp = "2026-06-15T12:30:00.000Z";

function createSchedule(
  overrides: Partial<CollectionSchedule> = {},
): CollectionSchedule {
  return {
    sourceGroupId: "sg-1",
    enabled: true,
    intervalMinutes: 30,
    nextRunAt: timestamp,
    parameters: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createSourceGroup(overrides: Partial<SourceGroup> = {}): SourceGroup {
  return {
    id: overrides.id ?? "sg-1",
    platform: "FACEBOOK",
    externalGroupId: "ext-1",
    name: overrides.name ?? "Group One",
    url: "https://www.facebook.com/groups/group-one",
    categoryId: "cat-1",
    status: overrides.status ?? "ACTIVE",
    collectionPriority: 50,
    entryRoutes: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("collection-schedule view-model", () => {
  it("uses strict collection-schedule schemas", () => {
    const listWithExtra = CollectionScheduleListResponseSchema.safeParse({
      items: [createSchedule()],
      page: { limit: 50, offset: 0 },
      unexpected: true,
    });
    const responseWithExtra = CollectionScheduleResponseSchema.safeParse({
      collectionSchedule: { ...createSchedule(), unexpected: true },
    });
    const scheduleWithExtra = CollectionScheduleSchema.safeParse({
      ...createSchedule(),
      unexpected: true,
    });

    expect(listWithExtra.success).toBe(false);
    expect(responseWithExtra.success).toBe(false);
    expect(scheduleWithExtra.success).toBe(false);
  });

  it("validates a strict upsert request", () => {
    expect(
      UpsertCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "not-iso",
      }).success,
    ).toBe(false);

    expect(
      UpsertCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 0,
        nextRunAt: timestamp,
      }).success,
    ).toBe(false);

    expect(
      UpsertCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 10081,
        nextRunAt: timestamp,
      }).success,
    ).toBe(false);

    const ok = UpsertCollectionScheduleRequestSchema.safeParse({
      enabled: false,
      intervalMinutes: 30,
      nextRunAt: timestamp,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects out-of-range and non-integer intervals in the form schema", () => {
    const low = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "0",
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const high = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: String(MAX_INTERVAL_MINUTES + 1),
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const nonInteger = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "5.5",
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const nonNumeric = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "abc",
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const empty = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "",
      nextRunAtLocal: "2026-06-15T12:00",
    });

    expect(low.success).toBe(false);
    expect(high.success).toBe(false);
    expect(nonInteger.success).toBe(false);
    expect(nonNumeric.success).toBe(false);
    expect(empty.success).toBe(false);
  });

  it("rejects non-ISO nextRunAt and missing source group", () => {
    const missingSourceGroup = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "  ",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const missingNextRun = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: "",
    });
    const whitespaceNextRun = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: "   ",
    });

    expect(missingSourceGroup.success).toBe(false);
    expect(missingNextRun.success).toBe(false);
    expect(whitespaceNextRun.success).toBe(false);
  });

  it("rejects negative and non-numeric optional numerics", () => {
    const negativeScrolls = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: "2026-06-15T12:00",
      maxScrolls: "-1",
    });
    const nonIntegerScrolls = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: "2026-06-15T12:00",
      maxScrolls: "1.2",
    });
    const zeroDuration = UpsertCollectionScheduleFormSchema.safeParse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: "2026-06-15T12:00",
      maxDurationMs: "0",
    });

    expect(negativeScrolls.success).toBe(false);
    expect(nonIntegerScrolls.success).toBe(false);
    expect(zeroDuration.success).toBe(false);
  });

  it("converts an ISO datetime with offset to a local datetime-local value", () => {
    const value = toLocalDateTimeInputValue(timestamp);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("converts a datetime-local value to an absolute ISO datetime with offset", () => {
    const local = toLocalDateTimeInputValue(timestamp);
    const iso = toIsoDateTimeWithOffset(local);
    expect(iso).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/);
    expect(new Date(iso).getTime()).toBe(new Date(local).getTime());
  });

  it("converts empty optional numerics to undefined in the request", () => {
    const parsed = UpsertCollectionScheduleFormSchema.parse({
      sourceGroupId: "sg-1",
      enabled: false,
      intervalMinutes: "30",
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: "",
      maxDurationMs: "",
    });

    const request = toUpsertCollectionScheduleRequest(parsed);
    expect(request.parameters).toEqual({});
    expect(request.parameters).toBeDefined();
    if (request.parameters !== undefined) {
      expect("maxScrolls" in request.parameters).toBe(false);
      expect("maxDurationMs" in request.parameters).toBe(false);
    }
  });

  it("includes set optional numerics in the request", () => {
    const parsed = UpsertCollectionScheduleFormSchema.parse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "60",
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: "5",
      maxDurationMs: "30000",
    });

    const request = toUpsertCollectionScheduleRequest(parsed);
    expect(request.parameters).toEqual({ maxScrolls: 5, maxDurationMs: 30_000 });
  });

  it("round-trips a CollectionSchedule through scheduleToFormValues", () => {
    const schedule = createSchedule({
      sourceGroupId: "sg-1",
      enabled: false,
      intervalMinutes: 120,
      parameters: { maxDurationMs: 60_000 },
    });
    const values = scheduleToFormValues(schedule);
    expect(values.sourceGroupId).toBe("sg-1");
    expect(values.enabled).toBe(false);
    expect(values.intervalMinutes).toBe("120");
    expect(values.maxScrolls).toBe("");
    expect(values.maxDurationMs).toBe("60000");
  });

  it("produces empty form values when creating a new schedule", () => {
    expect(emptyScheduleFormValues()).toEqual({
      sourceGroupId: "",
      enabled: true,
      intervalMinutes: "",
      nextRunAtLocal: "",
      maxScrolls: "",
      maxDurationMs: "",
    });
  });

  it("formats a local datetime in the operator's timezone", () => {
    const formatted = formatLocalDateTime(timestamp);
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).not.toBe(timestamp);
    const formattedSeconds = formatLocalDateTimeSeconds(timestamp);
    expect(formattedSeconds.length).toBeGreaterThan(0);
  });

  it("filters schedulable source groups to Facebook ACTIVE/PAUSED/ARCHIVED", () => {
    const facebook = createSourceGroup({ id: "fb", name: "FB" });
    const paused = createSourceGroup({
      id: "pa",
      name: "PA",
      status: "PAUSED",
    });
    const archived = createSourceGroup({
      id: "ar",
      name: "AR",
      status: "ARCHIVED",
    });

    const filtered = filterSchedulableSourceGroups([
      facebook,
      paused,
      archived,
    ]);
    expect(filtered.map((g) => g.id)).toEqual(["ar", "fb", "pa"]);
  });

  it("finds a source group by id", () => {
    const groups = [createSourceGroup({ id: "a" }), createSourceGroup({ id: "b" })];
    expect(findSourceGroupById(groups, "b")?.id).toBe("b");
    expect(findSourceGroupById(groups, "missing")).toBeUndefined();
  });

  it("builds the list query params from defaults", () => {
    expect(toListCollectionSchedulesQueryParams(undefined)).toBeUndefined();
    expect(toListCollectionSchedulesQueryParams({ limit: 25, offset: 50 })).toEqual({
      limit: 25,
      offset: 50,
    });
  });

  it("accepts a list response shape", () => {
    const sample: CollectionScheduleListResponse = {
      items: [createSchedule()],
      page: { limit: 50, offset: 0, total: 1 },
    };
    const parsed = CollectionScheduleListResponseSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });
});
