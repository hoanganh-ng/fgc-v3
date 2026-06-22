import type { Clock, IdGenerator } from "../../content-builder/application";
import {
  createDatabaseClient,
  DrizzleTransformTypeRepository,
} from "../../infrastructure/database";
import type {
  CreateDatabaseClientOptions,
  DatabaseClient,
} from "../../infrastructure/database";
import { CryptoIdGenerator, SystemClock } from "../../infrastructure/system";
import { loadCompositionConfig } from "../config";
import type { CompositionEnvironment } from "../config";
import { createContentBuilder } from "./content-builder.container";
import type { ContentBuilderContainer } from "./content-builder.container";

export interface CreateContentBuilderOptions {
  readonly databaseUrl: string;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export interface CreateContentBuilderFromEnvOptions {
  readonly environment?: CompositionEnvironment;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export type ContentBuilderService = ContentBuilderContainer;

export function createContentBuilderFromEnv(
  options: CreateContentBuilderFromEnvOptions = {},
): ContentBuilderService {
  const config = loadCompositionConfig(options.environment);

  return createContentBuilderFromDatabase({
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

export function createContentBuilderFromDatabase(
  options: CreateContentBuilderOptions,
): ContentBuilderService {
  const clientOptions = {
    databaseUrl: options.databaseUrl,
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
  } satisfies CreateDatabaseClientOptions;

  return createContentBuilderFromDatabaseClient(
    createDatabaseClient(clientOptions),
    options,
  );
}

export function createContentBuilderFromDatabaseClient(
  databaseClient: DatabaseClient,
  overrides: Partial<
    Pick<CreateContentBuilderOptions, "clock" | "idGenerator">
  > = {},
): ContentBuilderService {
  const transformTypes = new DrizzleTransformTypeRepository(databaseClient.db);

  return createContentBuilder({
    transformTypes,
    clock: overrides.clock ?? new SystemClock(),
    idGenerator: overrides.idGenerator ?? new CryptoIdGenerator(),
    close: () => databaseClient.close(),
  });
}
