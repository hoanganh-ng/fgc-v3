import { describe, expect, it } from "vitest";
import {
  syntheticUnsupportedPayload,
  syntheticValidGroupPostPayload,
} from "../platform-extractors/facebook/__fixtures__";
import { RunFacebookGroupCollectionUseCase } from "./run-facebook-group-collection";
import { SubmitCapturedFacebookPayloadUseCase } from "./submit-captured-facebook-payload";
import type {
  CapturedFacebookPayload,
  CollectorRuntimeWarning,
  FacebookGroupPayloadCaptureInput,
  FacebookGroupPayloadCapturePort,
  FacebookPayloadCaptureResult,
  ProfileCheckoutInput,
  ProfileCheckoutResult,
  ProfileLeasePort,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
} from "./collector-runtime.ports";
import type {
  CollectedContentSubmissionInput,
  ContentManagerContentSubmissionPort,
  ContentSubmissionResult,
} from "./collector-runtime.types";

const sourceGroupId = "source-group-1";
const sourceGroupUrl = "https://www.facebook.com/groups/group-1/";
const capturedAt = new Date("2026-03-01T12:00:00.000Z");

describe("RunFacebookGroupCollectionUseCase", () => {
  it("checks out a profile, captures payloads, submits candidates, and releases the lease", async () => {
    const context = createContext({
      capturedPayloads: [createCapturedPayload(syntheticValidGroupPostPayload)],
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: true,
      profileId: "profile-1",
      leaseId: "lease-1",
      capturedPayloadCount: 1,
      extractedCandidateCount: 1,
      submittedCount: 1,
      failedSubmissionCount: 0,
      leaseReleased: true,
    });
    expect(context.profileLeasePort.checkoutCalls).toEqual([
      {
        sourceGroupId,
        purpose: "FACEBOOK_GROUP_COLLECTION",
      },
    ]);
    expect(context.capturePort.calls).toEqual([
      {
        sourceGroupId,
        sourceGroupUrl,
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);
    expect(context.contentSubmissionPort.calls).toHaveLength(1);
    expect(context.profileLeasePort.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);
  });

  it("attempts lease release when capture fails after checkout", async () => {
    const context = createContext();

    context.capturePort.setResult({
      ok: false,
      errorCode: "CAPTURE_FAILED",
      errorMessage: "Unable to capture payloads.",
      warnings: [
        {
          code: "CAPTURE_DELAYED",
          message: "Capture was delayed before failing.",
        },
      ],
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: false,
      capturedPayloadCount: 0,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      leaseReleased: true,
      errors: [
        {
          code: "FACEBOOK_PAYLOAD_CAPTURE_FAILED",
          causeCode: "CAPTURE_FAILED",
        },
      ],
    });
    expect(result.warnings).toContainEqual({
      source: "PAYLOAD_CAPTURE",
      code: "CAPTURE_DELAYED",
      message: "Capture was delayed before failing.",
    });
    expect(context.profileLeasePort.releaseCalls).toHaveLength(1);
    expect(context.contentSubmissionPort.calls).toEqual([]);
  });

  it("attempts lease release when submission has partial failures", async () => {
    const context = createContext({
      capturedPayloads: [createCapturedPayload(syntheticTwoPostPayload)],
    });

    context.contentSubmissionPort.setResult("post-b", {
      ok: false,
      statusCode: 409,
      errorCode: "CONTENT_MANAGER_HTTP_ERROR",
      errorMessage: "Duplicate content item.",
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(context.contentSubmissionPort.calls.map((call) => call.externalPostId))
      .toEqual(["post-a", "post-b"]);
    expect(context.profileLeasePort.releaseCalls).toHaveLength(1);
    expect(result).toMatchObject({
      ok: false,
      capturedPayloadCount: 1,
      extractedCandidateCount: 2,
      submittedCount: 1,
      failedSubmissionCount: 1,
      leaseReleased: true,
      errors: [
        {
          code: "CONTENT_SUBMISSION_FAILED",
          causeCode: "CONTENT_MANAGER_HTTP_ERROR",
          payloadIndex: 0,
          externalPostId: "post-b",
          statusCode: 409,
        },
      ],
    });
  });

  it("stops before capture, submission, and release when checkout fails", async () => {
    const context = createContext();

    context.profileLeasePort.setCheckoutResult({
      ok: false,
      errorCode: "NO_ELIGIBLE_PROFILE",
      errorMessage: "No checkout-eligible profile is available.",
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: false,
      capturedPayloadCount: 0,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      leaseReleased: false,
      errors: [
        {
          code: "PROFILE_CHECKOUT_FAILED",
          causeCode: "NO_ELIGIBLE_PROFILE",
        },
      ],
    });
    expect(context.capturePort.calls).toEqual([]);
    expect(context.contentSubmissionPort.calls).toEqual([]);
    expect(context.profileLeasePort.releaseCalls).toEqual([]);
  });

  it("returns success with zero submitted content when no payloads are captured", async () => {
    const context = createContext({
      capturedPayloads: [],
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: true,
      capturedPayloadCount: 0,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      payloadResults: [],
      leaseReleased: true,
    });
    expect(context.contentSubmissionPort.calls).toEqual([]);
  });

  it("returns success when captured payloads extract zero candidates", async () => {
    const context = createContext({
      capturedPayloads: [createCapturedPayload(syntheticUnsupportedPayload)],
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: true,
      capturedPayloadCount: 1,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      leaseReleased: true,
    });
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "UNSUPPORTED_PAYLOAD_SHAPE",
    );
    expect(context.contentSubmissionPort.calls).toEqual([]);
  });

  it("processes all captured payloads when one payload has extraction issues", async () => {
    const context = createContext({
      capturedPayloads: [
        createCapturedPayload(syntheticValidGroupPostPayload, {
          capturedAt: new Date("invalid"),
        }),
        createCapturedPayload(syntheticValidGroupPostPayload),
      ],
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: false,
      capturedPayloadCount: 2,
      extractedCandidateCount: 1,
      submittedCount: 1,
      failedSubmissionCount: 0,
      leaseReleased: true,
    });
    expect(result.payloadResults.map((payloadResult) => payloadResult.ok)).toEqual([
      false,
      true,
    ]);
    expect(result.errors).toContainEqual({
      code: "FACEBOOK_PAYLOAD_EXTRACTION_FAILED",
      message: "Expected capturedAt to be a valid Date.",
      causeCode: "INVALID_CAPTURED_AT",
      payloadIndex: 0,
      path: "capturedAt",
    });
    expect(context.contentSubmissionPort.calls).toHaveLength(1);
  });

  it("aggregates extracted, submitted, and failed counts across multiple payloads", async () => {
    const context = createContext({
      capturedPayloads: [
        createCapturedPayload(syntheticValidGroupPostPayload),
        createCapturedPayload(syntheticTwoPostPayload),
      ],
    });

    context.contentSubmissionPort.setResult("post-b", {
      ok: false,
      statusCode: 503,
      errorCode: "CONTENT_MANAGER_HTTP_ERROR",
      errorMessage: "Content Manager is unavailable.",
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: false,
      capturedPayloadCount: 2,
      extractedCandidateCount: 3,
      submittedCount: 2,
      failedSubmissionCount: 1,
      leaseReleased: true,
    });
    expect(result.payloadResults.map((payloadResult) => ({
      extractedCandidateCount: payloadResult.extractedCandidateCount,
      submittedCount: payloadResult.submittedCount,
      failedSubmissionCount: payloadResult.failedSubmissionCount,
    }))).toEqual([
      {
        extractedCandidateCount: 1,
        submittedCount: 1,
        failedSubmissionCount: 0,
      },
      {
        extractedCandidateCount: 2,
        submittedCount: 1,
        failedSubmissionCount: 1,
      },
    ]);
  });

  it("reports release failure without losing collection progress", async () => {
    const context = createContext({
      capturedPayloads: [createCapturedPayload(syntheticValidGroupPostPayload)],
    });

    context.profileLeasePort.setReleaseResult({
      ok: false,
      errorCode: "LEASE_RELEASE_FAILED",
      errorMessage: "Lease release endpoint failed.",
    });

    const result = await context.useCase.execute({
      sourceGroupId,
      sourceGroupUrl,
    });

    expect(result).toMatchObject({
      ok: false,
      capturedPayloadCount: 1,
      extractedCandidateCount: 1,
      submittedCount: 1,
      failedSubmissionCount: 0,
      leaseReleased: false,
      leaseReleaseError: {
        code: "PROFILE_LEASE_RELEASE_FAILED",
        causeCode: "LEASE_RELEASE_FAILED",
        message: "Lease release endpoint failed.",
      },
    });
    expect(result.errors).toContainEqual({
      code: "PROFILE_LEASE_RELEASE_FAILED",
      causeCode: "LEASE_RELEASE_FAILED",
      message: "Lease release endpoint failed.",
    });
  });
});

interface TestContextOptions {
  readonly capturedPayloads?: readonly CapturedFacebookPayload[];
  readonly captureWarnings?: readonly CollectorRuntimeWarning[];
}

interface TestContext {
  readonly useCase: RunFacebookGroupCollectionUseCase;
  readonly profileLeasePort: FakeProfileLeasePort;
  readonly capturePort: FakeFacebookGroupPayloadCapturePort;
  readonly contentSubmissionPort: FakeContentSubmissionPort;
}

function createContext(options: TestContextOptions = {}): TestContext {
  const profileLeasePort = new FakeProfileLeasePort();
  const capturePort = new FakeFacebookGroupPayloadCapturePort(
    options.capturedPayloads ?? [
      createCapturedPayload(syntheticValidGroupPostPayload),
    ],
    options.captureWarnings ?? [],
  );
  const contentSubmissionPort = new FakeContentSubmissionPort();
  const submitCapturedPayloadUseCase = new SubmitCapturedFacebookPayloadUseCase({
    contentSubmissionPort,
  });
  const useCase = new RunFacebookGroupCollectionUseCase({
    profileLeasePort,
    payloadCapturePort: capturePort,
    submitCapturedPayloadUseCase,
  });

  return {
    useCase,
    profileLeasePort,
    capturePort,
    contentSubmissionPort,
  };
}

class FakeProfileLeasePort implements ProfileLeasePort {
  public readonly checkoutCalls: ProfileCheckoutInput[] = [];
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];
  private checkoutResult: ProfileCheckoutResult = {
    ok: true,
    profileId: "profile-1",
    leaseId: "lease-1",
    leaseExpiresAt: "2026-03-01T12:30:00.000Z",
  };
  private releaseResult: ProfileLeaseReleaseResult = {
    ok: true,
    releasedAt: "2026-03-01T12:05:00.000Z",
  };

  public setCheckoutResult(result: ProfileCheckoutResult): void {
    this.checkoutResult = result;
  }

  public setReleaseResult(result: ProfileLeaseReleaseResult): void {
    this.releaseResult = result;
  }

  public async checkoutProfile(
    input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    this.checkoutCalls.push(input);

    return this.checkoutResult;
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.releaseCalls.push(input);

    return this.releaseResult;
  }
}

class FakeFacebookGroupPayloadCapturePort
  implements FacebookGroupPayloadCapturePort {
  public readonly calls: FacebookGroupPayloadCaptureInput[] = [];
  private result: FacebookPayloadCaptureResult;

  public constructor(
    capturedPayloads: readonly CapturedFacebookPayload[],
    warnings: readonly CollectorRuntimeWarning[],
  ) {
    this.result = {
      ok: true,
      capturedPayloads,
      warnings,
    };
  }

  public setResult(result: FacebookPayloadCaptureResult): void {
    this.result = result;
  }

  public async captureGroupPayloads(
    input: FacebookGroupPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    this.calls.push(input);

    return this.result;
  }
}

class FakeContentSubmissionPort implements ContentManagerContentSubmissionPort {
  public readonly calls: CollectedContentSubmissionInput[] = [];
  private readonly results = new Map<string, ContentSubmissionResult>();

  public setResult(
    externalPostId: string,
    result: ContentSubmissionResult,
  ): void {
    this.results.set(externalPostId, result);
  }

  public async submitCollectedContent(
    input: CollectedContentSubmissionInput,
  ): Promise<ContentSubmissionResult> {
    this.calls.push(input);

    return (
      this.results.get(input.externalPostId) ?? {
        ok: true,
        statusCode: 200,
        contentItemId: `content-${input.externalPostId}`,
      }
    );
  }
}

function createCapturedPayload(
  payload: unknown,
  options: {
    readonly capturedAt?: Date;
    readonly sourceUrlHint?: string;
  } = {},
): CapturedFacebookPayload {
  return {
    payload,
    capturedAt: options.capturedAt ?? capturedAt,
    ...(options.sourceUrlHint !== undefined
      ? { sourceUrlHint: options.sourceUrlHint }
      : {}),
  };
}

const syntheticTwoPostPayload = {
  data: {
    group_feed: {
      edges: [
        {
          node: {
            __typename: "GroupPostStory",
            post_id: "post-a",
            url: "https://www.facebook.com/groups/group-1/posts/post-a/",
            message: {
              text: "First post ready for submission.",
            },
            creation_time: "2026-02-03T11:00:00.000Z",
            feedback: {
              reaction_count: {
                count: 4,
              },
              comment_count: {
                total_count: 1,
              },
            },
          },
        },
        {
          node: {
            __typename: "GroupPostStory",
            post_id: "post-b",
            url: "https://www.facebook.com/groups/group-1/posts/post-b/",
            message: {
              text: "Second post should still be attempted.",
            },
            creation_time: "2026-02-03T12:00:00.000Z",
            feedback: {
              reaction_count: {
                count: 7,
              },
              comment_count: {
                total_count: 2,
              },
            },
          },
        },
      ],
    },
  },
} as const;
