import type { FastifyInstance } from "fastify";
import type {
  CancelCollectionRunInput,
  GetCollectionRunInput,
  ListCollectionRunsInput,
  ListCollectionRunsOutput,
  RequestCollectionRunInput,
} from "../../../collector-runtime/application";
import type {
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
  CollectionRunIdHttpParamsSchema,
  ListCollectionRunsHttpQuerySchema,
  RequestCollectionRunHttpBodySchema,
  cancelCollectionRunHttpRouteSchema,
  getCollectionRunHttpRouteSchema,
  listCollectionRunsHttpRouteSchema,
  parseHttpInput,
  requestCollectionRunHttpRouteSchema,
} from "../schemas/collector-runtime.http-schemas";

interface ExecutableUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface CollectorRuntimeHttpService {
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
