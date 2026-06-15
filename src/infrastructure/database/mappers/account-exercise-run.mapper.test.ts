import { describe, expect, it } from "vitest";
import {
  toAccountExerciseRunDomain,
  toAccountExerciseRunRow,
} from "./account-exercise-run.mapper";
import type { AccountExerciseRunRow } from "./account-exercise-run.mapper";
import type { AccountExerciseRun } from "../../../collector-runtime/domain";

const now = "2026-05-01T10:00:00.000Z";

describe("account exercise run database mapper", () => {
  it("maps account exercise runs to and from persistence rows", () => {
    const run = createAccountExerciseRun({
      leaseId: "lease-1",
      status: "FAILED",
      startedAt: "2026-05-01T10:05:00.000Z",
      finishedAt: "2026-05-01T10:10:00.000Z",
      safeSummary: {
        pageLoaded: true,
        loginRequired: true,
        checkpointDetected: false,
        scrollsPerformed: 0,
        durationMs: 10_000,
        leaseReleased: true,
      },
      failureReason: {
        code: "LOGIN_REQUIRED",
        message: "Login is required before ambient exercise can continue.",
      },
    });

    const row = toAccountExerciseRunRow(run);

    expect(row).toMatchObject({
      id: "exercise-run-1",
      profileId: "profile-1",
      leaseId: "lease-1",
      exerciseType: "AMBIENT_ACCOUNT",
      status: "FAILED",
      stageAtStart: "NEW_ACCOUNT",
      actionBudget: {
        maxDurationMs: 120_000,
        maxScrolls: 2,
      },
      safeSummary: {
        pageLoaded: true,
        loginRequired: true,
      },
      failureReason: {
        code: "LOGIN_REQUIRED",
      },
    });
    expect(toAccountExerciseRunDomain(toSelectRow(row, run))).toEqual(run);
  });

  it("stores optional lease, summary, and failure reason as null", () => {
    const row = toAccountExerciseRunRow(createAccountExerciseRun());

    expect(row.leaseId).toBeNull();
    expect(row.safeSummary).toBeNull();
    expect(row.failureReason).toBeNull();
    expect(
      toAccountExerciseRunDomain(toSelectRow(row, createAccountExerciseRun())),
    ).toEqual(createAccountExerciseRun());
  });

  it("mapper round-trips a CATEGORY_BROWSE run with target", () => {
    const target = {
      categoryId: "category-1",
      sourceGroupId: "group-1",
      entryRouteId: "route-1",
      entryRouteType: "CATEGORY_ENTRY_URL" as const,
      url: "https://www.facebook.com/groups/group-1/categories",
      riskLevel: "LOW" as const,
    };
    const run = createAccountExerciseRun({
      exerciseType: "CATEGORY_BROWSE",
      target,
    });

    const row = toAccountExerciseRunRow(run);
    expect(row.target).toEqual(target);

    const domain = toAccountExerciseRunDomain(toSelectRow(row, run));
    expect(domain).toEqual(run);
  });

  it("null target remains valid for AMBIENT_ACCOUNT", () => {
    const run = createAccountExerciseRun({
      exerciseType: "AMBIENT_ACCOUNT",
    });

    const row = toAccountExerciseRunRow(run);
    expect(row.target).toBeNull();

    const domain = toAccountExerciseRunDomain(toSelectRow(row, run));
    expect(domain.target).toBeUndefined();
    expect(domain).toEqual(run);
  });

  it("malformed persisted target is rejected", () => {
    const baseRow = toAccountExerciseRunRow(
      createAccountExerciseRun({
        exerciseType: "CATEGORY_BROWSE",
        target: {
          categoryId: "category-1",
          sourceGroupId: "group-1",
          entryRouteId: "route-1",
          entryRouteType: "CATEGORY_ENTRY_URL",
          url: "https://www.facebook.com/groups/group-1/categories",
          riskLevel: "LOW",
        },
      }),
    );

    const malformedRow1 = {
      ...toSelectRow(baseRow, createAccountExerciseRun({ exerciseType: "CATEGORY_BROWSE" })),
      target: null,
    };
    expect(() => toAccountExerciseRunDomain(malformedRow1)).toThrow();

    const malformedRow2 = {
      ...toSelectRow(baseRow, createAccountExerciseRun({ exerciseType: "CATEGORY_BROWSE" })),
      target: {
        categoryId: "category-1",
        sourceGroupId: "group-1",
        entryRouteId: "route-1",
        entryRouteType: "CATEGORY_ENTRY_URL" as const,
        url: "http://non-facebook-url.com",
        riskLevel: "LOW" as const,
      },
    };
    expect(() => toAccountExerciseRunDomain(malformedRow2)).toThrow();
  });
});

function toSelectRow(
  row: ReturnType<typeof toAccountExerciseRunRow>,
  run: AccountExerciseRun,
): AccountExerciseRunRow {
  return {
    id: run.id,
    profileId: run.profileId,
    leaseId: row.leaseId ?? null,
    exerciseType: run.exerciseType,
    status: run.status,
    stageAtStart: run.stageAtStart,
    actionBudget: row.actionBudget,
    target: row.target ?? null,
    safeSummary: row.safeSummary ?? null,
    failureReason: row.failureReason ?? null,
    requestedAt: run.requestedAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function createAccountExerciseRun(
  options: Partial<AccountExerciseRun> = {},
): AccountExerciseRun {
  return {
    id: options.id ?? "exercise-run-1",
    profileId: options.profileId ?? "profile-1",
    ...(options.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
    exerciseType: options.exerciseType ?? "AMBIENT_ACCOUNT",
    status: options.status ?? "QUEUED",
    stageAtStart: options.stageAtStart ?? "NEW_ACCOUNT",
    actionBudget: options.actionBudget ?? {
      maxDurationMs: 120_000,
      maxScrolls: 2,
      minDwellMs: 2_000,
    },
    ...(options.target !== undefined ? { target: options.target } : {}),
    ...(options.safeSummary !== undefined
      ? { safeSummary: options.safeSummary }
      : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? now,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? options.createdAt ?? now,
  };
}
