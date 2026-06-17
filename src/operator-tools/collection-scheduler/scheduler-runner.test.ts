import { describe, expect, it, vi } from "vitest";
import type { Clock, IdGenerator } from "../../collector-runtime/application";
import {
  DispatchNextDueCollectionScheduleUseCase,
} from "../../collector-runtime/application";
import type {
  CollectionRun,
  CollectionSchedule,
} from "../../collector-runtime/domain";
import { InMemoryDispatchNextDueCollectionScheduleRepository } from "../../collector-runtime/application/test-support/in-memory-dispatch-next-due-collection-schedule.repository";
import { runCollectionSchedulerCommand } from "./scheduler-runner";
import type {
  CollectionSchedulerLogger,
  DispatchNextDueFn,
  DispatchNextDueResult,
} from "./scheduler-runner";

const defaultOptions = {
  once: false,
  pollIntervalMs: 5_000,
} as const;

describe("collection scheduler runner", () => {
  it("completes one drain cycle in --once mode when no schedule is due", async () => {
    const dispatch = vi.fn(async () => null);
    let closeCount = 0;

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch,
        close: async () => {
          closeCount += 1;
        },
      },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 0 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(closeCount).toBe(1);
  });

  it("drains every due schedule in one --once cycle", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      makeResult("source-group-2", "run-2"),
      makeResult("source-group-3", "run-3"),
      null,
    ]);

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 3 });
    expect(dispatch).toHaveBeenCalledTimes(4);
  });

  it("runs multiple continuous cycles and stops when aborted during a sleep", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      makeResult("source-group-2", "run-2"),
      null,
      makeResult("source-group-3", "run-3"),
      makeResult("source-group-4", "run-4"),
      null,
    ]);
    const abortController = new AbortController();
    let dispatchedCount = 0;

    const wrappedDispatch = vi.fn(async () => {
      const result = await dispatch();
      if (result !== null) {
        dispatchedCount += 1;
        if (dispatchedCount === 4) {
          abortController.abort();
        }
      }
      return result;
    });

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 50 },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: wrappedDispatch,
        close: async () => {},
      },
      abortSignal: abortController.signal,
    });

    expect(result.cyclesCompleted).toBe(2);
    expect(result.dispatchedRuns).toBe(4);
    expect(wrappedDispatch).toHaveBeenCalledTimes(5);
  });

  it("counts one cycle and never calls dispatch when the signal is already aborted", async () => {
    const dispatch = vi.fn(async () => null);
    const abortController = new AbortController();
    abortController.abort();

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 50 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("aborts a drain mid-cycle without dispatching further", async () => {
    const dispatch = vi.fn(async (): Promise<DispatchNextDueResult | null> => {
      const result = makeResult("source-group-1", "run-1");
      abortController.abort();
      return result;
    });
    const abortController = new AbortController();

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 50 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("propagates dispatch errors and still closes dependencies once", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("dispatch boom");
    });
    let closeCount = 0;

    await expect(
      runCollectionSchedulerCommand({
        options: { ...defaultOptions, once: true },
        logger: new MemoryLogger(),
        dependencies: {
          dispatch,
          close: async () => {
            closeCount += 1;
          },
        },
      }),
    ).rejects.toThrow("dispatch boom");

    expect(closeCount).toBe(1);
  });

  it("propagates errors after a successful dispatch and still closes once", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      () => {
        throw new Error("dispatch boom");
      },
    ]);
    let closeCount = 0;

    await expect(
      runCollectionSchedulerCommand({
        options: { ...defaultOptions, once: true },
        logger: new MemoryLogger(),
        dependencies: {
          dispatch,
          close: async () => {
            closeCount += 1;
          },
        },
      }),
    ).rejects.toThrow("dispatch boom");

    expect(closeCount).toBe(1);
  });

  it("propagates errors raised from close()", async () => {
    const dispatch = vi.fn(async () => null);

    await expect(
      runCollectionSchedulerCommand({
        options: { ...defaultOptions, once: true },
        logger: new MemoryLogger(),
        dependencies: {
          dispatch,
          close: async () => {
            throw new Error("close boom");
          },
        },
      }),
    ).rejects.toThrow("close boom");
  });

  it("emits one info line per dispatch and one per cycle completion", async () => {
    const logger = new MemoryLogger();
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      null,
    ]);

    await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger,
      dependencies: { dispatch, close: async () => {} },
    });

    const messages = logger.messages.join("\n");

    expect(messages).toContain("Collection scheduler started.");
    expect(messages).toContain(
      "Dispatched schedule source-group-1 run run-1.",
    );
    expect(messages).toContain("Cycle 1 complete (dispatched 1 total).");
    expect(messages).toContain("Collection scheduler stopped.");
    expect(logger.warns).toEqual([]);
    expect(logger.errors).toEqual([]);
  });

  it("integrates with the real use case via the in-memory dispatch repository", async () => {
    const repository = new InMemoryDispatchNextDueCollectionScheduleRepository();
    repository.seedSchedule(makeSchedule({ sourceGroupId: "source-group-1" }));

    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      repository,
      new FixedClock("2026-06-17T10:35:00.000Z"),
      new FixedIdGenerator("scheduled-run-1"),
    );

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: () => useCase.execute(),
        close: async () => {},
      },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(repository.getInvocations()).toHaveLength(2);
    for (const invocation of repository.getInvocations()) {
      expect(invocation).toEqual({
        dispatchAt: "2026-06-17T10:35:00.000Z",
        collectionRunId: "scheduled-run-1",
      });
    }
  });

  it("uses the real use case to return null when nothing is due", async () => {
    const repository = new InMemoryDispatchNextDueCollectionScheduleRepository();

    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      repository,
      new FixedClock("2026-06-17T10:35:00.000Z"),
      new FixedIdGenerator("scheduled-run-1"),
    );

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: () => useCase.execute(),
        close: async () => {},
      },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 0 });
    expect(repository.getInvocations()).toHaveLength(1);
  });
});

class MemoryLogger implements CollectionSchedulerLogger {
  public readonly messages: string[] = [];
  public readonly warns: string[] = [];
  public readonly errors: string[] = [];

  public info(message: string): void {
    this.messages.push(message);
  }

  public warn(message: string): void {
    this.warns.push(message);
  }

  public error(message: string): void {
    this.errors.push(message);
  }
}

type QueueEntry = DispatchNextDueResult | null | (() => Promise<DispatchNextDueResult | null>);

function createFakeDispatch(queue: readonly QueueEntry[]): DispatchNextDueFn {
  let index = 0;
  const fn = vi.fn(async (): Promise<DispatchNextDueResult | null> => {
    const entry = queue[index];
    index += 1;

    if (entry === undefined) {
      return null;
    }

    if (typeof entry === "function") {
      return entry();
    }

    return entry;
  });

  return fn;
}

function makeResult(
  sourceGroupId: string,
  runId: string,
): DispatchNextDueResult {
  return {
    schedule: makeSchedule({ sourceGroupId }),
    collectionRun: makeRun({ id: runId, sourceGroupId }),
  };
}

function makeSchedule(overrides: Partial<CollectionSchedule> = {}): CollectionSchedule {
  return {
    sourceGroupId: overrides.sourceGroupId ?? "source-group-1",
    enabled: overrides.enabled ?? true,
    intervalMinutes: overrides.intervalMinutes ?? 30,
    nextRunAt: overrides.nextRunAt ?? "2026-06-17T10:00:00.000Z",
    parameters: overrides.parameters ?? { maxScrolls: 5 },
    createdAt: overrides.createdAt ?? "2026-06-17T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-17T09:00:00.000Z",
  };
}

function makeRun(
  overrides: Partial<CollectionRun> & { id: string },
): CollectionRun {
  return {
    id: overrides.id,
    sourceGroupId: overrides.sourceGroupId ?? "source-group-1",
    status: overrides.status ?? "QUEUED",
    triggerType: overrides.triggerType ?? "SCHEDULED",
    parameters: overrides.parameters ?? { maxScrolls: 5 },
    requestedAt: overrides.requestedAt ?? "2026-06-17T10:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-06-17T10:35:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-17T10:35:00.000Z",
  };
}

class FixedClock implements Clock {
  public constructor(private readonly current: string) {}

  public now(): Date {
    return new Date(this.current);
  }
}

class FixedIdGenerator implements IdGenerator {
  public constructor(private readonly id: string) {}

  public async generateId(): Promise<string> {
    return this.id;
  }
}