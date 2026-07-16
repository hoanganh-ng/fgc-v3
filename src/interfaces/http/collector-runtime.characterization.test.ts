import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerCollectorRuntimeRoutes } from "./routes/collector-runtime.routes";
import * as routeSchemas from "./schemas/collector-runtime.http-schemas";
import { createFakeCollectorRuntimeHttpService } from "./test-support/collector-runtime-http-service";

const testDirectory = dirname(fileURLToPath(import.meta.url));

interface CollectorRouteInventoryEntry {
  readonly method: string;
  readonly path: string;
  readonly schemaName: string;
}

const EXPECTED_ROUTE_INVENTORY: readonly CollectorRouteInventoryEntry[] = [
  {
    method: "POST",
    path: "/collector/account-exercise-runs",
    schemaName: "requestAccountExerciseRunHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/account-exercise-runs",
    schemaName: "listAccountExerciseRunsHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/account-exercise-runs/:accountExerciseRunId",
    schemaName: "getAccountExerciseRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/account-exercise-runs/:accountExerciseRunId/start",
    schemaName: "startAccountExerciseRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/account-exercise-runs/:accountExerciseRunId/lease",
    schemaName: "attachAccountExerciseRunLeaseHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/account-exercise-runs/:accountExerciseRunId/succeed",
    schemaName: "succeedAccountExerciseRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/account-exercise-runs/:accountExerciseRunId/fail",
    schemaName: "failAccountExerciseRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/account-exercise-runs/:accountExerciseRunId/cancel",
    schemaName: "cancelAccountExerciseRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/collection-runs",
    schemaName: "requestCollectionRunHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/collection-runs",
    schemaName: "listCollectionRunsHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/collection-runs/:collectionRunId",
    schemaName: "getCollectionRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/collection-runs/:collectionRunId/cancel",
    schemaName: "cancelCollectionRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/profile-source-access-check-runs",
    schemaName: "requestProfileSourceAccessCheckRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/profile-home-feed-collection-runs",
    schemaName: "requestProfileHomeFeedCollectionRunHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/profile-home-feed-collection-runs",
    schemaName: "listProfileHomeFeedCollectionRunsHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/profile-home-feed-collection-runs/:profileHomeFeedCollectionRunId",
    schemaName: "getProfileHomeFeedCollectionRunHttpRouteSchema",
  },
  {
    method: "POST",
    path:
      "/collector/profile-home-feed-collection-runs/:profileHomeFeedCollectionRunId/cancel",
    schemaName: "cancelProfileHomeFeedCollectionRunHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/profile-source-access-check-runs",
    schemaName: "listProfileSourceAccessCheckRunsHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/profile-source-access-check-runs/:checkRunId",
    schemaName: "getProfileSourceAccessCheckRunHttpRouteSchema",
  },
  {
    method: "POST",
    path: "/collector/profile-source-access-check-runs/:checkRunId/cancel",
    schemaName: "cancelProfileSourceAccessCheckRunHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/profile-home-feed-collection-schedules",
    schemaName: "listProfileHomeFeedCollectionSchedulesHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/profile-home-feed-collection-schedules/:profileId",
    schemaName: "getProfileHomeFeedCollectionScheduleHttpRouteSchema",
  },
  {
    method: "PUT",
    path: "/collector/profile-home-feed-collection-schedules/:profileId",
    schemaName: "createOrUpdateProfileHomeFeedCollectionScheduleHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/collection-schedules",
    schemaName: "listCollectionSchedulesHttpRouteSchema",
  },
  {
    method: "GET",
    path: "/collector/collection-schedules/:sourceGroupId",
    schemaName: "getCollectionScheduleHttpRouteSchema",
  },
  {
    method: "PUT",
    path: "/collector/collection-schedules/:sourceGroupId",
    schemaName: "upsertCollectionScheduleHttpRouteSchema",
  },
];

const EXPECTED_ROUTES_EXPORTS = [
  "AccountExerciseRunDto",
  "CollectionRunDto",
  "CollectionScheduleDto",
  "CollectorRuntimeHttpService",
  "ProfileHomeFeedCollectionRunDto",
  "ProfileHomeFeedCollectionScheduleDto",
  "ProfileSourceAccessCheckRunDto",
  "RegisterCollectorRuntimeRoutesOptions",
  "registerCollectorRuntimeRoutes",
  "toAccountExerciseRunDto",
  "toCollectionRunDto",
  "toCollectionScheduleDto",
  "toProfileHomeFeedCollectionRunDto",
  "toProfileHomeFeedCollectionScheduleDto",
  "toProfileSourceAccessCheckRunDto",
] as const;

const EXPECTED_SCHEMAS_EXPORTS = [
  "AccountExerciseRunIdHttpParams",
  "AccountExerciseRunIdHttpParamsSchema",
  "AttachAccountExerciseRunLeaseHttpBody",
  "AttachAccountExerciseRunLeaseHttpBodySchema",
  "CollectionRunIdHttpParams",
  "CollectionRunIdHttpParamsSchema",
  "CollectionScheduleSourceGroupIdHttpParams",
  "CollectionScheduleSourceGroupIdHttpParamsSchema",
  "CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBody",
  "CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema",
  "FailAccountExerciseRunHttpBody",
  "FailAccountExerciseRunHttpBodySchema",
  "ListAccountExerciseRunsHttpQuery",
  "ListAccountExerciseRunsHttpQuerySchema",
  "ListCollectionRunsHttpQuery",
  "ListCollectionRunsHttpQuerySchema",
  "ListCollectionSchedulesHttpQuery",
  "ListCollectionSchedulesHttpQuerySchema",
  "ListProfileHomeFeedCollectionRunsHttpQuery",
  "ListProfileHomeFeedCollectionRunsHttpQuerySchema",
  "ListProfileHomeFeedCollectionSchedulesHttpQuery",
  "ListProfileHomeFeedCollectionSchedulesHttpQuerySchema",
  "ListProfileSourceAccessCheckRunsHttpQuery",
  "ListProfileSourceAccessCheckRunsHttpQuerySchema",
  "ProfileHomeFeedCollectionRunIdHttpParams",
  "ProfileHomeFeedCollectionRunIdHttpParamsSchema",
  "ProfileHomeFeedCollectionScheduleProfileIdHttpParams",
  "ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema",
  "ProfileSourceAccessCheckRunIdHttpParams",
  "ProfileSourceAccessCheckRunIdHttpParamsSchema",
  "RequestAccountExerciseRunHttpBody",
  "RequestAccountExerciseRunHttpBodySchema",
  "RequestCollectionRunHttpBody",
  "RequestCollectionRunHttpBodySchema",
  "RequestProfileHomeFeedCollectionRunHttpBody",
  "RequestProfileHomeFeedCollectionRunHttpBodySchema",
  "RequestProfileSourceAccessCheckRunHttpBody",
  "RequestProfileSourceAccessCheckRunHttpBodySchema",
  "StartAccountExerciseRunHttpBody",
  "StartAccountExerciseRunHttpBodySchema",
  "SucceedAccountExerciseRunHttpBody",
  "SucceedAccountExerciseRunHttpBodySchema",
  "UpsertCollectionScheduleHttpBody",
  "UpsertCollectionScheduleHttpBodySchema",
  "attachAccountExerciseRunLeaseHttpRouteSchema",
  "cancelAccountExerciseRunHttpRouteSchema",
  "cancelCollectionRunHttpRouteSchema",
  "cancelProfileHomeFeedCollectionRunHttpRouteSchema",
  "cancelProfileSourceAccessCheckRunHttpRouteSchema",
  "createOrUpdateProfileHomeFeedCollectionScheduleHttpRouteSchema",
  "failAccountExerciseRunHttpRouteSchema",
  "getAccountExerciseRunHttpRouteSchema",
  "getCollectionRunHttpRouteSchema",
  "getCollectionScheduleHttpRouteSchema",
  "getProfileHomeFeedCollectionRunHttpRouteSchema",
  "getProfileHomeFeedCollectionScheduleHttpRouteSchema",
  "getProfileSourceAccessCheckRunHttpRouteSchema",
  "listAccountExerciseRunsHttpRouteSchema",
  "listCollectionRunsHttpRouteSchema",
  "listCollectionSchedulesHttpRouteSchema",
  "listProfileHomeFeedCollectionRunsHttpRouteSchema",
  "listProfileHomeFeedCollectionSchedulesHttpRouteSchema",
  "listProfileSourceAccessCheckRunsHttpRouteSchema",
  "parseHttpInput",
  "requestAccountExerciseRunHttpRouteSchema",
  "requestCollectionRunHttpRouteSchema",
  "requestProfileHomeFeedCollectionRunHttpRouteSchema",
  "requestProfileSourceAccessCheckRunHttpRouteSchema",
  "startAccountExerciseRunHttpRouteSchema",
  "succeedAccountExerciseRunHttpRouteSchema",
  "upsertCollectionScheduleHttpRouteSchema",
] as const;

function collectNamedExportsFromSource(relativePath: string): string[] {
  const source = readFileSync(join(testDirectory, relativePath), "utf8");
  const exportNames = new Set<string>();

  for (const match of source.matchAll(/^export (?:async )?function (\w+)/gm)) {
    exportNames.add(match[1]!);
  }

  for (const match of source.matchAll(/^export interface (\w+)/gm)) {
    exportNames.add(match[1]!);
  }

  for (const match of source.matchAll(/^export const (\w+)/gm)) {
    exportNames.add(match[1]!);
  }

  for (const match of source.matchAll(/^export type (\w+)/gm)) {
    exportNames.add(match[1]!);
  }

  for (const match of source.matchAll(
    /^export type \{([^}]+)\}/gms,
  )) {
    addExportClauseNames(exportNames, match[1]!);
  }

  for (const match of source.matchAll(/^export \{([^}]+)\}/gms)) {
    addExportClauseNames(exportNames, match[1]!);
  }

  return [...exportNames].sort();
}

function addExportClauseNames(
  exportNames: Set<string>,
  clause: string,
): void {
  for (const part of clause.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const typeExport = trimmed.match(/^type\s+(\w+)$/);
    if (typeExport) {
      exportNames.add(typeExport[1]!);
      continue;
    }

    const aliasMatch = trimmed.match(/^(?:\w+\s+as\s+)?(\w+)$/);
    if (aliasMatch) {
      exportNames.add(aliasMatch[1]!);
    }
  }
}

function resolveSchemaName(schema: unknown): string {
  if (schema === undefined || schema === null) {
    return "none";
  }

  for (const [name, value] of Object.entries(routeSchemas)) {
    if (value === schema) {
      return name;
    }
  }

  return "unknown";
}

async function collectCollectorRouteInventory(): Promise<
  CollectorRouteInventoryEntry[]
> {
  const inventory: CollectorRouteInventoryEntry[] = [];
  const server = fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
    logger: false,
  });

  server.addHook("onRoute", (routeOptions) => {
    if (!routeOptions.url.startsWith("/collector/")) {
      return;
    }

    if (routeOptions.method === "HEAD") {
      return;
    }

    inventory.push({
      method: String(routeOptions.method),
      path: routeOptions.url,
      schemaName: resolveSchemaName(routeOptions.schema),
    });
  });

  registerCollectorRuntimeRoutes(server, {
    collectorRuntime: createFakeCollectorRuntimeHttpService(),
  });
  await server.ready();
  await server.close();

  return inventory;
}

describe("Collector Runtime HTTP characterization", () => {
  it("preserves the exact collector HTTP method/path inventory", async () => {
    const inventory = await collectCollectorRouteInventory();

    const observed = inventory.map((entry) => ({
      method: entry.method,
      path: entry.path,
    }));
    const expected = EXPECTED_ROUTE_INVENTORY.map((entry) => ({
      method: entry.method,
      path: entry.path,
    }));

    expect(observed).toEqual(expected);
  });

  it("associates the expected route schema for every collector route", async () => {
    const inventory = await collectCollectorRouteInventory();

    expect(inventory).toEqual([...EXPECTED_ROUTE_INVENTORY]);
  });

  it("preserves the public named-export inventory of the routes entry file", () => {
    expect(
      collectNamedExportsFromSource("routes/collector-runtime.routes.ts"),
    ).toEqual([...EXPECTED_ROUTES_EXPORTS].sort());
  });

  it("preserves the public named-export inventory of the schemas entry file", () => {
    expect(
      collectNamedExportsFromSource("schemas/collector-runtime.http-schemas.ts"),
    ).toEqual([...EXPECTED_SCHEMAS_EXPORTS].sort());
  });
});
