import { describe, expect, it } from "vitest";
import {
  AccountExerciseRunResponseSchema,
  AccountExerciseRunsListResponseSchema,
  RequestAccountExerciseRunRequestSchema,
  createCollectorRuntimeClient,
  toListAccountExerciseRunsQueryParams,
  type AccountExerciseRun,
  type AccountExerciseRunResponse,
} from "@/lib/api/collector-runtime-client";
import type {
  ApiRequestOptions,
  ApiResult,
  HttpClient,
} from "@/lib/api/http-client";

const timestamp = "2026-06-15T00:00:00.000Z";

function createAccountExerciseRun(
  overrides: Partial<AccountExerciseRun> = {},
): AccountExerciseRun {
  return {
    id: "exercise-run-1",
    profileId: "profile-1",
    exerciseType: "AMBIENT_ACCOUNT",
    status: "QUEUED",
    stageAtStart: "NEW_ACCOUNT",
    actionBudget: {
      maxDurationMs: 120_000,
      maxScrolls: 2,
    },
    requestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("collector runtime account-exercise-run client", () => {
  it("uses strict account-exercise-run response schemas", () => {
    const listWithExtraTopLevelField =
      AccountExerciseRunsListResponseSchema.safeParse({
        items: [createAccountExerciseRun()],
        page: { limit: 50, offset: 0 },
        unexpected: true,
      });
    const responseWithExtraRunField = AccountExerciseRunResponseSchema.safeParse({
      accountExerciseRun: {
        ...createAccountExerciseRun(),
        unexpected: true,
      },
    });
    const responseWithExtraSummaryField =
      AccountExerciseRunResponseSchema.safeParse({
        accountExerciseRun: {
          ...createAccountExerciseRun(),
          safeSummary: {
            pageLoaded: true,
            loginRequired: false,
            checkpointDetected: false,
            scrollsPerformed: 2,
            durationMs: 30_000,
            leaseReleased: true,
            unexpected: true,
          },
        },
      });

    expect(listWithExtraTopLevelField.success).toBe(false);
    expect(responseWithExtraRunField.success).toBe(false);
    expect(responseWithExtraSummaryField.success).toBe(false);
  });

  it("uses strict account-exercise-run request schemas", () => {
    const parsed = RequestAccountExerciseRunRequestSchema.safeParse({
      profileId: "profile-1",
      stageAtStart: "NEW_ACCOUNT",
      maxDurationMs: 120_000,
      maxScrolls: 0,
      unexpected: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("constructs account-exercise-run query parameters from the production helper", () => {
    expect(
      toListAccountExerciseRunsQueryParams({
        status: "QUEUED",
        profileId: "profile-1",
        limit: 50,
        offset: 100,
      }),
    ).toEqual({
      status: "QUEUED",
      profileId: "profile-1",
      limit: 50,
      offset: 100,
    });
  });

  it("omits absent account-exercise-run query parameters", () => {
    expect(toListAccountExerciseRunsQueryParams({ limit: 50 })).toEqual({
      limit: 50,
    });
  });

  it("encodes detail and cancellation paths", async () => {
    const response: AccountExerciseRunResponse = {
      accountExerciseRun: createAccountExerciseRun(),
    };
    const capturedPaths: string[] = [];
    const httpClient: HttpClient = {
      async request<TResponse, TBody = unknown>(
        options: ApiRequestOptions<TResponse, TBody>,
      ): Promise<ApiResult<TResponse>> {
        capturedPaths.push(options.path);
        return { ok: true, data: response as TResponse };
      },
    };
    const client = createCollectorRuntimeClient(httpClient);

    await client.getAccountExerciseRun("run/with space");
    await client.cancelAccountExerciseRun("run/with space");

    expect(capturedPaths).toEqual([
      "/collector/account-exercise-runs/run%2Fwith%20space",
      "/collector/account-exercise-runs/run%2Fwith%20space/cancel",
    ]);
  });

  it("sends the account-exercise-run request body without mutation", async () => {
    let capturedBody: unknown;
    const response: AccountExerciseRunResponse = {
      accountExerciseRun: createAccountExerciseRun(),
    };
    const httpClient: HttpClient = {
      async request<TResponse, TBody = unknown>(
        options: ApiRequestOptions<TResponse, TBody>,
      ): Promise<ApiResult<TResponse>> {
        capturedBody = options.body;
        return { ok: true, data: response as TResponse };
      },
    };
    const client = createCollectorRuntimeClient(httpClient);

    await client.requestAccountExerciseRun({
      profileId: "profile-1",
      stageAtStart: "WARMING",
      maxDurationMs: 60_000,
      maxScrolls: 0,
      minDwellMs: 0,
    });

    expect(capturedBody).toEqual({
      profileId: "profile-1",
      stageAtStart: "WARMING",
      maxDurationMs: 60_000,
      maxScrolls: 0,
      minDwellMs: 0,
    });
  });

  it("parses both exercise types and rejects malformed targets in client schema", () => {
    const validTarget = {
      categoryId: "category-1",
      sourceGroupId: "group-1",
      entryRouteId: "route-1",
      entryRouteType: "CATEGORY_ENTRY_URL" as const,
      url: "https://www.facebook.com/groups/group-1/categories",
      riskLevel: "LOW" as const,
    };

    const parseAmbient = AccountExerciseRunResponseSchema.safeParse({
      accountExerciseRun: createAccountExerciseRun({
        exerciseType: "AMBIENT_ACCOUNT",
      }),
    });
    expect(parseAmbient.success).toBe(true);

    const parseCategoryBrowse = AccountExerciseRunResponseSchema.safeParse({
      accountExerciseRun: createAccountExerciseRun({
        exerciseType: "CATEGORY_BROWSE",
        target: validTarget,
      }),
    });
    expect(parseCategoryBrowse.success).toBe(true);

    const parseMissingTarget = AccountExerciseRunResponseSchema.safeParse({
      accountExerciseRun: createAccountExerciseRun({
        exerciseType: "CATEGORY_BROWSE",
      }),
    });
    expect(parseMissingTarget.success).toBe(false);

    const parseMalformedTarget = AccountExerciseRunResponseSchema.safeParse({
      accountExerciseRun: createAccountExerciseRun({
        exerciseType: "CATEGORY_BROWSE",
        target: {
          ...validTarget,
          url: "http://non-facebook.com",
        },
      }),
    });
    expect(parseMalformedTarget.success).toBe(false);
  });
});
