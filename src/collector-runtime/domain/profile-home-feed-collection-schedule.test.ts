import { describe, expect, it } from "vitest";
import { validateProfileHomeFeedCollectionSchedule } from "./validation";
import type { ProfileHomeFeedCollectionSchedule } from "./profile-home-feed-collection-schedule";

const now = "2026-06-21T10:00:00.000Z";

describe("ProfileHomeFeedCollectionSchedule", () => {
  it("accepts a valid profile-bound home-feed collection schedule", () => {
    const schedule = createSchedule({
      parameters: {
        maxScrolls: 3,
        maxDurationMs: 30_000,
        maxPosts: 20,
      },
    });

    expect(validateProfileHomeFeedCollectionSchedule(schedule)).toEqual({
      valid: true,
      value: schedule,
    });
  });

  it("allows omitted optional parameters without converting them to null", () => {
    const result = validateProfileHomeFeedCollectionSchedule(
      createSchedule({ parameters: {} }),
    );

    expect(result).toMatchObject({ valid: true });
    if (result.valid) {
      expect(result.value.parameters).toEqual({});
      expect(result.value.parameters).not.toHaveProperty("maxScrolls");
      expect(result.value.parameters).not.toHaveProperty("maxDurationMs");
      expect(result.value.parameters).not.toHaveProperty("maxPosts");
    }
  });

  it("rejects invalid aggregate fields", () => {
    const result = validateProfileHomeFeedCollectionSchedule({
      profileId: "",
      enabled: true,
      intervalMinutes: 0,
      nextRunAt: "2026-06-21T10:00:00.000",
      parameters: {
        maxScrolls: -1,
        maxDurationMs: 0,
        maxPosts: 0,
      },
      createdAt: now,
      updatedAt: now,
      unexpected: "not allowed",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          "profileId",
          "intervalMinutes",
          "nextRunAt",
          "parameters.maxScrolls",
          "parameters.maxDurationMs",
          "parameters.maxPosts",
        ]),
      );
    }
  });

  it("rejects null optional parameters rather than treating them as omissions", () => {
    const result = validateProfileHomeFeedCollectionSchedule(
      createSchedule({
        parameters: {
          maxScrolls: null,
        } as unknown as ProfileHomeFeedCollectionSchedule["parameters"],
      }),
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain(
        "parameters.maxScrolls",
      );
    }
  });
});

function createSchedule(
  options: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: options.profileId ?? "profile-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 60,
    nextRunAt: options.nextRunAt ?? "2026-06-21T11:00:00.000Z",
    parameters: options.parameters ?? {},
    consecutiveFailures: options.consecutiveFailures ?? 0,
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };
}
