import type { Clock, IdGenerator } from "../../content-manager/application";
import {
  createDatabaseClient,
  DrizzleContentCategoryRepository,
  DrizzleContentItemRepository,
  DrizzleSourceGroupRepository,
} from "../../infrastructure/database";
import type {
  CreateDatabaseClientOptions,
  DatabaseClient,
} from "../../infrastructure/database";
import { CryptoIdGenerator, SystemClock } from "../../infrastructure/system";
import { loadCompositionConfig } from "../config";
import type { CompositionEnvironment } from "../config";
import { createContentManager } from "./content-manager.container";
import type { ContentManagerContainer } from "./content-manager.container";

export interface CreateContentManagerOptions {
  readonly databaseUrl: string;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export interface CreateContentManagerFromEnvOptions {
  readonly environment?: CompositionEnvironment;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export type ContentManagerService = ContentManagerContainer;

export function createContentManagerFromEnv(
  options: CreateContentManagerFromEnvOptions = {},
): ContentManagerService {
  const config = loadCompositionConfig(options.environment);

  return createContentManagerFromDatabase({
    databaseUrl: config.databaseUrl,
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
    ...(options.clock !== undefined ? { clock: options.clock } : {}),
    ...(options.idGenerator !== undefined
      ? { idGenerator: options.idGenerator }
      : {}),
  });
}

export function createContentManagerFromDatabase(
  options: CreateContentManagerOptions,
): ContentManagerService {
  const clientOptions = {
    databaseUrl: options.databaseUrl,
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
  } satisfies CreateDatabaseClientOptions;

  return createContentManagerFromDatabaseClient(
    createDatabaseClient(clientOptions),
    options,
  );
}

export function createContentManagerFromDatabaseClient(
  databaseClient: DatabaseClient,
  overrides: Partial<
    Pick<CreateContentManagerOptions, "clock" | "idGenerator">
  > = {},
): ContentManagerService {
  const categories = new DrizzleContentCategoryRepository(databaseClient.db);
  const sourceGroups = new DrizzleSourceGroupRepository(databaseClient.db);
  const contentItems = new DrizzleContentItemRepository(databaseClient.db);

  return createContentManager({
    categories,
    sourceGroups,
    contentItems,
    clock: overrides.clock ?? new SystemClock(),
    idGenerator: overrides.idGenerator ?? new CryptoIdGenerator(),
    close: () => databaseClient.close(),
  });
}
