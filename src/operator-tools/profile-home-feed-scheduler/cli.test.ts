import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runProfileHomeFeedSchedulerCli,
} from "./cli-command";
import type { ProfileHomeFeedSchedulerLogger } from "./scheduler-runner";
import type { CollectorRuntimeService } from "../../composition/collector-runtime/create-collector-runtime";

type RuntimeFactory = () => CollectorRuntimeService;

function createFakeRuntimeFactory(): {
  build: RuntimeFactory;
  readonly calls: () => number;
} {
  let calls = 0;
  return {
    build: () => {
      calls += 1;
      return {
        dispatchNextDueProfileHomeFeedCollectionSchedule: {
          execute: async () => ({ outcome: "NO_DUE_SCHEDULE" as const }),
        },
        close: async () => undefined,
      } as unknown as CollectorRuntimeService;
    },
    calls: () => calls,
  };
}

function silentLogger(): ProfileHomeFeedSchedulerLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe("profile home-feed scheduler CLI lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns without constructing the runtime when --help is requested", async () => {
    const factory = createFakeRuntimeFactory();

    const result = await runProfileHomeFeedSchedulerCli(["--help"], {
      buildRuntime: factory.build,
      installSignalHandlers: () => () => undefined,
      logger: silentLogger(),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(factory.calls()).toBe(0);
  });

  it("returns without constructing the runtime on argument errors", async () => {
    const factory = createFakeRuntimeFactory();

    const result = await runProfileHomeFeedSchedulerCli(["--bogus"], {
      buildRuntime: factory.build,
      installSignalHandlers: () => () => undefined,
      logger: silentLogger(),
    });

    expect(result.exitCode).toBe(2);
    expect(factory.calls()).toBe(0);
  });

  it("installs signal handlers and uses the AbortController path for the runner", async () => {
    const factory = createFakeRuntimeFactory();
    let installed = false;
    let detachCount = 0;

    const result = await runProfileHomeFeedSchedulerCli(["--once"], {
      buildRuntime: factory.build,
      installSignalHandlers: (abort) => {
        installed = true;
        expect(typeof abort).toBe("function");
        return () => {
          detachCount += 1;
        };
      },
      logger: silentLogger(),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(installed).toBe(true);
    expect(factory.calls()).toBe(1);
    expect(detachCount).toBe(1);
  });

  it("stops continuous mode when a signal handler aborts the controller", async () => {
    const factory = createFakeRuntimeFactory();
    let abort: (() => void) | undefined;

    const promise = runProfileHomeFeedSchedulerCli([], {
      buildRuntime: factory.build,
      installSignalHandlers: (abortFn) => {
        abort = abortFn;
        return () => undefined;
      },
      logger: silentLogger(),
    });

    await Promise.resolve();
    await Promise.resolve();

    if (abort !== undefined) {
      abort();
    }

    const result = await promise;
    expect(result.exitCode).toBe(0);
  });

  it("detaches signal handlers when runtime composition throws", async () => {
    let detached = false;

    await expect(
      runProfileHomeFeedSchedulerCli(["--once"], {
        buildRuntime: () => {
          throw new Error("composition boom");
        },
        installSignalHandlers: () => {
          return () => {
            detached = true;
          };
        },
        logger: silentLogger(),
      }),
    ).rejects.toThrow("composition boom");

    expect(detached).toBe(true);
  });

  it("does not call runtime close when runtime construction throws", async () => {
    await expect(
      runProfileHomeFeedSchedulerCli(["--once"], {
        buildRuntime: () => {
          throw new Error("composition boom");
        },
        installSignalHandlers: () => () => undefined,
        logger: silentLogger(),
      }),
    ).rejects.toThrow("composition boom");
  });

  it("closes the runtime exactly once (the runner is the sole closer)", async () => {
    let closeCalls = 0;
    const factory = {
      build: (): CollectorRuntimeService => {
        return {
          dispatchNextDueProfileHomeFeedCollectionSchedule: {
            execute: async () => ({ outcome: "NO_DUE_SCHEDULE" as const }),
          },
          close: async () => {
            closeCalls += 1;
          },
        } as unknown as CollectorRuntimeService;
      },
    };

    const result = await runProfileHomeFeedSchedulerCli(["--once"], {
      buildRuntime: factory.build,
      installSignalHandlers: () => () => undefined,
      logger: silentLogger(),
    });

    expect(result.exitCode).toBe(0);
    expect(closeCalls).toBe(1);
  });

  it("binds dispatch and close against the production runtime contract", async () => {
    let dispatchedRuns = 0;
    let closeCalls = 0;

    const useCase = {
      execute: async () => {
        dispatchedRuns += 1;
        if (dispatchedRuns === 1) {
          return {
            outcome: "DISPATCHED" as const,
            schedule: {
              profileId: "profile-1",
              enabled: true,
              intervalMinutes: 30,
              nextRunAt: "2026-06-17T10:00:00.000Z",
              parameters: { maxScrolls: 5 },
              createdAt: "2026-06-17T09:00:00.000Z",
              updatedAt: "2026-06-17T09:00:00.000Z",
              consecutiveFailures: 0,
            },
            run: {
              id: "run-1",
              profileId: "profile-1",
              triggerType: "SCHEDULED" as const,
              status: "QUEUED" as const,
              accountStageAtRequest: "READY" as const,
              target: { platform: "FACEBOOK" as const, surface: "PROFILE_HOME_FEED" as const },
              parameters: { maxScrolls: 5 },
              requestedAt: "2026-06-17T10:00:00.000Z",
              createdAt: "2026-06-17T10:35:00.000Z",
              updatedAt: "2026-06-17T10:35:00.000Z",
            },
          };
        }
        return { outcome: "NO_DUE_SCHEDULE" as const };
      },
    };

    const runtime = {
      dispatchNextDueProfileHomeFeedCollectionSchedule: useCase,
      close: async () => {
        closeCalls += 1;
      },
    } as unknown as CollectorRuntimeService;

    const result = await runProfileHomeFeedSchedulerCli(["--once"], {
      buildRuntime: () => runtime,
      installSignalHandlers: () => () => undefined,
      logger: silentLogger(),
    });

    expect(result.exitCode).toBe(0);
    expect(dispatchedRuns).toBe(2);
    expect(closeCalls).toBe(1);
  });
});
