import type { FastifyInstance } from "fastify";
import { registerAccountExerciseRunsRoutes } from "./collector-runtime/account-exercise-runs.routes";
import { registerCollectionRunsRoutes } from "./collector-runtime/collection-runs.routes";
import { registerCollectionSchedulesRoutes } from "./collector-runtime/collection-schedules.routes";
import {
  registerProfileSourceAccessCheckRunRoutes,
} from "./collector-runtime/profile-source-access-check-runs.routes";
import { registerProfileHomeFeedCollectionRunsRoutes } from "./collector-runtime/profile-home-feed-collection-runs.routes";
import { registerProfileHomeFeedCollectionSchedulesRoutes } from "./collector-runtime/profile-home-feed-collection-schedules.routes";

export type {
  CollectorRuntimeHttpService,
  RegisterCollectorRuntimeRoutesOptions,
} from "./collector-runtime/collector-runtime-http-service";

export type { AccountExerciseRunDto } from "./collector-runtime/account-exercise-runs.routes";
export type { CollectionRunDto } from "./collector-runtime/collection-runs.routes";
export type { CollectionScheduleDto } from "./collector-runtime/collection-schedules.routes";
export type { ProfileHomeFeedCollectionRunDto } from "./collector-runtime/profile-home-feed-collection-runs.routes";
export type { ProfileHomeFeedCollectionScheduleDto } from "./collector-runtime/profile-home-feed-collection-schedules.routes";
export type { ProfileSourceAccessCheckRunDto } from "./collector-runtime/profile-source-access-check-runs.routes";

export { toAccountExerciseRunDto } from "./collector-runtime/account-exercise-runs.routes";
export { toCollectionRunDto } from "./collector-runtime/collection-runs.routes";
export { toCollectionScheduleDto } from "./collector-runtime/collection-schedules.routes";
export { toProfileHomeFeedCollectionRunDto } from "./collector-runtime/profile-home-feed-collection-runs.routes";
export { toProfileHomeFeedCollectionScheduleDto } from "./collector-runtime/profile-home-feed-collection-schedules.routes";
export { toProfileSourceAccessCheckRunDto } from "./collector-runtime/profile-source-access-check-runs.routes";

export function registerCollectorRuntimeRoutes(
  server: FastifyInstance,
  options: import("./collector-runtime/collector-runtime-http-service").RegisterCollectorRuntimeRoutesOptions,
): void {
  const { collectorRuntime } = options;

  registerAccountExerciseRunsRoutes(server, collectorRuntime);
  registerCollectionRunsRoutes(server, collectorRuntime);
  registerProfileSourceAccessCheckRunRoutes(
    server,
    collectorRuntime,
    "before-home-feed",
  );
  registerProfileHomeFeedCollectionRunsRoutes(server, collectorRuntime);
  registerProfileSourceAccessCheckRunRoutes(
    server,
    collectorRuntime,
    "after-home-feed",
  );
  registerProfileHomeFeedCollectionSchedulesRoutes(server, collectorRuntime);
  registerCollectionSchedulesRoutes(server, collectorRuntime);
}
