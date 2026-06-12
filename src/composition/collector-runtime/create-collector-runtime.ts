import type {
  Clock,
  IdGenerator,
  SourceGroupLookupPort,
} from "../../collector-runtime/application";
import { ContentManagerHttpClient } from "../../collector-runtime/infrastructure";
import {
  DrizzleCollectionRunRepository,
  createDatabaseClient,
} from "../../infrastructure/database";
import type {
  CreateDatabaseClientOptions,
  DatabaseClient,
} from "../../infrastructure/database";
import { CryptoIdGenerator, SystemClock } from "../../infrastructure/system";
import { loadCompositionConfig } from "../config";
import type { CompositionEnvironment } from "../config";
import { createCollectorRuntime } from "./collector-runtime.container";
import type { CollectorRuntimeContainer } from "./collector-runtime.container";

export interface CollectorRuntimeEnvironment
  extends CompositionEnvironment {
  readonly CONTENT_MANAGER_BASE_URL?: string;
  readonly HTTP_PORT?: string;
}

export interface CreateCollectorRuntimeOptions {
  readonly databaseUrl: string;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly sourceGroupLookupPort?: SourceGroupLookupPort;
  readonly contentManagerBaseUrl?: string;
}

export interface CreateCollectorRuntimeFromEnvOptions {
  readonly environment?: CollectorRuntimeEnvironment;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly sourceGroupLookupPort?: SourceGroupLookupPort;
}

export type CollectorRuntimeService = CollectorRuntimeContainer;

export function createCollectorRuntimeFromEnv(
  options: CreateCollectorRuntimeFromEnvOptions = {},
): CollectorRuntimeService {
  const environment = options.environment ?? process.env;
  const config = loadCompositionConfig(environment);

  return createCollectorRuntimeFromDatabase({
    databaseUrl: config.databaseUrl,
    contentManagerBaseUrl: loadContentManagerBaseUrl(environment),
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
    ...(options.clock !== undefined ? { clock: options.clock } : {}),
    ...(options.idGenerator !== undefined
      ? { idGenerator: options.idGenerator }
      : {}),
    ...(options.sourceGroupLookupPort !== undefined
      ? { sourceGroupLookupPort: options.sourceGroupLookupPort }
      : {}),
  });
}

export function createCollectorRuntimeFromDatabase(
  options: CreateCollectorRuntimeOptions,
): CollectorRuntimeService {
  const clientOptions = {
    databaseUrl: options.databaseUrl,
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
  } satisfies CreateDatabaseClientOptions;

  return createCollectorRuntimeFromDatabaseClient(
    createDatabaseClient(clientOptions),
    options,
  );
}

export function createCollectorRuntimeFromDatabaseClient(
  databaseClient: DatabaseClient,
  overrides: Partial<
    Pick<
      CreateCollectorRuntimeOptions,
      "clock" | "idGenerator" | "sourceGroupLookupPort" | "contentManagerBaseUrl"
    >
  > = {},
): CollectorRuntimeService {
  const collectionRuns = new DrizzleCollectionRunRepository(databaseClient.db);
  const sourceGroups =
    overrides.sourceGroupLookupPort ??
    new ContentManagerHttpClient({
      baseUrl: overrides.contentManagerBaseUrl ?? DEFAULT_CONTENT_MANAGER_BASE_URL,
    });

  return createCollectorRuntime({
    collectionRuns,
    sourceGroups,
    clock: overrides.clock ?? new SystemClock(),
    idGenerator: overrides.idGenerator ?? new CryptoIdGenerator(),
    close: () => databaseClient.close(),
  });
}

const DEFAULT_CONTENT_MANAGER_BASE_URL = "http://127.0.0.1:3000";

function loadContentManagerBaseUrl(
  environment: CollectorRuntimeEnvironment,
): string {
  const configuredBaseUrl = environment.CONTENT_MANAGER_BASE_URL?.trim();

  if (configuredBaseUrl !== undefined && configuredBaseUrl !== "") {
    return configuredBaseUrl;
  }

  const rawPort = environment.HTTP_PORT?.trim() ?? "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_CONTENT_MANAGER_BASE_URL;
  }

  return `http://127.0.0.1:${port}`;
}
