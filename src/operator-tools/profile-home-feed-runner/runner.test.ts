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
import type {
  FacebookHomeFeedGraphQLExtractionResult,
  FacebookHomeFeedGraphQLPayloadExtractionInput,
} from "../../collector-runtime/platform-extractors/facebook";
import type { ProfileHomeFeedCollectionRun } from "../../collector-runtime/domain";
import {
  runProfileHomeFeedRunNextCommand,
  type ProfileHomeFeedRunNextLogger,
} from "./runner";

const createdAt = "2026-06-19T10:00:00.000Z";

describe("runProfileHomeFeedRunNextCommand", () => {
  it("reports zero claims and exits cleanly when no run is queued", async () => {
    const deps = createDependencies();
    const logger = createCapturingLogger();

    const result = await runProfileHomeFeedRunNextCommand({
      args: { baseUrl: "http://localhost:3000", browserProvider: "playwright" },
      logger,
      dependencies: deps.dependencies,
    });

    expect(result).toEqual({
      ok: true,
      claimedRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
    });
    expect(logger.lines).toContain(
      "No queued profile home-feed collection run found.",
    );
    assertSafeLogs(logger.lines);
  });

  it("claims, executes, and reports a SUCCEEDED run with a sanitized summary", async () => {
    const deps = createDependencies();
    await deps.runs.create(createQueuedRun("run-success"));
    const logger = createCapturingLogger();

    const result = await runProfileHomeFeedRunNextCommand({
      args: { baseUrl: "http://localhost:3000", browserProvider: "playwright" },
      logger,
      dependencies: deps.dependencies,
    });

    expect(result).toEqual({
      ok: true,
      claimedRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
    });
    expect(logger.lines).toContain("- Status: SUCCEEDED");
    expect(logger.lines).toContain("- Lease released: yes");
    assertSafeLogs(logger.lines);
  });

  it("reports a FAILED run with sanitized failure code and partial summary", async () => {
    const deps = createDependencies();
    deps.checkout.next = {
      ok: false,
      errorCode: "PROFILE_NOT_CHECKOUT_ELIGIBLE",
      errorMessage: "should not leak",
    };
    await deps.runs.create(createQueuedRun("run-failed"));
    const logger = createCapturingLogger();

    const result = await runProfileHomeFeedRunNextCommand({
      args: { baseUrl: "http://localhost:3000", browserProvider: "playwright" },
      logger,
      dependencies: deps.dependencies,
    });

    expect(result).toEqual({
      ok: false,
      claimedRuns: 1,
      succeededRuns: 0,
      failedRuns: 1,
    });
    expect(
      logger.lines.some((line) => line.includes("HOME_FEED_CHECKOUT_FAILED")),
    ).toBe(true);
    assertSafeLogs(logger.lines);
  });

  it("returns early when the abort signal is already aborted and never claims a run", async () => {
    const deps = createDependencies();
    await deps.runs.create(createQueuedRun("run-aborted"));
    const abortController = new AbortController();
    abortController.abort();

    const result = await runProfileHomeFeedRunNextCommand({
      args: { baseUrl: "http://localhost:3000", browserProvider: "playwright" },
      abortSignal: abortController.signal,
      dependencies: deps.dependencies,
    });

    expect(result).toEqual({
      ok: false,
      claimedRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
    });
    const stored = await deps.runs.findById("run-aborted");
    expect(stored?.status).toBe("QUEUED");
  });
});

interface FakeDependencies {
  readonly runs: InMemoryProfileHomeFeedCollectionRunRepository;
  readonly checkout: FakeCheckoutPort;
  readonly lease: FakeLeasePort;
  readonly capture: FakeCapturePort;
  readonly publisher: FakeSourcePublisherObservationPort;
  readonly submission: FakeContentSubmissionPort;
  readonly extractor: HomeFeedExtractorLike;
  readonly clock: Clock;
  readonly dependencies: {
    readonly runs: InMemoryProfileHomeFeedCollectionRunRepository;
    readonly checkoutPort: ProfileHomeFeedCheckoutPort;
    readonly leasePort: ProfileLeasePort;
    readonly capturePort: FacebookHomeFeedPayloadCapturePort;
    readonly publisherObservationPort: SourcePublisherObservationPort;
    readonly contentSubmissionPort: HomeFeedContentSubmissionPort;
    readonly extractor: HomeFeedExtractorLike;
    readonly clock: Clock;
    readonly close: () => Promise<void>;
  };
}

function createDependencies(): FakeDependencies {
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

  return {
    runs,
    checkout,
    lease,
    capture,
    publisher,
    submission,
    extractor,
    clock,
    dependencies: {
      runs,
      checkoutPort: checkout,
      leasePort: lease,
      capturePort: capture,
      publisherObservationPort: publisher,
      contentSubmissionPort: submission,
      extractor,
      clock,
      close: async () => undefined,
    },
  };
}

function createCapturingLogger(): {
  readonly lines: string[];
} & ProfileHomeFeedRunNextLogger {
  const lines: string[] = [];
  return {
    lines,
    info: (message) => lines.push(message),
    warn: (message) => lines.push(message),
    error: (message) => lines.push(message),
  };
}

function createQueuedRun(id: string): ProfileHomeFeedCollectionRun {
  return {
    id,
    profileId: "profile-1",
    triggerType: "MANUAL_API",
    status: "QUEUED",
    accountStageAtRequest: "WARMING",
    target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
    parameters: {},
    requestedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
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
];

function assertSafeLogs(lines: readonly string[]): void {
  const joined = lines.join("\n").toLowerCase();
  for (const needle of SENSITIVE_SUBSTRINGS) {
    expect(joined).not.toContain(needle.toLowerCase());
  }
}

class FakeCheckoutPort implements ProfileHomeFeedCheckoutPort {
  public next: ProfileHomeFeedCheckoutResult = {
    ok: true,
    profileId: "profile-1",
    accountStage: "WARMING",
    leaseId: "lease-1",
  };

  public async checkoutProfileForHomeFeedCollection(
    _profileId: string,
  ): Promise<ProfileHomeFeedCheckoutResult> {
    return this.next;
  }
}

class FakeLeasePort implements ProfileLeasePort {
  public next: ProfileLeaseReleaseResult = { ok: true };

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
    return this.next;
  }
}

class FakeCapturePort implements FacebookHomeFeedPayloadCapturePort {
  public next: FacebookPayloadCaptureResult = {
    ok: true,
    capturedPayloads: [],
    warnings: [],
  };

  public async captureHomeFeedPayloads(
    _input: FacebookHomeFeedPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    return this.next;
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

// Silence unused-import lint on the extraction input alias.
type _FacebookHomeFeedGraphQLPayloadExtractionInput =
  FacebookHomeFeedGraphQLPayloadExtractionInput;
type _FacebookHomeFeedGraphQLExtractionResult =
  FacebookHomeFeedGraphQLExtractionResult;
