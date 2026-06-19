import { describe, expect, it } from "vitest";
import type { ProfileHomeFeedCollectionRun } from "../../../collector-runtime/domain";
import {
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
        postsSeen: 2,
        extractorCandidates: 1,
        sourcePublishersObserved: 1,
        contentItemsSubmitted: 0,
        failedSubmissions: 1,
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
        postsSeen: 2,
        failedSubmissions: 1,
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
