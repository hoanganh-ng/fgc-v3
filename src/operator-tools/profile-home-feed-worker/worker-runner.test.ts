import { describe, expect, it } from "vitest";
import { InMemoryProfileHomeFeedCollectionRunRepository } from "../../collector-runtime/application/test-support/in-memory-profile-home-feed-collection-run-repository";
import type {
  Clock,
  FacebookHomeFeedPayloadCaptureInput,
  FacebookHomeFeedPayloadCapturePort,
  FacebookPayloadCaptureResult,
  HomeFeedContentSubmissionInput,
  HomeFeedContentSubmissionPort,
  HomeFeedContentSubmissionResult,
  HomeFeedExtractorLike,
  ProfileAuthenticationObservation,
  ProfileCheckoutInput,
  ProfileCheckoutResult,
  ProfileHomeFeedCheckoutPort,
  ProfileHomeFeedCheckoutResult,
  ProfileLeasePort,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  SourcePublisherObservationInput,
  SourcePublisherObservationPort,
  SourcePublisherObservationResult,
} from "../../collector-runtime/application";
import type { ProfileHomeFeedCollectionRun } from "../../collector-runtime/domain";
import {
  runProfileHomeFeedWorkerCommand,
  type ProfileHomeFeedWorkerLogger,
} from "./worker-runner";

const createdAt = "2026-06-21T10:00:00.000Z";

describe("profile home-feed worker runner", () => {
  it("runs once with no queued run and closes exactly once", async () => {
    const context = createContext();

    const result = await runProfileHomeFeedWorkerCommand({
      args: workerArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      ok: true,
      claimedRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
    });
    expect(context.logger.messages).toContain(
      "No queued profile home-feed collection run found.",
    );
    expect(context.closeCount).toBe(1);
    assertSafeLogs(context.logger.messages);
  });

  it("claims one queued run and executes it through the shared execution path", async () => {
    const context = createContext();
    await context.runs.create(createQueuedRun("run-success"));

    const result = await runProfileHomeFeedWorkerCommand({
      args: workerArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      ok: true,
      claimedRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
    });
    expect(await context.runs.findById("run-success")).toMatchObject({
      status: "SUCCEEDED",
    });
    expect(context.logger.messages).toContain("- Status: SUCCEEDED");
    expect(context.closeCount).toBe(1);
    assertSafeLogs(context.logger.messages);
  });

  it("passes the worker abort signal into home-feed execution", async () => {
    const context = createContext();
    await context.runs.create(createQueuedRun("run-abort-signal"));
    const abortController = new AbortController();

    await runProfileHomeFeedWorkerCommand({
      args: workerArgs({ once: true }),
      logger: context.logger,
      abortSignal: abortController.signal,
      dependencies: context.dependencies,
    });

    expect(context.capture.abortSignals).toEqual([abortController.signal]);
    expect(context.closeCount).toBe(1);
  });

  it("continues polling after an individual failure and stops on abort", async () => {
    const context = createContext();
    await context.runs.create(createQueuedRun("run-failed"));
    await context.runs.create(
      createQueuedRun("run-succeeded", {
        profileId: "profile-2",
        requestedAt: "2026-06-21T10:01:00.000Z",
        createdAt: "2026-06-21T10:01:00.000Z",
        updatedAt: "2026-06-21T10:01:00.000Z",
      }),
    );
    context.checkout.results = [
      {
        ok: false,
        errorCode: "PROFILE_NOT_CHECKOUT_ELIGIBLE",
        errorMessage: "unsafe upstream detail must not be logged",
      },
      {
        ok: true,
        profileId: "profile-2",
        accountStage: "WARMING",
        leaseId: "lease-2",
      },
    ];
    const abortController = new AbortController();
    context.logger.onInfo = (message) => {
      if (message === "- Status: SUCCEEDED") {
        abortController.abort();
      }
    };

    const result = await runProfileHomeFeedWorkerCommand({
      args: workerArgs({ once: false, pollIntervalMs: 1 }),
      logger: context.logger,
      abortSignal: abortController.signal,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      ok: false,
      claimedRuns: 2,
      succeededRuns: 1,
      failedRuns: 1,
    });
    expect(await context.runs.findById("run-failed")).toMatchObject({
      status: "FAILED",
    });
    expect(await context.runs.findById("run-succeeded")).toMatchObject({
      status: "SUCCEEDED",
    });
    expect(context.closeCount).toBe(1);
    assertSafeLogs(context.logger.messages);
  });
});

function createContext() {
  const runs = new InMemoryProfileHomeFeedCollectionRunRepository();
  const checkout = new FakeCheckoutPort();
  const lease = new FakeLeasePort();
  const capture = new FakeCapturePort();
  const publisher = new FakeSourcePublisherObservationPort();
  const submission = new FakeContentSubmissionPort();
  const extractor: HomeFeedExtractorLike = {
    extract: () => ({ valid: true, candidates: [], warnings: [] }),
  };
  const clock: Clock = { now: () => new Date(createdAt) };
  const logger = new MemoryLogger();
  let closeCount = 0;

  return {
    runs,
    checkout,
    capture,
    logger,
    get closeCount() {
      return closeCount;
    },
    dependencies: {
      runs,
      checkoutPort: checkout,
      leasePort: lease,
      capturePort: capture,
      publisherObservationPort: publisher,
      contentSubmissionPort: submission,
      extractor,
      clock,
      close: async () => {
        closeCount += 1;
      },
    },
  };
}

function workerArgs(
  overrides: Partial<Parameters<typeof runProfileHomeFeedWorkerCommand>[0]["args"]>,
) {
  return {
    baseUrl: "http://localhost:3000",
    browserProvider: "playwright" as const,
    once: true,
    pollIntervalMs: 5_000,
    ...overrides,
  };
}

function createQueuedRun(
  id: string,
  overrides: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id,
    profileId: "profile-1",
    triggerType: "SCHEDULED",
    status: "QUEUED",
    accountStageAtRequest: "WARMING",
    target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
    parameters: {},
    requestedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

const SENSITIVE_SUBSTRINGS = [
  "cookie",
  "localStorage",
  "authorization",
  "proxy",
  "fingerprint",
  "viewerId",
  "rawHtml",
  "screenshot",
  "DATABASE_URL",
  "unsafe upstream detail",
];

function assertSafeLogs(lines: readonly string[]): void {
  const joined = lines.join("\n").toLowerCase();
  for (const needle of SENSITIVE_SUBSTRINGS) {
    expect(joined).not.toContain(needle.toLowerCase());
  }
}

class MemoryLogger implements ProfileHomeFeedWorkerLogger {
  public readonly messages: string[] = [];
  public onInfo: ((message: string) => void) | undefined;

  public info(message: string): void {
    this.messages.push(message);
    this.onInfo?.(message);
  }

  public warn(message: string): void {
    this.messages.push(message);
    this.onInfo?.(message);
  }

  public error(message: string): void {
    this.messages.push(message);
    this.onInfo?.(message);
  }
}

class FakeCheckoutPort implements ProfileHomeFeedCheckoutPort {
  public results: ProfileHomeFeedCheckoutResult[] = [];

  public async checkoutProfileForHomeFeedCollection(
    profileId: string,
  ): Promise<ProfileHomeFeedCheckoutResult> {
    return (
      this.results.shift() ?? {
        ok: true,
        profileId,
        accountStage: "WARMING",
        leaseId: `lease-${profileId}`,
      }
    );
  }
}

class FakeLeasePort implements ProfileLeasePort {
  public async checkoutProfile(
    _input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    throw new Error("not used");
  }

  public async releaseProfileLease(
    _input: ProfileLeaseReleaseInput & {
      readonly authenticationObservation?: ProfileAuthenticationObservation;
    },
  ): Promise<ProfileLeaseReleaseResult> {
    return { ok: true };
  }
}

class FakeCapturePort implements FacebookHomeFeedPayloadCapturePort {
  public readonly abortSignals: Array<AbortSignal | undefined> = [];

  public async captureHomeFeedPayloads(
    input: FacebookHomeFeedPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    this.abortSignals.push(input.abortSignal);
    return {
      ok: true,
      capturedPayloads: [],
      warnings: [],
    };
  }
}

class FakeSourcePublisherObservationPort
  implements SourcePublisherObservationPort {
  public async observeSourcePublisher(
    input: SourcePublisherObservationInput,
  ): Promise<SourcePublisherObservationResult> {
    return { ok: true, sourcePublisherId: `sp-${input.externalPublisherId}` };
  }
}

class FakeContentSubmissionPort implements HomeFeedContentSubmissionPort {
  public async submitHomeFeedCollectedContent(
    input: HomeFeedContentSubmissionInput,
  ): Promise<HomeFeedContentSubmissionResult> {
    return { ok: true, contentItemId: `ci-${input.externalPostId}` };
  }
}
