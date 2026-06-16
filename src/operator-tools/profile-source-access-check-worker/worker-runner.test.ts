import { describe, expect, it } from "vitest";
import type {
  ProfileSourceAccessBrowserCheckPort,
  ProfileSourceAccessBrowserCheckResult,
  ProfileSourceAccessMutationPort,
  ProfileSourceAccessMutationResult,
  ProfileSourceAccessOutcomeClassifierPort,
} from "../../collector-runtime/application";
import { InMemoryProfileSourceAccessCheckRunRepository } from "../../collector-runtime/application/test-support/in-memory-profile-source-access-check-run-repository";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunOutcome,
} from "../../collector-runtime/domain";
import type { ProfileSourceAccessBrowserObservation } from "../../collector-runtime/application";
import type { Clock } from "../../collector-runtime/application";
import {
  runProfileSourceAccessCheckWorkerCommand,
  type ProfileSourceAccessCheckWorkerLogger,
} from "./worker-runner";

const now = "2026-05-01T10:00:00.000Z";
const later = "2026-05-01T10:05:00.000Z";

describe("profile-source access check worker runner", () => {
  it("runs once with no queued run", async () => {
    const context = createContext();

    const result = await runProfileSourceAccessCheckWorkerCommand({
      args: workerArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      claimedRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
    });
    expect(context.logger.messages).toContain(
      "No queued profile-source access check run found.",
    );
    expect(context.closed).toBe(true);
  });

  it("claims one queued run and marks it succeeded", async () => {
    const context = createContext();
    await context.checkRuns.save(createCheckRun());

    const result = await runProfileSourceAccessCheckWorkerCommand({
      args: workerArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
    });
    expect((await context.checkRuns.findById("check-run-1"))).toMatchObject({
      status: "SUCCEEDED",
      outcome: "PUBLIC_ACCESSIBLE",
    });
    expect(context.logger.messages.join("\n")).toContain(
      "outcome=PUBLIC_ACCESSIBLE",
    );
  });

  it("passes the worker abort signal into browser check execution", async () => {
    const context = createContext();
    await context.checkRuns.save(createCheckRun());
    const abortController = new AbortController();

    await runProfileSourceAccessCheckWorkerCommand({
      args: workerArgs({ once: true }),
      logger: context.logger,
      abortSignal: abortController.signal,
      dependencies: context.dependencies,
    });

    expect(context.browser.abortSignals).toEqual([abortController.signal]);
  });

  it("continues polling after an individual failure and stops on abort", async () => {
    const context = createContext();
    await context.checkRuns.save(
      createCheckRun({
        id: "failed-run",
        requestedAt: "2026-05-01T10:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
      }),
    );
    await context.checkRuns.save(
      createCheckRun({
        id: "succeeded-run",
        sourceGroupId: "source-group-2",
        requestedAt: "2026-05-01T10:01:00.000Z",
        createdAt: "2026-05-01T10:01:00.000Z",
      }),
    );
    context.browser.results = [
      {
        ok: false,
        failureReason: {
          code: "ACCESS_CHECK_BROWSER_FAILED",
          message: "Profile-source access browser check failed.",
        },
      },
      context.browser.result,
    ];
    const abortController = new AbortController();
    context.logger.onInfo = (message) => {
      if (message.includes("succeeded-run succeeded")) {
        abortController.abort();
      }
    };

    const result = await runProfileSourceAccessCheckWorkerCommand({
      args: workerArgs({ once: false, pollIntervalMs: 1 }),
      logger: context.logger,
      abortSignal: abortController.signal,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      claimedRuns: 2,
      succeededRuns: 1,
      failedRuns: 1,
    });
    expect(context.logger.messages.join("\n")).toContain("failed-run failed");
    expect(context.logger.messages.join("\n")).toContain("succeeded-run succeeded");
    expect(context.closed).toBe(true);
  });
});

function createContext() {
  const checkRuns = new InMemoryProfileSourceAccessCheckRunRepository();
  const browser = new FakeBrowserCheckPort();
  const classifier = new FakeClassifierPort();
  const mutation = new FakeMutationPort();
  const clock = new FakeClock();
  const logger = new MemoryLogger();
  let closed = false;

  return {
    checkRuns,
    browser,
    classifier,
    mutation,
    clock,
    logger,
    get closed() {
      return closed;
    },
    dependencies: {
      checkRuns,
      browserCheck: browser,
      classifier,
      mutation,
      clock,
      close: async () => {
        closed = true;
      },
    },
  };
}

function workerArgs(
  overrides: Partial<Parameters<typeof runProfileSourceAccessCheckWorkerCommand>[0]["args"]>,
) {
  return {
    baseUrl: "http://localhost:3000",
    browserProvider: "playwright" as const,
    once: true,
    pollIntervalMs: 5_000,
    ...overrides,
  };
}

class FakeClock implements Clock {
  public now(): Date {
    return new Date(later);
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
  public results: ProfileSourceAccessBrowserCheckResult[] = [];
  public readonly abortSignals: Array<AbortSignal | undefined> = [];

  public async check(input: {
    readonly abortSignal?: AbortSignal;
  }): Promise<ProfileSourceAccessBrowserCheckResult> {
    this.abortSignals.push(input.abortSignal);
    return this.results.shift() ?? this.result;
  }
}

class FakeClassifierPort implements ProfileSourceAccessOutcomeClassifierPort {
  public async classify(
    _observation: ProfileSourceAccessBrowserObservation,
  ): Promise<ProfileSourceAccessCheckRunOutcome> {
    return "PUBLIC_ACCESSIBLE";
  }
}

class FakeMutationPort implements ProfileSourceAccessMutationPort {
  public result: ProfileSourceAccessMutationResult = { ok: true };

  public async applyOutcome(): Promise<ProfileSourceAccessMutationResult> {
    return this.result;
  }
}

class MemoryLogger implements ProfileSourceAccessCheckWorkerLogger {
  public readonly messages: string[] = [];
  public onInfo: ((message: string) => void) | undefined;

  public info(message: string): void {
    this.messages.push(message);
    this.onInfo?.(message);
  }

  public error(message: string): void {
    this.messages.push(message);
    this.onInfo?.(message);
  }
}

function createCheckRun(
  overrides: Partial<ProfileSourceAccessCheckRun> = {},
): ProfileSourceAccessCheckRun {
  return {
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
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
