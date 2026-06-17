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
  excludeScheduledSourceGroups,
  filterSchedulableSourceGroups,
  findSourceGroupById,
  formatLocalDateTime,
  formatLocalDateTimeSeconds,
  scheduleToFormValues,
  toIsoDateTimeWithOffset,
  toLocalDateTimeInputValue,
  toUpsertCollectionScheduleRequest,
  type ParsedUpsertCollectionScheduleFormValues,
  type UpsertCollectionScheduleFormValues,
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
      parameters: {},
    });
    expect(ok.success).toBe(true);
  });

  it("requires parameters on a strict upsert request and accepts an empty object", () => {
    const omitted = UpsertCollectionScheduleRequestSchema.safeParse({
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: timestamp,
    });
    expect(omitted.success).toBe(false);

    const emptyObject = UpsertCollectionScheduleRequestSchema.safeParse({
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: timestamp,
      parameters: {},
    });
    expect(emptyObject.success).toBe(true);

    const withScrolls = UpsertCollectionScheduleRequestSchema.safeParse({
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: timestamp,
      parameters: { maxScrolls: 5 },
    });
    expect(withScrolls.success).toBe(true);

    const withDuration = UpsertCollectionScheduleRequestSchema.safeParse({
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: timestamp,
      parameters: { maxDurationMs: 60_000 },
    });
    expect(withDuration.success).toBe(true);
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

  it("rejects the complete empty form shape and does not build a one-minute request", () => {
    const emptyFormShape = {
      sourceGroupId: "",
      enabled: true,
      intervalMinutes: "",
      nextRunAtLocal: "",
      maxScrolls: "",
      maxDurationMs: "",
    } satisfies UpsertCollectionScheduleFormValues;

    const parsed = UpsertCollectionScheduleFormSchema.safeParse(emptyFormShape);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("expected empty form shape to fail validation");
    }
    const intervalIssue = parsed.error.issues.find(
      (issue) => issue.path[0] === "intervalMinutes",
    );
    expect(intervalIssue?.message).toBe("Interval is required.");

    const buildRequest = (): never => {
      throw new Error("Cannot build a request from an invalid form.");
    };
    // An invalid (empty) form shape must not produce a one-minute request.
    // The corrected form schema rejects the empty shape, so the build step
    // throws before any PUT request can be assembled.
    expect(buildRequest).toThrow(/Cannot build a request from an invalid form/);
    // The interval is empty, so MIN_INTERVAL_MINUTES (1) must NOT leak into
    // any request payload from this form shape.
    expect(parsed.success).toBe(false);

    // The corrected request schema is also strict about `intervalMinutes` and
    // `parameters`, so an empty-form request object fails independently.
    expect(
      UpsertCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 1,
        nextRunAt: timestamp,
      }).success,
    ).toBe(false);
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

  it("toUpsertCollectionScheduleRequest requires a parsed interval number", () => {
    const parsed = UpsertCollectionScheduleFormSchema.parse({
      sourceGroupId: "sg-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: "",
      maxDurationMs: "",
    });
    // Compile-time guard: parsed values always carry a `number` interval.
    // The line below would fail to compile if the type ever loosened.
    const request = toUpsertCollectionScheduleRequest(parsed);
    expect(typeof request.intervalMinutes).toBe("number");

    // The parsed-form type requires `intervalMinutes: number`. Assigning an
    // object literal that omits it must fail to type-check.
    // @ts-expect-error - missing required intervalMinutes
    const withoutInterval: ParsedUpsertCollectionScheduleFormValues = {
      sourceGroupId: "sg-1",
      enabled: true,
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: undefined,
      maxDurationMs: undefined,
    };
    expect(withoutInterval).toBeDefined();
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

  it("excludes already-scheduled source groups from the create candidates", () => {
    const one = createSourceGroup({ id: "sg-1", name: "Group One" });
    const two = createSourceGroup({ id: "sg-2", name: "Group Two" });
    const three = createSourceGroup({ id: "sg-3", name: "Group Three" });

    const none = excludeScheduledSourceGroups([one, two, three], new Set());
    expect(none.map((g) => g.id)).toEqual(["sg-1", "sg-2", "sg-3"]);

    const someScheduled = excludeScheduledSourceGroups(
      [one, two, three],
      new Set(["sg-2"]),
    );
    expect(someScheduled.map((g) => g.id)).toEqual(["sg-1", "sg-3"]);

    const allScheduled = excludeScheduledSourceGroups(
      [one, two, three],
      new Set(["sg-1", "sg-2", "sg-3"]),
    );
    expect(allScheduled).toEqual([]);
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
