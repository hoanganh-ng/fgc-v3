import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Clock, IdGenerator, ProfileReferencePort } from "../../collector-runtime/application";
import { DispatchNextDueProfileHomeFeedCollectionScheduleUseCase } from "../../collector-runtime/application";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionSchedule,
  CollectorRuntimeAccountStage,
} from "../../collector-runtime/domain";
import { InMemoryProfileHomeFeedCollectionScheduleRepository } from "../../collector-runtime/application/test-support/in-memory-profile-home-feed-collection-schedule-repository";
import { runProfileHomeFeedSchedulerCommand } from "./scheduler-runner";
import type {
  DispatchNextDueProfileHomeFeedFn,
  ProfileHomeFeedSchedulerLogger,
} from "./scheduler-runner";

const defaultOptions = {
  once: false,
  pollIntervalMs: 5_000,
} as const;

describe("profile home-feed scheduler runner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completes one drain cycle in --once mode when no schedule is due", async () => {
    const dispatch = vi.fn(async () => ({ outcome: "NO_DUE_SCHEDULE" as const }));
    let closeCount = 0;

    const result = await runProfileHomeFeedSchedulerCommand({
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
      makeDispatched("profile-1", "run-1"),
      makeDispatched("profile-2", "run-2"),
      makeDispatched("profile-3", "run-3"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 3 });
    expect(dispatch).toHaveBeenCalledTimes(4);
  });

  it("continues draining after SKIPPED_ACTIVE_RUN", async () => {
    const dispatch = createFakeDispatch([
      makeSkipped("profile-1", "SKIPPED_ACTIVE_RUN"),
      makeDispatched("profile-2", "run-2"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it("continues draining after PROFILE_NOT_FOUND", async () => {
    const dispatch = createFakeDispatch([
      makeSkipped("profile-1", "PROFILE_NOT_FOUND"),
      makeDispatched("profile-2", "run-2"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
  });

  it("continues draining after PROFILE_LOOKUP_FAILED", async () => {
    const dispatch = createFakeDispatch([
      makeSkipped("profile-1", "PROFILE_LOOKUP_FAILED"),
      makeDispatched("profile-2", "run-2"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
  });

  it("continues draining after RACE_LOST", async () => {
    const dispatch = createFakeDispatch([
      { outcome: "RACE_LOST" },
      makeDispatched("profile-2", "run-2"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
  });

  it("does not increment dispatchedRuns for non-DISPATCHED outcomes", async () => {
    const dispatch = createFakeDispatch([
      makeSkipped("profile-1", "SKIPPED_ACTIVE_RUN"),
      makeSkipped("profile-1", "PROFILE_NOT_FOUND"),
      makeSkipped("profile-1", "PROFILE_LOOKUP_FAILED"),
      { outcome: "RACE_LOST" },
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 0 });
  });

  it("does not delay between dispatches inside a single drain cycle", async () => {
    const dispatch = createFakeDispatch([
      makeDispatched("profile-1", "run-1"),
      makeDispatched("profile-2", "run-2"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const result = await runProfileHomeFeedSchedulerCommand({
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
      makeDispatched("profile-1", "run-1"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);
    const abortController = new AbortController();

    const promise = runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 750 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 750);

    await vi.advanceTimersByTimeAsync(749);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

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
      makeDispatched("profile-1", "run-1"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);
    const abortController = new AbortController();
    let dispatchCalls = 0;

    const wrappedDispatch = vi.fn(async () => {
      dispatchCalls += 1;
      return dispatch();
    });

    const promise = runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 1_000 },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: wrappedDispatch,
        close: async () => {},
      },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();
    expect(dispatchCalls).toBe(2);

    abortController.abort();
    await flushMicrotasks();

    const result = await promise;
    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(wrappedDispatch).toHaveBeenCalledTimes(2);
  });

  it("aborts the delay promptly and removes the abort listener", async () => {
    const dispatch = createFakeDispatch([
      makeDispatched("profile-1", "run-1"),
      { outcome: "NO_DUE_SCHEDULE" },
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

    const promise = runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 10_000 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();

    expect(addListenerSpy).toHaveBeenCalledWith(
      "abort",
      expect.anything(),
      expect.objectContaining({ once: true }),
    );
    expect(removeListenerSpy).not.toHaveBeenCalled();

    abortController.abort();
    const result = await promise;

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(removeListenerSpy).toHaveBeenCalledWith("abort", expect.anything());

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  it("removes the abort listener after a normal delay completes", async () => {
    const dispatch = createFakeDispatch([
      makeDispatched("profile-1", "run-1"),
      { outcome: "NO_DUE_SCHEDULE" },
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

    const promise = runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 200 },
      logger: new MemoryLogger(),
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    await flushMicrotasks();
    expect(removeListenerSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    await flushMicrotasks();
    expect(removeListenerSpy).toHaveBeenCalledTimes(1);
    expect(addListenerSpy).toHaveBeenCalledTimes(2);

    abortController.abort();
    await flushMicrotasks();

    const result = await promise;
    expect(result).toEqual({ cyclesCompleted: 2, dispatchedRuns: 1 });
    expect(removeListenerSpy).toHaveBeenCalledTimes(2);

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  it("performs zero dispatches and completes zero cycles when the signal is already aborted", async () => {
    const dispatch = vi.fn(async () => ({ outcome: "NO_DUE_SCHEDULE" as const }));
    const abortController = new AbortController();
    abortController.abort();
    let closeCount = 0;
    const logger = new MemoryLogger();

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, pollIntervalMs: 50 },
      logger,
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
    expect(logger.messages).toContain(
      "Profile home-feed scheduler aborted before first cycle.",
    );
    expect(logger.messages).toContain("Profile home-feed scheduler stopped.");
  });

  it("aborts a drain mid-cycle without dispatching further", async () => {
    const abortController = new AbortController();
    const dispatch = vi.fn(async () => {
      const result = makeDispatched("profile-1", "run-1");
      abortController.abort();
      return result;
    });
    const logger = new MemoryLogger();

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true, pollIntervalMs: 50 },
      logger,
      dependencies: { dispatch, close: async () => {} },
      abortSignal: abortController.signal,
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(logger.messages).not.toContain(
      "Profile home-feed scheduler aborted before first cycle.",
    );
    expect(logger.messages).toContain(
      "Cycle 1 complete (dispatched 1 total).",
    );
    expect(logger.messages).toContain("Profile home-feed scheduler stopped.");
  });

  it("propagates dispatch errors and still closes dependencies once", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("dispatch boom");
    });
    let closeCount = 0;

    await expect(
      runProfileHomeFeedSchedulerCommand({
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
    const dispatch = vi.fn(async () => ({ outcome: "NO_DUE_SCHEDULE" as const }));

    await expect(
      runProfileHomeFeedSchedulerCommand({
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
      makeDispatched("profile-1", "run-1"),
      { outcome: "NO_DUE_SCHEDULE" },
    ]);

    await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger,
      dependencies: { dispatch, close: async () => {} },
    });

    const messages = logger.messages.join("\n");

    expect(messages).toContain("Profile home-feed scheduler started.");
    expect(messages).toContain(
      "Dispatched profile home-feed schedule profile-1 run run-1.",
    );
    expect(messages).toContain("Cycle 1 complete (dispatched 1 total).");
    expect(messages).toContain("Profile home-feed scheduler stopped.");
    expect(logger.warns).toEqual([]);
    expect(logger.errors).toEqual([]);
  });

  it("integrates with the real use case via the in-memory dispatch repository", async () => {
    const repository = new InMemoryProfileHomeFeedCollectionScheduleRepository();
    await repository.save(makeSchedule({ profileId: "profile-1" }));

    const useCase = new DispatchNextDueProfileHomeFeedCollectionScheduleUseCase(
      repository,
      new StubProfileReference("COLLECTION_READY"),
      new FixedClock("2026-06-17T10:35:00.000Z"),
      new FixedIdGenerator("scheduled-run-1"),
    );

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: () => useCase.execute(),
        close: async () => {},
      },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 1 });
    expect(repository.getRun("scheduled-run-1")).toBeDefined();
  });

  it("uses the real use case to return NO_DUE_SCHEDULE when nothing is due", async () => {
    const repository = new InMemoryProfileHomeFeedCollectionScheduleRepository();

    const useCase = new DispatchNextDueProfileHomeFeedCollectionScheduleUseCase(
      repository,
      new StubProfileReference("COLLECTION_READY"),
      new FixedClock("2026-06-17T10:35:00.000Z"),
      new FixedIdGenerator("scheduled-run-1"),
    );

    const result = await runProfileHomeFeedSchedulerCommand({
      options: { ...defaultOptions, once: true },
      logger: new MemoryLogger(),
      dependencies: {
        dispatch: () => useCase.execute(),
        close: async () => {},
      },
    });

    expect(result).toEqual({ cyclesCompleted: 1, dispatchedRuns: 0 });
  });
});

class MemoryLogger implements ProfileHomeFeedSchedulerLogger {
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

type QueueEntry = Awaited<ReturnType<DispatchNextDueProfileHomeFeedFn>>;

function createFakeDispatch(queue: readonly QueueEntry[]): DispatchNextDueProfileHomeFeedFn {
  let index = 0;
  const fn = vi.fn(async () => {
    const entry = queue[index];
    index += 1;
    return entry === undefined ? { outcome: "NO_DUE_SCHEDULE" as const } : entry;
  });

  return fn;
}

function makeDispatched(
  profileId: string,
  runId: string,
): {
  readonly outcome: "DISPATCHED";
  readonly schedule: ProfileHomeFeedCollectionSchedule;
  readonly run: ProfileHomeFeedCollectionRun;
} {
  return {
    outcome: "DISPATCHED",
    schedule: makeSchedule({ profileId }),
    run: makeRun({ id: runId, profileId }),
  };
}

function makeSkipped(
  profileId: string,
  outcome: "SKIPPED_ACTIVE_RUN" | "PROFILE_NOT_FOUND" | "PROFILE_LOOKUP_FAILED",
): {
  readonly outcome: typeof outcome;
  readonly schedule: ProfileHomeFeedCollectionSchedule;
} {
  return {
    outcome,
    schedule: makeSchedule({ profileId }),
  };
}

function makeSchedule(
  overrides: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: overrides.profileId ?? "profile-1",
    enabled: overrides.enabled ?? true,
    intervalMinutes: overrides.intervalMinutes ?? 30,
    nextRunAt: overrides.nextRunAt ?? "2026-06-17T10:00:00.000Z",
    parameters: overrides.parameters ?? { maxScrolls: 5 },
    createdAt: overrides.createdAt ?? "2026-06-17T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-17T09:00:00.000Z",
    lastAttemptedAt: overrides.lastAttemptedAt,
    lastDispatchStatus: overrides.lastDispatchStatus,
    lastFailureReason: overrides.lastFailureReason,
    consecutiveFailures: overrides.consecutiveFailures ?? 0,
  };
}

function makeRun(
  overrides: Partial<ProfileHomeFeedCollectionRun> & { id: string },
): ProfileHomeFeedCollectionRun {
  return {
    id: overrides.id,
    profileId: overrides.profileId ?? "profile-1",
    triggerType: overrides.triggerType ?? "SCHEDULED",
    status: overrides.status ?? "QUEUED",
    accountStageAtRequest: overrides.accountStageAtRequest ?? "COLLECTION_READY",
    target: overrides.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
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

class StubProfileReference implements ProfileReferencePort {
  public constructor(private readonly stage: CollectorRuntimeAccountStage) {}

  public async getProfileAccountStage(
    profileId: string,
  ): Promise<{
    ok: true;
    profileId: string;
    accountStage: CollectorRuntimeAccountStage;
  }> {
    return {
      ok: true,
      profileId,
      accountStage: this.stage,
    };
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
