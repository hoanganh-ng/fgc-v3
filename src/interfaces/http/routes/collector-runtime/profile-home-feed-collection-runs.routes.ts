import type { FastifyInstance } from "fastify";
import type {
  CancelProfileHomeFeedCollectionRunInput,
  GetProfileHomeFeedCollectionRunInput,
  ListProfileHomeFeedCollectionRunsInput,
  ListProfileHomeFeedCollectionRunsOutput,
  RequestProfileHomeFeedCollectionRunInput,
} from "../../../../collector-runtime/application";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunFailureReason,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionRunStatus,
  ProfileHomeFeedCollectionRunSummary,
  ProfileHomeFeedCollectionRunTarget,
  ProfileHomeFeedCollectionRunTriggerType,
  ProfileHomeFeedDiagnosticSummary,
} from "../../../../collector-runtime/domain";
import {
  ProfileHomeFeedCollectionRunIdHttpParamsSchema,
  RequestProfileHomeFeedCollectionRunHttpBodySchema,
  ListProfileHomeFeedCollectionRunsHttpQuerySchema,
  cancelProfileHomeFeedCollectionRunHttpRouteSchema,
  getProfileHomeFeedCollectionRunHttpRouteSchema,
  listProfileHomeFeedCollectionRunsHttpRouteSchema,
  requestProfileHomeFeedCollectionRunHttpRouteSchema,
} from "../../schemas/collector-runtime/profile-home-feed-collection-runs.http-schemas";
import { parseHttpInput } from "../../schemas/collector-runtime/http-schema-primitives";
import type { CollectorRuntimeHttpService } from "./collector-runtime-http-service";

export interface ProfileHomeFeedCollectionRunDto {
  readonly id: ProfileHomeFeedCollectionRunId;
  readonly profileId: string;
  readonly triggerType: ProfileHomeFeedCollectionRunTriggerType;
  readonly status: ProfileHomeFeedCollectionRunStatus;
  readonly accountStageAtRequest: string;
  readonly target: ProfileHomeFeedCollectionRunTarget;
  readonly parameters: ProfileHomeFeedCollectionRunParameters;
  readonly summary?: ProfileHomeFeedCollectionRunSummary;
  readonly diagnostics?: ProfileHomeFeedDiagnosticSummary;
  readonly failureReason?: ProfileHomeFeedCollectionRunFailureReason;
  readonly requestedAt: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly startedAt?: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly finishedAt?: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly createdAt: ProfileHomeFeedCollectionRunIsoDateTime;
  readonly updatedAt: ProfileHomeFeedCollectionRunIsoDateTime;
}

export function registerProfileHomeFeedCollectionRunsRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
): void {
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
    ...(run.diagnostics !== undefined
      ? { diagnostics: cloneDiagnostics(run.diagnostics) }
      : {}),
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

function cloneDiagnostics(
  diagnostics: ProfileHomeFeedDiagnosticSummary,
): ProfileHomeFeedDiagnosticSummary {
  return {
    schemaVersion: diagnostics.schemaVersion,
    ...(diagnostics.capture !== undefined
      ? { capture: { ...diagnostics.capture } }
      : {}),
    ...(diagnostics.captureStage !== undefined
      ? { captureStage: diagnostics.captureStage }
      : {}),
    ...(diagnostics.capturePageState !== undefined
      ? { capturePageState: diagnostics.capturePageState }
      : {}),
    ...(diagnostics.captureLoginRedirectSuspected !== undefined
      ? {
          captureLoginRedirectSuspected:
            diagnostics.captureLoginRedirectSuspected,
        }
      : {}),
    ...(diagnostics.extractor !== undefined
      ? { extractor: { ...diagnostics.extractor } }
      : {}),
    ...(diagnostics.warningCounts !== undefined
      ? { warningCounts: { ...diagnostics.warningCounts } }
      : {}),
    ...(diagnostics.unsupportedPayloadCount !== undefined
      ? { unsupportedPayloadCount: diagnostics.unsupportedPayloadCount }
      : {}),
    ...(diagnostics.runOutcome !== undefined
      ? { runOutcome: { ...diagnostics.runOutcome } }
      : {}),
  };
}
export { registerProfileHomeFeedCollectionRunsRoutes as registerProfileHomeFeedCollectionRunRoutes };
