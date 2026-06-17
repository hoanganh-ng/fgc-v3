import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("does not delay between dispatches inside a single drain cycle", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      makeResult("source-group-2", "run-2"),
      null,
    ]);
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true, pollIntervalMs: 1_000 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 2 });
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it("schedules exactly one delay between the first and second completed continuous cycles", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      null,
    ]);
    const abortController = new AbortController();

    const promise = runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 750 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();

    // Cycle 1 drained, cyclesCompleted=1, the only setTimeout is the delay.
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 750);

    // Advance just under the timeout boundary — still no second delay.
    await vi.advanceTimersByTimeAsync(749);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    // Cross the boundary — the first delay resolves, then cycle 2 begins.
    // Cycle 2 has the same queue [r, null]; it drains completely. The
    // inter-cycle delay #2 is then scheduled. setTimeout count is now 2.
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    abortController.abort();
    await flushMicrotasks();

    const result = await promise;
    expect(result).toEqual({ cyclesCompleted: 2, dispatchedRuns: 1 });
    setTimeoutSpy.mockRestore();
  });

  it("does not begin or count a new cycle when aborted during the delay", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      null,
    ]);
    const abortController = new AbortController();
    let dispatchCalls = 0;

    const wrappedDispatch = vi.fn(async (): Promise<DispatchNextDueResult | null> => {
      dispatchCalls += 1;
      const entry = dispatch();
      return entry;
    });

    const promise = runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 1_000 },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: wrappedDispatch,
        close: async () => {},
      },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();
    // Cycle 1 drained (one non-null + one null = two dispatches).
    expect(dispatchCalls).toBe(2);
    expect(wrappedDispatch).toHaveBeenCalledTimes(2);

    // Abort while in the inter-cycle delay.
    abortController.abort();
    await flushMicrotasks();

    const result = await promise;

    // No second cycle is started, no further dispatch is issued.
    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(wrappedDispatch).toHaveBeenCalledTimes(2);
  });

  it("aborts the delay promptly and removes the abort listener", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      null,
    ]);
    const abortController = new AbortController();
    const removeListenerSpy = vi.spyOn(
      abortController.signal,
      "removeEventListener",
    );
    const addListenerSpy = vi.spyOn(
      abortController.signal,
      "addEventListener",
    );

    const promise = runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 10_000 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();

    // The runner installed an abort listener with { once: true }.
    expect(addListenerSpy).toHaveBeenCalledWith(
      "abort",
      expect.anything(),
      expect.objectContaining({ once: true }),
    );
    expect(removeListenerSpy).not.toHaveBeenCalled();

    const start = Date.now();
    abortController.abort();
    const result = await promise;
    const elapsed = Date.now() - start;

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(elapsed).toBeLessThan(50);
    expect(removeListenerSpy).toHaveBeenCalledWith("abort", expect.anything());

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  it("removes the abort listener after a normal delay completes", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      null,
    ]);
    const abortController = new AbortController();
    const removeListenerSpy = vi.spyOn(
      abortController.signal,
      "removeEventListener",
    );
    const addListenerSpy = vi.spyOn(
      abortController.signal,
      "addEventListener",
    );

    const promise = runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 200 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();
    expect(removeListenerSpy).not.toHaveBeenCalled();

    // Cross the first delay — the runner must remove its own listener.
    await vi.advanceTimersByTimeAsync(200);
    await flushMicrotasks();
    expect(removeListenerSpy).toHaveBeenCalledTimes(1);
    expect(addListenerSpy).toHaveBeenCalledTimes(2);

    // Abort during the second delay.
    abortController.abort();
    await flushMicrotasks();

    const result = await promise;

    // Each registered listener is removed exactly once, total 2 removes.
    expect(result).toEqual({ cyclesCompleted: 2, dispatchedRuns: 1 });
    expect(removeListenerSpy).toHaveBeenCalledTimes(2);

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  it("removes every abort listener across multiple completed normal delays", async () => {
    const dispatch = createFakeDispatch([
      makeResult("source-group-1", "run-1"),
      null,
    ]);
    const abortController = new AbortController();
    const removeListenerSpy = vi.spyOn(
      abortController.signal,
      "removeEventListener",
    );
    const addListenerSpy = vi.spyOn(
      abortController.signal,
      "addEventListener",
    );

    const promise = runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 100 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();
    expect(addListenerSpy).toHaveBeenCalledTimes(1);

    // First normal delay completes.
    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();
    expect(removeListenerSpy).toHaveBeenCalledTimes(1);
    expect(addListenerSpy).toHaveBeenCalledTimes(2);

    // Second normal delay completes.
    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();
    expect(removeListenerSpy).toHaveBeenCalledTimes(2);
    expect(addListenerSpy).toHaveBeenCalledTimes(3);

    abortController.abort();
    await flushMicrotasks();

    const result = await promise;
    expect(result).toEqual({ cyclesCompleted: 3, dispatchedRuns: 1 });
    // Every listener the runner added was removed.
    expect(removeListenerSpy.mock.calls.length).toBe(addListenerSpy.mock.calls.length);

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  it("performs zero dispatches and completes zero cycles when the signal is already aborted", async () => {
    const dispatch = vi.fn(async () => null);
    const abortController = new AbortController();
    abortController.abort();
    let closeCount = 0;

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 50 },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch,
        close: async () => {
          closeCount += 1;
        },
      },
      abortSignal: abortController.signal,
    });

    expect(result).toEqual({ cyclesCompleted: 0, dispatchedRuns: 0 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(closeCount).toBe(1);
  });

  it("aborts a drain mid-cycle without dispatching further", async () => {
    const abortController = new AbortController();
    const dispatch = vi.fn(async (): Promise<DispatchNextDueResult | null> => {
      const result = makeResult("source-group-1", "run-1");
      abortController.abort();
      return result;
    });

    const result = await runCollectionSchedulerCommand({
      options: { ...defaultOptions, once: true, pollIntervalMs: 50 },
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
