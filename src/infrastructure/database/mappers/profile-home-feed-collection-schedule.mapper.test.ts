import { describe, expect, it } from "vitest";
import type { ProfileHomeFeedCollectionSchedule } from "../../../collector-runtime/domain";
import {
  InvalidPersistedProfileHomeFeedCollectionScheduleRecordError,
  toDomainProfileHomeFeedCollectionSchedule,
  toProfileHomeFeedCollectionScheduleRecord,
} from "./profile-home-feed-collection-schedule.mapper";
import type { ProfileHomeFeedCollectionScheduleRow } from "./profile-home-feed-collection-schedule.mapper";

const now = "2026-06-21T10:00:00.000Z";

describe("profile home-feed collection schedule database mapper", () => {
  it("maps profile home-feed collection schedules to and from persistence rows", () => {
    const schedule = createSchedule({
      parameters: {
        maxScrolls: 3,
        maxDurationMs: 30_000,
        maxPosts: 20,
      },
    });

    const record = toProfileHomeFeedCollectionScheduleRecord(schedule);

    expect(record).toEqual({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: 60,
      nextRunAt: "2026-06-21T11:00:00.000Z",
      parameters: {
        maxScrolls: 3,
        maxDurationMs: 30_000,
        maxPosts: 20,
      },
      createdAt: now,
      updatedAt: now,
    });
    expect(toDomainProfileHomeFeedCollectionSchedule(toSelectRow(record))).toEqual(
      schedule,
    );
  });

  it("keeps omitted optional parameters omitted", () => {
    const schedule = createSchedule({ parameters: {} });
    const record = toProfileHomeFeedCollectionScheduleRecord(schedule);

    expect(record.parameters).toEqual({});
    expect(record.parameters).not.toHaveProperty("maxScrolls");
    expect(record.parameters).not.toHaveProperty("maxDurationMs");
    expect(record.parameters).not.toHaveProperty("maxPosts");
  });

  it("rejects invalid persisted schedule rows", () => {
    expect(() =>
      toDomainProfileHomeFeedCollectionSchedule(
        toSelectRow({
          ...toProfileHomeFeedCollectionScheduleRecord(createSchedule()),
          intervalMinutes: 0,
        }),
      ),
    ).toThrow(InvalidPersistedProfileHomeFeedCollectionScheduleRecordError);
  });
});

function toSelectRow(
  record: ReturnType<typeof toProfileHomeFeedCollectionScheduleRecord>,
): ProfileHomeFeedCollectionScheduleRow {
  return {
    profileId: record.profileId,
    enabled: record.enabled,
    intervalMinutes: record.intervalMinutes,
    nextRunAt: record.nextRunAt,
    parameters: record.parameters,
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now,
  };
}

function createSchedule(
  options: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: options.profileId ?? "profile-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 60,
    nextRunAt: options.nextRunAt ?? "2026-06-21T11:00:00.000Z",
    parameters: options.parameters ?? {},
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };
}
