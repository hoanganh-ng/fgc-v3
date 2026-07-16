import type { FastifyInstance } from "fastify";
import type {
  RequestProfileSourceAccessCheckRunInput,
  GetProfileSourceAccessCheckRunInput,
  ListProfileSourceAccessCheckRunsInput,
  ListProfileSourceAccessCheckRunsOutput,
  CancelProfileSourceAccessCheckRunInput,
} from "../../../../collector-runtime/application";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunFailureReason,
  ProfileSourceAccessCheckRunId,
  ProfileSourceAccessCheckRunOutcome,
  ProfileSourceAccessCheckRunStatus,
  ProfileSourceAccessCheckRunTarget,
  ProfileSourceAccessCheckRunTriggerType,
} from "../../../../collector-runtime/domain";
import {
  ProfileSourceAccessCheckRunIdHttpParamsSchema,
  RequestProfileSourceAccessCheckRunHttpBodySchema,
  ListProfileSourceAccessCheckRunsHttpQuerySchema,
  cancelProfileSourceAccessCheckRunHttpRouteSchema,
  getProfileSourceAccessCheckRunHttpRouteSchema,
  listProfileSourceAccessCheckRunsHttpRouteSchema,
  requestProfileSourceAccessCheckRunHttpRouteSchema,
} from "../../schemas/collector-runtime/profile-source-access-check-runs.http-schemas";
import { parseHttpInput } from "../../schemas/collector-runtime/http-schema-primitives";
import type { CollectorRuntimeHttpService } from "./collector-runtime-http-service";

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

export function registerProfileSourceAccessCheckRunRequestRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
): void {
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
}




export function registerProfileSourceAccessCheckRunReadRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
): void {
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

export type ProfileSourceAccessCheckRunRegistrationPhase =
  | "before-home-feed"
  | "after-home-feed";

export function registerProfileSourceAccessCheckRunRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
  phase: ProfileSourceAccessCheckRunRegistrationPhase,
): void {
  if (phase === "before-home-feed") {
    registerProfileSourceAccessCheckRunRequestRoutes(server, collectorRuntime);
    return;
  }

  registerProfileSourceAccessCheckRunReadRoutes(server, collectorRuntime);
}
