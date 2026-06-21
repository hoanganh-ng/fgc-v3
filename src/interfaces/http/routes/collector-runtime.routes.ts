import type { FastifyInstance } from "fastify";
import type {
  CancelAccountExerciseRunInput,
  CancelCollectionRunInput,
  CancelProfileHomeFeedCollectionRunInput,
  AttachAccountExerciseRunLeaseInput,
  GetAccountExerciseRunInput,
  GetCollectionRunInput,
  GetCollectionScheduleInput,
  CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
  GetProfileHomeFeedCollectionRunInput,
  GetProfileHomeFeedCollectionScheduleInput,
  ListAccountExerciseRunsInput,
  ListAccountExerciseRunsOutput,
  ListCollectionRunsInput,
  ListCollectionRunsOutput,
  ListCollectionSchedulesInput,
  ListCollectionSchedulesOutput,
  ListProfileHomeFeedCollectionRunsInput,
  ListProfileHomeFeedCollectionRunsOutput,
  ListProfileHomeFeedCollectionSchedulesInput,
  ListProfileHomeFeedCollectionSchedulesOutput,
  MarkAccountExerciseRunFailedInput,
  MarkAccountExerciseRunRunningInput,
  MarkAccountExerciseRunSucceededInput,
  RequestAccountExerciseRunInput,
  RequestCollectionRunInput,
  RequestProfileHomeFeedCollectionRunInput,
  RequestProfileSourceAccessCheckRunInput,
  GetProfileSourceAccessCheckRunInput,
  ListProfileSourceAccessCheckRunsInput,
  ListProfileSourceAccessCheckRunsOutput,
  CancelProfileSourceAccessCheckRunInput,
  MarkProfileSourceAccessCheckRunRunningInput,
  MarkProfileSourceAccessCheckRunSucceededInput,
  UpsertCollectionScheduleUseCaseInput,
} from "../../../collector-runtime/application";
import type {
  AccountExerciseRun,
  AccountExerciseRunActionBudget,
  AccountExerciseRunFailureReason,
  AccountExerciseRunId,
  AccountExerciseRunIsoDateTime,
  AccountExerciseRunSafeSummary,
  AccountExerciseRunStatus,
  AccountExerciseType,
  CategoryBrowseExerciseTarget,
  CollectionRun,
  CollectionRunFailureReason,
  CollectionRunId,
  CollectionRunIsoDateTime,
  CollectionRunParameters,
  CollectionRunStatus,
  CollectionRunSummary,
  CollectionRunTriggerType,
  CollectionSchedule,
  CollectionScheduleIsoDateTime,
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunFailureReason,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionRunStatus,
  ProfileHomeFeedCollectionRunSummary,
  ProfileHomeFeedCollectionRunTarget,
  ProfileHomeFeedCollectionRunTriggerType,
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleIsoDateTime,
  ProfileHomeFeedCollectionScheduleDispatchStatus,
  ProfileHomeFeedCollectionScheduleFailureReason,
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunFailureReason,
  ProfileSourceAccessCheckRunId,
  ProfileSourceAccessCheckRunOutcome,
  ProfileSourceAccessCheckRunStatus,
  ProfileSourceAccessCheckRunTarget,
  ProfileSourceAccessCheckRunTriggerType,
} from "../../../collector-runtime/domain";
import {
  AccountExerciseRunIdHttpParamsSchema,
  AttachAccountExerciseRunLeaseHttpBodySchema,
  FailAccountExerciseRunHttpBodySchema,
  ListAccountExerciseRunsHttpQuerySchema,
  CollectionRunIdHttpParamsSchema,
  ListCollectionRunsHttpQuerySchema,
  RequestCollectionRunHttpBodySchema,
  RequestAccountExerciseRunHttpBodySchema,
  StartAccountExerciseRunHttpBodySchema,
  attachAccountExerciseRunLeaseHttpRouteSchema,
  SucceedAccountExerciseRunHttpBodySchema,
  cancelAccountExerciseRunHttpRouteSchema,
  cancelCollectionRunHttpRouteSchema,
  failAccountExerciseRunHttpRouteSchema,
  getAccountExerciseRunHttpRouteSchema,
  getCollectionRunHttpRouteSchema,
  listAccountExerciseRunsHttpRouteSchema,
  listCollectionRunsHttpRouteSchema,
  parseHttpInput,
  requestAccountExerciseRunHttpRouteSchema,
  requestCollectionRunHttpRouteSchema,
  startAccountExerciseRunHttpRouteSchema,
  succeedAccountExerciseRunHttpRouteSchema,
  cancelProfileSourceAccessCheckRunHttpRouteSchema,
  cancelProfileHomeFeedCollectionRunHttpRouteSchema,
  getProfileSourceAccessCheckRunHttpRouteSchema,
  getProfileHomeFeedCollectionRunHttpRouteSchema,
  listProfileSourceAccessCheckRunsHttpRouteSchema,
  listProfileHomeFeedCollectionRunsHttpRouteSchema,
  requestProfileSourceAccessCheckRunHttpRouteSchema,
  requestProfileHomeFeedCollectionRunHttpRouteSchema,
  ProfileSourceAccessCheckRunIdHttpParamsSchema,
  ProfileHomeFeedCollectionRunIdHttpParamsSchema,
  RequestProfileSourceAccessCheckRunHttpBodySchema,
  RequestProfileHomeFeedCollectionRunHttpBodySchema,
  ListProfileSourceAccessCheckRunsHttpQuerySchema,
  ListProfileHomeFeedCollectionRunsHttpQuerySchema,
  CollectionScheduleSourceGroupIdHttpParamsSchema,
  ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema,
  UpsertCollectionScheduleHttpBodySchema,
  CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema,
  ListCollectionSchedulesHttpQuerySchema,
  ListProfileHomeFeedCollectionSchedulesHttpQuerySchema,
  listCollectionSchedulesHttpRouteSchema,
  getCollectionScheduleHttpRouteSchema,
  upsertCollectionScheduleHttpRouteSchema,
  listProfileHomeFeedCollectionSchedulesHttpRouteSchema,
  getProfileHomeFeedCollectionScheduleHttpRouteSchema,
  createOrUpdateProfileHomeFeedCollectionScheduleHttpRouteSchema,
} from "../schemas/collector-runtime.http-schemas";

interface ExecutableUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface CollectorRuntimeHttpService {
  readonly requestAccountExerciseRun: ExecutableUseCase<
    RequestAccountExerciseRunInput,
    AccountExerciseRun
  >;
  readonly getAccountExerciseRun: ExecutableUseCase<
    GetAccountExerciseRunInput,
    AccountExerciseRun
  >;
  readonly listAccountExerciseRuns: ExecutableUseCase<
    ListAccountExerciseRunsInput,
    ListAccountExerciseRunsOutput
  >;
  readonly markAccountExerciseRunRunning: ExecutableUseCase<
    MarkAccountExerciseRunRunningInput,
    AccountExerciseRun
  >;
  readonly markAccountExerciseRunSucceeded: ExecutableUseCase<
    MarkAccountExerciseRunSucceededInput,
    AccountExerciseRun
  >;
  readonly markAccountExerciseRunFailed: ExecutableUseCase<
    MarkAccountExerciseRunFailedInput,
    AccountExerciseRun
  >;
  readonly attachAccountExerciseRunLease: ExecutableUseCase<
    AttachAccountExerciseRunLeaseInput,
    AccountExerciseRun
  >;
  readonly cancelAccountExerciseRun: ExecutableUseCase<
    CancelAccountExerciseRunInput,
    AccountExerciseRun
  >;
  readonly requestCollectionRun: ExecutableUseCase<
    RequestCollectionRunInput,
    CollectionRun
  >;
  readonly getCollectionRun: ExecutableUseCase<
    GetCollectionRunInput,
    CollectionRun
  >;
  readonly listCollectionRuns: ExecutableUseCase<
    ListCollectionRunsInput,
    ListCollectionRunsOutput
  >;
  readonly cancelCollectionRun: ExecutableUseCase<
    CancelCollectionRunInput,
    CollectionRun
  >;
  readonly requestProfileHomeFeedCollectionRun: ExecutableUseCase<
    RequestProfileHomeFeedCollectionRunInput,
    ProfileHomeFeedCollectionRun
  >;
  readonly getProfileHomeFeedCollectionRun: ExecutableUseCase<
    GetProfileHomeFeedCollectionRunInput,
    ProfileHomeFeedCollectionRun
  >;
  readonly listProfileHomeFeedCollectionRuns: ExecutableUseCase<
    ListProfileHomeFeedCollectionRunsInput,
    ListProfileHomeFeedCollectionRunsOutput
  >;
  readonly cancelProfileHomeFeedCollectionRun: ExecutableUseCase<
    CancelProfileHomeFeedCollectionRunInput,
    ProfileHomeFeedCollectionRun
  >;
  readonly requestProfileSourceAccessCheckRun: ExecutableUseCase<
    RequestProfileSourceAccessCheckRunInput,
    ProfileSourceAccessCheckRun
  >;
  readonly getProfileSourceAccessCheckRun: ExecutableUseCase<
    GetProfileSourceAccessCheckRunInput,
    ProfileSourceAccessCheckRun
  >;
  readonly listProfileSourceAccessCheckRuns: ExecutableUseCase<
    ListProfileSourceAccessCheckRunsInput,
    ListProfileSourceAccessCheckRunsOutput
  >;
  readonly cancelProfileSourceAccessCheckRun: ExecutableUseCase<
    CancelProfileSourceAccessCheckRunInput,
    ProfileSourceAccessCheckRun
  >;
  readonly upsertCollectionSchedule: ExecutableUseCase<
    UpsertCollectionScheduleUseCaseInput,
    CollectionSchedule
  >;
  readonly getCollectionSchedule: ExecutableUseCase<
    GetCollectionScheduleInput,
    CollectionSchedule
  >;
  readonly listCollectionSchedules: ExecutableUseCase<
    ListCollectionSchedulesInput,
    ListCollectionSchedulesOutput
  >;
  readonly createOrUpdateProfileHomeFeedCollectionSchedule: ExecutableUseCase<
    CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
    ProfileHomeFeedCollectionSchedule
  >;
  readonly getProfileHomeFeedCollectionSchedule: ExecutableUseCase<
    GetProfileHomeFeedCollectionScheduleInput,
    ProfileHomeFeedCollectionSchedule
  >;
  readonly listProfileHomeFeedCollectionSchedules: ExecutableUseCase<
    ListProfileHomeFeedCollectionSchedulesInput,
    ListProfileHomeFeedCollectionSchedulesOutput
  >;
}

export interface RegisterCollectorRuntimeRoutesOptions {
  readonly collectorRuntime: CollectorRuntimeHttpService;
}

export interface AccountExerciseRunDto {
  readonly id: AccountExerciseRunId;
  readonly profileId: string;
  readonly leaseId?: string;
  readonly exerciseType: AccountExerciseType;
  readonly status: AccountExerciseRunStatus;
  readonly stageAtStart: string;
  readonly actionBudget: AccountExerciseRunActionBudget;
  readonly target?: CategoryBrowseExerciseTarget;
  readonly safeSummary?: AccountExerciseRunSafeSummary;
  readonly failureReason?: AccountExerciseRunFailureReason;
  readonly requestedAt: AccountExerciseRunIsoDateTime;
  readonly startedAt?: AccountExerciseRunIsoDateTime;
  readonly finishedAt?: AccountExerciseRunIsoDateTime;
  readonly createdAt: AccountExerciseRunIsoDateTime;
  readonly updatedAt: AccountExerciseRunIsoDateTime;
}

export interface CollectionRunDto {
  readonly id: CollectionRunId;
  readonly sourceGroupId: string;
  readonly status: CollectionRunStatus;
  readonly triggerType: CollectionRunTriggerType;
  readonly parameters: CollectionRunParameters;
  readonly summary?: CollectionRunSummary;
  readonly failureReason?: CollectionRunFailureReason;
  readonly requestedAt: CollectionRunIsoDateTime;
  readonly startedAt?: CollectionRunIsoDateTime;
  readonly finishedAt?: CollectionRunIsoDateTime;
  readonly createdAt: CollectionRunIsoDateTime;
  readonly updatedAt: CollectionRunIsoDateTime;
}

export interface ProfileSourceAccessCheckRunDto {
  readonly id: ProfileSourceAccessCheckRunId;
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly triggerType: ProfileSourceAccessCheckRunTriggerType;
  readonly status: ProfileSourceAccessCheckRunStatus;
  readonly accountStageAtRequest: string;
  readonly target: ProfileSourceAccessCheckRunTarget;
  readonly outcome?: ProfileSourceAccessCheckRunOutcome;
  readonly failureReason?: ProfileSourceAccessCheckRunFailureReason;
  readonly requestedAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProfileHomeFeedCollectionRunDto {
  readonly id: ProfileHomeFeedCollectionRunId;
  readonly profileId: string;
  readonly triggerType: ProfileHomeFeedCollectionRunTriggerType;
  readonly status: ProfileHomeFeedCollectionRunStatus;
  readonly accountStageAtRequest: string;
  readonly target: ProfileHomeFeedCollectionRunTarget;
  readonly parameters: ProfileHomeFeedCollectionRunParameters;
  readonly summary?: ProfileHomeFeedCollectionRunSummary;
  readonly failureReason?: ProfileHomeFeedCollectionRunFailureReason;
  readonly requestedAt: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly startedAt?: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly finishedAt?: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly createdAt: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly updatedAt: ProfileHomeFeedCollectionRunIsoDateTime;
}

export interface CollectionScheduleDto {
  readonly sourceGroupId: string;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
  readonly nextRunAt: CollectionScheduleIsoDateTime;
  readonly parameters: {
    readonly maxScrolls?: number;
    readonly maxDurationMs?: number;
  };
  readonly createdAt: CollectionScheduleIsoDateTime;
  readonly updatedAt: CollectionScheduleIsoDateTime;
}

export interface ProfileHomeFeedCollectionScheduleDto {
  readonly profileId: string;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
  readonly nextRunAt: ProfileHomeFeedCollectionScheduleIsoDateTime;
  readonly parameters: ProfileHomeFeedCollectionRunParameters;
  readonly lastAttemptedAt?: ProfileHomeFeedCollectionScheduleIsoDateTime;
  readonly lastDispatchStatus?: ProfileHomeFeedCollectionScheduleDispatchStatus;
  readonly lastFailureReason?: ProfileHomeFeedCollectionScheduleFailureReason;
  readonly consecutiveFailures: number;
  readonly createdAt: ProfileHomeFeedCollectionScheduleIsoDateTime;
  readonly updatedAt: ProfileHomeFeedCollectionScheduleIsoDateTime;
}

export function registerCollectorRuntimeRoutes(
  server: FastifyInstance,
  options: RegisterCollectorRuntimeRoutesOptions,
): void {
  const { collectorRuntime } = options;

  server.post(
    "/collector/account-exercise-runs",
    { schema: requestAccountExerciseRunHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        RequestAccountExerciseRunHttpBodySchema,
        request.body,
      );
      const input = (body.exerciseType === "CATEGORY_BROWSE"
        ? {
            profileId: body.profileId,
            stageAtStart: body.stageAtStart,
            exerciseType: "CATEGORY_BROWSE" as const,
            sourceGroupId: body.sourceGroupId!,
            ...(body.entryRouteId !== undefined
              ? { entryRouteId: body.entryRouteId }
              : {}),
            maxDurationMs: body.maxDurationMs,
            maxScrolls: body.maxScrolls,
            ...(body.minDwellMs !== undefined
              ? { minDwellMs: body.minDwellMs }
              : {}),
          }
        : {
            profileId: body.profileId,
            stageAtStart: body.stageAtStart,
            ...(body.exerciseType === "AMBIENT_ACCOUNT"
              ? { exerciseType: "AMBIENT_ACCOUNT" as const }
              : {}),
            maxDurationMs: body.maxDurationMs,
            maxScrolls: body.maxScrolls,
            ...(body.minDwellMs !== undefined
              ? { minDwellMs: body.minDwellMs }
              : {}),
          }) satisfies RequestAccountExerciseRunInput;
      const accountExerciseRun =
        await collectorRuntime.requestAccountExerciseRun.execute(input);

      return reply.code(201).send({
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      });
    },
  );

  server.get(
    "/collector/account-exercise-runs",
    { schema: listAccountExerciseRunsHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListAccountExerciseRunsHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.profileId !== undefined ? { profileId: query.profileId } : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListAccountExerciseRunsInput;
      const output =
        await collectorRuntime.listAccountExerciseRuns.execute(input);

      return {
        items: output.items.map(toAccountExerciseRunDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/account-exercise-runs/:accountExerciseRunId",
    { schema: getAccountExerciseRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        AccountExerciseRunIdHttpParamsSchema,
        request.params,
      );
      const accountExerciseRun =
        await collectorRuntime.getAccountExerciseRun.execute({
          accountExerciseRunId: params.accountExerciseRunId,
        });

      return {
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      };
    },
  );

  server.post(
    "/collector/account-exercise-runs/:accountExerciseRunId/start",
    { schema: startAccountExerciseRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        AccountExerciseRunIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        StartAccountExerciseRunHttpBodySchema,
        request.body ?? {},
      );
      const input = {
        accountExerciseRunId: params.accountExerciseRunId,
        ...(body.leaseId !== undefined ? { leaseId: body.leaseId } : {}),
      } satisfies MarkAccountExerciseRunRunningInput;
      const accountExerciseRun =
        await collectorRuntime.markAccountExerciseRunRunning.execute(input);

      return {
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      };
    },
  );

  server.post(
    "/collector/account-exercise-runs/:accountExerciseRunId/lease",
    { schema: attachAccountExerciseRunLeaseHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        AccountExerciseRunIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        AttachAccountExerciseRunLeaseHttpBodySchema,
        request.body,
      );
      const accountExerciseRun =
        await collectorRuntime.attachAccountExerciseRunLease.execute({
          accountExerciseRunId: params.accountExerciseRunId,
          leaseId: body.leaseId,
        });

      return {
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      };
    },
  );

  server.post(
    "/collector/account-exercise-runs/:accountExerciseRunId/succeed",
    { schema: succeedAccountExerciseRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        AccountExerciseRunIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        SucceedAccountExerciseRunHttpBodySchema,
        request.body,
      );
      const accountExerciseRun =
        await collectorRuntime.markAccountExerciseRunSucceeded.execute({
          accountExerciseRunId: params.accountExerciseRunId,
          safeSummary: body.safeSummary,
        });

      return {
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      };
    },
  );

  server.post(
    "/collector/account-exercise-runs/:accountExerciseRunId/fail",
    { schema: failAccountExerciseRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        AccountExerciseRunIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        FailAccountExerciseRunHttpBodySchema,
        request.body,
      );
      const input = {
        accountExerciseRunId: params.accountExerciseRunId,
        failureReason: body.failureReason,
        ...(body.safeSummary !== undefined
          ? { safeSummary: body.safeSummary }
          : {}),
      } satisfies MarkAccountExerciseRunFailedInput;
      const accountExerciseRun =
        await collectorRuntime.markAccountExerciseRunFailed.execute(input);

      return {
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      };
    },
  );

  server.post(
    "/collector/account-exercise-runs/:accountExerciseRunId/cancel",
    { schema: cancelAccountExerciseRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        AccountExerciseRunIdHttpParamsSchema,
        request.params,
      );
      const accountExerciseRun =
        await collectorRuntime.cancelAccountExerciseRun.execute({
          accountExerciseRunId: params.accountExerciseRunId,
        });

      return {
        accountExerciseRun: toAccountExerciseRunDto(accountExerciseRun),
      };
    },
  );

  server.post(
    "/collector/collection-runs",
    { schema: requestCollectionRunHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        RequestCollectionRunHttpBodySchema,
        request.body,
      );
      const input = {
        sourceGroupId: body.sourceGroupId,
        ...(body.maxScrolls !== undefined
          ? { maxScrolls: body.maxScrolls }
          : {}),
        ...(body.maxDurationMs !== undefined
          ? { maxDurationMs: body.maxDurationMs }
          : {}),
      } satisfies RequestCollectionRunInput;
      const collectionRun =
        await collectorRuntime.requestCollectionRun.execute(input);

      return reply.code(201).send({
        collectionRun: toCollectionRunDto(collectionRun),
      });
    },
  );

  server.get(
    "/collector/collection-runs",
    { schema: listCollectionRunsHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListCollectionRunsHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.sourceGroupId !== undefined
          ? { sourceGroupId: query.sourceGroupId }
          : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListCollectionRunsInput;
      const output = await collectorRuntime.listCollectionRuns.execute(input);

      return {
        items: output.items.map(toCollectionRunDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/collection-runs/:collectionRunId",
    { schema: getCollectionRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        CollectionRunIdHttpParamsSchema,
        request.params,
      );
      const collectionRun = await collectorRuntime.getCollectionRun.execute({
        collectionRunId: params.collectionRunId,
      });

      return {
        collectionRun: toCollectionRunDto(collectionRun),
      };
    },
  );

  server.post(
    "/collector/collection-runs/:collectionRunId/cancel",
    { schema: cancelCollectionRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        CollectionRunIdHttpParamsSchema,
        request.params,
      );
      const collectionRun = await collectorRuntime.cancelCollectionRun.execute({
        collectionRunId: params.collectionRunId,
      });

      return {
        collectionRun: toCollectionRunDto(collectionRun),
      };
    },
  );

  server.post(
    "/collector/profile-source-access-check-runs",
    { schema: requestProfileSourceAccessCheckRunHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        RequestProfileSourceAccessCheckRunHttpBodySchema,
        request.body,
      );
      const input = {
        profileId: body.profileId,
        sourceGroupId: body.sourceGroupId,
      };
      const checkRun = await collectorRuntime.requestProfileSourceAccessCheckRun.execute(input);

      return reply.code(201).send({
        profileSourceAccessCheckRun: toProfileSourceAccessCheckRunDto(checkRun),
      });
    },
  );

  server.post(
    "/collector/profile-home-feed-collection-runs",
    { schema: requestProfileHomeFeedCollectionRunHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        RequestProfileHomeFeedCollectionRunHttpBodySchema,
        request.body,
      );
      const input = {
        profileId: body.profileId,
        ...(body.maxScrolls !== undefined
          ? { maxScrolls: body.maxScrolls }
          : {}),
        ...(body.maxDurationMs !== undefined
          ? { maxDurationMs: body.maxDurationMs }
          : {}),
        ...(body.maxPosts !== undefined ? { maxPosts: body.maxPosts } : {}),
      } satisfies RequestProfileHomeFeedCollectionRunInput;
      const run =
        await collectorRuntime.requestProfileHomeFeedCollectionRun.execute(
          input,
        );

      return reply.code(201).send({
        profileHomeFeedCollectionRun: toProfileHomeFeedCollectionRunDto(run),
      });
    },
  );

  server.get(
    "/collector/profile-home-feed-collection-runs",
    { schema: listProfileHomeFeedCollectionRunsHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListProfileHomeFeedCollectionRunsHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.profileId !== undefined ? { profileId: query.profileId } : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListProfileHomeFeedCollectionRunsInput;
      const output =
        await collectorRuntime.listProfileHomeFeedCollectionRuns.execute(input);

      return {
        items: output.items.map(toProfileHomeFeedCollectionRunDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/profile-home-feed-collection-runs/:profileHomeFeedCollectionRunId",
    { schema: getProfileHomeFeedCollectionRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileHomeFeedCollectionRunIdHttpParamsSchema,
        request.params,
      );
      const run =
        await collectorRuntime.getProfileHomeFeedCollectionRun.execute({
          runId: params.profileHomeFeedCollectionRunId,
        });

      return {
        profileHomeFeedCollectionRun: toProfileHomeFeedCollectionRunDto(run),
      };
    },
  );

  server.post(
    "/collector/profile-home-feed-collection-runs/:profileHomeFeedCollectionRunId/cancel",
    { schema: cancelProfileHomeFeedCollectionRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileHomeFeedCollectionRunIdHttpParamsSchema,
        request.params,
      );
      const run =
        await collectorRuntime.cancelProfileHomeFeedCollectionRun.execute({
          runId: params.profileHomeFeedCollectionRunId,
        });

      return {
        profileHomeFeedCollectionRun: toProfileHomeFeedCollectionRunDto(run),
      };
    },
  );

  server.get(
    "/collector/profile-source-access-check-runs",
    { schema: listProfileSourceAccessCheckRunsHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListProfileSourceAccessCheckRunsHttpQuerySchema,
        request.query,
      );
      const input: ListProfileSourceAccessCheckRunsInput = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.profileId !== undefined ? { profileId: query.profileId } : {}),
        ...(query.sourceGroupId !== undefined ? { sourceGroupId: query.sourceGroupId } : {}),
        limit: query.limit,
        offset: query.offset,
      };
      const output = await collectorRuntime.listProfileSourceAccessCheckRuns.execute(input);

      return {
        items: output.items.map(toProfileSourceAccessCheckRunDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/profile-source-access-check-runs/:checkRunId",
    { schema: getProfileSourceAccessCheckRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileSourceAccessCheckRunIdHttpParamsSchema,
        request.params,
      );
      const checkRun = await collectorRuntime.getProfileSourceAccessCheckRun.execute({
        checkRunId: params.checkRunId,
      });

      return {
        profileSourceAccessCheckRun: toProfileSourceAccessCheckRunDto(checkRun),
      };
    },
  );

  server.post(
    "/collector/profile-source-access-check-runs/:checkRunId/cancel",
    { schema: cancelProfileSourceAccessCheckRunHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileSourceAccessCheckRunIdHttpParamsSchema,
        request.params,
      );
      const checkRun = await collectorRuntime.cancelProfileSourceAccessCheckRun.execute({
        checkRunId: params.checkRunId,
      });

      return {
        profileSourceAccessCheckRun: toProfileSourceAccessCheckRunDto(checkRun),
      };
    },
  );

  server.get(
    "/collector/profile-home-feed-collection-schedules",
    { schema: listProfileHomeFeedCollectionSchedulesHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListProfileHomeFeedCollectionSchedulesHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListProfileHomeFeedCollectionSchedulesInput;
      const output =
        await collectorRuntime.listProfileHomeFeedCollectionSchedules.execute(
          input,
        );

      return {
        items: output.items.map(toProfileHomeFeedCollectionScheduleDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/profile-home-feed-collection-schedules/:profileId",
    { schema: getProfileHomeFeedCollectionScheduleHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema,
        request.params,
      );
      const schedule =
        await collectorRuntime.getProfileHomeFeedCollectionSchedule.execute({
          profileId: params.profileId,
        });

      return {
        schedule: toProfileHomeFeedCollectionScheduleDto(schedule),
      };
    },
  );

  server.put(
    "/collector/profile-home-feed-collection-schedules/:profileId",
    { schema: createOrUpdateProfileHomeFeedCollectionScheduleHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema,
        request.body,
      );
      const input = {
        profileId: params.profileId,
        enabled: body.enabled,
        intervalMinutes: body.intervalMinutes,
        nextRunAt: body.nextRunAt,
        ...(body.maxScrolls !== undefined
          ? { maxScrolls: body.maxScrolls }
          : {}),
        ...(body.maxDurationMs !== undefined
          ? { maxDurationMs: body.maxDurationMs }
          : {}),
        ...(body.maxPosts !== undefined ? { maxPosts: body.maxPosts } : {}),
      } satisfies CreateOrUpdateProfileHomeFeedCollectionScheduleInput;
      const schedule =
        await collectorRuntime.createOrUpdateProfileHomeFeedCollectionSchedule.execute(
          input,
        );

      return {
        schedule: toProfileHomeFeedCollectionScheduleDto(schedule),
      };
    },
  );

  server.get(
    "/collector/collection-schedules",
    { schema: listCollectionSchedulesHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListCollectionSchedulesHttpQuerySchema,
        request.query,
      );
      const input: ListCollectionSchedulesInput = {
        limit: query.limit,
        offset: query.offset,
      };
      const output = await collectorRuntime.listCollectionSchedules.execute(input);

      return {
        items: output.items.map(toCollectionScheduleDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/collection-schedules/:sourceGroupId",
    { schema: getCollectionScheduleHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        CollectionScheduleSourceGroupIdHttpParamsSchema,
        request.params,
      );
      const collectionSchedule =
        await collectorRuntime.getCollectionSchedule.execute({
          sourceGroupId: params.sourceGroupId,
        });

      return {
        collectionSchedule: toCollectionScheduleDto(collectionSchedule),
      };
    },
  );

  server.put(
    "/collector/collection-schedules/:sourceGroupId",
    { schema: upsertCollectionScheduleHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        CollectionScheduleSourceGroupIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpsertCollectionScheduleHttpBodySchema,
        request.body,
      );
      const input: UpsertCollectionScheduleUseCaseInput = {
        sourceGroupId: params.sourceGroupId,
        enabled: body.enabled,
        intervalMinutes: body.intervalMinutes,
        nextRunAt: body.nextRunAt,
        parameters: {
          ...(body.parameters?.maxScrolls !== undefined
            ? { maxScrolls: body.parameters.maxScrolls }
            : {}),
          ...(body.parameters?.maxDurationMs !== undefined
            ? { maxDurationMs: body.parameters.maxDurationMs }
            : {}),
        },
      };
      const collectionSchedule =
        await collectorRuntime.upsertCollectionSchedule.execute(input);

      return {
        collectionSchedule: toCollectionScheduleDto(collectionSchedule),
      };
    },
  );

}

export function toAccountExerciseRunDto(
  accountExerciseRun: AccountExerciseRun,
): AccountExerciseRunDto {
  return {
    id: accountExerciseRun.id,
    profileId: accountExerciseRun.profileId,
    ...(accountExerciseRun.leaseId !== undefined
      ? { leaseId: accountExerciseRun.leaseId }
      : {}),
    exerciseType: accountExerciseRun.exerciseType,
    status: accountExerciseRun.status,
    stageAtStart: accountExerciseRun.stageAtStart,
    actionBudget: { ...accountExerciseRun.actionBudget },
    ...(accountExerciseRun.target !== undefined
      ? { target: { ...accountExerciseRun.target } }
      : {}),
    ...(accountExerciseRun.safeSummary !== undefined
      ? { safeSummary: { ...accountExerciseRun.safeSummary } }
      : {}),
    ...(accountExerciseRun.failureReason !== undefined
      ? { failureReason: { ...accountExerciseRun.failureReason } }
      : {}),
    requestedAt: accountExerciseRun.requestedAt,
    ...(accountExerciseRun.startedAt !== undefined
      ? { startedAt: accountExerciseRun.startedAt }
      : {}),
    ...(accountExerciseRun.finishedAt !== undefined
      ? { finishedAt: accountExerciseRun.finishedAt }
      : {}),
    createdAt: accountExerciseRun.createdAt,
    updatedAt: accountExerciseRun.updatedAt,
  };
}

export function toCollectionRunDto(
  collectionRun: CollectionRun,
): CollectionRunDto {
  return {
    id: collectionRun.id,
    sourceGroupId: collectionRun.sourceGroupId,
    status: collectionRun.status,
    triggerType: collectionRun.triggerType,
    parameters: { ...collectionRun.parameters },
    ...(collectionRun.summary !== undefined
      ? { summary: { ...collectionRun.summary } }
      : {}),
    ...(collectionRun.failureReason !== undefined
      ? { failureReason: { ...collectionRun.failureReason } }
      : {}),
    requestedAt: collectionRun.requestedAt,
    ...(collectionRun.startedAt !== undefined
      ? { startedAt: collectionRun.startedAt }
      : {}),
    ...(collectionRun.finishedAt !== undefined
      ? { finishedAt: collectionRun.finishedAt }
      : {}),
    createdAt: collectionRun.createdAt,
    updatedAt: collectionRun.updatedAt,
  };
}

export function toProfileSourceAccessCheckRunDto(
  run: ProfileSourceAccessCheckRun,
): ProfileSourceAccessCheckRunDto {
  return {
    id: run.id,
    profileId: run.profileId,
    sourceGroupId: run.sourceGroupId,
    triggerType: run.triggerType,
    status: run.status,
    accountStageAtRequest: run.accountStageAtRequest,
    target: { ...run.target },
    ...(run.outcome !== undefined ? { outcome: run.outcome } : {}),
    ...(run.failureReason !== undefined
      ? { failureReason: { ...run.failureReason } }
      : {}),
    requestedAt: run.requestedAt,
    ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
    ...(run.finishedAt !== undefined ? { finishedAt: run.finishedAt } : {}),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export function toProfileHomeFeedCollectionRunDto(
  run: ProfileHomeFeedCollectionRun,
): ProfileHomeFeedCollectionRunDto {
  return {
    id: run.id,
    profileId: run.profileId,
    triggerType: run.triggerType,
    status: run.status,
    accountStageAtRequest: run.accountStageAtRequest,
    target: { ...run.target },
    parameters: { ...run.parameters },
    ...(run.summary !== undefined ? { summary: { ...run.summary } } : {}),
    ...(run.failureReason !== undefined
      ? { failureReason: { ...run.failureReason } }
      : {}),
    requestedAt: run.requestedAt,
    ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
    ...(run.finishedAt !== undefined ? { finishedAt: run.finishedAt } : {}),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export function toCollectionScheduleDto(
  collectionSchedule: CollectionSchedule,
): CollectionScheduleDto {
  return {
    sourceGroupId: collectionSchedule.sourceGroupId,
    enabled: collectionSchedule.enabled,
    intervalMinutes: collectionSchedule.intervalMinutes,
    nextRunAt: collectionSchedule.nextRunAt,
    parameters: {
      ...(collectionSchedule.parameters.maxScrolls !== undefined
        ? { maxScrolls: collectionSchedule.parameters.maxScrolls }
        : {}),
      ...(collectionSchedule.parameters.maxDurationMs !== undefined
        ? { maxDurationMs: collectionSchedule.parameters.maxDurationMs }
        : {}),
    },
    createdAt: collectionSchedule.createdAt,
    updatedAt: collectionSchedule.updatedAt,
  };
}

export function toProfileHomeFeedCollectionScheduleDto(
  schedule: ProfileHomeFeedCollectionSchedule,
): ProfileHomeFeedCollectionScheduleDto {
  return {
    profileId: schedule.profileId,
    enabled: schedule.enabled,
    intervalMinutes: schedule.intervalMinutes,
    nextRunAt: schedule.nextRunAt,
    parameters: {
      ...(schedule.parameters.maxScrolls !== undefined
        ? { maxScrolls: schedule.parameters.maxScrolls }
        : {}),
      ...(schedule.parameters.maxDurationMs !== undefined
        ? { maxDurationMs: schedule.parameters.maxDurationMs }
        : {}),
      ...(schedule.parameters.maxPosts !== undefined
        ? { maxPosts: schedule.parameters.maxPosts }
        : {}),
    },
    ...(schedule.lastAttemptedAt !== undefined
      ? { lastAttemptedAt: schedule.lastAttemptedAt }
      : {}),
    ...(schedule.lastDispatchStatus !== undefined
      ? { lastDispatchStatus: schedule.lastDispatchStatus }
      : {}),
    ...(schedule.lastFailureReason !== undefined
      ? { lastFailureReason: { ...schedule.lastFailureReason } }
      : {}),
    consecutiveFailures: schedule.consecutiveFailures,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}
