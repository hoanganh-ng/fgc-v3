import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type {
  ApiRequestOptions,
  ApiResult,
  HttpClient,
} from "@/lib/api/http-client";
import * as collectorRuntimeClientModule from "./collector-runtime-client";
import { createCollectorRuntimeClient } from "./collector-runtime-client";

const BARREL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "collector-runtime-client.ts",
);

function collectNamedExports(sourcePath: string): string[] {
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exports: string[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        exports.push(element.name.text);
      }
    }

    if (!ts.canHaveModifiers(statement)) {
      continue;
    }

    const modifiers = ts.getModifiers(statement);
    const isExported = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exports.push(declaration.name.text);
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      exports.push(statement.name.text);
    } else if (ts.isInterfaceDeclaration(statement)) {
      exports.push(statement.name.text);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      exports.push(statement.name.text);
    }
  }

  return exports.sort();
}

const BASELINE_PUBLIC_EXPORTS = [
  "AccountExerciseRun",
  "AccountExerciseRunActionBudget",
  "AccountExerciseRunFailureReason",
  "AccountExerciseRunResponse",
  "AccountExerciseRunResponseSchema",
  "AccountExerciseRunSafeSummary",
  "AccountExerciseRunSchema",
  "AccountExerciseRunStatus",
  "AccountExerciseRunStatusSchema",
  "AccountExerciseRunsListResponse",
  "AccountExerciseRunsListResponseSchema",
  "AccountExerciseType",
  "AccountExerciseTypeSchema",
  "CategoryBrowseExerciseTargetSchema",
  "CollectionRun",
  "CollectionRunFailureReason",
  "CollectionRunParameters",
  "CollectionRunResponse",
  "CollectionRunResponseSchema",
  "CollectionRunSchema",
  "CollectionRunStatus",
  "CollectionRunStatusSchema",
  "CollectionRunSummary",
  "CollectionRunTriggerType",
  "CollectionRunTriggerTypeSchema",
  "CollectionRunsListResponse",
  "CollectionRunsListResponseSchema",
  "CollectionSchedule",
  "CollectionScheduleListResponse",
  "CollectionScheduleListResponseSchema",
  "CollectionScheduleParameters",
  "CollectionScheduleParametersSchema",
  "CollectionScheduleResponse",
  "CollectionScheduleResponseSchema",
  "CollectionScheduleSchema",
  "CollectorRuntimeClient",
  "DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT",
  "DEFAULT_COLLECTION_RUN_LIST_LIMIT",
  "DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT",
  "DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT",
  "DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT",
  "DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT",
  "ListAccountExerciseRunsQuery",
  "ListCollectionRunsQuery",
  "ListCollectionSchedulesQuery",
  "ListProfileHomeFeedCollectionRunsQuery",
  "ListProfileHomeFeedCollectionSchedulesQuery",
  "ListProfileSourceAccessCheckRunsQuery",
  "MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT",
  "MAX_COLLECTION_RUN_LIST_LIMIT",
  "MAX_COLLECTION_SCHEDULE_LIST_LIMIT",
  "MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT",
  "MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT",
  "MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT",
  "PROFILE_HOME_FEED_COLLECTION_SCHEDULE_DISPATCH_STATUSES",
  "PROFILE_HOME_FEED_DIAGNOSTIC_CAPTURE_STAGES",
  "PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES",
  "PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_STAGES",
  "PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES",
  "PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES",
  "ProfileHomeFeedCollectionRun",
  "ProfileHomeFeedCollectionRunAccountStage",
  "ProfileHomeFeedCollectionRunAccountStageSchema",
  "ProfileHomeFeedCollectionRunFailureReason",
  "ProfileHomeFeedCollectionRunFailureReasonSchema",
  "ProfileHomeFeedCollectionRunParameters",
  "ProfileHomeFeedCollectionRunParametersSchema",
  "ProfileHomeFeedCollectionRunResponse",
  "ProfileHomeFeedCollectionRunResponseSchema",
  "ProfileHomeFeedCollectionRunSchema",
  "ProfileHomeFeedCollectionRunStatus",
  "ProfileHomeFeedCollectionRunStatusSchema",
  "ProfileHomeFeedCollectionRunSummary",
  "ProfileHomeFeedCollectionRunSummarySchema",
  "ProfileHomeFeedCollectionRunTarget",
  "ProfileHomeFeedCollectionRunTargetSchema",
  "ProfileHomeFeedCollectionRunTriggerType",
  "ProfileHomeFeedCollectionRunTriggerTypeSchema",
  "ProfileHomeFeedCollectionRunsListResponse",
  "ProfileHomeFeedCollectionRunsListResponseSchema",
  "ProfileHomeFeedCollectionSchedule",
  "ProfileHomeFeedCollectionScheduleDispatchStatus",
  "ProfileHomeFeedCollectionScheduleDispatchStatusSchema",
  "ProfileHomeFeedCollectionScheduleFailureReason",
  "ProfileHomeFeedCollectionScheduleFailureReasonSchema",
  "ProfileHomeFeedCollectionScheduleListResponse",
  "ProfileHomeFeedCollectionScheduleListResponseSchema",
  "ProfileHomeFeedCollectionScheduleParameters",
  "ProfileHomeFeedCollectionScheduleParametersSchema",
  "ProfileHomeFeedCollectionScheduleResponse",
  "ProfileHomeFeedCollectionScheduleResponseSchema",
  "ProfileHomeFeedCollectionScheduleSchema",
  "ProfileHomeFeedDiagnosticCaptureStage",
  "ProfileHomeFeedDiagnosticFailureCode",
  "ProfileHomeFeedDiagnosticFailureStage",
  "ProfileHomeFeedDiagnosticPageState",
  "ProfileHomeFeedDiagnosticSummary",
  "ProfileHomeFeedDiagnosticSummaryCaptureCounters",
  "ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema",
  "ProfileHomeFeedDiagnosticSummaryExtractorCounters",
  "ProfileHomeFeedDiagnosticSummaryExtractorCountersSchema",
  "ProfileHomeFeedDiagnosticSummaryRunOutcome",
  "ProfileHomeFeedDiagnosticSummaryRunOutcomeSchema",
  "ProfileHomeFeedDiagnosticSummarySchema",
  "ProfileHomeFeedDiagnosticSummaryWarningCountsSchema",
  "ProfileHomeFeedDiagnosticWarningCode",
  "ProfileSourceAccessCheckRun",
  "ProfileSourceAccessCheckRunAccountStage",
  "ProfileSourceAccessCheckRunAccountStageSchema",
  "ProfileSourceAccessCheckRunFailureReason",
  "ProfileSourceAccessCheckRunOutcome",
  "ProfileSourceAccessCheckRunOutcomeSchema",
  "ProfileSourceAccessCheckRunResponse",
  "ProfileSourceAccessCheckRunResponseSchema",
  "ProfileSourceAccessCheckRunSchema",
  "ProfileSourceAccessCheckRunStatus",
  "ProfileSourceAccessCheckRunStatusSchema",
  "ProfileSourceAccessCheckRunTriggerType",
  "ProfileSourceAccessCheckRunTriggerTypeSchema",
  "ProfileSourceAccessCheckRunsListResponse",
  "ProfileSourceAccessCheckRunsListResponseSchema",
  "RequestAccountExerciseRunRequest",
  "RequestAccountExerciseRunRequestSchema",
  "RequestCollectionRunRequest",
  "RequestCollectionRunRequestSchema",
  "RequestProfileHomeFeedCollectionRunRequest",
  "RequestProfileHomeFeedCollectionRunRequestSchema",
  "RequestProfileSourceAccessCheckRunRequest",
  "RequestProfileSourceAccessCheckRunRequestSchema",
  "UpsertCollectionScheduleRequest",
  "UpsertCollectionScheduleRequestSchema",
  "UpsertProfileHomeFeedCollectionScheduleRequest",
  "UpsertProfileHomeFeedCollectionScheduleRequestSchema",
  "collectorRuntimeClient",
  "createCollectorRuntimeClient",
  "toListAccountExerciseRunsQueryParams",
  "toListCollectionRunsQueryParams",
  "toListCollectionSchedulesQueryParams",
  "toListProfileHomeFeedCollectionRunsQueryParams",
  "toListProfileHomeFeedCollectionSchedulesQueryParams",
  "toListProfileSourceAccessCheckRunsQueryParams",
] as const;

type CapturedRequest = {
  method?: string | undefined;
  path: string;
  query?: Readonly<Record<string, string | number | boolean>>;
  body?: unknown;
};

function createCapturingHttpClient(): {
  httpClient: HttpClient;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const httpClient: HttpClient = {
    async request<TResponse, TBody = unknown>(
      options: ApiRequestOptions<TResponse, TBody>,
    ): Promise<ApiResult<TResponse>> {
      const captured: CapturedRequest = {
        path: options.path,
      };
      if (options.method !== undefined) {
        captured.method = options.method;
      }
      if (options.query !== undefined) {
        captured.query = options.query as Readonly<
          Record<string, string | number | boolean>
        >;
      }
      if (options.body !== undefined) {
        captured.body = options.body;
      }
      requests.push(captured);
      return { ok: true, data: {} as TResponse };
    },
  };

  return { httpClient, requests };
}

describe("collector-runtime-client characterization", () => {
  it("exports the expected public named-export inventory", () => {
    const barrelExports = collectNamedExports(BARREL_PATH);
    const runtimeExports = Object.keys(collectorRuntimeClientModule).sort();
    const valueExportsFromBarrel = barrelExports.filter(
      (exportName) =>
        exportName.endsWith("Schema") ||
        exportName.startsWith("DEFAULT_") ||
        exportName.startsWith("MAX_") ||
        exportName.startsWith("PROFILE_HOME_FEED_") ||
        exportName === "collectorRuntimeClient" ||
        exportName === "createCollectorRuntimeClient" ||
        exportName.startsWith("toList"),
    );

    expect(barrelExports).toEqual([...BASELINE_PUBLIC_EXPORTS]);
    expect(runtimeExports).toEqual(valueExportsFromBarrel);
  });

  it("snapshots collection-runs client contracts", async () => {
    const { httpClient, requests } = createCapturingHttpClient();
    const client = createCollectorRuntimeClient(httpClient);

    await client.listCollectionRuns({
      status: "QUEUED",
      sourceGroupId: "sg-1",
      limit: 50,
      offset: 0,
    });
    await client.requestCollectionRun({
      sourceGroupId: "sg-1",
      maxScrolls: 3,
    });
    await client.cancelCollectionRun("run/id");

    expect(requests).toEqual([
      {
        method: undefined,
        path: "/collector/collection-runs",
        query: {
          status: "QUEUED",
          sourceGroupId: "sg-1",
          limit: 50,
          offset: 0,
        },
        body: undefined,
      },
      {
        method: "POST",
        path: "/collector/collection-runs",
        query: undefined,
        body: { sourceGroupId: "sg-1", maxScrolls: 3 },
      },
      {
        method: "POST",
        path: "/collector/collection-runs/run%2Fid/cancel",
        query: undefined,
        body: undefined,
      },
    ]);
  });

  it("snapshots account-exercise-runs client contracts", async () => {
    const { httpClient, requests } = createCapturingHttpClient();
    const client = createCollectorRuntimeClient(httpClient);

    await client.listAccountExerciseRuns({
      status: "RUNNING",
      profileId: "profile-1",
      limit: 25,
      offset: 10,
    });
    await client.getAccountExerciseRun("run-1");
    await client.requestAccountExerciseRun({
      profileId: "profile-1",
      stageAtStart: "WARMING",
      maxDurationMs: 1000,
      maxScrolls: 2,
    });
    await client.cancelAccountExerciseRun("run-1");

    expect(requests).toEqual([
      {
        method: undefined,
        path: "/collector/account-exercise-runs",
        query: {
          status: "RUNNING",
          profileId: "profile-1",
          limit: 25,
          offset: 10,
        },
        body: undefined,
      },
      {
        method: undefined,
        path: "/collector/account-exercise-runs/run-1",
        query: undefined,
        body: undefined,
      },
      {
        method: "POST",
        path: "/collector/account-exercise-runs",
        query: undefined,
        body: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          maxDurationMs: 1000,
          maxScrolls: 2,
        },
      },
      {
        method: "POST",
        path: "/collector/account-exercise-runs/run-1/cancel",
        query: undefined,
        body: undefined,
      },
    ]);
  });

  it("snapshots profile-source-access-check-runs client contracts", async () => {
    const { httpClient, requests } = createCapturingHttpClient();
    const client = createCollectorRuntimeClient(httpClient);

    await client.listProfileSourceAccessCheckRuns({
      status: "SUCCEEDED",
      profileId: "profile-1",
      sourceGroupId: "sg-1",
      limit: 50,
      offset: 0,
    });
    await client.getProfileSourceAccessCheckRun("check-1");
    await client.requestProfileSourceAccessCheckRun({
      profileId: "profile-1",
      sourceGroupId: "sg-1",
    });
    await client.cancelProfileSourceAccessCheckRun("check-1");

    expect(requests).toEqual([
      {
        method: undefined,
        path: "/collector/profile-source-access-check-runs",
        query: {
          status: "SUCCEEDED",
          profileId: "profile-1",
          sourceGroupId: "sg-1",
          limit: 50,
          offset: 0,
        },
        body: undefined,
      },
      {
        method: undefined,
        path: "/collector/profile-source-access-check-runs/check-1",
        query: undefined,
        body: undefined,
      },
      {
        method: "POST",
        path: "/collector/profile-source-access-check-runs",
        query: undefined,
        body: { profileId: "profile-1", sourceGroupId: "sg-1" },
      },
      {
        method: "POST",
        path: "/collector/profile-source-access-check-runs/check-1/cancel",
        query: undefined,
        body: undefined,
      },
    ]);
  });

  it("snapshots profile-home-feed-collection-runs client contracts", async () => {
    const { httpClient, requests } = createCapturingHttpClient();
    const client = createCollectorRuntimeClient(httpClient);

    await client.listProfileHomeFeedCollectionRuns({
      status: "FAILED",
      profileId: "profile-1",
      limit: 10,
      offset: 5,
    });
    await client.getProfileHomeFeedCollectionRun("feed-run-1");
    await client.requestProfileHomeFeedCollectionRun({
      profileId: "profile-1",
      maxPosts: 12,
    });
    await client.cancelProfileHomeFeedCollectionRun("feed-run-1");

    expect(requests).toEqual([
      {
        method: undefined,
        path: "/collector/profile-home-feed-collection-runs",
        query: {
          status: "FAILED",
          profileId: "profile-1",
          limit: 10,
          offset: 5,
        },
        body: undefined,
      },
      {
        method: undefined,
        path: "/collector/profile-home-feed-collection-runs/feed-run-1",
        query: undefined,
        body: undefined,
      },
      {
        method: "POST",
        path: "/collector/profile-home-feed-collection-runs",
        query: undefined,
        body: { profileId: "profile-1", maxPosts: 12 },
      },
      {
        method: "POST",
        path: "/collector/profile-home-feed-collection-runs/feed-run-1/cancel",
        query: undefined,
        body: undefined,
      },
    ]);
  });

  it("snapshots collection-schedules client contracts", async () => {
    const { httpClient, requests } = createCapturingHttpClient();
    const client = createCollectorRuntimeClient(httpClient);

    await client.listCollectionSchedules({ limit: 20, offset: 40 });
    await client.getCollectionSchedule("sg-1");
    await client.upsertCollectionSchedule("sg-1", {
      enabled: true,
      intervalMinutes: 60,
      nextRunAt: "2026-07-16T00:00:00.000Z",
      parameters: { maxScrolls: 5 },
    });

    expect(requests).toEqual([
      {
        method: undefined,
        path: "/collector/collection-schedules",
        query: { limit: 20, offset: 40 },
        body: undefined,
      },
      {
        method: undefined,
        path: "/collector/collection-schedules/sg-1",
        query: undefined,
        body: undefined,
      },
      {
        method: "PUT",
        path: "/collector/collection-schedules/sg-1",
        query: undefined,
        body: {
          enabled: true,
          intervalMinutes: 60,
          nextRunAt: "2026-07-16T00:00:00.000Z",
          parameters: { maxScrolls: 5 },
        },
      },
    ]);
  });

  it("snapshots profile-home-feed-collection-schedules client contracts", async () => {
    const { httpClient, requests } = createCapturingHttpClient();
    const client = createCollectorRuntimeClient(httpClient);

    await client.listProfileHomeFeedCollectionSchedules({
      enabled: true,
      limit: 15,
      offset: 30,
    });
    await client.getProfileHomeFeedCollectionSchedule("profile-1");
    await client.upsertProfileHomeFeedCollectionSchedule("profile-1", {
      enabled: false,
      intervalMinutes: 120,
      nextRunAt: "2026-07-17T00:00:00.000Z",
      maxPosts: 8,
    });

    expect(requests).toEqual([
      {
        method: undefined,
        path: "/collector/profile-home-feed-collection-schedules",
        query: { enabled: true, limit: 15, offset: 30 },
        body: undefined,
      },
      {
        method: undefined,
        path: "/collector/profile-home-feed-collection-schedules/profile-1",
        query: undefined,
        body: undefined,
      },
      {
        method: "PUT",
        path: "/collector/profile-home-feed-collection-schedules/profile-1",
        query: undefined,
        body: {
          enabled: false,
          intervalMinutes: 120,
          nextRunAt: "2026-07-17T00:00:00.000Z",
          maxPosts: 8,
        },
      },
    ]);
  });
});
