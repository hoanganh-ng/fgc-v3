import type { FastifyInstance } from "fastify";
import type {
  CancelAccountExerciseRunInput,
  AttachAccountExerciseRunLeaseInput,
  GetAccountExerciseRunInput,
  ListAccountExerciseRunsInput,
  ListAccountExerciseRunsOutput,
  MarkAccountExerciseRunFailedInput,
  MarkAccountExerciseRunRunningInput,
  MarkAccountExerciseRunSucceededInput,
  RequestAccountExerciseRunInput,
} from "../../../../collector-runtime/application";
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
} from "../../../../collector-runtime/domain";
import {
  AccountExerciseRunIdHttpParamsSchema,
  AttachAccountExerciseRunLeaseHttpBodySchema,
  FailAccountExerciseRunHttpBodySchema,
  ListAccountExerciseRunsHttpQuerySchema,
  RequestAccountExerciseRunHttpBodySchema,
  StartAccountExerciseRunHttpBodySchema,
  attachAccountExerciseRunLeaseHttpRouteSchema,
  SucceedAccountExerciseRunHttpBodySchema,
  cancelAccountExerciseRunHttpRouteSchema,
  failAccountExerciseRunHttpRouteSchema,
  getAccountExerciseRunHttpRouteSchema,
  listAccountExerciseRunsHttpRouteSchema,
  requestAccountExerciseRunHttpRouteSchema,
  startAccountExerciseRunHttpRouteSchema,
  succeedAccountExerciseRunHttpRouteSchema,
} from "../../schemas/collector-runtime/account-exercise-runs.http-schemas";
import { parseHttpInput } from "../../schemas/collector-runtime/http-schema-primitives";
import type { CollectorRuntimeHttpService } from "./collector-runtime-http-service";

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

export function registerAccountExerciseRunsRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
): void {
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
export { registerAccountExerciseRunsRoutes as registerAccountExerciseRunRoutes };
