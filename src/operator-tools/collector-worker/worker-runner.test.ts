import { describe, expect, it } from "vitest";
import type {
  Clock,
  CollectionRunExecutorInput,
  CollectionRunExecutorPort,
  CollectionRunExecutorResult,
} from "../../collector-runtime/application";
import { InMemoryCollectionRunRepository } from "../../collector-runtime/application/test-support/in-memory-collection-run-repository";
import type { CollectionRun } from "../../collector-runtime/domain";
import {
  runCollectorWorkerCommand,
  type CollectorWorkerLogger,
} from "./worker-runner";

const createdAt = "2026-04-01T10:00:00.000Z";
const finishedAt = "2026-04-01T10:10:00.000Z";

describe("collector worker runner", () => {
  it("one-shot mode exits cleanly when no queued run exists", async () => {
    const collectionRuns = new InMemoryCollectionRunRepository();
    const executor = new FakeCollectionRunExecutor();
    const logger = new MemoryLogger();
    let closed = false;

    const result = await runCollectorWorkerCommand({
      args: {
        baseUrl: "http://localhost:8081",
        once: true,
        pollIntervalMs: 5_000,
      },
      logger,
      dependencies: {
        collectionRuns,
        executor,
        clock: new FixedClock(),
        close: async () => {
          closed = true;
        },
      },
    });

    expect(result).toEqual({
      claimedRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
    });
    expect(executor.calls).toEqual([]);
    expect(closed).toBe(true);
    expect(logger.messages).toContain("Collector worker started.");
    expect(logger.messages).toContain("No queued collection run found.");
    expect(logger.messages).toContain("Collector worker stopped.");
  });

  it("claims one queued run and marks it succeeded", async () => {
    const collectionRuns = new InMemoryCollectionRunRepository();
    const executor = new FakeCollectionRunExecutor();
    const logger = new MemoryLogger();

    await collectionRuns.save(
      createCollectionRun({
        parameters: {
          maxScrolls: 4,
          maxDurationMs: 20_000,
        },
      }),
    );

    const result = await runCollectorWorkerCommand({
      args: {
        baseUrl: "http://localhost:8081",
        once: true,
        pollIntervalMs: 5_000,
      },
      logger,
      dependencies: {
        collectionRuns,
        executor,
        clock: new FixedClock(),
      },
    });

    await expect(collectionRuns.findById("collection-run-1")).resolves.toMatchObject({
      status: "SUCCEEDED",
      startedAt: finishedAt,
      finishedAt,
      summary: {
        capturedPayloads: 1,
        extractorCandidates: 2,
        contentItemsSubmitted: 2,
        failedSubmissions: 0,
        leaseReleased: true,
      },
    });
    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
    });
    expect(executor.calls).toEqual([
      {
        collectionRunId: "collection-run-1",
        sourceGroupId: "source-group-1",
        parameters: {
          maxScrolls: 4,
          maxDurationMs: 20_000,
        },
      },
    ]);
    expect(logger.messages.join("\n")).toContain("Claimed collection run");
    expect(logger.messages.join("\n")).toContain("succeeded");
    expect(logger.messages.join("\n")).toContain("lease released: yes");
  });

  it("marks failed executions with sanitized failure reasons", async () => {
    const collectionRuns = new InMemoryCollectionRunRepository();
    const executor = new FakeCollectionRunExecutor();
    const logger = new MemoryLogger();

    executor.setResult({
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
    await collectionRuns.save(createCollectionRun());

    const result = await runCollectorWorkerCommand({
      args: {
        baseUrl: "http://localhost:8081",
        once: true,
        pollIntervalMs: 5_000,
      },
      logger,
      dependencies: {
        collectionRuns,
        executor,
        clock: new FixedClock(),
      },
    });

    await expect(collectionRuns.findById("collection-run-1")).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "SOURCE_GROUP_NOT_ACTIVE",
        message: "Source group must be ACTIVE before collection.",
      },
      summary: {
        leaseReleased: false,
      },
    });
    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 0,
      failedRuns: 1,
    });
    expect(logger.messages.join("\n")).not.toContain("rawGraphQLPayload");
    expect(logger.messages.join("\n")).not.toContain("session-cookie-value");
  });
});

class FixedClock implements Clock {
  public now(): Date {
    return new Date(finishedAt);
  }
}

class FakeCollectionRunExecutor implements CollectionRunExecutorPort {
  public readonly calls: CollectionRunExecutorInput[] = [];
  private result: CollectionRunExecutorResult = {
    ok: true,
    summary: {
      capturedPayloads: 1,
      extractorCandidates: 2,
      contentItemsSubmitted: 2,
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

class MemoryLogger implements CollectorWorkerLogger {
  public readonly messages: string[] = [];

  public info(message: string): void {
    this.messages.push(message);
  }

  public warn(message: string): void {
    this.messages.push(message);
  }

  public error(message: string): void {
    this.messages.push(message);
  }
}

function createCollectionRun(
  options: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: options.id ?? "collection-run-1",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    status: options.status ?? "QUEUED",
    triggerType: options.triggerType ?? "MANUAL_API",
    parameters: options.parameters ?? {},
    requestedAt: options.requestedAt ?? createdAt,
    createdAt: options.createdAt ?? createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  };
}
