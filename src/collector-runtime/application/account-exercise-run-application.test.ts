import { describe, expect, it } from "vitest";
import {
  AccountExerciseRunNotFoundError,
  AccountExerciseRunLeaseConflictError,
  AttachAccountExerciseRunLeaseUseCase,
  CancelAccountExerciseRunUseCase,
  ClaimNextAccountExerciseRunUseCase,
  GetAccountExerciseRunUseCase,
  InvalidAccountExerciseRunStatusTransitionError,
  ListAccountExerciseRunsUseCase,
  MarkAccountExerciseRunFailedUseCase,
  MarkAccountExerciseRunRunningUseCase,
  MarkAccountExerciseRunSucceededUseCase,
  RequestAccountExerciseRunUseCase,
  AccountExerciseRunValidationError,
} from "./index";
import type { Clock, IdGenerator, SourceGroupLookupPort, SourceGroupLookupResult } from "./index";
import { InMemoryAccountExerciseRunRepository } from "./test-support/in-memory-account-exercise-run-repository";
import type {
  AccountExerciseRun,
  AccountExerciseRunFailureReason,
  AccountExerciseRunSafeSummary,
} from "../domain";

const createdAt = "2026-05-01T10:00:00.000Z";
const updatedAt = "2026-05-01T10:05:00.000Z";

describe("collector runtime account exercise run application use cases", () => {
  it("requests a queued ambient account exercise run", async () => {
    const context = createTestContext(["exercise-run-created"]);

    const run = await new RequestAccountExerciseRunUseCase(
      context.accountExerciseRuns,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      stageAtStart: "NEW_ACCOUNT",
      maxDurationMs: 120_000,
      maxScrolls: 2,
      minDwellMs: 2_000,
    });

    expect(run).toEqual({
      id: "exercise-run-created",
      profileId: "profile-1",
      exerciseType: "AMBIENT_ACCOUNT",
      status: "QUEUED",
      stageAtStart: "NEW_ACCOUNT",
      actionBudget: {
        maxDurationMs: 120_000,
        maxScrolls: 2,
        minDwellMs: 2_000,
      },
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("requests a queued category browse exercise run and selects deterministic route", async () => {
    const context = createTestContext(["exercise-run-created"]);

    const run = await new RequestAccountExerciseRunUseCase(
      context.accountExerciseRuns,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      stageAtStart: "WARMING",
      exerciseType: "CATEGORY_BROWSE",
      sourceGroupId: "source-group-1",
      maxDurationMs: 120_000,
      maxScrolls: 2,
    });

    expect(run).toEqual({
      id: "exercise-run-created",
      profileId: "profile-1",
      exerciseType: "CATEGORY_BROWSE",
      status: "QUEUED",
      stageAtStart: "WARMING",
      actionBudget: {
        maxDurationMs: 120_000,
        maxScrolls: 2,
      },
      target: {
        categoryId: "category-1",
        sourceGroupId: "source-group-1",
        entryRouteId: "route-1",
        entryRouteType: "CATEGORY_ENTRY_URL",
        url: "https://www.facebook.com/groups/source-group-1/category-1",
        riskLevel: "LOW",
      },
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("selects default entry route before non-default within equal risk", async () => {
    const context = createTestContext(["exercise-run-created"]);
    context.sourceGroups.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/source-group-1",
        categoryId: "category-1",
        entryRoutes: [
          {
            id: "route-non-default",
            type: "CATEGORY_ENTRY_URL",
            url: "https://www.facebook.com/groups/source-group-1/route-non-default",
            riskLevel: "LOW",
            isDefault: false,
          },
          {
            id: "route-default",
            type: "CATEGORY_ENTRY_URL",
            url: "https://www.facebook.com/groups/source-group-1/route-default",
            riskLevel: "LOW",
            isDefault: true,
          },
        ],
      },
    };

    const run = await new RequestAccountExerciseRunUseCase(
      context.accountExerciseRuns,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      stageAtStart: "WARMING",
      exerciseType: "CATEGORY_BROWSE",
      sourceGroupId: "source-group-1",
      maxDurationMs: 120_000,
      maxScrolls: 2,
    });

    expect(run.target?.entryRouteId).toBe("route-default");
  });

  it("rejects category browse exercise run requests when source group is paused", async () => {
    const context = createTestContext();
    context.sourceGroups.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "PAUSED",
        url: "https://www.facebook.com/groups/source-group-1",
        categoryId: "category-1",
        entryRoutes: [],
      },
    };

    await expect(
      new RequestAccountExerciseRunUseCase(
        context.accountExerciseRuns,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        stageAtStart: "WARMING",
        exerciseType: "CATEGORY_BROWSE",
        sourceGroupId: "source-group-1",
        maxDurationMs: 120_000,
        maxScrolls: 2,
      }),
    ).rejects.toThrow();
  });

  it("moves queued runs through running and succeeded transitions", async () => {
    const context = createTestContext();
    const safeSummary = createSafeSummary();

    await seedAccountExerciseRun(context, { status: "QUEUED" });
    context.clock.setNow(updatedAt);

    const runningRun = await new MarkAccountExerciseRunRunningUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute({
      accountExerciseRunId: "exercise-run-1",
      leaseId: "lease-1",
    });

    expect(runningRun).toMatchObject({
      id: "exercise-run-1",
      leaseId: "lease-1",
      status: "RUNNING",
      startedAt: updatedAt,
      updatedAt,
    });

    const succeededRun = await new MarkAccountExerciseRunSucceededUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute({
      accountExerciseRunId: "exercise-run-1",
      safeSummary,
    });

    expect(succeededRun).toMatchObject({
      status: "SUCCEEDED",
      safeSummary,
      finishedAt: updatedAt,
      updatedAt,
    });
  });

  it("cancels queued account exercise runs", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, { status: "QUEUED" });
    context.clock.setNow(updatedAt);

    const canceledRun = await new CancelAccountExerciseRunUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute({
      accountExerciseRunId: "exercise-run-1",
    });

    expect(canceledRun).toMatchObject({
      status: "CANCELED",
      finishedAt: updatedAt,
      updatedAt,
    });
  });

  it("claims the oldest queued account exercise run and transitions it to running", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      id: "exercise-run-newer",
      status: "QUEUED",
      requestedAt: "2026-05-01T10:05:00.000Z",
      createdAt: "2026-05-01T10:05:00.000Z",
    });
    await seedAccountExerciseRun(context, {
      id: "exercise-run-older",
      status: "QUEUED",
      requestedAt: "2026-05-01T10:00:00.000Z",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
    context.clock.setNow(updatedAt);

    const claimedRun = await new ClaimNextAccountExerciseRunUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute();

    expect(claimedRun).toMatchObject({
      id: "exercise-run-older",
      status: "RUNNING",
      startedAt: updatedAt,
      updatedAt,
    });
    await expect(
      context.accountExerciseRuns.findById("exercise-run-older"),
    ).resolves.toMatchObject({
      status: "RUNNING",
      startedAt: updatedAt,
    });
    await expect(
      context.accountExerciseRuns.findById("exercise-run-newer"),
    ).resolves.toMatchObject({
      status: "QUEUED",
    });
  });

  it("does not claim canceled, running, succeeded, or failed account exercise runs", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      id: "exercise-run-canceled",
      status: "CANCELED",
      finishedAt: updatedAt,
    });
    await seedAccountExerciseRun(context, {
      id: "exercise-run-running",
      status: "RUNNING",
      startedAt: createdAt,
    });
    await seedAccountExerciseRun(context, {
      id: "exercise-run-succeeded",
      status: "SUCCEEDED",
      startedAt: createdAt,
      finishedAt: updatedAt,
      safeSummary: createSafeSummary(),
    });
    await seedAccountExerciseRun(context, {
      id: "exercise-run-failed",
      status: "FAILED",
      startedAt: createdAt,
      finishedAt: updatedAt,
      failureReason: {
        code: "EXERCISE_FAILED",
        message: "Exercise failed.",
      },
    });

    await expect(
      new ClaimNextAccountExerciseRunUseCase(
        context.accountExerciseRuns,
        context.clock,
      ).execute(),
    ).resolves.toBeNull();
  });

  it("does not claim the same queued account exercise run twice", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, { status: "QUEUED" });

    const useCase = new ClaimNextAccountExerciseRunUseCase(
      context.accountExerciseRuns,
      context.clock,
    );

    await expect(useCase.execute()).resolves.toMatchObject({
      id: "exercise-run-1",
      status: "RUNNING",
    });
    await expect(useCase.execute()).resolves.toBeNull();
  });

  it("attaches a lease id to a running account exercise run", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
    });
    context.clock.setNow(updatedAt);

    const updatedRun = await new AttachAccountExerciseRunLeaseUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute({
      accountExerciseRunId: "exercise-run-1",
      leaseId: "lease-1",
    });

    expect(updatedRun).toMatchObject({
      status: "RUNNING",
      leaseId: "lease-1",
      updatedAt,
    });
  });

  it("allows reattaching the same lease id without replacing it", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
      leaseId: "lease-1",
    });

    const updatedRun = await new AttachAccountExerciseRunLeaseUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute({
      accountExerciseRunId: "exercise-run-1",
      leaseId: "lease-1",
    });

    expect(updatedRun).toMatchObject({
      leaseId: "lease-1",
      updatedAt: createdAt,
    });
  });

  it("rejects empty lease ids when attaching a lease", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
    });

    await expect(
      new AttachAccountExerciseRunLeaseUseCase(
        context.accountExerciseRuns,
        context.clock,
      ).execute({
        accountExerciseRunId: "exercise-run-1",
        leaseId: " ",
      }),
    ).rejects.toThrow(AccountExerciseRunValidationError);
    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.not.toHaveProperty("leaseId");
  });

  it("rejects attaching a lease to non-running account exercise runs", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      status: "QUEUED",
    });

    await expect(
      new AttachAccountExerciseRunLeaseUseCase(
        context.accountExerciseRuns,
        context.clock,
      ).execute({
        accountExerciseRunId: "exercise-run-1",
        leaseId: "lease-1",
      }),
    ).rejects.toThrow(InvalidAccountExerciseRunStatusTransitionError);
  });

  it("rejects replacing an existing different lease id", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
      leaseId: "lease-1",
    });

    await expect(
      new AttachAccountExerciseRunLeaseUseCase(
        context.accountExerciseRuns,
        context.clock,
      ).execute({
        accountExerciseRunId: "exercise-run-1",
        leaseId: "lease-2",
      }),
    ).rejects.toThrow(AccountExerciseRunLeaseConflictError);
  });

  it("marks running account exercise runs failed with sanitized failure reason", async () => {
    const context = createTestContext();
    const failureReason: AccountExerciseRunFailureReason = {
      code: "LOGIN_REQUIRED",
      message: "Login is required before ambient exercise can continue.",
    };

    await seedAccountExerciseRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
      leaseId: "lease-1",
    });
    context.clock.setNow(updatedAt);

    const failedRun = await new MarkAccountExerciseRunFailedUseCase(
      context.accountExerciseRuns,
      context.clock,
    ).execute({
      accountExerciseRunId: "exercise-run-1",
      failureReason,
      safeSummary: createSafeSummary({
        pageLoaded: true,
        loginRequired: true,
        leaseReleased: true,
      }),
    });
    const serialized = JSON.stringify(failedRun);

    expect(failedRun).toMatchObject({
      status: "FAILED",
      failureReason,
      safeSummary: {
        pageLoaded: true,
        loginRequired: true,
        leaseReleased: true,
      },
      finishedAt: updatedAt,
    });
    expect(serialized).not.toContain("cookie");
    expect(serialized).not.toContain("localStorage");
    expect(serialized).not.toContain("proxy-password");
    expect(serialized).not.toContain("rawFacebookGraphqlPayload");
    expect(serialized).not.toContain("checkpoint html");
  });

  it("rejects invalid account exercise run status transitions", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, { status: "QUEUED" });

    await expect(
      new MarkAccountExerciseRunSucceededUseCase(
        context.accountExerciseRuns,
        context.clock,
      ).execute({
        accountExerciseRunId: "exercise-run-1",
        safeSummary: createSafeSummary(),
      }),
    ).rejects.toThrow(InvalidAccountExerciseRunStatusTransitionError);
  });

  it("rejects transitions from terminal account exercise run statuses", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      status: "SUCCEEDED",
      startedAt: createdAt,
      finishedAt: updatedAt,
      safeSummary: createSafeSummary(),
    });

    await expect(
      new MarkAccountExerciseRunFailedUseCase(
        context.accountExerciseRuns,
        context.clock,
      ).execute({
        accountExerciseRunId: "exercise-run-1",
        failureReason: {
          code: "UNKNOWN_FAILURE",
          message: "Exercise failed after completion.",
        },
      }),
    ).rejects.toThrow(InvalidAccountExerciseRunStatusTransitionError);
  });

  it("gets and lists account exercise runs", async () => {
    const context = createTestContext();

    await seedAccountExerciseRun(context, {
      id: "exercise-run-1",
      profileId: "profile-1",
      status: "QUEUED",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
    await seedAccountExerciseRun(context, {
      id: "exercise-run-2",
      profileId: "profile-2",
      status: "RUNNING",
      startedAt: "2026-05-01T10:30:00.000Z",
      createdAt: "2026-05-01T10:30:00.000Z",
    });

    await expect(
      new GetAccountExerciseRunUseCase(context.accountExerciseRuns).execute({
        accountExerciseRunId: "exercise-run-1",
      }),
    ).resolves.toMatchObject({
      id: "exercise-run-1",
      status: "QUEUED",
    });

    await expect(
      new ListAccountExerciseRunsUseCase(context.accountExerciseRuns).execute({
        status: "RUNNING",
        profileId: "profile-2",
        limit: 10,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: "exercise-run-2",
          status: "RUNNING",
        },
      ],
      page: {
        limit: 10,
        offset: 0,
        total: 1,
      },
    });
  });

  it("rejects missing account exercise runs", async () => {
    const context = createTestContext();

    await expect(
      new GetAccountExerciseRunUseCase(context.accountExerciseRuns).execute({
        accountExerciseRunId: "missing-exercise-run",
      }),
    ).rejects.toThrow(AccountExerciseRunNotFoundError);
  });
});

interface TestContext {
  readonly accountExerciseRuns: InMemoryAccountExerciseRunRepository;
  readonly sourceGroups: FakeSourceGroupLookupPort;
  readonly clock: FixedClock;
  readonly ids: FakeIdGenerator;
}

function createTestContext(ids: readonly string[] = []): TestContext {
  return {
    accountExerciseRuns: new InMemoryAccountExerciseRunRepository(),
    sourceGroups: new FakeSourceGroupLookupPort(),
    clock: new FixedClock(),
    ids: new FakeIdGenerator(ids),
  };
}

class FakeSourceGroupLookupPort implements SourceGroupLookupPort {
  public readonly calls: string[] = [];
  public result: SourceGroupLookupResult = {
    ok: true,
    statusCode: 200,
    sourceGroup: {
      id: "source-group-1",
      platform: "FACEBOOK",
      status: "ACTIVE",
      url: "https://www.facebook.com/groups/source-group-1",
      categoryId: "category-1",
      entryRoutes: [
        {
          id: "route-1",
          type: "CATEGORY_ENTRY_URL",
          url: "https://www.facebook.com/groups/source-group-1/category-1",
          riskLevel: "LOW",
          isDefault: true,
        },
      ],
    },
  };

  public async getSourceGroup(
    requestedSourceGroupId: string,
  ): Promise<SourceGroupLookupResult> {
    this.calls.push(requestedSourceGroupId);

    if (this.result.ok) {
      return {
        ...this.result,
        sourceGroup: {
          ...this.result.sourceGroup,
          id: requestedSourceGroupId,
        },
      };
    }

    return this.result;
  }
}

async function seedAccountExerciseRun(
  context: TestContext,
  options: Partial<AccountExerciseRun> = {},
): Promise<AccountExerciseRun> {
  const run = createAccountExerciseRun(options);

  await context.accountExerciseRuns.save(run);

  return run;
}

function createAccountExerciseRun(
  options: Partial<AccountExerciseRun> = {},
): AccountExerciseRun {
  return {
    id: options.id ?? "exercise-run-1",
    profileId: options.profileId ?? "profile-1",
    ...(options.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
    exerciseType: options.exerciseType ?? "AMBIENT_ACCOUNT",
    status: options.status ?? "QUEUED",
    stageAtStart: options.stageAtStart ?? "NEW_ACCOUNT",
    actionBudget: options.actionBudget ?? {
      maxDurationMs: 120_000,
      maxScrolls: 2,
      minDwellMs: 2_000,
    },
    ...(options.safeSummary !== undefined
      ? { safeSummary: options.safeSummary }
      : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? createdAt,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? createdAt,
    updatedAt: options.updatedAt ?? options.createdAt ?? createdAt,
  };
}

function createSafeSummary(
  options: Partial<AccountExerciseRunSafeSummary> = {},
): AccountExerciseRunSafeSummary {
  return {
    pageLoaded: options.pageLoaded ?? true,
    loginRequired: options.loginRequired ?? false,
    checkpointDetected: options.checkpointDetected ?? false,
    scrollsPerformed: options.scrollsPerformed ?? 2,
    durationMs: options.durationMs ?? 10_000,
    leaseReleased: options.leaseReleased ?? true,
  };
}

class FixedClock implements Clock {
  private current = new Date(createdAt);

  public now(): Date {
    return this.current;
  }

  public setNow(value: string): void {
    this.current = new Date(value);
  }
}

class FakeIdGenerator implements IdGenerator {
  private nextIndex = 0;

  public constructor(private readonly ids: readonly string[]) {}

  public async generateId(): Promise<string> {
    const id = this.ids[this.nextIndex] ?? `exercise-run-${this.nextIndex + 1}`;

    this.nextIndex += 1;

    return id;
  }
}
