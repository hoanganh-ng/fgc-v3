import { describe, expect, it } from "vitest";
import {
  ExecuteProfileHomeFeedCollectionRunUseCase,
  HOME_FEED_EXECUTION_MAX_DURATION_MS_CEILING,
  HOME_FEED_EXECUTION_MAX_POSTS_CEILING,
  HOME_FEED_EXECUTION_MAX_SCROLLS_CEILING,
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  MarkProfileHomeFeedCollectionRunFailedUseCase,
  MarkProfileHomeFeedCollectionRunSucceededUseCase,
} from "../index";
import type {
  CapturedFacebookPayload,
  Clock,
  FacebookHomeFeedPayloadCaptureInput,
  FacebookHomeFeedPayloadCapturePort,
  FacebookPayloadCaptureResult,
  HomeFeedContentSubmissionInput,
  HomeFeedContentSubmissionPort,
  HomeFeedContentSubmissionResult,
  HomeFeedExtractorLike,
  ProfileAuthenticationObservation,
  ProfileHomeFeedCheckoutPort,
  ProfileHomeFeedCheckoutResult,
  ProfileLeasePort,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  ProfileCheckoutInput,
  ProfileCheckoutResult,
  SourcePublisherObservationInput,
  SourcePublisherObservationPort,
  SourcePublisherObservationResult,
} from "../index";
import { InMemoryProfileHomeFeedCollectionRunRepository } from "../test-support/in-memory-profile-home-feed-collection-run-repository";
import type {
  FacebookHomeFeedExtractedContentCandidate,
  FacebookHomeFeedGraphQLExtractionResult,
  FacebookHomeFeedGraphQLPayloadExtractionInput,
} from "../../platform-extractors/facebook";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedDiagnosticSummary,
} from "../../domain";

const createdAt = "2026-06-19T10:00:00.000Z";
const claimedAt = "2026-06-19T10:01:00.000Z";
const observedAtIso = "2026-06-19T10:02:00.000Z";

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

describe("ExecuteProfileHomeFeedCollectionRunUseCase", () => {
  it("fails the RUNNING run BEFORE checkout when maxScrolls exceeds the ceiling", async () => {
    const ctx = await createContext({
      parameters: { maxScrolls: HOME_FEED_EXECUTION_MAX_SCROLLS_CEILING + 1 },
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toEqual({
      code: "HOME_FEED_EXECUTION_BOUNDS_EXCEEDED",
      message: "Home-feed execution bounds exceed permitted ceilings.",
    });
    expect(ctx.checkout.calls).toEqual([]);
    expect(ctx.capture.calls).toEqual([]);
  });

  it("fails BEFORE checkout when maxDurationMs exceeds the ceiling", async () => {
    const ctx = await createContext({
      parameters: {
        maxDurationMs: HOME_FEED_EXECUTION_MAX_DURATION_MS_CEILING + 1,
      },
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_EXECUTION_BOUNDS_EXCEEDED",
    );
    expect(ctx.checkout.calls).toEqual([]);
  });

  it("fails BEFORE checkout when maxPosts exceeds the ceiling", async () => {
    const ctx = await createContext({
      parameters: { maxPosts: HOME_FEED_EXECUTION_MAX_POSTS_CEILING + 1 },
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_EXECUTION_BOUNDS_EXCEEDED",
    );
    expect(ctx.checkout.calls).toEqual([]);
  });

  it("rejects a non-RUNNING run with InvalidProfileHomeFeedCollectionRunStatusTransitionError", async () => {
    const ctx = await createContext({ runStatus: "QUEUED" });

    await expect(ctx.useCase.execute({ runId: ctx.runId })).rejects.toThrow(
      InvalidProfileHomeFeedCollectionRunStatusTransitionError,
    );
  });

  it("releases the returned lease on a mismatched successful checkout and records leaseReleased", async () => {
    const ctx = await createContext();
    ctx.checkout.next = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
      leaseId: "lease-1",
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "PROFILE_HOME_FEED_CHECKOUT_PROFILE_MISMATCH",
    );
    expect(result.summary).toMatchObject({ leaseReleased: true });
    expect(ctx.capture.calls).toEqual([]);
    expect(ctx.lease.releases).toEqual([
      {
        profileId: "different-profile",
        leaseId: "lease-1",
      },
    ]);
  });

  it("classifies mismatch with release failure as HOME_FEED_LEASE_RELEASE_FAILED", async () => {
    const ctx = await createContext();
    ctx.checkout.next = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
      leaseId: "lease-1",
    };
    ctx.lease.releaseResult = {
      ok: false,
      statusCode: 503,
      errorCode: "PROFILE_LEASE_RELEASE_FAILED",
      errorMessage: "this should not leak",
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_LEASE_RELEASE_FAILED",
    );
    expect(result.summary).toMatchObject({ leaseReleased: false });
    expect(ctx.lease.releases).toHaveLength(1);
    expect(ctx.capture.calls).toEqual([]);
  });

  it("uses HOME_FEED_EXECUTION_FAILED when an unexpected operational error occurs after successful checkout", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });
    let clockCalls = 0;
    ctx.clock.handler = () => {
      clockCalls += 1;
      if (clockCalls === 1) {
        throw new Error(
          "cookie=c_user; authorization=Bearer xyz; proxy=user:pass",
        );
      }
      return new Date(observedAtIso);
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toEqual({
      code: "HOME_FEED_EXECUTION_FAILED",
      message: "Home-feed execution failed unexpectedly.",
    });
    expect(result.summary).toMatchObject({
      capturedPayloads: 1,
      extractorCandidates: 1,
      leaseReleased: true,
    });
    expect(ctx.lease.releases).toHaveLength(1);
    const serialized = JSON.stringify(result);
    for (const needle of SENSITIVE_SUBSTRINGS) {
      expect(serialized.toLowerCase()).not.toContain(needle.toLowerCase());
    }
  });

  it("classifies unexpected-error + release-failure as HOME_FEED_LEASE_RELEASE_FAILED", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });
    let clockCalls = 0;
    ctx.clock.handler = () => {
      clockCalls += 1;
      if (clockCalls === 1) {
        throw new Error("boom");
      }
      return new Date(observedAtIso);
    };
    ctx.lease.releaseResult = {
      ok: false,
      statusCode: 503,
      errorCode: "PROFILE_LEASE_RELEASE_FAILED",
      errorMessage: "this should not leak",
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_LEASE_RELEASE_FAILED",
    );
    expect(result.summary).toMatchObject({ leaseReleased: false });
    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("propagates a terminal CAS conflict from markSucceeded and does not release the lease a second time", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });
    const repository = ctx.runs as ConflictingTerminalRepository;
    repository.failNextTransition = true;

    await expect(ctx.useCase.execute({ runId: ctx.runId })).rejects.toThrow(
      InvalidProfileHomeFeedCollectionRunStatusTransitionError,
    );
    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("propagates a terminal CAS conflict from markFailed (mismatch path) and does not release again", async () => {
    const ctx = await createContext();
    ctx.checkout.next = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
      leaseId: "lease-1",
    };
    const repository = ctx.runs as ConflictingTerminalRepository;
    repository.failNextTransition = true;

    await expect(ctx.useCase.execute({ runId: ctx.runId })).rejects.toThrow(
      InvalidProfileHomeFeedCollectionRunStatusTransitionError,
    );
    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("propagates a terminal CAS conflict from markFailed (capture path) and does not release again", async () => {
    const ctx = await createContext();
    ctx.capture.next = {
      ok: false,
      errorCode: "LOGIN_REQUIRED",
      errorMessage: "session expired",
      warnings: [],
    };
    const repository = ctx.runs as ConflictingTerminalRepository;
    repository.failNextTransition = true;

    await expect(ctx.useCase.execute({ runId: ctx.runId })).rejects.toThrow(
      InvalidProfileHomeFeedCollectionRunStatusTransitionError,
    );
    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("attempts lease release exactly once on the happy path", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });

    await ctx.useCase.execute({ runId: ctx.runId });

    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("attempts lease release exactly once on mid-capture interruption", async () => {
    const ctx = await createContext();
    const abortController = new AbortController();
    ctx.capture.next = async () => {
      abortController.abort();
      return {
        ok: false,
        errorCode: "FACEBOOK_BROWSER_CAPTURE_INTERRUPTED",
        errorMessage: "interrupted",
        warnings: [],
      };
    };

    const result = await ctx.useCase.execute({
      runId: ctx.runId,
      abortSignal: abortController.signal,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_EXECUTION_INTERRUPTED",
    );
    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("attempts lease release exactly once on mid-delivery interruption", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [
            createCandidate({ externalPostId: "post-1" }),
            createCandidate({ externalPostId: "post-2" }),
          ],
          warnings: [],
        },
      ],
    });
    const abortController = new AbortController();
    let observedCount = 0;
    ctx.submission.handler = (input) => {
      observedCount += 1;
      if (input.externalPostId === "post-1") {
        abortController.abort();
      }
      return { ok: true, contentItemId: `ci-${input.externalPostId}` };
    };

    const result = await ctx.useCase.execute({
      runId: ctx.runId,
      abortSignal: abortController.signal,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_EXECUTION_INTERRUPTED",
    );
    expect(observedCount).toBe(1);
    expect(ctx.lease.releases).toHaveLength(1);
  });

  it("treats a lease-release failure on a mid-delivery interruption as the terminal failure", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });
    const abortController = new AbortController();
    ctx.submission.handler = () => {
      abortController.abort();
      return {
        ok: false,
        errorCode: "CONTENT_MANAGER_HTTP_ERROR",
        errorMessage: "interrupted",
      };
    };
    ctx.lease.releaseResult = {
      ok: false,
      statusCode: 503,
      errorCode: "PROFILE_LEASE_RELEASE_FAILED",
      errorMessage: "this should not leak",
    };

    const result = await ctx.useCase.execute({
      runId: ctx.runId,
      abortSignal: abortController.signal,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_LEASE_RELEASE_FAILED",
    );
  });

  it("fails when checkout port returns !ok and skips capture and release", async () => {
    const ctx = await createContext();
    ctx.checkout.next = {
      ok: false,
      errorCode: "PROFILE_NOT_CHECKOUT_ELIGIBLE",
      errorMessage: "this should not leak",
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toEqual({
      code: "HOME_FEED_CHECKOUT_FAILED",
      message: "Home-feed profile checkout failed.",
    });
    expect(ctx.capture.calls).toEqual([]);
    expect(ctx.lease.releases).toEqual([]);
  });

  it("forwards LOGIN_REQUIRED to lease release as authenticationObservation", async () => {
    const ctx = await createContext();
    ctx.capture.next = {
      ok: false,
      errorCode: "LOGIN_REQUIRED",
      errorMessage: "session expired",
      warnings: [],
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe("HOME_FEED_CAPTURE_FAILED");
    expect(result.summary).toMatchObject({
      capturedPayloads: 0,
      leaseReleased: true,
    });
    expect(ctx.lease.releases).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        authenticationObservation: "LOGIN_REQUIRED",
      },
    ]);
  });

  it("forwards CHECKPOINT_REQUIRED to lease release as authenticationObservation", async () => {
    const ctx = await createContext();
    ctx.capture.next = {
      ok: false,
      errorCode: "CHECKPOINT_REQUIRED",
      errorMessage: "checkpoint required",
      warnings: [],
    };

    await ctx.useCase.execute({ runId: ctx.runId });

    expect(ctx.lease.releases[0]?.authenticationObservation).toBe(
      "CHECKPOINT_REQUIRED",
    );
  });

  it("captures, deduplicates, and submits one content item per unique post key", async () => {
    const candidate1 = createCandidate({
      externalPostId: "post-1",
      externalPublisherId: "publisher-a",
    });
    const candidate2 = createCandidate({
      externalPostId: "post-2",
      externalPublisherId: "publisher-a",
    });
    const candidateDup = createCandidate({
      externalPostId: "post-1",
      externalPublisherId: "publisher-a",
    });
    const ctx = await createContext({
      capturedPayloads: [
        { payload: { p: 1 }, capturedAt: new Date(createdAt) },
        { payload: { p: 2 }, capturedAt: new Date(createdAt) },
      ],
      extractions: [
        { valid: true, candidates: [candidate1, candidateDup], warnings: [] },
        { valid: true, candidates: [candidate2], warnings: [] },
      ],
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.summary).toEqual({
      capturedPayloads: 2,
      extractorCandidates: 2,
      sourcePublishersObserved: 1,
      contentItemsSubmitted: 2,
      failedPublisherObservations: 0,
      failedContentSubmissions: 0,
      leaseReleased: true,
    });
    expect(ctx.publisher.calls).toHaveLength(1);
    expect(ctx.submission.calls.map((c) => c.externalPostId)).toEqual([
      "post-1",
      "post-2",
    ]);
  });

  it("caps extractor candidates at maxPosts and drops extras", async () => {
    const ctx = await createContext({
      parameters: { maxPosts: 3 },
      capturedPayloads: [
        { payload: {}, capturedAt: new Date(createdAt) },
      ],
      extractions: [
        {
          valid: true,
          candidates: [
            createCandidate({ externalPostId: "p1" }),
            createCandidate({ externalPostId: "p2" }),
            createCandidate({ externalPostId: "p3" }),
            createCandidate({ externalPostId: "p4" }),
            createCandidate({ externalPostId: "p5" }),
          ],
          warnings: [],
        },
      ],
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.summary?.extractorCandidates).toBe(3);
    expect(ctx.submission.calls).toHaveLength(3);
  });

  it("counts publisher observation failures and blocks that publisher's submissions", async () => {
    const candidatePub1 = createCandidate({
      externalPostId: "post-1",
      externalPublisherId: "publisher-1",
    });
    const candidatePub1Again = createCandidate({
      externalPostId: "post-2",
      externalPublisherId: "publisher-1",
    });
    const candidatePub2 = createCandidate({
      externalPostId: "post-3",
      externalPublisherId: "publisher-2",
    });
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [candidatePub1, candidatePub1Again, candidatePub2],
          warnings: [],
        },
      ],
    });
    ctx.publisher.handler = (input) => {
      if (input.externalPublisherId === "publisher-1") {
        return {
          ok: false,
          statusCode: 503,
          errorCode: "CONTENT_MANAGER_HTTP_ERROR",
          errorMessage: "this should not leak",
        };
      }
      return { ok: true, sourcePublisherId: `sp-${input.externalPublisherId}` };
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe("HOME_FEED_EXECUTION_PARTIAL_FAILURE");
    expect(result.summary).toEqual({
      capturedPayloads: 1,
      extractorCandidates: 3,
      sourcePublishersObserved: 1,
      contentItemsSubmitted: 1,
      failedPublisherObservations: 1,
      failedContentSubmissions: 2,
      leaseReleased: true,
    });
    expect(ctx.publisher.calls).toHaveLength(2);
    expect(ctx.submission.calls.map((c) => c.externalPostId)).toEqual([
      "post-3",
    ]);
  });

  it("counts content submission failures while continuing", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [
            createCandidate({ externalPostId: "post-1" }),
            createCandidate({ externalPostId: "post-2" }),
          ],
          warnings: [],
        },
      ],
    });
    let callIndex = 0;
    ctx.submission.handler = () => {
      callIndex += 1;
      if (callIndex === 1) {
        return {
          ok: false,
          statusCode: 502,
          errorCode: "CONTENT_MANAGER_HTTP_ERROR",
          errorMessage: "this should not leak",
        };
      }
      return { ok: true, contentItemId: "ci-2" };
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.summary).toEqual({
      capturedPayloads: 1,
      extractorCandidates: 2,
      sourcePublishersObserved: 1,
      contentItemsSubmitted: 1,
      failedPublisherObservations: 0,
      failedContentSubmissions: 1,
      leaseReleased: true,
    });
  });

  it("succeeds with zero candidates when capture and release succeeded", async () => {
    const ctx = await createContext({
      capturedPayloads: [],
      extractions: [],
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.summary).toEqual({
      capturedPayloads: 0,
      extractorCandidates: 0,
      sourcePublishersObserved: 0,
      contentItemsSubmitted: 0,
      failedPublisherObservations: 0,
      failedContentSubmissions: 0,
      leaseReleased: true,
    });
    expect(ctx.publisher.calls).toEqual([]);
    expect(ctx.submission.calls).toEqual([]);
  });

  it("fails when lease release fails after successful capture and submissions", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });
    ctx.lease.releaseResult = {
      ok: false,
      statusCode: 503,
      errorCode: "PROFILE_LEASE_RELEASE_FAILED",
      errorMessage: "this should not leak",
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toEqual({
      code: "HOME_FEED_LEASE_RELEASE_FAILED",
      message: "Profile lease release failed after home-feed capture.",
    });
    expect(result.summary?.leaseReleased).toBe(false);
    expect(result.summary?.contentItemsSubmitted).toBe(1);
  });

  it("never includes sensitive substrings in failure messages or summary", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ payload: {}, capturedAt: new Date(createdAt) }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "post-1" })],
          warnings: [],
        },
      ],
    });
    ctx.publisher.handler = () => ({
      ok: false,
      errorCode: "X",
      errorMessage:
        "cookie=evil; authorization=Bearer xxx; proxy=user:pass; fingerprint=abc",
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    const serialized = JSON.stringify(result);
    for (const needle of SENSITIVE_SUBSTRINGS) {
      expect(serialized.toLowerCase()).not.toContain(needle.toLowerCase());
    }
  });

  it("aborts immediately when abortSignal is already aborted", async () => {
    const ctx = await createContext();
    const abortController = new AbortController();
    abortController.abort();

    const result = await ctx.useCase.execute({
      runId: ctx.runId,
      abortSignal: abortController.signal,
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_EXECUTION_INTERRUPTED",
    );
    expect(ctx.checkout.calls).toEqual([]);
  });

  it("surfaces CAS conflict from terminal mark as InvalidProfileHomeFeedCollectionRunStatusTransitionError", async () => {
    const ctx = await createContext({
      capturedPayloads: [],
      extractions: [],
    });
    const repository = ctx.runs as ConflictingTerminalRepository;
    repository.failNextTransition = true;

    await expect(ctx.useCase.execute({ runId: ctx.runId })).rejects.toThrow(
      InvalidProfileHomeFeedCollectionRunStatusTransitionError,
    );
  });

  it("persists diagnostics on a successful run with capture counters and a zero-candidate warning histogram", async () => {
    const ctx = await createContext({
      capturedPayloads: [
        { capturedAt: new Date(createdAt), payload: {} },
        { capturedAt: new Date(createdAt), payload: {} },
      ],
      extractions: [
        {
          valid: true,
          candidates: [],
          warnings: [
            { code: "UNKNOWN_PUBLISHER_KIND", message: "x" },
            { code: "UNKNOWN_PUBLISHER_KIND", message: "x" },
            { code: "MISSING_SOURCE_URL", message: "x" },
            { code: "UNSUPPORTED_PAYLOAD_SHAPE", message: "x" },
          ],
        },
        {
          valid: true,
          candidates: [],
          warnings: [],
        },
      ],
    });
    ctx.capture.next = {
      ok: true,
      capturedPayloads: [
        { capturedAt: new Date(createdAt), payload: {} },
        { capturedAt: new Date(createdAt), payload: {} },
      ],
      warnings: [],
      diagnostics: {
        pageContextFetchCaptureCount: 0,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 4,
        parseFailureCount: 1,
        totalPayloadsPassedToExtractor: 2,
        finalPageUrl: "https://www.facebook.com/?sk=h_chr",
        loginRedirectSuspected: false,
      },
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("SUCCEEDED");
    const diagnostics = result.diagnostics as
      | ProfileHomeFeedDiagnosticSummary
      | undefined;
    expect(diagnostics).toBeDefined();
    expect(diagnostics?.schemaVersion).toBe(1);
    expect(diagnostics?.captureStage).toBe("SUCCEEDED");
    expect(diagnostics?.capture).toEqual({
      pageContextFetchCaptureCount: 0,
      pageContextXhrCaptureCount: 0,
      networkListenerCaptureCount: 4,
      parseFailureCount: 1,
      totalPayloadsPassedToExtractor: 2,
    });
    expect(diagnostics?.captureFinalPageUrl).toBe(
      "https://www.facebook.com/",
    );
    expect(diagnostics?.extractor).toEqual({
      extractedCandidateCount: 0,
      deduplicatedCandidateCount: 0,
    });
    expect(diagnostics?.warningCounts).toEqual({
      UNKNOWN_PUBLISHER_KIND: 2,
      MISSING_SOURCE_URL: 1,
      UNSUPPORTED_PAYLOAD_SHAPE: 1,
    });
    expect(diagnostics?.unsupportedPayloadCount).toBe(1);
  });

  it("persists diagnostics with capture-stage CAPTURE_FAILED on a failed capture", async () => {
    const ctx = await createContext();
    ctx.capture.next = {
      ok: false,
      errorCode: "LOGIN_REQUIRED",
      errorMessage: "Login required.",
      warnings: [],
      diagnostics: {
        pageContextFetchCaptureCount: 0,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 0,
        parseFailureCount: 3,
        totalPayloadsPassedToExtractor: 0,
        finalPageUrl: "https://www.facebook.com/login/?secret=ABC",
        loginRedirectSuspected: true,
      },
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe("HOME_FEED_CAPTURE_FAILED");
    const diagnostics = result.diagnostics as
      | ProfileHomeFeedDiagnosticSummary
      | undefined;
    expect(diagnostics?.captureStage).toBe("CAPTURE_FAILED");
    expect(diagnostics?.runOutcome).toEqual({
      failureStage: "CAPTURE",
      failureCode: "LOGIN_REQUIRED",
    });
    expect(diagnostics?.captureFinalPageUrl).toBe(
      "https://www.facebook.com/login/",
    );
    expect(diagnostics?.captureLoginRedirectSuspected).toBe(true);
  });

  it("preserves captured diagnostics when capture succeeds but no candidates are submitted", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ capturedAt: new Date(createdAt), payload: {} }],
      extractions: [
        {
          valid: true,
          candidates: [],
          warnings: [
            { code: "MISSING_STABLE_PUBLISHER_ID", message: "x" },
          ],
        },
      ],
    });
    ctx.capture.next = {
      ok: true,
      capturedPayloads: [{ capturedAt: new Date(createdAt), payload: {} }],
      warnings: [],
      diagnostics: {
        pageContextFetchCaptureCount: 0,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 1,
        parseFailureCount: 0,
        totalPayloadsPassedToExtractor: 1,
        loginRedirectSuspected: false,
      },
    };

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("SUCCEEDED");
    const diagnostics = result.diagnostics as
      | ProfileHomeFeedDiagnosticSummary
      | undefined;
    expect(diagnostics?.warningCounts).toEqual({
      MISSING_STABLE_PUBLISHER_ID: 1,
    });
    expect(diagnostics?.capture?.totalPayloadsPassedToExtractor).toBe(1);
  });

  it("populates diagnostics with PARTIAL stage when publisher observations fail", async () => {
    const ctx = await createContext({
      capturedPayloads: [{ capturedAt: new Date(createdAt), payload: {} }],
      extractions: [
        {
          valid: true,
          candidates: [createCandidate({ externalPostId: "p-1" })],
          warnings: [],
        },
      ],
    });
    ctx.publisher.handler = () => ({
      ok: false,
      errorCode: "PUBLISHER_OBSERVATION_FAILED",
      errorMessage: "Publisher observation failed.",
    });

    const result = await ctx.useCase.execute({ runId: ctx.runId });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason?.code).toBe(
      "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
    );
    const diagnostics = result.diagnostics as
      | ProfileHomeFeedDiagnosticSummary
      | undefined;
    expect(diagnostics?.runOutcome).toEqual({
      failureStage: "PARTIAL",
      failureCode: "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
    });
  });
});

interface CreateContextOptions {
  readonly runStatus?: ProfileHomeFeedCollectionRun["status"];
  readonly parameters?: ProfileHomeFeedCollectionRunParameters;
  readonly capturedPayloads?: readonly CapturedFacebookPayload[];
  readonly extractions?: readonly FacebookHomeFeedGraphQLExtractionResult[];
}

interface TestContext {
  readonly useCase: ExecuteProfileHomeFeedCollectionRunUseCase;
  readonly runs: InMemoryProfileHomeFeedCollectionRunRepository;
  readonly runId: string;
  readonly checkout: FakeCheckoutPort;
  readonly lease: FakeLeasePort;
  readonly capture: FakeCapturePort;
  readonly publisher: FakeSourcePublisherObservationPort;
  readonly submission: FakeContentSubmissionPort;
  readonly clock: FixedClock;
}

async function createContext(
  options: CreateContextOptions = {},
): Promise<TestContext> {
  const clock = new FixedClock(observedAtIso);
  const runs = new ConflictingTerminalRepository();
  const parameters: ProfileHomeFeedCollectionRunParameters =
    options.parameters ?? {};
  const status = options.runStatus ?? "RUNNING";
  const baseRun: ProfileHomeFeedCollectionRun = {
    id: "run-1",
    profileId: "profile-1",
    triggerType: "MANUAL_API",
    status,
    accountStageAtRequest: "WARMING",
    target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
    parameters,
    requestedAt: createdAt,
    createdAt,
    updatedAt: claimedAt,
    ...(status === "RUNNING" ||
    status === "SUCCEEDED" ||
    status === "FAILED"
      ? { startedAt: claimedAt }
      : {}),
  };
  await runs.create(baseRun);

  const checkout = new FakeCheckoutPort();
  const lease = new FakeLeasePort();
  const capture = new FakeCapturePort();
  const publisher = new FakeSourcePublisherObservationPort();
  const submission = new FakeContentSubmissionPort();

  if (options.capturedPayloads !== undefined) {
    capture.next = {
      ok: true,
      capturedPayloads: options.capturedPayloads,
      warnings: [],
    };
  }
  const extractor = new ScriptedExtractor(options.extractions ?? []);
  const markSucceeded = new MarkProfileHomeFeedCollectionRunSucceededUseCase(
    runs,
    clock,
  );
  const markFailed = new MarkProfileHomeFeedCollectionRunFailedUseCase(
    runs,
    clock,
  );
  const useCase = new ExecuteProfileHomeFeedCollectionRunUseCase(
    runs,
    markSucceeded,
    markFailed,
    checkout,
    lease,
    capture,
    publisher,
    submission,
    extractor,
    clock,
  );

  return {
    useCase,
    runs,
    runId: baseRun.id,
    checkout,
    lease,
    capture,
    publisher,
    submission,
    clock,
  };
}

class FixedClock implements Clock {
  public handler: (() => Date) | undefined;

  public constructor(private readonly nowResult: string) {}

  public now(): Date {
    if (this.handler !== undefined) {
      return this.handler();
    }
    return new Date(this.nowResult);
  }
}

class FakeCheckoutPort implements ProfileHomeFeedCheckoutPort {
  public readonly calls: string[] = [];
  public next: ProfileHomeFeedCheckoutResult = {
    ok: true,
    profileId: "profile-1",
    accountStage: "WARMING",
    leaseId: "lease-1",
  };

  public async checkoutProfileForHomeFeedCollection(
    profileId: string,
  ): Promise<ProfileHomeFeedCheckoutResult> {
    this.calls.push(profileId);
    return this.next;
  }
}

class FakeLeasePort implements ProfileLeasePort {
  public readonly releases: Array<{
    readonly profileId: string;
    readonly leaseId: string;
    readonly authenticationObservation?: ProfileAuthenticationObservation;
  }> = [];
  public releaseResult: ProfileLeaseReleaseResult = { ok: true };

  public async checkoutProfile(
    _input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    throw new Error("not used");
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.releases.push({
      profileId: input.profileId,
      leaseId: input.leaseId,
      ...(input.authenticationObservation !== undefined
        ? { authenticationObservation: input.authenticationObservation }
        : {}),
    });
    return this.releaseResult;
  }
}

class FakeCapturePort implements FacebookHomeFeedPayloadCapturePort {
  public readonly calls: FacebookHomeFeedPayloadCaptureInput[] = [];
  public next:
    | FacebookPayloadCaptureResult
    | ((
        input: FacebookHomeFeedPayloadCaptureInput,
      ) => Promise<FacebookPayloadCaptureResult>) = {
    ok: true,
    capturedPayloads: [],
    warnings: [],
  };

  public async captureHomeFeedPayloads(
    input: FacebookHomeFeedPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    this.calls.push(input);
    if (typeof this.next === "function") {
      return this.next(input);
    }
    return this.next;
  }
}

class FakeSourcePublisherObservationPort
  implements SourcePublisherObservationPort {
  public readonly calls: SourcePublisherObservationInput[] = [];
  public handler: (
    input: SourcePublisherObservationInput,
  ) => SourcePublisherObservationResult = (input) => ({
    ok: true,
    sourcePublisherId: `sp-${input.externalPublisherId}`,
  });

  public async observeSourcePublisher(
    input: SourcePublisherObservationInput,
  ): Promise<SourcePublisherObservationResult> {
    this.calls.push(input);
    return this.handler(input);
  }
}

class FakeContentSubmissionPort implements HomeFeedContentSubmissionPort {
  public readonly calls: HomeFeedContentSubmissionInput[] = [];
  public handler: (
    input: HomeFeedContentSubmissionInput,
  ) => HomeFeedContentSubmissionResult = (input) => ({
    ok: true,
    contentItemId: `ci-${input.externalPostId}`,
  });

  public async submitHomeFeedCollectedContent(
    input: HomeFeedContentSubmissionInput,
  ): Promise<HomeFeedContentSubmissionResult> {
    this.calls.push(input);
    return this.handler(input);
  }
}

class ScriptedExtractor implements HomeFeedExtractorLike {
  private index = 0;

  public constructor(
    private readonly scripts: readonly FacebookHomeFeedGraphQLExtractionResult[],
  ) {}

  public extract(
    _input: FacebookHomeFeedGraphQLPayloadExtractionInput,
  ): FacebookHomeFeedGraphQLExtractionResult {
    const script = this.scripts[this.index] ?? {
      valid: true,
      candidates: [],
      warnings: [],
    };
    this.index += 1;
    return script;
  }
}

class ConflictingTerminalRepository extends InMemoryProfileHomeFeedCollectionRunRepository {
  public failNextTransition = false;

  public override async transitionStatus(
    transition: Parameters<
      InMemoryProfileHomeFeedCollectionRunRepository["transitionStatus"]
    >[0],
  ): ReturnType<
    InMemoryProfileHomeFeedCollectionRunRepository["transitionStatus"]
  > {
    if (
      this.failNextTransition &&
      (transition.nextStatus === "SUCCEEDED" ||
        transition.nextStatus === "FAILED")
    ) {
      this.failNextTransition = false;
      const existing = await this.findById(transition.runId);
      if (existing === null) {
        return { ok: false, reason: "not_found" };
      }
      return {
        ok: false,
        reason: "status_conflict",
        currentRun: {
          ...existing,
          status: "CANCELED",
          startedAt: undefined,
          finishedAt: transition.updatedAt,
          summary: undefined,
          failureReason: undefined,
        } as ProfileHomeFeedCollectionRun,
      };
    }
    return super.transitionStatus(transition);
  }
}

function createCandidate(options: {
  readonly externalPostId: string;
  readonly externalPublisherId?: string;
  readonly publisherKind?: "GROUP" | "PAGE";
}): FacebookHomeFeedExtractedContentCandidate {
  return {
    platform: "FACEBOOK",
    externalPostId: options.externalPostId,
    sourceUrl: `https://www.facebook.com/post/${options.externalPostId}`,
    bodyText: `body for ${options.externalPostId}`,
    collectedAt: createdAt,
    reactionCount: 1,
    commentCount: 1,
    topComments: [],
    publisherObservation: {
      platform: "FACEBOOK",
      kind: options.publisherKind ?? "GROUP",
      externalPublisherId: options.externalPublisherId ?? "publisher-default",
      observedAt: createdAt,
    },
  };
}
