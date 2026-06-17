import { describe, expect, it } from "vitest";
import {
  InvalidPersistedCollectionScheduleRecordError,
  toCollectionRunDomain,
  toCollectionRunRow,
  toCollectionScheduleDomain,
  toCollectionScheduleRow,
} from "./collector-runtime.mapper";
import type {
  CollectionRunRow,
  CollectionScheduleRow,
} from "./collector-runtime.mapper";
import type {
  CollectionRun,
  CollectionSchedule,
} from "../../../collector-runtime/domain";

const now = "2026-04-01T10:00:00.000Z";

describe("collector runtime database mapper", () => {
  it("maps collection runs to and from persistence rows", () => {
    const collectionRun = createCollectionRun({
      status: "FAILED",
      startedAt: "2026-04-01T10:05:00.000Z",
      finishedAt: "2026-04-01T10:10:00.000Z",
      summary: {
        capturedPayloads: 3,
        extractorCandidates: 4,
        contentItemsSubmitted: 2,
        failedSubmissions: 1,
        leaseReleased: true,
      },
      failureReason: {
        code: "CAPTURE_FAILED",
        message: "Capture failed.",
      },
    });

    const row = toCollectionRunRow(collectionRun);

    expect(row).toMatchObject({
      id: "collection-run-1",
      sourceGroupId: "source-group-1",
      status: "FAILED",
      triggerType: "MANUAL_API",
      parameters: {
        maxScrolls: 3,
        maxDurationMs: 30_000,
      },
      summary: {
        capturedPayloads: 3,
        failedSubmissions: 1,
      },
      failureReason: {
        code: "CAPTURE_FAILED",
      },
    });
    expect(toCollectionRunDomain(toSelectRow(row, collectionRun))).toEqual(
      collectionRun,
    );
  });

  it("stores optional summary and failure reason as null", () => {
    const row = toCollectionRunRow(createCollectionRun());

    expect(row.summary).toBeNull();
    expect(row.failureReason).toBeNull();
    expect(toCollectionRunDomain(toSelectRow(row, createCollectionRun()))).toEqual(
      createCollectionRun(),
    );
  });
});

describe("collector runtime database mapper: collection schedule", () => {
  const sourceGroupId = "source-group-1";
  const createdAt = "2026-06-17T10:00:00.000Z";
  const updatedAt = "2026-06-17T11:00:00.000Z";

  it("maps a valid schedule row to domain", () => {
    const domain = toCollectionScheduleDomain({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: createdAt,
      parameters: { maxScrolls: 5 },
      createdAt,
      updatedAt,
    });

    expect(domain).toEqual({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: createdAt,
      parameters: { maxScrolls: 5 },
      createdAt,
      updatedAt,
    });
  });

  it("throws InvalidPersistedCollectionScheduleRecordError on invalid persisted row", () => {
    expect(() =>
      toCollectionScheduleDomain({
        sourceGroupId,
        enabled: true,
        intervalMinutes: 0,
        nextRunAt: createdAt,
        parameters: {},
        createdAt,
        updatedAt,
      }),
    ).toThrow(InvalidPersistedCollectionScheduleRecordError);
  });

  it("round-trips a valid schedule through toRow and back", () => {
    const schedule: CollectionSchedule = {
      sourceGroupId,
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-17T12:00:00.000Z",
      parameters: { maxScrolls: 1, maxDurationMs: 1000 },
      createdAt,
      updatedAt,
    };

    const row = toCollectionScheduleRow(schedule);

    expect(row).toEqual({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-17T12:00:00.000Z",
      parameters: { maxScrolls: 1, maxDurationMs: 1000 },
      createdAt,
      updatedAt,
    });

    expect(
      toCollectionScheduleDomain({
        ...row,
        sourceGroupId: row.sourceGroupId,
      } as CollectionScheduleRow),
    ).toEqual(schedule);
  });
});

function toSelectRow(
  row: ReturnType<typeof toCollectionRunRow>,
  collectionRun: CollectionRun,
): CollectionRunRow {
  return {
    id: collectionRun.id,
    sourceGroupId: collectionRun.sourceGroupId,
    status: collectionRun.status,
    triggerType: collectionRun.triggerType,
    parameters: row.parameters,
    summary: row.summary ?? null,
    failureReason: row.failureReason ?? null,
    requestedAt: collectionRun.requestedAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    createdAt: collectionRun.createdAt,
    updatedAt: collectionRun.updatedAt,
  };
}

function createCollectionRun(
  options: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: options.id ?? "collection-run-1",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    status: options.status ?? "QUEUED",
    triggerType: options.triggerType ?? "MANUAL_API",
    parameters: options.parameters ?? {
      maxScrolls: 3,
      maxDurationMs: 30_000,
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
