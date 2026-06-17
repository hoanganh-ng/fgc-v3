import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runCollectionSchedulerCli,
} from "./cli-command";
import type { CollectionSchedulerLogger } from "./scheduler-runner";
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
        dispatchNextDueCollectionSchedule: {
          execute: async () => null,
        },
        close: async () => undefined,
      } as unknown as CollectorRuntimeService;
    },
    calls: () => calls,
  };
}

function silentLogger(): CollectionSchedulerLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe("collection scheduler CLI lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns without constructing the runtime when --help is requested", async () => {
    const factory = createFakeRuntimeFactory();

    const result = await runCollectionSchedulerCli(["--help"], {
      buildRuntime: factory.build,
      installSignalHandlers: () => () => undefined,
      logger: silentLogger(),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(factory.calls()).toBe(0);
  });

  it("returns without constructing the runtime on argument errors", async () => {
    const factory = createFakeRuntimeFactory();

    const result = await runCollectionSchedulerCli(["--bogus"], {
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

    const result = await runCollectionSchedulerCli(["--once"], {
      buildRuntime: factory.build,
      installSignalHandlers: (abort) => {
        installed = true;
        // Sanity: abort is callable without throwing.
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
    let dispatchCalls = 0;

    factory.build = () => {
      return {
        dispatchNextDueCollectionSchedule: {
          execute: async () => {
            dispatchCalls += 1;
            if (dispatchCalls === 1) {
              return null;
            }
            return null;
          },
        },
        close: async () => undefined,
      } as unknown as CollectorRuntimeService;
    };

    const promise = runCollectionSchedulerCli([], {
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
      runCollectionSchedulerCli(["--once"], {
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
      runCollectionSchedulerCli(["--once"], {
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
          dispatchNextDueCollectionSchedule: {
            execute: async () => null,
          },
          close: async () => {
            closeCalls += 1;
          },
        } as unknown as CollectorRuntimeService;
      },
    };

    const result = await runCollectionSchedulerCli(["--once"], {
      buildRuntime: factory.build,
      installSignalHandlers: () => () => undefined,
      logger: silentLogger(),
    });

    expect(result.exitCode).toBe(0);
    expect(closeCalls).toBe(1);
  });
});
