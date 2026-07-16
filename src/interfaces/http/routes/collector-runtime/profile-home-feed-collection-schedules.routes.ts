import type { FastifyInstance } from "fastify";
import type {
  CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
  GetProfileHomeFeedCollectionScheduleInput,
  ListProfileHomeFeedCollectionSchedulesInput,
  ListProfileHomeFeedCollectionSchedulesOutput,
} from "../../../../collector-runtime/application";
import type {
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleDispatchStatus,
  ProfileHomeFeedCollectionScheduleFailureReason,
  ProfileHomeFeedCollectionScheduleIsoDateTime,
} from "../../../../collector-runtime/domain";
import {
  ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema,
  CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema,
  ListProfileHomeFeedCollectionSchedulesHttpQuerySchema,
  createOrUpdateProfileHomeFeedCollectionScheduleHttpRouteSchema,
  getProfileHomeFeedCollectionScheduleHttpRouteSchema,
  listProfileHomeFeedCollectionSchedulesHttpRouteSchema,
} from "../../schemas/collector-runtime/profile-home-feed-collection-schedules.http-schemas";
import { parseHttpInput } from "../../schemas/collector-runtime/http-schema-primitives";
import type { CollectorRuntimeHttpService } from "./collector-runtime-http-service";

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

export function registerProfileHomeFeedCollectionSchedulesRoutes(
  server: FastifyInstance,
  collectorRuntime: CollectorRuntimeHttpService,
): void {
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
export { registerProfileHomeFeedCollectionSchedulesRoutes as registerProfileHomeFeedCollectionScheduleRoutes };
