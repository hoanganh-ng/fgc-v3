import { describe, expect, it } from "vitest";
import {
  CancelProfileSourceAccessCheckRunUseCase,
  ClaimNextProfileSourceAccessCheckRunUseCase,
  ExecuteProfileSourceAccessCheckRunUseCase,
  GetProfileSourceAccessCheckRunUseCase,
  ListProfileSourceAccessCheckRunsUseCase,
  MarkProfileSourceAccessCheckRunFailedUseCase,
  MarkProfileSourceAccessCheckRunRunningUseCase,
  MarkProfileSourceAccessCheckRunSucceededUseCase,
  RequestProfileSourceAccessCheckRunUseCase,
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
  ProfileSourceAccessCheckRunConflictError,
  ProfileSourceAccessCheckRunSourceGroupNotActiveError,
  ProfileSourceAccessCheckRunSourceGroupNotFoundError,
  ProfileSourceAccessCheckRunSourceGroupPlatformUnsupportedError,
  SourceGroupLookupFailedError,
} from "../index";
import type {
  Clock,
  ProfileSourceAccessBrowserCheckPort,
  ProfileSourceAccessBrowserCheckResult,
  ProfileSourceAccessMutationPort,
  ProfileSourceAccessMutationResult,
  ProfileSourceAccessOutcomeClassifierPort,
  IdGenerator,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../index";
import type {
  ProfileSourceAccessBrowserObservation,
} from "../ports/profile-source-access-check-execution.port";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunOutcome,
} from "../../domain";
import { InMemoryProfileSourceAccessCheckRunRepository } from "./in-memory-profile-source-access-check-run-repository";

const createdAt = "2026-05-01T10:00:00.000Z";
const updatedAt = "2026-05-01T10:05:00.000Z";

describe("collector runtime profile-source access check run application use cases", () => {
  it("requests a check run", async () => {
    const context = createTestContext(["check-run-1"]);

    const run = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    expect(run).toEqual({
      id: "check-run-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      triggerType: "MANUAL",
      status: "QUEUED",
      accountStageAtRequest: "WARMING",
      target: {
        platform: "FACEBOOK",
        routeType: "DIRECT_GROUP_URL",
        url: "https://www.facebook.com/groups/source-group-1",
      },
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("prevents requesting multiple active check runs for the same profile and source group", async () => {
    const context = createTestContext(["check-run-1", "check-run-2"]);

    await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileSourceAccessCheckRunConflictError);
  });

  it("rejects check run request if profile is not found", async () => {
    const context = createTestContext(["check-run-1"]);
    context.profiles.result = {
      ok: false,
      errorCode: "PROFILE_NOT_FOUND",
      errorMessage: "Not found",
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("rejects check run request if profile ID mismatches", async () => {
    const context = createTestContext(["check-run-1"]);
    context.profiles.result = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileReferenceLookupFailedError);
  });

  it("rejects check run request if source group ID mismatches", async () => {
    const context = createTestContext(["check-run-1"]);
    context.sourceGroups.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "different-source-group",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/source-group-1",
        categoryId: "category-1",
        entryRoutes: [],
      },
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(SourceGroupLookupFailedError);
  });

  it("rejects check run request if source group is paused", async () => {
    const context = createTestContext(["check-run-1"]);
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
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileSourceAccessCheckRunSourceGroupNotActiveError);
  });

  it("gets a check run", async () => {
    const context = createTestContext(["check-run-1"]);

    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    const get = await new GetProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
    ).execute({ checkRunId: requested.id });

    expect(get).toEqual(requested);
  });

  it("cancels a queued check run", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    const canceled = await new CancelProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    expect(canceled.status).toBe("CANCELED");
    expect(canceled.finishedAt).toBe(updatedAt);
    expect(canceled.updatedAt).toBe(updatedAt);
  });

  it("marks a queued check run as running", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    const running = await new MarkProfileSourceAccessCheckRunRunningUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    expect(running.status).toBe("RUNNING");
    expect(running.startedAt).toBe(updatedAt);
    expect(running.updatedAt).toBe(updatedAt);
  });

  it("marks a running check run as succeeded", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    await new MarkProfileSourceAccessCheckRunRunningUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    const succeeded = await new MarkProfileSourceAccessCheckRunSucceededUseCase(
      context.checkRuns,
      context.clock,
    ).execute({
      checkRunId: requested.id,
      outcome: "PUBLIC_ACCESSIBLE",
    });

    expect(succeeded.status).toBe("SUCCEEDED");
    expect(succeeded.outcome).toBe("PUBLIC_ACCESSIBLE");
    expect(succeeded.finishedAt).toBe(updatedAt);
    expect(succeeded.updatedAt).toBe(updatedAt);
  });

  it("claims the oldest queued check run deterministically", async () => {
    const context = createTestContext();
    await context.checkRuns.save(createCheckRunFixture({
      id: "newer-run",
      requestedAt: "2026-05-01T10:02:00.000Z",
      createdAt: "2026-05-01T10:02:00.000Z",
    }));
    await context.checkRuns.save(createCheckRunFixture({
      id: "oldest-run",
      requestedAt: "2026-05-01T10:00:00.000Z",
      createdAt: "2026-05-01T10:01:00.000Z",
    }));
    await context.checkRuns.save(createCheckRunFixture({
      id: "oldest-created-run",
      requestedAt: "2026-05-01T10:00:00.000Z",
      createdAt: "2026-05-01T10:00:00.000Z",
    }));

    context.clock.nowResult = new Date(updatedAt);

    const claimed = await new ClaimNextProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.clock,
    ).execute();

    expect(claimed?.id).toBe("oldest-created-run");
    expect(claimed?.status).toBe("RUNNING");
    expect(claimed?.startedAt).toBe(updatedAt);
  });

  it("executes a running check run and persists the classified outcome", async () => {
    const context = createExecutionContext();
    const running = createCheckRunFixture({
      status: "RUNNING",
      startedAt: "2026-05-01T10:01:00.000Z",
    });
    await context.checkRuns.save(running);
    context.browser.result = {
      ok: true,
      observation: {
        pageKind: "FACEBOOK_GROUP",
        groupContentVisible: true,
        joinActionVisible: false,
        joinedIndicatorVisible: false,
        accessDeniedIndicatorVisible: false,
      },
    };
    context.classifier.outcome = "PUBLIC_ACCESSIBLE";
    context.clock.nowResult = new Date(updatedAt);

    const completed = await new ExecuteProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.browser,
      context.classifier,
      context.mutation,
      context.clock,
    ).execute({ checkRunId: running.id });

    expect(completed.status).toBe("SUCCEEDED");
    expect(completed.outcome).toBe("PUBLIC_ACCESSIBLE");
    expect(context.mutation.calls).toEqual([
      {
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        outcome: "PUBLIC_ACCESSIBLE",
      },
    ]);
  });

  it("does not mutate profile-source access when browser cleanup fails", async () => {
    const context = createExecutionContext();
    const running = createCheckRunFixture({
      status: "RUNNING",
      startedAt: "2026-05-01T10:01:00.000Z",
    });
    await context.checkRuns.save(running);
    context.browser.result = {
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_CLEANUP_FAILED",
        message: "Profile-source access browser check failed.",
      },
    };

    const completed = await new ExecuteProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.browser,
      context.classifier,
      context.mutation,
      context.clock,
    ).execute({ checkRunId: running.id });

    expect(completed.status).toBe("FAILED");
    expect(completed.failureReason?.code).toBe("ACCESS_CHECK_CLEANUP_FAILED");
    expect(context.classifier.calls).toHaveLength(0);
    expect(context.mutation.calls).toHaveLength(0);
  });

  it("marks the check run failed when mutation fails", async () => {
    const context = createExecutionContext();
    const running = createCheckRunFixture({
      status: "RUNNING",
      startedAt: "2026-05-01T10:01:00.000Z",
    });
    await context.checkRuns.save(running);
    context.mutation.result = {
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_MUTATION_FAILED",
        message: "Profile-source access mutation failed.",
      },
    };

    const completed = await new ExecuteProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.browser,
      context.classifier,
      context.mutation,
      context.clock,
    ).execute({ checkRunId: running.id });

    expect(completed.status).toBe("FAILED");
    expect(completed.failureReason?.code).toBe("ACCESS_CHECK_MUTATION_FAILED");
    expect(completed.outcome).toBeUndefined();
  });

  it("marks a running check run as failed", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    await new MarkProfileSourceAccessCheckRunRunningUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    const failed = await new MarkProfileSourceAccessCheckRunFailedUseCase(
      context.checkRuns,
      context.clock,
    ).execute({
      checkRunId: requested.id,
      failureReason: {
        code: "WORKER_FAILED",
        message: "Worker crashed",
      },
    });

    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toEqual({
      code: "WORKER_FAILED",
      message: "Worker crashed",
    });
    expect(failed.finishedAt).toBe(updatedAt);
    expect(failed.updatedAt).toBe(updatedAt);
  });
});

function createExecutionContext() {
  const checkRuns = new InMemoryProfileSourceAccessCheckRunRepository();
  const browser = new FakeBrowserCheckPort();
  const classifier = new FakeOutcomeClassifierPort();
  const mutation = new FakeMutationPort();
  const clock = new FakeClock(new Date(updatedAt));

  return {
    checkRuns,
    browser,
    classifier,
    mutation,
    clock,
  };
}

function createTestContext(idSequence: string[] = []) {
  const checkRuns = new InMemoryProfileSourceAccessCheckRunRepository();
  const sourceGroups = new FakeSourceGroupLookupPort();
  const profiles = new FakeProfileReferencePort();
  const ids = new FakeIdGenerator(idSequence);
  const clock = new FakeClock(new Date(createdAt));

  return {
    checkRuns,
    sourceGroups,
    profiles,
    ids,
    clock,
  };
}

class FakeIdGenerator implements IdGenerator {
  public constructor(private readonly sequence: string[]) {}

  public async generateId(): Promise<string> {
    const id = this.sequence.shift();

    if (id === undefined) {
      throw new Error("No more IDs in test sequence");
    }

    return id;
  }
}

class FakeClock implements Clock {
  public constructor(public nowResult: Date) {}

  public now(): Date {
    return this.nowResult;
  }
}

class FakeSourceGroupLookupPort implements SourceGroupLookupPort {
  public result: SourceGroupLookupResult = {
    ok: true,
    statusCode: 200,
    sourceGroup: {
      id: "source-group-1",
      platform: "FACEBOOK",
      status: "ACTIVE",
      url: "https://www.facebook.com/groups/source-group-1",
      categoryId: "category-1",
      entryRoutes: [],
    },
  };

  public async getSourceGroup(): Promise<SourceGroupLookupResult> {
    return this.result;
  }
}

class FakeProfileReferencePort implements ProfileReferencePort {
  public result: ProfileReferenceResult = {
    ok: true,
    profileId: "profile-1",
    accountStage: "WARMING",
  };

  public async getProfileAccountStage(): Promise<ProfileReferenceResult> {
    return this.result;
  }
}

class FakeBrowserCheckPort implements ProfileSourceAccessBrowserCheckPort {
  public result: ProfileSourceAccessBrowserCheckResult = {
    ok: true,
    observation: {
      pageKind: "FACEBOOK_GROUP",
      groupContentVisible: true,
      joinActionVisible: false,
      joinedIndicatorVisible: false,
      accessDeniedIndicatorVisible: false,
    },
  };

  public async check(): Promise<ProfileSourceAccessBrowserCheckResult> {
    return this.result;
  }
}

class FakeOutcomeClassifierPort implements ProfileSourceAccessOutcomeClassifierPort {
  public outcome: ProfileSourceAccessCheckRunOutcome = "PUBLIC_ACCESSIBLE";
  public readonly calls: ProfileSourceAccessBrowserObservation[] = [];

  public async classify(
    observation: ProfileSourceAccessBrowserObservation,
  ): Promise<ProfileSourceAccessCheckRunOutcome> {
    this.calls.push(observation);
    return this.outcome;
  }
}

class FakeMutationPort implements ProfileSourceAccessMutationPort {
  public result: ProfileSourceAccessMutationResult = { ok: true };
  public readonly calls: Array<{
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly outcome: ProfileSourceAccessCheckRunOutcome;
  }> = [];

  public async applyOutcome(input: {
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly outcome: ProfileSourceAccessCheckRunOutcome;
  }): Promise<ProfileSourceAccessMutationResult> {
    this.calls.push(input);
    return this.result;
  }
}

function createCheckRunFixture(
  overrides: Partial<ProfileSourceAccessCheckRun> = {},
): ProfileSourceAccessCheckRun {
  return {
    ...createBaseCheckRunFixture(),
    ...overrides,
  };
}

function createBaseCheckRunFixture(): ProfileSourceAccessCheckRun {
  return {
    id: "check-run-1",
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    triggerType: "MANUAL" as const,
    status: "QUEUED" as const,
    accountStageAtRequest: "WARMING" as const,
    target: {
      platform: "FACEBOOK" as const,
      routeType: "DIRECT_GROUP_URL" as const,
      url: "https://www.facebook.com/groups/source-group-1",
    },
    requestedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}
