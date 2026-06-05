import type {
  Clock,
  LeaseIdGenerator,
  TokenGenerator,
} from "../../collector-profile-manager/application";
import { loadCompositionConfig } from "../config";
import type { CompositionEnvironment } from "../config";
import {
  createDatabaseClient,
  DrizzleProfileLeaseRepository,
  DrizzleProfileRepository,
  DrizzleTransactionManager,
} from "../../infrastructure/database";
import type {
  CreateDatabaseClientOptions,
  DatabaseClient,
} from "../../infrastructure/database";
import {
  CryptoLeaseIdGenerator,
  CryptoTokenGenerator,
  SystemClock,
} from "../../infrastructure/system";
import {
  createCollectorProfileManager,
} from "./collector-profile-manager.container";
import type {
  CollectorProfileManagerContainer,
} from "./collector-profile-manager.container";

export interface CreateCollectorProfileManagerOptions {
  readonly databaseUrl: string;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly tokenGenerator?: TokenGenerator;
  readonly leaseIdGenerator?: LeaseIdGenerator;
}

export interface CreateCollectorProfileManagerFromEnvOptions {
  readonly environment?: CompositionEnvironment;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly tokenGenerator?: TokenGenerator;
  readonly leaseIdGenerator?: LeaseIdGenerator;
}

export type CollectorProfileManagerService = CollectorProfileManagerContainer;

export function createCollectorProfileManagerFromEnv(
  options: CreateCollectorProfileManagerFromEnvOptions = {},
): CollectorProfileManagerService {
  const config = loadCompositionConfig(options.environment);

  return createCollectorProfileManagerFromDatabase({
    databaseUrl: config.databaseUrl,
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
    ...(options.clock !== undefined ? { clock: options.clock } : {}),
    ...(options.tokenGenerator !== undefined
      ? { tokenGenerator: options.tokenGenerator }
      : {}),
    ...(options.leaseIdGenerator !== undefined
      ? { leaseIdGenerator: options.leaseIdGenerator }
      : {}),
  });
}

export function createCollectorProfileManagerFromDatabase(
  options: CreateCollectorProfileManagerOptions,
): CollectorProfileManagerService {
  const clientOptions = {
    databaseUrl: options.databaseUrl,
    ...(options.poolConfig !== undefined
      ? { poolConfig: options.poolConfig }
      : {}),
  } satisfies CreateDatabaseClientOptions;

  return createCollectorProfileManagerFromDatabaseClient(
    createDatabaseClient(clientOptions),
    options,
  );
}

export function createCollectorProfileManagerFromDatabaseClient(
  databaseClient: DatabaseClient,
  overrides: Partial<
    Pick<
      CreateCollectorProfileManagerOptions,
      "clock" | "tokenGenerator" | "leaseIdGenerator"
    >
  > = {},
): CollectorProfileManagerService {
  const profiles = new DrizzleProfileRepository(databaseClient.db);
  const leases = new DrizzleProfileLeaseRepository(databaseClient.db);
  const transactionManager = new DrizzleTransactionManager(databaseClient.db);

  return createCollectorProfileManager({
    profiles,
    leases,
    transactionManager,
    clock: overrides.clock ?? new SystemClock(),
    tokenGenerator: overrides.tokenGenerator ?? new CryptoTokenGenerator(),
    leaseIdGenerator:
      overrides.leaseIdGenerator ?? new CryptoLeaseIdGenerator(),
    close: () => databaseClient.close(),
  });
}
