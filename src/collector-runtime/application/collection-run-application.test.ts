import { describe, expect, it } from "vitest";
import {
  CancelCollectionRunUseCase,
  ClaimNextCollectionRunUseCase,
  CollectionRunSourceGroupNotActiveError,
  CollectionRunSourceGroupNotFoundError,
  CollectionRunSourceGroupPlatformUnsupportedError,
  ExecuteCollectionRunUseCase,
  GetCollectionRunUseCase,
  InvalidCollectionRunStatusTransitionError,
  ListCollectionRunsUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  RequestCollectionRunUseCase,
} from "./index";
import type {
  Clock,
  CollectionRunExecutorInput,
  CollectionRunExecutorPort,
  CollectionRunExecutorResult,
  IdGenerator,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
} from "./index";
import { InMemoryCollectionRunRepository } from "./test-support/in-memory-collection-run-repository";
import type {
  CollectionRun,
  CollectionRunStatus,
  CollectionRunSummary,
} from "../domain";

const createdAt = "2026-04-01T10:00:00.000Z";
const updatedAt = "2026-04-01T11:00:00.000Z";
const sourceGroupId = "source-group-1";

describe("collector runtime collection run application use cases", () => {
  it("requests a queued manual API collection run for an active Facebook source group", async () => {
    const context = createTestContext(["collection-run-created"]);

    const collectionRun = await new RequestCollectionRunUseCase(
      context.collectionRuns,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      sourceGroupId,
      maxScrolls: 5,
      maxDurationMs: 45_000,
    });

    expect(collectionRun).toEqual({
      id: "collection-run-created",
      sourceGroupId,
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters: {
        maxScrolls: 5,
        maxDurationMs: 45_000,
      },
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
    expect(context.sourceGroups.calls).toEqual([sourceGroupId]);
    await expect(
      context.collectionRuns.findById("collection-run-created"),
    ).resolves.toEqual(collectionRun);
  });

  it("rejects collection run requests when the source group is missing", async () => {
    const context = createTestContext(["collection-run-created"]);

    context.sourceGroups.setResult({
      ok: false,
      statusCode: 404,
      errorCode: "SOURCE_GROUP_NOT_FOUND",
      errorMessage: "Source group not found.",
    });

    await expect(
      new RequestCollectionRunUseCase(
        context.collectionRuns,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        sourceGroupId: "missing-source-group",
      }),
    ).rejects.toThrow(CollectionRunSourceGroupNotFoundError);
    await expect(
      context.collectionRuns.list({ limit: 10, offset: 0 }),
    ).resolves.toMatchObject({
      items: [],
    });
  });

  it("rejects collection run requests for inactive source groups", async () => {
    const context = createTestContext(["collection-run-created"]);

    context.sourceGroups.setSourceGroup({
      status: "PAUSED",
    });

    await expect(
      new RequestCollectionRunUseCase(
        context.collectionRuns,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        sourceGroupId,
      }),
    ).rejects.toThrow(CollectionRunSourceGroupNotActiveError);
  });

  it("rejects collection run requests for non-Facebook source groups", async () => {
    const context = createTestContext(["collection-run-created"]);

    context.sourceGroups.setSourceGroup({
      platform: "YOUTUBE",
    });

    await expect(
      new RequestCollectionRunUseCase(
        context.collectionRuns,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        sourceGroupId,
      }),
    ).rejects.toThrow(CollectionRunSourceGroupPlatformUnsupportedError);
  });

  it("moves queued runs through running and succeeded transitions", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, { status: "QUEUED" });
    context.clock.setNow(updatedAt);

    const runningCollectionRun = await new MarkCollectionRunRunningUseCase(
      context.collectionRuns,
      context.clock,
    ).execute({
      collectionRunId: "collection-run-1",
    });

    expect(runningCollectionRun).toMatchObject({
      id: "collection-run-1",
      status: "RUNNING",
      startedAt: updatedAt,
      updatedAt,
    });

    const succeededCollectionRun = await new MarkCollectionRunSucceededUseCase(
      context.collectionRuns,
      context.clock,
    ).execute({
      collectionRunId: "collection-run-1",
      summary: {
        capturedPayloads: 3,
        extractorCandidates: 4,
        contentItemsSubmitted: 4,
        failedSubmissions: 0,
        leaseReleased: true,
      },
    });

    expect(succeededCollectionRun).toMatchObject({
      id: "collection-run-1",
      status: "SUCCEEDED",
      finishedAt: updatedAt,
      summary: {
        capturedPayloads: 3,
        contentItemsSubmitted: 4,
        leaseReleased: true,
      },
      updatedAt,
    });
  });

  it("cancels queued collection runs", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, { status: "QUEUED" });
    context.clock.setNow(updatedAt);

    const canceledCollectionRun = await new CancelCollectionRunUseCase(
      context.collectionRuns,
      context.clock,
    ).execute({
      collectionRunId: "collection-run-1",
    });

    expect(canceledCollectionRun).toMatchObject({
      status: "CANCELED",
      finishedAt: updatedAt,
      updatedAt,
    });
  });

  it("claims the oldest queued collection run and transitions it to running", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, {
      id: "collection-run-newer",
      status: "QUEUED",
      requestedAt: "2026-04-01T10:05:00.000Z",
      createdAt: "2026-04-01T10:05:00.000Z",
    });
    await seedCollectionRun(context, {
      id: "collection-run-older",
      status: "QUEUED",
      requestedAt: "2026-04-01T10:00:00.000Z",
      createdAt: "2026-04-01T10:00:00.000Z",
    });
    context.clock.setNow(updatedAt);

    const claimedCollectionRun = await new ClaimNextCollectionRunUseCase(
      context.collectionRuns,
      context.clock,
    ).execute();

    expect(claimedCollectionRun).toMatchObject({
      id: "collection-run-older",
      status: "RUNNING",
      startedAt: updatedAt,
      updatedAt,
    });
    await expect(
      context.collectionRuns.findById("collection-run-older"),
    ).resolves.toMatchObject({
      status: "RUNNING",
      startedAt: updatedAt,
    });
    await expect(
      context.collectionRuns.findById("collection-run-newer"),
    ).resolves.toMatchObject({
      status: "QUEUED",
    });
  });

  it("does not claim canceled, running, succeeded, or failed collection runs", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, {
      id: "collection-run-canceled",
      status: "CANCELED",
      finishedAt: updatedAt,
    });
    await seedCollectionRun(context, {
      id: "collection-run-running",
      status: "RUNNING",
      startedAt: createdAt,
    });
    await seedCollectionRun(context, {
      id: "collection-run-succeeded",
      status: "SUCCEEDED",
      startedAt: createdAt,
      finishedAt: updatedAt,
    });
    await seedCollectionRun(context, {
      id: "collection-run-failed",
      status: "FAILED",
      startedAt: createdAt,
      finishedAt: updatedAt,
      failureReason: {
        code: "WORKER_FAILED",
        message: "Worker failed.",
      },
    });

    await expect(
      new ClaimNextCollectionRunUseCase(
        context.collectionRuns,
        context.clock,
      ).execute(),
    ).resolves.toBeNull();
  });

  it("does not claim the same queued run twice", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, { status: "QUEUED" });

    const useCase = new ClaimNextCollectionRunUseCase(
      context.collectionRuns,
      context.clock,
    );

    await expect(useCase.execute()).resolves.toMatchObject({
      id: "collection-run-1",
      status: "RUNNING",
    });
    await expect(useCase.execute()).resolves.toBeNull();
  });

  it("executes a running collection run and marks it succeeded with a safe summary", async () => {
    const context = createTestContext();
    const summary: CollectionRunSummary = {
      capturedPayloads: 2,
      extractorCandidates: 3,
      contentItemsSubmitted: 3,
      failedSubmissions: 0,
      leaseReleased: true,
    };

    await seedCollectionRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
      parameters: {
        maxScrolls: 4,
        maxDurationMs: 20_000,
      },
    });
    context.executor.setResult({
      ok: true,
      summary,
    });
    context.clock.setNow(updatedAt);

    const collectionRun = await new ExecuteCollectionRunUseCase(
      context.collectionRuns,
      context.executor,
      context.clock,
    ).execute({
      collectionRunId: "collection-run-1",
    });

    expect(collectionRun).toMatchObject({
      id: "collection-run-1",
      status: "SUCCEEDED",
      summary,
      finishedAt: updatedAt,
      updatedAt,
    });
    expect(context.executor.calls).toEqual([
      {
        collectionRunId: "collection-run-1",
        sourceGroupId,
        parameters: {
          maxScrolls: 4,
          maxDurationMs: 20_000,
        },
      },
    ]);
  });

  it("executes a running collection run and marks it failed with a sanitized failure reason", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, {
      status: "RUNNING",
      startedAt: createdAt,
    });
    context.executor.setResult({
      ok: false,
      failureReason: {
        code: "SOURCE_GROUP_NOT_ACTIVE",
        message: "Source group must be ACTIVE before collection.",
      },
      summary: {
        capturedPayloads: 0,
        extractorCandidates: 0,
        contentItemsSubmitted: 0,
        failedSubmissions: 0,
        leaseReleased: false,
      },
    });
    context.clock.setNow(updatedAt);

    const collectionRun = await new ExecuteCollectionRunUseCase(
      context.collectionRuns,
      context.executor,
      context.clock,
    ).execute({
      collectionRunId: "collection-run-1",
    });

    expect(collectionRun).toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "SOURCE_GROUP_NOT_ACTIVE",
        message: "Source group must be ACTIVE before collection.",
      },
      summary: {
        capturedPayloads: 0,
        leaseReleased: false,
      },
      finishedAt: updatedAt,
      updatedAt,
    });
  });

  it("does not execute collection runs that are not running", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, { status: "SUCCEEDED" });

    await expect(
      new ExecuteCollectionRunUseCase(
        context.collectionRuns,
        context.executor,
        context.clock,
      ).execute({
        collectionRunId: "collection-run-1",
      }),
    ).rejects.toThrow(InvalidCollectionRunStatusTransitionError);
    expect(context.executor.calls).toEqual([]);
  });

  it("rejects invalid status transitions", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, { status: "QUEUED" });

    await expect(
      new MarkCollectionRunSucceededUseCase(
        context.collectionRuns,
        context.clock,
      ).execute({
        collectionRunId: "collection-run-1",
      }),
    ).rejects.toThrow(InvalidCollectionRunStatusTransitionError);
  });

  it("rejects transitions from terminal statuses", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, {
      status: "SUCCEEDED",
      startedAt: createdAt,
      finishedAt: updatedAt,
    });

    await expect(
      new MarkCollectionRunFailedUseCase(
        context.collectionRuns,
        context.clock,
      ).execute({
        collectionRunId: "collection-run-1",
        failureReason: {
          code: "WORKER_FAILED",
          message: "Worker failed after completion.",
        },
      }),
    ).rejects.toThrow(InvalidCollectionRunStatusTransitionError);
  });

  it("gets and lists collection runs", async () => {
    const context = createTestContext();

    await seedCollectionRun(context, {
      id: "collection-run-1",
      status: "QUEUED",
      createdAt: "2026-04-01T10:00:00.000Z",
    });
    await seedCollectionRun(context, {
      id: "collection-run-2",
      status: "RUNNING",
      startedAt: "2026-04-01T10:30:00.000Z",
      createdAt: "2026-04-01T10:30:00.000Z",
    });

    await expect(
      new GetCollectionRunUseCase(context.collectionRuns).execute({
        collectionRunId: "collection-run-1",
      }),
    ).resolves.toMatchObject({
      id: "collection-run-1",
      status: "QUEUED",
    });

    await expect(
      new ListCollectionRunsUseCase(context.collectionRuns).execute({
        status: "RUNNING",
        limit: 10,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: "collection-run-2",
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
});

interface TestContext {
  readonly collectionRuns: InMemoryCollectionRunRepository;
  readonly sourceGroups: FakeSourceGroupLookupPort;
  readonly clock: FixedClock;
  readonly ids: FakeIdGenerator;
  readonly executor: FakeCollectionRunExecutor;
}

function createTestContext(ids: readonly string[] = []): TestContext {
  return {
    collectionRuns: new InMemoryCollectionRunRepository(),
    sourceGroups: new FakeSourceGroupLookupPort(),
    clock: new FixedClock(),
    ids: new FakeIdGenerator(ids),
    executor: new FakeCollectionRunExecutor(),
  };
}

async function seedCollectionRun(
  context: TestContext,
  options: Partial<CollectionRun> = {},
): Promise<CollectionRun> {
  const collectionRun = createCollectionRun(options);

  await context.collectionRuns.save(collectionRun);

  return collectionRun;
}

function createCollectionRun(
  options: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: options.id ?? "collection-run-1",
    sourceGroupId: options.sourceGroupId ?? sourceGroupId,
    status: options.status ?? "QUEUED",
    triggerType: options.triggerType ?? "MANUAL_API",
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
    updatedAt: options.updatedAt ?? options.createdAt ?? createdAt,
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
    const id = this.ids[this.nextIndex] ?? `collection-run-${this.nextIndex + 1}`;

    this.nextIndex += 1;

    return id;
  }
}

class FakeSourceGroupLookupPort implements SourceGroupLookupPort {
  public readonly calls: string[] = [];
  private result: SourceGroupLookupResult = {
    ok: true,
    statusCode: 200,
    sourceGroup: {
      id: sourceGroupId,
      platform: "FACEBOOK",
      status: "ACTIVE",
      url: "https://www.facebook.com/groups/source-group-1",
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

  public setResult(result: SourceGroupLookupResult): void {
    this.result = result;
  }

  public setSourceGroup(
    options: Partial<{
      readonly id: string;
      readonly platform: string;
      readonly status: string;
      readonly url: string;
    }>,
  ): void {
    this.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: options.id ?? sourceGroupId,
        platform: options.platform ?? "FACEBOOK",
        status: options.status ?? "ACTIVE",
        url: options.url ?? "https://www.facebook.com/groups/source-group-1",
      },
    };
  }
}

class FakeCollectionRunExecutor implements CollectionRunExecutorPort {
  public readonly calls: CollectionRunExecutorInput[] = [];
  private result: CollectionRunExecutorResult = {
    ok: true,
    summary: {
      capturedPayloads: 0,
      extractorCandidates: 0,
      contentItemsSubmitted: 0,
      failedSubmissions: 0,
      leaseReleased: true,
    },
  };

  public async execute(
    input: CollectionRunExecutorInput,
  ): Promise<CollectionRunExecutorResult> {
    this.calls.push(input);

    return this.result;
  }

  public setResult(result: CollectionRunExecutorResult): void {
    this.result = result;
  }
}
