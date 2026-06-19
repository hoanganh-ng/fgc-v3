import { describe, expect, it } from "vitest";
import type { ProfileHomeFeedCollectionRun } from "./profile-home-feed-collection-run";
import { validateProfileHomeFeedCollectionRun } from "./validation";

const requestedAt = "2026-06-19T10:00:00.000Z";
const startedAt = "2026-06-19T10:01:00.000Z";
const finishedAt = "2026-06-19T10:02:00.000Z";

describe("ProfileHomeFeedCollectionRun domain schema", () => {
  const invalidLifecycleCases: readonly {
    readonly status: string;
    readonly path: string;
    readonly options: Partial<ProfileHomeFeedCollectionRun>;
  }[] = [
    { status: "QUEUED", path: "startedAt", options: { status: "QUEUED", startedAt } },
    { status: "QUEUED", path: "finishedAt", options: { status: "QUEUED", finishedAt } },
    {
      status: "QUEUED",
      path: "summary",
      options: { status: "QUEUED", summary: createSummary() },
    },
    {
      status: "QUEUED",
      path: "failureReason",
      options: {
        status: "QUEUED",
        failureReason: {
          code: "FAILED",
          message: "Failed.",
        },
      },
    },
    { status: "RUNNING", path: "startedAt", options: { status: "RUNNING" } },
    {
      status: "RUNNING",
      path: "finishedAt",
      options: { status: "RUNNING", startedAt, finishedAt },
    },
    {
      status: "RUNNING",
      path: "summary",
      options: { status: "RUNNING", startedAt, summary: createSummary() },
    },
    {
      status: "RUNNING",
      path: "failureReason",
      options: {
        status: "RUNNING",
        startedAt,
        failureReason: {
          code: "FAILED",
          message: "Failed.",
        },
      },
    },
    {
      status: "SUCCEEDED",
      path: "startedAt",
      options: { status: "SUCCEEDED", finishedAt, summary: createSummary() },
    },
    {
      status: "SUCCEEDED",
      path: "finishedAt",
      options: { status: "SUCCEEDED", startedAt, summary: createSummary() },
    },
    {
      status: "SUCCEEDED",
      path: "summary",
      options: { status: "SUCCEEDED", startedAt, finishedAt },
    },
    {
      status: "SUCCEEDED",
      path: "failureReason",
      options: {
        status: "SUCCEEDED",
        startedAt,
        finishedAt,
        summary: createSummary(),
        failureReason: {
          code: "FAILED",
          message: "Failed.",
        },
      },
    },
    {
      status: "FAILED",
      path: "startedAt",
      options: {
        status: "FAILED",
        finishedAt,
        failureReason: {
          code: "FAILED",
          message: "Failed.",
        },
      },
    },
    {
      status: "FAILED",
      path: "finishedAt",
      options: {
        status: "FAILED",
        startedAt,
        failureReason: {
          code: "FAILED",
          message: "Failed.",
        },
      },
    },
    {
      status: "FAILED",
      path: "failureReason",
      options: { status: "FAILED", startedAt, finishedAt },
    },
    { status: "CANCELED", path: "finishedAt", options: { status: "CANCELED" } },
    {
      status: "CANCELED",
      path: "startedAt",
      options: { status: "CANCELED", startedAt, finishedAt },
    },
    {
      status: "CANCELED",
      path: "summary",
      options: { status: "CANCELED", finishedAt, summary: createSummary() },
    },
    {
      status: "CANCELED",
      path: "failureReason",
      options: {
        status: "CANCELED",
        finishedAt,
        failureReason: {
          code: "FAILED",
          message: "Failed.",
        },
      },
    },
  ];

  it.each([
    [
      "QUEUED",
      createRun({
        status: "QUEUED",
      }),
    ],
    [
      "RUNNING",
      createRun({
        status: "RUNNING",
        startedAt,
      }),
    ],
    [
      "SUCCEEDED",
      createRun({
        status: "SUCCEEDED",
        startedAt,
        finishedAt,
        summary: createSummary(),
      }),
    ],
    [
      "FAILED",
      createRun({
        status: "FAILED",
        startedAt,
        finishedAt,
        failureReason: {
          code: "CAPTURE_FAILED",
          message: "Home-feed collection failed.",
        },
      }),
    ],
    [
      "FAILED with summary",
      createRun({
        status: "FAILED",
        startedAt,
        finishedAt,
        summary: createSummary({
          failedContentSubmissions: 1,
        }),
        failureReason: {
          code: "CONTENT_SUBMISSION_FAILED",
          message: "Content submission failed.",
        },
      }),
    ],
    [
      "CANCELED",
      createRun({
        status: "CANCELED",
        finishedAt,
      }),
    ],
  ])("accepts the valid %s lifecycle shape", (_label, run) => {
    expect(validateProfileHomeFeedCollectionRun(run).valid).toBe(true);
  });

  it.each(invalidLifecycleCases)(
    "rejects $status with invalid lifecycle field $path",
    ({ path, options }) => {
    const result = validateProfileHomeFeedCollectionRun(
      createRun(options),
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.some((issue) => issue.path === path)).toBe(true);
    }
    },
  );

  it("keeps the summary contract strict and non-negative", () => {
    const runWithUnknownSummaryField = {
      ...createRun({
        status: "SUCCEEDED",
        startedAt,
        finishedAt,
      }),
      summary: {
        ...createSummary(),
        postsSeen: 1,
      },
    };

    expect(
      validateProfileHomeFeedCollectionRun(runWithUnknownSummaryField).valid,
    ).toBe(false);
    expect(
      validateProfileHomeFeedCollectionRun(
        createRun({
          status: "SUCCEEDED",
          startedAt,
          finishedAt,
          summary: {
            capturedPayloads: -1,
          },
        }),
      ).valid,
    ).toBe(false);
  });
});

function createSummary(
  options: Partial<NonNullable<ProfileHomeFeedCollectionRun["summary"]>> = {},
): NonNullable<ProfileHomeFeedCollectionRun["summary"]> {
  return {
    capturedPayloads: options.capturedPayloads ?? 4,
    extractorCandidates: options.extractorCandidates ?? 3,
    sourcePublishersObserved: options.sourcePublishersObserved ?? 2,
    contentItemsSubmitted: options.contentItemsSubmitted ?? 1,
    failedPublisherObservations: options.failedPublisherObservations ?? 0,
    failedContentSubmissions: options.failedContentSubmissions ?? 0,
    leaseReleased: options.leaseReleased ?? true,
  };
}

function createRun(
  options: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id: options.id ?? "home-feed-run-1",
    profileId: options.profileId ?? "profile-1",
    triggerType: options.triggerType ?? "MANUAL_API",
    status: options.status ?? "QUEUED",
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: options.parameters ?? {},
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? requestedAt,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? requestedAt,
    updatedAt: options.updatedAt ?? requestedAt,
  };
}
