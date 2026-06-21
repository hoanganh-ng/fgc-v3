import { describe, expect, it } from "vitest";
import {
  ProfileHomeFeedCollectionScheduleListResponseSchema,
  ProfileHomeFeedCollectionScheduleResponseSchema,
  ProfileHomeFeedCollectionScheduleSchema,
  UpsertProfileHomeFeedCollectionScheduleRequestSchema,
  toListProfileHomeFeedCollectionSchedulesQueryParams,
  type ProfileHomeFeedCollectionSchedule,
  type ProfileHomeFeedCollectionScheduleListResponse,
} from "@/lib/api/collector-runtime-client";
import {
  MAX_INTERVAL_MINUTES,
  UpsertProfileHomeFeedCollectionScheduleFormSchema,
  checkCreateProfileHomeFeedScheduleConflict,
  emptyProfileHomeFeedScheduleFormValues,
  formatLocalDateTime,
  formatLocalDateTimeSeconds,
  profileHomeFeedScheduleToFormValues,
  resolveProfileHomeFeedScheduleSubmit,
  toIsoDateTimeWithOffset,
  toLocalDateTimeInputValue,
  toUpsertProfileHomeFeedCollectionScheduleRequest,
  type ParsedUpsertProfileHomeFeedCollectionScheduleFormValues,
  type UpsertProfileHomeFeedCollectionScheduleFormValues,
} from "@/features/collector-runtime/profile-home-feed-collection-schedule-view-model";
import type { ApiResult } from "@/lib/api/http-client";

const timestamp = "2026-06-15T12:30:00.000Z";

function createSchedule(
  overrides: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: "profile-1",
    enabled: true,
    intervalMinutes: 30,
    nextRunAt: timestamp,
    parameters: {},
    consecutiveFailures: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("profile-home-feed-schedule view-model", () => {
  it("uses strict profile-home-feed-schedule schemas", () => {
    const listWithExtra = ProfileHomeFeedCollectionScheduleListResponseSchema.safeParse(
      {
        items: [createSchedule()],
        page: { limit: 50, offset: 0 },
        unexpected: true,
      },
    );
    const responseWithExtra =
      ProfileHomeFeedCollectionScheduleResponseSchema.safeParse({
        schedule: {
          ...createSchedule(),
          unexpected: true,
        },
      });
    const scheduleWithExtra = ProfileHomeFeedCollectionScheduleSchema.safeParse({
      ...createSchedule(),
      unexpected: true,
    });

    expect(listWithExtra.success).toBe(false);
    expect(responseWithExtra.success).toBe(false);
    expect(scheduleWithExtra.success).toBe(false);
  });

  it("validates a strict upsert request and omits profileId from the body", () => {
    expect(
      UpsertProfileHomeFeedCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "not-iso",
      }).success,
    ).toBe(false);

    expect(
      UpsertProfileHomeFeedCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 0,
        nextRunAt: timestamp,
      }).success,
    ).toBe(false);

    expect(
      UpsertProfileHomeFeedCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 10081,
        nextRunAt: timestamp,
      }).success,
    ).toBe(false);

    const ok = UpsertProfileHomeFeedCollectionScheduleRequestSchema.safeParse({
      enabled: false,
      intervalMinutes: 30,
      nextRunAt: timestamp,
    });
    expect(ok.success).toBe(true);

    // profileId must not appear in the body — it is path-only.
    const withProfileId =
      UpsertProfileHomeFeedCollectionScheduleRequestSchema.safeParse({
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: timestamp,
        profileId: "profile-1",
      });
    expect(withProfileId.success).toBe(false);
  });

  it("rejects out-of-range, non-integer, non-numeric, and empty intervals in the form schema", () => {
    const low = UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: "0",
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const high = UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: String(MAX_INTERVAL_MINUTES + 1),
      nextRunAtLocal: "2026-06-15T12:00",
    });
    const nonInteger =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: "5.5",
        nextRunAtLocal: "2026-06-15T12:00",
      });
    const nonNumeric =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: "abc",
        nextRunAtLocal: "2026-06-15T12:00",
      });
    const empty = UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
      profileId: "profile-1",
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
      profileId: "",
      enabled: true,
      intervalMinutes: "",
      nextRunAtLocal: "",
      maxScrolls: "",
      maxDurationMs: "",
      maxPosts: "",
    } satisfies UpsertProfileHomeFeedCollectionScheduleFormValues;

    const parsed =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse(
        emptyFormShape,
      );

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("expected empty form shape to fail validation");
    }
    const intervalIssue = parsed.error.issues.find(
      (issue) => issue.path[0] === "intervalMinutes",
    );
    expect(intervalIssue?.message).toBe("Interval is required.");
  });

  it("rejects negative and non-numeric optional numerics", () => {
    const negativeScrolls =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: "30",
        nextRunAtLocal: "2026-06-15T12:00",
        maxScrolls: "-1",
      });
    const nonIntegerScrolls =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: "30",
        nextRunAtLocal: "2026-06-15T12:00",
        maxScrolls: "1.2",
      });
    const zeroDuration =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: "30",
        nextRunAtLocal: "2026-06-15T12:00",
        maxDurationMs: "0",
      });
    const zeroPosts =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: "30",
        nextRunAtLocal: "2026-06-15T12:00",
        maxPosts: "0",
      });

    expect(negativeScrolls.success).toBe(false);
    expect(nonIntegerScrolls.success).toBe(false);
    expect(zeroDuration.success).toBe(false);
    expect(zeroPosts.success).toBe(false);
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

  it("omits empty optional numerics from the upsert request", () => {
    const parsed = UpsertProfileHomeFeedCollectionScheduleFormSchema.parse({
      profileId: "profile-1",
      enabled: false,
      intervalMinutes: "30",
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: "",
      maxDurationMs: "",
      maxPosts: "",
    });

    const request = toUpsertProfileHomeFeedCollectionScheduleRequest(parsed);
    expect("maxScrolls" in request).toBe(false);
    expect("maxDurationMs" in request).toBe(false);
    expect("maxPosts" in request).toBe(false);
  });

  it("includes set optional numerics in the request", () => {
    const parsed = UpsertProfileHomeFeedCollectionScheduleFormSchema.parse({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: "60",
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: "5",
      maxDurationMs: "30000",
      maxPosts: "20",
    });

    const request = toUpsertProfileHomeFeedCollectionScheduleRequest(parsed);
    expect(request.maxScrolls).toBe(5);
    expect(request.maxDurationMs).toBe(30_000);
    expect(request.maxPosts).toBe(20);
  });

  it("round-trips a profile-home-feed schedule through profileHomeFeedScheduleToFormValues", () => {
    const schedule = createSchedule({
      profileId: "profile-1",
      enabled: false,
      intervalMinutes: 120,
      parameters: { maxDurationMs: 60_000, maxPosts: 30 },
    });
    const values = profileHomeFeedScheduleToFormValues(schedule);
    expect(values.profileId).toBe("profile-1");
    expect(values.enabled).toBe(false);
    expect(values.intervalMinutes).toBe("120");
    expect(values.maxScrolls).toBe("");
    expect(values.maxDurationMs).toBe("60000");
    expect(values.maxPosts).toBe("30");
  });

  it("toUpsertProfileHomeFeedCollectionScheduleRequest requires a parsed interval number", () => {
    const parsed = UpsertProfileHomeFeedCollectionScheduleFormSchema.parse({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: "30",
      nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
      maxScrolls: "",
      maxDurationMs: "",
      maxPosts: "",
    });
    const request = toUpsertProfileHomeFeedCollectionScheduleRequest(parsed);
    expect(typeof request.intervalMinutes).toBe("number");

    // @ts-expect-error - missing required intervalMinutes
    const withoutInterval: ParsedUpsertProfileHomeFeedCollectionScheduleFormValues =
      {
        profileId: "profile-1",
        enabled: true,
        nextRunAtLocal: toLocalDateTimeInputValue(timestamp),
        maxScrolls: undefined,
        maxDurationMs: undefined,
        maxPosts: undefined,
      };
    expect(withoutInterval).toBeDefined();
  });

  it("produces empty form values when creating a new schedule", () => {
    expect(emptyProfileHomeFeedScheduleFormValues()).toEqual({
      profileId: "",
      enabled: true,
      intervalMinutes: "",
      nextRunAtLocal: "",
      maxScrolls: "",
      maxDurationMs: "",
      maxPosts: "",
    });
  });

  it("formats a local datetime in the operator's timezone", () => {
    const formatted = formatLocalDateTime(timestamp);
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).not.toBe(timestamp);
    const formattedSeconds = formatLocalDateTimeSeconds(timestamp);
    expect(formattedSeconds.length).toBeGreaterThan(0);
  });

  it("builds list query params from defaults and boolean enabled filter", () => {
    expect(
      toListProfileHomeFeedCollectionSchedulesQueryParams(undefined),
    ).toBeUndefined();
    expect(
      toListProfileHomeFeedCollectionSchedulesQueryParams({
        limit: 25,
        offset: 50,
      }),
    ).toEqual({
      limit: 25,
      offset: 50,
    });
    expect(
      toListProfileHomeFeedCollectionSchedulesQueryParams({
        enabled: true,
        limit: 10,
        offset: 0,
      }),
    ).toEqual({
      enabled: true,
      limit: 10,
      offset: 0,
    });
  });

  it("accepts a list response shape", () => {
    const sample: ProfileHomeFeedCollectionScheduleListResponse = {
      items: [createSchedule()],
      page: { limit: 50, offset: 0, total: 1 },
    };
    const parsed =
      ProfileHomeFeedCollectionScheduleListResponseSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it("accepts the backend single schedule response wrapper", () => {
    const parsed = ProfileHomeFeedCollectionScheduleResponseSchema.safeParse({
      schedule: createSchedule(),
    });

    expect(parsed.success).toBe(true);
  });
});

describe("checkCreateProfileHomeFeedScheduleConflict", () => {
  function okResult(): ApiResult<unknown> {
    return { ok: true, data: {} };
  }

  function httpError(status: number, message: string): ApiResult<unknown> {
    return {
      ok: false,
      error: { kind: "http", status, code: "X", message },
    };
  }

  function networkError(message: string): ApiResult<unknown> {
    return { ok: false, error: { kind: "network", message } };
  }

  it("returns not_found when the GET yields 404", async () => {
    const fetchSchedule = async (): Promise<ApiResult<unknown>> =>
      httpError(404, "Not found");
    const result = await checkCreateProfileHomeFeedScheduleConflict(
      "profile-missing",
      fetchSchedule,
    );
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns exists when the GET yields 200", async () => {
    const fetchSchedule = async (): Promise<ApiResult<unknown>> => okResult();
    const result = await checkCreateProfileHomeFeedScheduleConflict(
      "profile-existing",
      fetchSchedule,
    );
    expect(result).toEqual({ status: "exists" });
  });

  it("returns error when the GET yields 500", async () => {
    const fetchSchedule = async (): Promise<ApiResult<unknown>> =>
      httpError(500, "boom");
    const result = await checkCreateProfileHomeFeedScheduleConflict(
      "profile-boom",
      fetchSchedule,
    );
    expect(result.status).toBe("error");
  });

  it("returns error for non-404 http failures", async () => {
    const fetchSchedule = async (): Promise<ApiResult<unknown>> =>
      httpError(400, "bad request");
    const result = await checkCreateProfileHomeFeedScheduleConflict(
      "profile-bad",
      fetchSchedule,
    );
    expect(result.status).toBe("error");
  });

  it("returns error for network failures", async () => {
    const fetchSchedule = async (): Promise<ApiResult<unknown>> =>
      networkError("offline");
    const result = await checkCreateProfileHomeFeedScheduleConflict(
      "profile-offline",
      fetchSchedule,
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/offline/);
    }
  });
});

describe("resolveProfileHomeFeedScheduleSubmit", () => {
  it("short-circuits on edit", async () => {
    const outcome = await resolveProfileHomeFeedScheduleSubmit({
      mode: "edit",
      profileId: "profile-1",
      fetchSchedule: () => Promise.reject(new Error("should not be called")),
    });
    expect(outcome).toEqual({ status: "submit" });
  });

  it("returns submit when the create probe yields 404", async () => {
    const outcome = await resolveProfileHomeFeedScheduleSubmit({
      mode: "create",
      profileId: "profile-1",
      fetchSchedule: async () => ({
        ok: false,
        error: { kind: "http", status: 404, code: "X", message: "missing" },
      }),
    });
    expect(outcome).toEqual({ status: "submit" });
  });

  it("returns exists when the create probe yields 200", async () => {
    const outcome = await resolveProfileHomeFeedScheduleSubmit({
      mode: "create",
      profileId: "profile-1",
      fetchSchedule: async () => ({ ok: true, data: {} }),
    });
    expect(outcome).toEqual({
      status: "exists",
      message:
        "A schedule already exists for this profile. Use Edit to modify it.",
    });
  });

  it("returns error when the create probe yields an unexpected failure", async () => {
    const outcome = await resolveProfileHomeFeedScheduleSubmit({
      mode: "create",
      profileId: "profile-1",
      fetchSchedule: async () => ({
        ok: false,
        error: { kind: "network", message: "offline" },
      }),
    });
    expect(outcome.status).toBe("error");
  });
});
