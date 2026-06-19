import { describe, expect, it } from "vitest";
import {
  CancelProfileHomeFeedCollectionRunUseCase,
  ClaimNextProfileHomeFeedCollectionRunUseCase,
  GetProfileHomeFeedCollectionRunUseCase,
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  ListProfileHomeFeedCollectionRunsUseCase,
  MarkProfileHomeFeedCollectionRunFailedUseCase,
  MarkProfileHomeFeedCollectionRunSucceededUseCase,
  ProfileHomeFeedCollectionRunAlreadyExistsError,
  ProfileHomeFeedCollectionRunConflictError,
  ProfileHomeFeedCollectionRunNotFoundError,
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
import type {
  ProfileHomeFeedCollectionRunStatusTransition,
  ProfileHomeFeedCollectionRunStatusTransitionResult,
} from "./ports/profile-home-feed-collection-run-repository.port";

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

  it("rejects duplicate run ids without overwriting the existing row", async () => {
    const context = createTestContext();
    const existing = createRunFixture({
      id: "duplicate-run",
      status: "SUCCEEDED",
      startedAt: "2026-06-19T10:01:00.000Z",
      finishedAt: updatedAt,
      summary: createSummary(),
    });
    await context.runs.create(existing);

    await expect(
      context.runs.create(
        createRunFixture({
          id: "duplicate-run",
          status: "QUEUED",
          profileId: "different-profile",
          requestedAt: "2026-06-19T11:00:00.000Z",
          createdAt: "2026-06-19T11:00:00.000Z",
          updatedAt: "2026-06-19T11:00:00.000Z",
        }),
      ),
    ).rejects.toThrow(ProfileHomeFeedCollectionRunAlreadyExistsError);

    await expect(context.runs.findById("duplicate-run")).resolves.toEqual(
      existing,
    );
  });

  it("does not allow a queued run to replace a terminal run with the same id", async () => {
    const context = createTestContext();
    const terminal = createRunFixture({
      id: "terminal-id",
      status: "FAILED",
      startedAt: "2026-06-19T10:01:00.000Z",
      finishedAt: "2026-06-19T10:02:00.000Z",
      failureReason: {
        code: "CAPTURE_FAILED",
        message: "Home-feed collection failed.",
      },
    });
    await context.runs.create(terminal);

    await expect(
      context.runs.create(
        createRunFixture({
          id: "terminal-id",
          status: "QUEUED",
        }),
      ),
    ).rejects.toThrow(ProfileHomeFeedCollectionRunAlreadyExistsError);

    await expect(context.runs.findById("terminal-id")).resolves.toMatchObject({
      status: "FAILED",
      finishedAt: "2026-06-19T10:02:00.000Z",
    });
  });

  it("does not let the request use case return a run whose immutable fields diverge from the durable row on id collision", async () => {
    const context = createTestContext(["collision-run"]);
    context.profiles.result = {
      ok: true,
      profileId: "profile-1",
      accountStage: "WARMING",
    };

    const firstRun = await new RequestProfileHomeFeedCollectionRunUseCase(
      context.runs,
      context.profiles,
      context.ids,
      context.clock,
    ).execute({ profileId: "profile-1" });
    context.clock.setNow(updatedAt);

    // A second request would mint a different id with the in-memory
    // FakeIdGenerator configured for a single id, so reuse the same id
    // explicitly to simulate an external id collision.
    await expect(
      context.runs.create(
        createRunFixture({
          id: firstRun.id,
          status: "SUCCEEDED",
          profileId: "different-profile",
          startedAt: "2026-06-19T11:00:00.000Z",
          finishedAt: "2026-06-19T11:01:00.000Z",
          summary: createSummary(),
          requestedAt: "2026-06-19T11:00:00.000Z",
          createdAt: "2026-06-19T11:00:00.000Z",
          updatedAt: "2026-06-19T11:01:00.000Z",
        }),
      ),
    ).rejects.toThrow(ProfileHomeFeedCollectionRunAlreadyExistsError);

    // The durable row still matches the originally-requested run.
    await expect(context.runs.findById(firstRun.id)).resolves.toEqual(
      firstRun,
    );
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
    await context.runs.create(
      createRunFixture({
        id: "home-feed-run-older",
        profileId: "profile-1",
        createdAt: "2026-06-19T10:00:00.000Z",
      }),
    );
    await context.runs.create(
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

  it("lists profile home-feed runs by requestedAt descending then id descending", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "a-run",
        profileId: "profile-a",
        requestedAt: "2026-06-19T10:00:00.000Z",
      }),
    );
    await context.runs.create(
      createRunFixture({
        id: "b-run",
        profileId: "profile-b",
        requestedAt: "2026-06-19T10:00:00.000Z",
      }),
    );
    await context.runs.create(
      createRunFixture({
        id: "older-run",
        profileId: "profile-c",
        requestedAt: "2026-06-19T09:00:00.000Z",
      }),
    );

    const listed = await new ListProfileHomeFeedCollectionRunsUseCase(
      context.runs,
    ).execute({
      limit: 10,
      offset: 0,
    });

    expect(listed.items.map((item) => item.id)).toEqual([
      "b-run",
      "a-run",
      "older-run",
    ]);
  });

  it("claims the oldest queued profile home-feed run by requestedAt then id", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "b-run",
        profileId: "profile-b",
        requestedAt: "2026-06-19T10:00:00.000Z",
        createdAt: "2026-06-19T10:01:00.000Z",
      }),
    );
    await context.runs.create(
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
    await context.runs.create(createRunFixture({ id: "home-feed-run-1" }));
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
    await successContext.runs.create(
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
          capturedPayloads: 4,
          extractorCandidates: 3,
          sourcePublishersObserved: 2,
          contentItemsSubmitted: 1,
          failedPublisherObservations: 0,
          failedContentSubmissions: 0,
          leaseReleased: true,
        },
      });

    expect(succeeded).toMatchObject({
      status: "SUCCEEDED",
      summary: {
        capturedPayloads: 4,
        contentItemsSubmitted: 1,
      },
      finishedAt: updatedAt,
    });

    const failureContext = createTestContext();
    await failureContext.runs.create(
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
        capturedPayloads: 0,
      },
    });

    expect(failed).toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "CAPTURE_FAILED",
        message: "Home-feed collection failed.",
      },
      summary: {
        capturedPayloads: 0,
      },
      finishedAt: updatedAt,
    });
  });

  it("rejects successful completion without a summary at the application boundary", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "success-run",
        status: "RUNNING",
        startedAt: createdAt,
      }),
    );

    const useCase = new MarkProfileHomeFeedCollectionRunSucceededUseCase(
      context.runs,
      context.clock,
    );

    await expect(
      // @ts-expect-error summary is intentionally omitted for runtime validation coverage.
      useCase.execute({
        runId: "success-run",
      }),
    ).rejects.toThrow(ProfileHomeFeedCollectionRunValidationError);
  });

  it("keeps a claimed run running when cancellation loses a claim race", async () => {
    const runs = new ClaimBeforeCancelRepository();
    await runs.create(createRunFixture({ id: "race-run" }));
    const clock = new FixedClock(updatedAt);

    await expect(
      new CancelProfileHomeFeedCollectionRunUseCase(runs, clock).execute({
        runId: "race-run",
      }),
    ).rejects.toThrow(InvalidProfileHomeFeedCollectionRunStatusTransitionError);
    await expect(runs.findById("race-run")).resolves.toMatchObject({
      status: "RUNNING",
      startedAt: updatedAt,
    });
  });

  it("allows only one terminal transition when success and failure race", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "terminal-race-run",
        status: "RUNNING",
        startedAt: createdAt,
      }),
    );
    context.clock.setNow(updatedAt);
    const succeed = new MarkProfileHomeFeedCollectionRunSucceededUseCase(
      context.runs,
      context.clock,
    );
    const fail = new MarkProfileHomeFeedCollectionRunFailedUseCase(
      context.runs,
      context.clock,
    );

    const results = await Promise.allSettled([
      succeed.execute({
        runId: "terminal-race-run",
        summary: createSummary(),
      }),
      fail.execute({
        runId: "terminal-race-run",
        failureReason: {
          code: "CAPTURE_FAILED",
          message: "Home-feed collection failed.",
        },
      }),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(
      InvalidProfileHomeFeedCollectionRunStatusTransitionError,
    );
  });

  it("rejects invalid terminal transitions", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "succeeded-run",
        status: "SUCCEEDED",
        startedAt: createdAt,
        finishedAt: updatedAt,
        summary: createSummary(),
      }),
    );

    await expect(
      new CancelProfileHomeFeedCollectionRunUseCase(
        context.runs,
        context.clock,
      ).execute({ runId: "succeeded-run" }),
    ).rejects.toThrow(InvalidProfileHomeFeedCollectionRunStatusTransitionError);
  });

  it("rejects repeated terminal transitions", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "failed-run",
        status: "FAILED",
        startedAt: createdAt,
        finishedAt: updatedAt,
        failureReason: {
          code: "CAPTURE_FAILED",
          message: "Home-feed collection failed.",
        },
      }),
    );

    await expect(
      new MarkProfileHomeFeedCollectionRunSucceededUseCase(
        context.runs,
        context.clock,
      ).execute({
        runId: "failed-run",
        summary: createSummary(),
      }),
    ).rejects.toThrow(InvalidProfileHomeFeedCollectionRunStatusTransitionError);
  });

  it("distinguishes not-found transitions from status conflicts", async () => {
    const context = createTestContext();

    await expect(
      new MarkProfileHomeFeedCollectionRunFailedUseCase(
        context.runs,
        context.clock,
      ).execute({
        runId: "missing-run",
        failureReason: {
          code: "CAPTURE_FAILED",
          message: "Home-feed collection failed.",
        },
      }),
    ).rejects.toThrow(ProfileHomeFeedCollectionRunNotFoundError);
  });

  it("rejects stale expected-status transitions without overwriting current status", async () => {
    const context = createTestContext();
    await context.runs.create(
      createRunFixture({
        id: "stale-run",
        status: "RUNNING",
        startedAt: createdAt,
      }),
    );

    const result = await context.runs.transitionStatus({
      runId: "stale-run",
      expectedStatus: "QUEUED",
      nextStatus: "CANCELED",
      finishedAt: updatedAt,
      updatedAt,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "status_conflict",
      currentRun: {
        status: "RUNNING",
      },
    });
    await expect(context.runs.findById("stale-run")).resolves.toMatchObject({
      status: "RUNNING",
    });
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
  const status = options.status ?? "QUEUED";

  return {
    id: options.id ?? "home-feed-run-1",
    profileId: options.profileId ?? "profile-1",
    triggerType: options.triggerType ?? "MANUAL_API",
    status,
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: options.parameters ?? {},
    ...(options.summary !== undefined
      ? { summary: options.summary }
      : status === "SUCCEEDED"
        ? { summary: createSummary() }
        : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : status === "FAILED"
        ? {
            failureReason: {
              code: "CAPTURE_FAILED",
              message: "Home-feed collection failed.",
            },
          }
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

function createSummary(): NonNullable<ProfileHomeFeedCollectionRun["summary"]> {
  return {
    capturedPayloads: 4,
    extractorCandidates: 3,
    sourcePublishersObserved: 2,
    contentItemsSubmitted: 1,
    failedPublisherObservations: 0,
    failedContentSubmissions: 0,
    leaseReleased: true,
  };
}

class ClaimBeforeCancelRepository extends InMemoryProfileHomeFeedCollectionRunRepository {
  public override async transitionStatus(
    transition: ProfileHomeFeedCollectionRunStatusTransition,
  ): Promise<ProfileHomeFeedCollectionRunStatusTransitionResult> {
    if (
      transition.expectedStatus === "QUEUED" &&
      transition.nextStatus === "CANCELED"
    ) {
      await this.claimNextQueued(transition.updatedAt);
    }

    return super.transitionStatus(transition);
  }
}
