import type { FastifyInstance } from "fastify";
import type {
  CancelAccountExerciseRunInput,
  CancelCollectionRunInput,
  GetAccountExerciseRunInput,
  GetCollectionRunInput,
  ListAccountExerciseRunsInput,
  ListAccountExerciseRunsOutput,
  ListCollectionRunsInput,
  ListCollectionRunsOutput,
  MarkAccountExerciseRunFailedInput,
  MarkAccountExerciseRunRunningInput,
  MarkAccountExerciseRunSucceededInput,
  RequestAccountExerciseRunInput,
  RequestCollectionRunInput,
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
  CollectionRun,
  CollectionRunFailureReason,
  CollectionRunId,
  CollectionRunIsoDateTime,
  CollectionRunParameters,
  CollectionRunStatus,
  CollectionRunSummary,
  CollectionRunTriggerType,
} from "../../../collector-runtime/domain";
import {
  AccountExerciseRunIdHttpParamsSchema,
  FailAccountExerciseRunHttpBodySchema,
  ListAccountExerciseRunsHttpQuerySchema,
  CollectionRunIdHttpParamsSchema,
  ListCollectionRunsHttpQuerySchema,
  RequestCollectionRunHttpBodySchema,
  RequestAccountExerciseRunHttpBodySchema,
  StartAccountExerciseRunHttpBodySchema,
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
      const input = {
        profileId: body.profileId,
        stageAtStart: body.stageAtStart,
        maxDurationMs: body.maxDurationMs,
        maxScrolls: body.maxScrolls,
        ...(body.minDwellMs !== undefined
          ? { minDwellMs: body.minDwellMs }
          : {}),
      } satisfies RequestAccountExerciseRunInput;
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
      const accountExerciseRun =
        await collectorRuntime.markAccountExerciseRunRunning.execute({
          accountExerciseRunId: params.accountExerciseRunId,
          ...(body.leaseId !== undefined ? { leaseId: body.leaseId } : {}),
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
