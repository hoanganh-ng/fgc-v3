import type { FastifyInstance } from "fastify";
import type {
  GetCollectionScheduleInput,
  ListCollectionSchedulesInput,
  ListCollectionSchedulesOutput,
  UpsertCollectionScheduleUseCaseInput,
} from "../../../../collector-runtime/application";
import type {
  CollectionSchedule,
  CollectionScheduleIsoDateTime,
} from "../../../../collector-runtime/domain";
import {
  CollectionScheduleSourceGroupIdHttpParamsSchema,
  UpsertCollectionScheduleHttpBodySchema,
  ListCollectionSchedulesHttpQuerySchema,
  getCollectionScheduleHttpRouteSchema,
  listCollectionSchedulesHttpRouteSchema,
  upsertCollectionScheduleHttpRouteSchema,
} from "../../schemas/collector-runtime/collection-schedules.http-schemas";
import { parseHttpInput } from "../../schemas/collector-runtime/http-schema-primitives";
import type { CollectorRuntimeHttpService } from "./collector-runtime-http-service";

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

export function registerCollectionSchedulesRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
): void {
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
export { registerCollectionSchedulesRoutes as registerCollectionScheduleRoutes };
