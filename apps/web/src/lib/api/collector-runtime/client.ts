import { env } from "@/lib/env";
import {
  createHttpClient,
  type ApiResult,
  type HttpClient,
} from "@/lib/api/http-client";
import {
  createAccountExerciseRunsOperations,
  type AccountExerciseRunResponse,
  type AccountExerciseRunsListResponse,
  type ListAccountExerciseRunsQuery,
  type RequestAccountExerciseRunRequest,
} from "./account-exercise-runs";
import {
  createCollectionRunsOperations,
  type CollectionRunResponse,
  type CollectionRunsListResponse,
  type ListCollectionRunsQuery,
  type RequestCollectionRunRequest,
} from "./collection-runs";
import {
  createCollectionSchedulesOperations,
  type CollectionScheduleResponse,
  type CollectionScheduleListResponse,
  type ListCollectionSchedulesQuery,
  type UpsertCollectionScheduleRequest,
} from "./collection-schedules";
import {
  createProfileHomeFeedCollectionRunsOperations,
  type ListProfileHomeFeedCollectionRunsQuery,
  type ProfileHomeFeedCollectionRunResponse,
  type ProfileHomeFeedCollectionRunsListResponse,
  type RequestProfileHomeFeedCollectionRunRequest,
} from "./profile-home-feed-collection-runs";
import {
  createProfileHomeFeedCollectionSchedulesOperations,
  type ListProfileHomeFeedCollectionSchedulesQuery,
  type ProfileHomeFeedCollectionScheduleListResponse,
  type ProfileHomeFeedCollectionScheduleResponse,
  type UpsertProfileHomeFeedCollectionScheduleRequest,
} from "./profile-home-feed-collection-schedules";
import {
  createProfileSourceAccessCheckRunsOperations,
  type ListProfileSourceAccessCheckRunsQuery,
  type ProfileSourceAccessCheckRunResponse,
  type ProfileSourceAccessCheckRunsListResponse,
  type RequestProfileSourceAccessCheckRunRequest,
} from "./profile-source-access-check-runs";

export interface CollectorRuntimeClient {
  readonly listCollectionRuns: (
    query?: ListCollectionRunsQuery,
  ) => Promise<ApiResult<CollectionRunsListResponse>>;
  readonly requestCollectionRun: (
    request: RequestCollectionRunRequest,
  ) => Promise<ApiResult<CollectionRunResponse>>;
  readonly cancelCollectionRun: (
    collectionRunId: string,
  ) => Promise<ApiResult<CollectionRunResponse>>;
  readonly listAccountExerciseRuns: (
    query?: ListAccountExerciseRunsQuery,
  ) => Promise<ApiResult<AccountExerciseRunsListResponse>>;
  readonly getAccountExerciseRun: (
    accountExerciseRunId: string,
  ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  readonly requestAccountExerciseRun: (
    request: RequestAccountExerciseRunRequest,
  ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  readonly cancelAccountExerciseRun: (
    accountExerciseRunId: string,
  ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  readonly listProfileSourceAccessCheckRuns: (
    query?: ListProfileSourceAccessCheckRunsQuery,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunsListResponse>>;
  readonly getProfileSourceAccessCheckRun: (
    checkRunId: string,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  readonly requestProfileSourceAccessCheckRun: (
    request: RequestProfileSourceAccessCheckRunRequest,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  readonly cancelProfileSourceAccessCheckRun: (
    checkRunId: string,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  readonly listProfileHomeFeedCollectionRuns: (
    query?: ListProfileHomeFeedCollectionRunsQuery,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunsListResponse>>;
  readonly getProfileHomeFeedCollectionRun: (
    profileHomeFeedCollectionRunId: string,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  readonly requestProfileHomeFeedCollectionRun: (
    request: RequestProfileHomeFeedCollectionRunRequest,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  readonly cancelProfileHomeFeedCollectionRun: (
    profileHomeFeedCollectionRunId: string,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  readonly listCollectionSchedules: (
    query?: ListCollectionSchedulesQuery,
  ) => Promise<ApiResult<CollectionScheduleListResponse>>;
  readonly getCollectionSchedule: (
    sourceGroupId: string,
  ) => Promise<ApiResult<CollectionScheduleResponse>>;
  readonly upsertCollectionSchedule: (
    sourceGroupId: string,
    request: UpsertCollectionScheduleRequest,
  ) => Promise<ApiResult<CollectionScheduleResponse>>;
  readonly listProfileHomeFeedCollectionSchedules: (
    query?: ListProfileHomeFeedCollectionSchedulesQuery,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleListResponse>>;
  readonly getProfileHomeFeedCollectionSchedule: (
    profileId: string,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleResponse>>;
  readonly upsertProfileHomeFeedCollectionSchedule: (
    profileId: string,
    request: UpsertProfileHomeFeedCollectionScheduleRequest,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleResponse>>;
}

export function createCollectorRuntimeClient(
  httpClient: HttpClient = createHttpClient({
    baseUrl: env.VITE_API_BASE_URL,
  }),
): CollectorRuntimeClient {
  return {
    ...createCollectionRunsOperations(httpClient),
    ...createAccountExerciseRunsOperations(httpClient),
    ...createProfileSourceAccessCheckRunsOperations(httpClient),
    ...createProfileHomeFeedCollectionRunsOperations(httpClient),
    ...createCollectionSchedulesOperations(httpClient),
    ...createProfileHomeFeedCollectionSchedulesOperations(httpClient),
  };
}

export const collectorRuntimeClient = createCollectorRuntimeClient();
