import { describe, expect, it } from "vitest";
import {
  CancelProfileHomeFeedCollectionRunUseCase,
  ClaimNextProfileHomeFeedCollectionRunUseCase,
  GetProfileHomeFeedCollectionRunUseCase,
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  ListProfileHomeFeedCollectionRunsUseCase,
  MarkProfileHomeFeedCollectionRunFailedUseCase,
  MarkProfileHomeFeedCollectionRunSucceededUseCase,
  ProfileHomeFeedCollectionRunConflictError,
  ProfileHomeFeedCollectionRunValidationError,
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
  RequestProfileHomeFeedCollectionRunUseCase,
} from "./index";
import type {
  Clock,
  IdGenerator,
  ProfileReferencePort,
  ProfileReferenceResult,
} from "./index";
import { InMemoryProfileHomeFeedCollectionRunRepository } from "./test-support/in-memory-profile-home-feed-collection-run-repository";
import type { ProfileHomeFeedCollectionRun } from "../domain";

const createdAt = "2026-06-19T10:00:00.000Z";
const updatedAt = "2026-06-19T10:05:00.000Z";

describe("collector runtime profile home-feed collection run application use cases", () => {
  it("requests a queued manual API profile home-feed run", async () => {
    const context = createTestContext(["home-feed-run-1"]);

    const run = await new RequestProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.profiles,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      maxScrolls: 4,
      maxDurationMs: 60_000,
      maxPosts: 12,
    });

    expect(run).toEqual({
      id: "home-feed-run-1",
      profileId: "profile-1",
      triggerType: "MANUAL_API",
      status: "QUEUED",
      accountStageAtRequest: "WARMING",
      target: {
        platform: "FACEBOOK",
        surface: "PROFILE_HOME_FEED",
      },
      parameters: {
        maxScrolls: 4,
        maxDurationMs: 60_000,
        maxPosts: 12,
      },
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
    expect(context.profiles.calls).toEqual(["profile-1"]);
    await expect(context.runs.findById(run.id)).resolves.toEqual(run);
  });

  it("rejects profile home-feed requests when profile lookup returns not found", async () => {
    const context = createTestContext(["home-feed-run-1"]);
    context.profiles.result = {
      ok: false,
      statusCode: 404,
      errorCode: "PROFILE_NOT_FOUND",
      errorMessage: "Not found.",
    };

    await expect(
      new RequestProfileHomeFeedCollectionRunUseCase(
        context.runs,
        context.profiles,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
      }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("rejects profile home-feed requests when Profile Manager returns a mismatched id", async () => {
    const context = createTestContext(["home-feed-run-1"]);
    context.profiles.result = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
    };

    await expect(
      new RequestProfileHomeFeedCollectionRunUseCase(
        context.runs,
        context.profiles,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
      }),
    ).rejects.toThrow(ProfileReferenceLookupFailedError);
  });

  it("rejects invalid optional run parameters strictly", async () => {
    const context = createTestContext(["home-feed-run-1"]);

    await expect(
      new RequestProfileHomeFeedCollectionRunUseCase(
        context.runs,
        context.profiles,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        maxScrolls: -1,
        maxDurationMs: 0,
        maxPosts: 0,
      }),
    ).rejects.toThrow(ProfileHomeFeedCollectionRunValidationError);
    expect(context.profiles.calls).toEqual([]);
  });

  it("prevents multiple active home-feed runs for the same profile", async () => {
    const context = createTestContext([
      "home-feed-run-1",
      "home-feed-run-2",
    ]);
    const useCase = new RequestProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.profiles,
      context.ids,
      context.clock,
    );

    await useCase.execute({ profileId: "profile-1" });

    await expect(useCase.execute({ profileId: "profile-1" })).rejects.toThrow(
      ProfileHomeFeedCollectionRunConflictError,
    );
  });

  it("allows a new home-feed run after the previous run is terminal", async () => {
    const context = createTestContext([
      "home-feed-run-1",
      "home-feed-run-2",
    ]);
    const request = new RequestProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.profiles,
      context.ids,
      context.clock,
    );
    const firstRun = await request.execute({ profileId: "profile-1" });
    context.clock.setNow(updatedAt);
    await new CancelProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.clock,
    ).execute({ runId: firstRun.id });

    const secondRun = await request.execute({ profileId: "profile-1" });

    expect(secondRun.id).toBe("home-feed-run-2");
    expect(secondRun.status).toBe("QUEUED");
  });

  it("gets and lists profile home-feed runs with filters and pagination", async () => {
    const context = createTestContext();
    await context.runs.save(
      createRunFixture({
        id: "home-feed-run-older",
        profileId: "profile-1",
        createdAt: "2026-06-19T10:00:00.000Z",
      }),
    );
    await context.runs.save(
      createRunFixture({
        id: "home-feed-run-newer",
        profileId: "profile-2",
        status: "RUNNING",
        startedAt: "2026-06-19T10:03:00.000Z",
        createdAt: "2026-06-19T10:01:00.000Z",
      }),
    );

    const listed = await new ListProfileHomeFeedCollectionRunsUseCase(
      context.runs,
    ).execute({
      status: "RUNNING",
      profileId: "profile-2",
      limit: 10,
      offset: 0,
    });
    const got = await new GetProfileHomeFeedCollectionRunUseCase(
      context.runs,
    ).execute({ runId: "home-feed-run-newer" });

    expect(listed.items.map((item) => item.id)).toEqual([
      "home-feed-run-newer",
    ]);
    expect(listed.page).toEqual({ limit: 10, offset: 0, total: 1 });
    expect(got.id).toBe("home-feed-run-newer");
  });

  it("claims the oldest queued profile home-feed run by requestedAt then id", async () => {
    const context = createTestContext();
    await context.runs.save(
      createRunFixture({
        id: "b-run",
        profileId: "profile-b",
        requestedAt: "2026-06-19T10:00:00.000Z",
        createdAt: "2026-06-19T10:01:00.000Z",
      }),
    );
    await context.runs.save(
      createRunFixture({
        id: "a-run",
        profileId: "profile-a",
        requestedAt: "2026-06-19T10:00:00.000Z",
        createdAt: "2026-06-19T10:02:00.000Z",
      }),
    );
    context.clock.setNow(updatedAt);

    const claimed = await new ClaimNextProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.clock,
    ).execute();

    expect(claimed).toMatchObject({
      id: "a-run",
      status: "RUNNING",
      startedAt: updatedAt,
      updatedAt,
    });
  });

  it("does not claim the same queued home-feed run twice", async () => {
    const context = createTestContext();
    await context.runs.save(createRunFixture({ id: "home-feed-run-1" }));
    const claim = new ClaimNextProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.clock,
    );

    await expect(claim.execute()).resolves.toMatchObject({
      id: "home-feed-run-1",
      status: "RUNNING",
    });
    await expect(claim.execute()).resolves.toBeNull();
  });

  it("marks running home-feed runs succeeded and failed with safe contracts", async () => {
    const successContext = createTestContext();
    await successContext.runs.save(
      createRunFixture({
        id: "success-run",
        status: "RUNNING",
        startedAt: createdAt,
      }),
    );
    successContext.clock.setNow(updatedAt);

    const succeeded =
      await new MarkProfileHomeFeedCollectionRunSucceededUseCase(
        successContext.runs,
        successContext.clock,
      ).execute({
        runId: "success-run",
        summary: {
          postsSeen: 4,
          extractorCandidates: 3,
          sourcePublishersObserved: 2,
          contentItemsSubmitted: 1,
          failedSubmissions: 0,
        },
      });

    expect(succeeded).toMatchObject({
      status: "SUCCEEDED",
      summary: {
        postsSeen: 4,
        contentItemsSubmitted: 1,
      },
      finishedAt: updatedAt,
    });

    const failureContext = createTestContext();
    await failureContext.runs.save(
      createRunFixture({
        id: "failed-run",
        status: "RUNNING",
        startedAt: createdAt,
      }),
    );
    failureContext.clock.setNow(updatedAt);

    const failed = await new MarkProfileHomeFeedCollectionRunFailedUseCase(
      failureContext.runs,
      failureContext.clock,
    ).execute({
      runId: "failed-run",
      failureReason: {
        code: "CAPTURE_FAILED",
        message: "Home-feed collection failed.",
      },
      summary: {
        postsSeen: 0,
      },
    });

    expect(failed).toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "CAPTURE_FAILED",
        message: "Home-feed collection failed.",
      },
      summary: {
        postsSeen: 0,
      },
      finishedAt: updatedAt,
    });
  });

  it("rejects invalid terminal transitions", async () => {
    const context = createTestContext();
    await context.runs.save(
      createRunFixture({
        id: "succeeded-run",
        status: "SUCCEEDED",
        startedAt: createdAt,
        finishedAt: updatedAt,
      }),
    );

    await expect(
      new CancelProfileHomeFeedCollectionRunUseCase(
        context.runs,
        context.clock,
      ).execute({ runId: "succeeded-run" }),
    ).rejects.toThrow(InvalidProfileHomeFeedCollectionRunStatusTransitionError);
  });
});

function createTestContext(ids: readonly string[] = ["home-feed-run-1"]): {
  readonly runs: InMemoryProfileHomeFeedCollectionRunRepository;
  readonly profiles: FakeProfileReferencePort;
  readonly ids: FakeIdGenerator;
  readonly clock: FixedClock;
} {
  return {
    runs: new InMemoryProfileHomeFeedCollectionRunRepository(),
    profiles: new FakeProfileReferencePort(),
    ids: new FakeIdGenerator(ids),
    clock: new FixedClock(createdAt),
  };
}

function createRunFixture(
  options: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id: options.id ?? "home-feed-run-1",
    profileId: options.profileId ?? "profile-1",
    triggerType: options.triggerType ?? "MANUAL_API",
    status: options.status ?? "QUEUED",
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: options.parameters ?? {},
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? createdAt,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  };
}

class FixedClock implements Clock {
  public constructor(private nowResult: string) {}

  public now(): Date {
    return new Date(this.nowResult);
  }

  public setNow(now: string): void {
    this.nowResult = now;
  }
}

class FakeIdGenerator implements IdGenerator {
  private index = 0;

  public constructor(private readonly ids: readonly string[]) {}

  public async generateId(): Promise<string> {
    const id = this.ids[this.index] ?? this.ids[this.ids.length - 1];
    this.index += 1;

    if (id === undefined) {
      throw new Error("No fake id configured.");
    }

    return id;
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
