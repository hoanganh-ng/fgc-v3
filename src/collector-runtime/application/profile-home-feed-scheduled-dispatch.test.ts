import { describe, expect, it } from "vitest";
import {
  DispatchNextDueProfileHomeFeedCollectionScheduleUseCase,
} from "./index";
import type {
  Clock,
  IdGenerator,
  ProfileReferencePort,
  ProfileReferenceResult,
} from "./index";
import { InMemoryProfileHomeFeedCollectionScheduleRepository } from "./test-support/in-memory-profile-home-feed-collection-schedule-repository";
import type { ProfileHomeFeedCollectionSchedule } from "../domain";

const dueAt = "2026-06-21T10:00:00.000Z";
const dispatchAt = "2026-06-21T10:35:00.000Z";

describe("DispatchNextDueProfileHomeFeedCollectionScheduleUseCase", () => {
  it("dispatches one due schedule into one queued scheduled home-feed run", async () => {
    const context = createContext();
    await context.repository.save(createSchedule());

    const result = await context.useCase.execute();

    expect(result).toMatchObject({
      outcome: "DISPATCHED",
      schedule: {
        profileId: "profile-1",
        nextRunAt: "2026-06-21T11:00:00.000Z",
        lastAttemptedAt: dispatchAt,
        lastDispatchStatus: "DISPATCHED",
        consecutiveFailures: 0,
      },
      run: {
        id: "scheduled-run-1",
        profileId: "profile-1",
        triggerType: "SCHEDULED",
        status: "QUEUED",
        accountStageAtRequest: "WARMING",
        target: {
          platform: "FACEBOOK",
          surface: "PROFILE_HOME_FEED",
        },
        parameters: { maxPosts: 10 },
        requestedAt: dueAt,
        createdAt: dispatchAt,
        updatedAt: dispatchAt,
      },
    });
    expect(context.profiles.calls).toEqual(["profile-1"]);
    expect(context.repository.getRun("scheduled-run-1")).toMatchObject({
      triggerType: "SCHEDULED",
    });
  });

  it("returns no work when no due schedule exists", async () => {
    const context = createContext();

    await expect(context.useCase.execute()).resolves.toEqual({
      outcome: "NO_DUE_SCHEDULE",
    });
    expect(context.profiles.calls).toEqual([]);
  });

  it("skips and advances cadence when an active run already exists", async () => {
    const context = createContext();
    await context.repository.save(createSchedule());
    context.repository.seedActiveRun("profile-1");

    const result = await context.useCase.execute();

    expect(result).toMatchObject({
      outcome: "SKIPPED_ACTIVE_RUN",
      schedule: {
        profileId: "profile-1",
        nextRunAt: "2026-06-21T11:00:00.000Z",
        lastAttemptedAt: dispatchAt,
        lastDispatchStatus: "SKIPPED_ACTIVE_RUN",
        consecutiveFailures: 0,
      },
    });
    expect(context.repository.getRun("scheduled-run-1")).toBeUndefined();
  });

  it("disables the schedule when the profile is not found", async () => {
    const context = createContext();
    await context.repository.save(createSchedule());
    context.profiles.result = {
      ok: false,
      statusCode: 404,
      errorCode: "PROFILE_NOT_FOUND",
      errorMessage: "raw not persisted",
    };

    const result = await context.useCase.execute();

    expect(result).toMatchObject({
      outcome: "PROFILE_NOT_FOUND",
      schedule: {
        enabled: false,
        nextRunAt: dueAt,
        lastAttemptedAt: dispatchAt,
        lastDispatchStatus: "PROFILE_NOT_FOUND",
        lastFailureReason: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile was not found.",
        },
        consecutiveFailures: 1,
      },
    });
    expect(context.repository.getRun("scheduled-run-1")).toBeUndefined();
  });

  it("records sanitized transient lookup failure and backs off immediate retry", async () => {
    const context = createContext();
    await context.repository.save(createSchedule());
    context.profiles.result = {
      ok: false,
      statusCode: 503,
      errorCode: "UPSTREAM_RAW_DETAIL",
      errorMessage: "private upstream text",
    };

    const failed = await context.useCase.execute();
    const retry = await context.useCase.execute();

    expect(failed).toMatchObject({
      outcome: "PROFILE_LOOKUP_FAILED",
      schedule: {
        enabled: true,
        nextRunAt: dueAt,
        lastAttemptedAt: dispatchAt,
        lastDispatchStatus: "PROFILE_LOOKUP_FAILED",
        lastFailureReason: {
          code: "PROFILE_REFERENCE_LOOKUP_FAILED",
          message: "Profile Manager returned an error.",
        },
        consecutiveFailures: 1,
      },
    });
    expect(retry).toEqual({ outcome: "NO_DUE_SCHEDULE" });
    expect(context.profiles.calls).toEqual(["profile-1"]);
  });
});

function createContext(): {
  readonly repository: InMemoryProfileHomeFeedCollectionScheduleRepository;
  readonly profiles: FakeProfileReferencePort;
  readonly useCase: DispatchNextDueProfileHomeFeedCollectionScheduleUseCase;
} {
  const repository = new InMemoryProfileHomeFeedCollectionScheduleRepository();
  const profiles = new FakeProfileReferencePort();

  return {
    repository,
    profiles,
    useCase: new DispatchNextDueProfileHomeFeedCollectionScheduleUseCase(
      repository,
      profiles,
      new FixedClock(dispatchAt),
      new FixedIdGenerator("scheduled-run-1"),
    ),
  };
}

function createSchedule(
  options: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: options.profileId ?? "profile-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 30,
    nextRunAt: options.nextRunAt ?? dueAt,
    parameters: options.parameters ?? { maxPosts: 10 },
    consecutiveFailures: options.consecutiveFailures ?? 0,
    createdAt: options.createdAt ?? "2026-06-21T09:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-06-21T09:00:00.000Z",
  };
}

class FixedClock implements Clock {
  public constructor(private readonly value: string) {}

  public now(): Date {
    return new Date(this.value);
  }
}

class FixedIdGenerator implements IdGenerator {
  public constructor(private readonly value: string) {}

  public async generateId(): Promise<string> {
    return this.value;
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
