import { describe, expect, it } from "vitest";
import {
  CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase,
  GetProfileHomeFeedCollectionScheduleUseCase,
  ListProfileHomeFeedCollectionSchedulesUseCase,
  ProfileHomeFeedCollectionScheduleNotFoundError,
  ProfileHomeFeedCollectionScheduleValidationError,
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
} from "./index";
import type {
  Clock,
  ProfileReferencePort,
  ProfileReferenceResult,
} from "./index";
import { InMemoryProfileHomeFeedCollectionScheduleRepository } from "./test-support/in-memory-profile-home-feed-collection-schedule-repository";
import type { ProfileHomeFeedCollectionSchedule } from "../domain";

const createdAt = "2026-06-21T10:00:00.000Z";
const updatedAt = "2026-06-21T10:05:00.000Z";

describe("collector runtime profile home-feed collection schedule application use cases", () => {
  it("creates a profile home-feed collection schedule after validating profile existence", async () => {
    const context = createTestContext();

    const schedule =
      await new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
        context.schedules,
        context.profiles,
        context.clock,
      ).execute({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-21T10:30:00.000Z",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        maxPosts: 20,
      });

    expect(schedule).toEqual({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-21T10:30:00.000Z",
      parameters: {
        maxScrolls: 3,
        maxDurationMs: 30_000,
        maxPosts: 20,
      },
      consecutiveFailures: 0,
      createdAt,
      updatedAt: createdAt,
    });
    expect(context.profiles.calls).toEqual(["profile-1"]);
    await expect(
      context.schedules.findByProfileId("profile-1"),
    ).resolves.toEqual(schedule);
  });

  it("preserves createdAt on update and bumps updatedAt", async () => {
    const context = createTestContext();
    const useCase = new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
      context.schedules,
      context.profiles,
      context.clock,
    );

    await useCase.execute({
      profileId: "profile-1",
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-21T10:30:00.000Z",
    });
    context.clock.setNow(updatedAt);

    const updated = await useCase.execute({
      profileId: "profile-1",
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-21T11:00:00.000Z",
      maxPosts: 10,
    });

    expect(updated).toEqual({
      profileId: "profile-1",
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-21T11:00:00.000Z",
      parameters: {
        maxPosts: 10,
      },
      consecutiveFailures: 0,
      createdAt,
      updatedAt,
    });
  });

  it("keeps omitted optional parameters omitted", async () => {
    const context = createTestContext();

    const schedule =
      await new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
        context.schedules,
        context.profiles,
        context.clock,
      ).execute({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-21T10:30:00.000Z",
      });

    expect(schedule.parameters).toEqual({});
    expect(schedule.parameters).not.toHaveProperty("maxScrolls");
    expect(schedule.parameters).not.toHaveProperty("maxDurationMs");
    expect(schedule.parameters).not.toHaveProperty("maxPosts");
  });

  it("rejects invalid input before looking up the profile", async () => {
    const context = createTestContext();

    await expect(
      new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
        context.schedules,
        context.profiles,
        context.clock,
      ).execute({
        profileId: "",
        enabled: true,
        intervalMinutes: 0,
        nextRunAt: "2026-06-21T10:30:00.000",
        maxScrolls: -1,
        maxDurationMs: 0,
        maxPosts: 0,
      }),
    ).rejects.toThrow(ProfileHomeFeedCollectionScheduleValidationError);
    expect(context.profiles.calls).toEqual([]);
  });

  it("rejects schedules when the profile is missing", async () => {
    const context = createTestContext();
    context.profiles.result = {
      ok: false,
      statusCode: 404,
      errorCode: "PROFILE_NOT_FOUND",
      errorMessage: "Not found.",
    };

    await expect(
      new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
        context.schedules,
        context.profiles,
        context.clock,
      ).execute({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-21T10:30:00.000Z",
      }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("rejects schedules when Profile Manager returns a mismatched profile id", async () => {
    const context = createTestContext();
    context.profiles.result = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
    };

    await expect(
      new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
        context.schedules,
        context.profiles,
        context.clock,
      ).execute({
        profileId: "profile-1",
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-21T10:30:00.000Z",
      }),
    ).rejects.toThrow(ProfileReferenceLookupFailedError);
  });

  it("gets a schedule by profileId and throws not-found for a missing schedule", async () => {
    const context = createTestContext();
    const schedule = createSchedule({ profileId: "profile-1" });
    await context.schedules.save(schedule);
    const useCase = new GetProfileHomeFeedCollectionScheduleUseCase(
      context.schedules,
    );

    await expect(useCase.execute({ profileId: "profile-1" })).resolves.toEqual(
      schedule,
    );
    await expect(useCase.execute({ profileId: "missing" })).rejects.toThrow(
      ProfileHomeFeedCollectionScheduleNotFoundError,
    );
  });

  it("lists schedules with enabled filtering, pagination, and deterministic ordering", async () => {
    const context = createTestContext();
    await context.schedules.save(
      createSchedule({
        profileId: "profile-c",
        enabled: true,
        nextRunAt: "2026-06-21T12:00:00.000Z",
      }),
    );
    await context.schedules.save(
      createSchedule({
        profileId: "profile-b",
        enabled: true,
        nextRunAt: "2026-06-21T11:00:00.000Z",
      }),
    );
    await context.schedules.save(
      createSchedule({
        profileId: "profile-a",
        enabled: true,
        nextRunAt: "2026-06-21T11:00:00.000Z",
      }),
    );
    await context.schedules.save(
      createSchedule({
        profileId: "profile-disabled",
        enabled: false,
        nextRunAt: "2026-06-21T10:00:00.000Z",
      }),
    );

    const listed = await new ListProfileHomeFeedCollectionSchedulesUseCase(
      context.schedules,
    ).execute({
      enabled: true,
      limit: 2,
      offset: 1,
    });

    expect(listed.items.map((item) => item.profileId)).toEqual([
      "profile-b",
      "profile-c",
    ]);
    expect(listed.page).toEqual({ limit: 2, offset: 1, total: 3 });
  });

  it("rejects invalid list input", async () => {
    const context = createTestContext();
    const useCase = new ListProfileHomeFeedCollectionSchedulesUseCase(
      context.schedules,
    );

    await expect(useCase.execute({ limit: 0 })).rejects.toThrow(
      ProfileHomeFeedCollectionScheduleValidationError,
    );
    await expect(useCase.execute({ offset: -1 })).rejects.toThrow(
      ProfileHomeFeedCollectionScheduleValidationError,
    );
  });
});

function createTestContext(): {
  readonly schedules: InMemoryProfileHomeFeedCollectionScheduleRepository;
  readonly profiles: FakeProfileReferencePort;
  readonly clock: MutableClock;
} {
  return {
    schedules: new InMemoryProfileHomeFeedCollectionScheduleRepository(),
    profiles: new FakeProfileReferencePort(),
    clock: new MutableClock(createdAt),
  };
}

class MutableClock implements Clock {
  public constructor(private nowValue: string) {}

  public now(): Date {
    return new Date(this.nowValue);
  }

  public setNow(value: string): void {
    this.nowValue = value;
  }
}

class FakeProfileReferencePort implements ProfileReferencePort {
  public readonly calls: string[] = [];
  public result: ProfileReferenceResult = {
    ok: true,
    profileId: "profile-1",
    accountStage: "WARMING",
  };

  public async getProfileAccountStage(
    profileId: string,
  ): Promise<ProfileReferenceResult> {
    this.calls.push(profileId);

    return this.result;
  }
}

function createSchedule(
  options: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: options.profileId ?? "profile-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 30,
    nextRunAt: options.nextRunAt ?? "2026-06-21T10:30:00.000Z",
    parameters: options.parameters ?? {},
    ...(options.lastAttemptedAt !== undefined
      ? { lastAttemptedAt: options.lastAttemptedAt }
      : {}),
    ...(options.lastDispatchStatus !== undefined
      ? { lastDispatchStatus: options.lastDispatchStatus }
      : {}),
    ...(options.lastFailureReason !== undefined
      ? { lastFailureReason: options.lastFailureReason }
      : {}),
    consecutiveFailures: options.consecutiveFailures ?? 0,
    createdAt: options.createdAt ?? createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  };
}
