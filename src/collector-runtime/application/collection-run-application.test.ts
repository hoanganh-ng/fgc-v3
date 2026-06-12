import { describe, expect, it } from "vitest";
import {
  CancelCollectionRunUseCase,
  CollectionRunSourceGroupNotActiveError,
  CollectionRunSourceGroupNotFoundError,
  CollectionRunSourceGroupPlatformUnsupportedError,
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
  IdGenerator,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
} from "./index";
import { InMemoryCollectionRunRepository } from "./test-support/in-memory-collection-run-repository";
import type {
  CollectionRun,
  CollectionRunStatus,
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
}

function createTestContext(ids: readonly string[] = []): TestContext {
  return {
    collectionRuns: new InMemoryCollectionRunRepository(),
    sourceGroups: new FakeSourceGroupLookupPort(),
    clock: new FixedClock(),
    ids: new FakeIdGenerator(ids),
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
