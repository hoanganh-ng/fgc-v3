import { describe, expect, it } from "vitest";
import type { ProfileHomeFeedCollectionRun } from "../../../collector-runtime/domain";
import {
  InvalidPersistedProfileHomeFeedCollectionRunRecordError,
  toDomainProfileHomeFeedCollectionRun,
  toProfileHomeFeedCollectionRunRecord,
} from "./profile-home-feed-collection-run.mapper";
import type { ProfileHomeFeedCollectionRunRow } from "./profile-home-feed-collection-run.mapper";

const now = "2026-06-19T10:00:00.000Z";

describe("profile home-feed collection run database mapper", () => {
  it("maps profile home-feed collection runs to and from persistence rows", () => {
    const run = createRun({
      status: "FAILED",
      startedAt: "2026-06-19T10:01:00.000Z",
      finishedAt: "2026-06-19T10:02:00.000Z",
      summary: {
        capturedPayloads: 2,
        extractorCandidates: 1,
        sourcePublishersObserved: 1,
        contentItemsSubmitted: 0,
        failedPublisherObservations: 1,
        failedContentSubmissions: 1,
        leaseReleased: true,
      },
      failureReason: {
        code: "CAPTURE_FAILED",
        message: "Home-feed collection failed.",
      },
    });

    const record = toProfileHomeFeedCollectionRunRecord(run);

    expect(record).toMatchObject({
      id: "home-feed-run-1",
      profileId: "profile-1",
      triggerType: "MANUAL_API",
      status: "FAILED",
      accountStageAtRequest: "WARMING",
      target: {
        platform: "FACEBOOK",
        surface: "PROFILE_HOME_FEED",
      },
      parameters: {
        maxScrolls: 4,
        maxDurationMs: 60_000,
        maxPosts: 12,
      },
      summary: {
        capturedPayloads: 2,
        failedPublisherObservations: 1,
        failedContentSubmissions: 1,
      },
      failureReason: {
        code: "CAPTURE_FAILED",
      },
    });
    expect(toDomainProfileHomeFeedCollectionRun(toSelectRow(record, run))).toEqual(
      run,
    );
  });

  it("stores optional summary and failure reason as null", () => {
    const run = createRun();
    const record = toProfileHomeFeedCollectionRunRecord(run);

    expect(record.summary).toBeNull();
    expect(record.failureReason).toBeNull();
    expect(toDomainProfileHomeFeedCollectionRun(toSelectRow(record, run))).toEqual(
      run,
    );
  });

  it.each([
    ["QUEUED", "startedAt", rowFor({ status: "QUEUED" }, { startedAt: now })],
    ["QUEUED", "finishedAt", rowFor({ status: "QUEUED" }, { finishedAt: now })],
    [
      "QUEUED",
      "summary",
      rowFor({ status: "QUEUED" }, { summary: createSummary() }),
    ],
    [
      "QUEUED",
      "failureReason",
      rowFor(
        { status: "QUEUED" },
        { failureReason: { code: "FAILED", message: "Failed." } },
      ),
    ],
    ["RUNNING", "startedAt", rowFor({ status: "RUNNING", startedAt: now }, { startedAt: null })],
    [
      "RUNNING",
      "finishedAt",
      rowFor({ status: "RUNNING", startedAt: now }, { finishedAt: now }),
    ],
    [
      "RUNNING",
      "summary",
      rowFor(
        { status: "RUNNING", startedAt: now },
        { summary: createSummary() },
      ),
    ],
    [
      "RUNNING",
      "failureReason",
      rowFor(
        { status: "RUNNING", startedAt: now },
        { failureReason: { code: "FAILED", message: "Failed." } },
      ),
    ],
    [
      "SUCCEEDED",
      "startedAt",
      rowFor(
        {
          status: "SUCCEEDED",
          startedAt: now,
          finishedAt: now,
          summary: createSummary(),
        },
        { startedAt: null },
      ),
    ],
    [
      "SUCCEEDED",
      "finishedAt",
      rowFor(
        {
          status: "SUCCEEDED",
          startedAt: now,
          finishedAt: now,
          summary: createSummary(),
        },
        { finishedAt: null },
      ),
    ],
    [
      "SUCCEEDED",
      "summary",
      rowFor(
        {
          status: "SUCCEEDED",
          startedAt: now,
          finishedAt: now,
          summary: createSummary(),
        },
        { summary: null },
      ),
    ],
    [
      "SUCCEEDED",
      "failureReason",
      rowFor(
        {
          status: "SUCCEEDED",
          startedAt: now,
          finishedAt: now,
          summary: createSummary(),
        },
        { failureReason: { code: "FAILED", message: "Failed." } },
      ),
    ],
    [
      "FAILED",
      "startedAt",
      rowFor(
        {
          status: "FAILED",
          startedAt: now,
          finishedAt: now,
          failureReason: { code: "FAILED", message: "Failed." },
        },
        { startedAt: null },
      ),
    ],
    [
      "FAILED",
      "finishedAt",
      rowFor(
        {
          status: "FAILED",
          startedAt: now,
          finishedAt: now,
          failureReason: { code: "FAILED", message: "Failed." },
        },
        { finishedAt: null },
      ),
    ],
    [
      "FAILED",
      "failureReason",
      rowFor(
        {
          status: "FAILED",
          startedAt: now,
          finishedAt: now,
          failureReason: { code: "FAILED", message: "Failed." },
        },
        { failureReason: null },
      ),
    ],
    ["CANCELED", "finishedAt", rowFor({ status: "CANCELED", finishedAt: now }, { finishedAt: null })],
    [
      "CANCELED",
      "startedAt",
      rowFor({ status: "CANCELED", finishedAt: now }, { startedAt: now }),
    ],
    [
      "CANCELED",
      "summary",
      rowFor(
        { status: "CANCELED", finishedAt: now },
        { summary: createSummary() },
      ),
    ],
    [
      "CANCELED",
      "failureReason",
      rowFor(
        { status: "CANCELED", finishedAt: now },
        { failureReason: { code: "FAILED", message: "Failed." } },
      ),
    ],
  ])("rejects malformed persisted %s row with invalid %s", (_status, _field, row) => {
    expect(() => toDomainProfileHomeFeedCollectionRun(row)).toThrow(
      InvalidPersistedProfileHomeFeedCollectionRunRecordError,
    );
  });
});

function toSelectRow(
  record: ReturnType<typeof toProfileHomeFeedCollectionRunRecord>,
  run: ProfileHomeFeedCollectionRun,
): ProfileHomeFeedCollectionRunRow {
  return {
    id: run.id,
    profileId: run.profileId,
    triggerType: run.triggerType,
    status: run.status,
    accountStageAtRequest: run.accountStageAtRequest,
    target: record.target,
    parameters: record.parameters,
    summary: record.summary ?? null,
    failureReason: record.failureReason ?? null,
    requestedAt: run.requestedAt,
    startedAt: record.startedAt ?? null,
    finishedAt: record.finishedAt ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
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
    parameters: options.parameters ?? {
      maxScrolls: 4,
      maxDurationMs: 60_000,
      maxPosts: 12,
    },
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? now,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };
}

function createSummary(): NonNullable<ProfileHomeFeedCollectionRun["summary"]> {
  return {
    capturedPayloads: 2,
    extractorCandidates: 1,
    sourcePublishersObserved: 1,
    contentItemsSubmitted: 0,
    failedPublisherObservations: 1,
    failedContentSubmissions: 1,
    leaseReleased: true,
  };
}

function rowFor(
  options: Partial<ProfileHomeFeedCollectionRun>,
  rowOverrides: Partial<ProfileHomeFeedCollectionRunRow>,
): ProfileHomeFeedCollectionRunRow {
  const run = createRun(options);
  const record = toProfileHomeFeedCollectionRunRecord(run);

  return {
    ...toSelectRow(record, run),
    ...rowOverrides,
  };
}
