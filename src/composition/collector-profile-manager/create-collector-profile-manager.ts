import type {
  Clock,
  IdGenerator,
  LeaseIdGenerator,
  SourceGroupReferencePort,
  TokenGenerator,
} from "../../collector-profile-manager/application";
import { loadCompositionConfig } from "../config";
import type { CompositionEnvironment } from "../config";
import {
  createDatabaseClient,
  DrizzleProfileLeaseRepository,
  DrizzleProfileRepository,
  DrizzleProfileSourceAccessRepository,
  DrizzleTransactionManager,
} from "../../infrastructure/database";
import type {
  CreateDatabaseClientOptions,
  DatabaseClient,
} from "../../infrastructure/database";
import {
  CryptoIdGenerator,
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
  readonly sourceGroupReference: SourceGroupReferencePort;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly tokenGenerator?: TokenGenerator;
  readonly leaseIdGenerator?: LeaseIdGenerator;
  readonly idGenerator?: IdGenerator;
}

export interface CreateCollectorProfileManagerFromEnvOptions {
  readonly sourceGroupReference: SourceGroupReferencePort;
  readonly environment?: CompositionEnvironment;
  readonly poolConfig?: CreateDatabaseClientOptions["poolConfig"];
  readonly clock?: Clock;
  readonly tokenGenerator?: TokenGenerator;
  readonly leaseIdGenerator?: LeaseIdGenerator;
  readonly idGenerator?: IdGenerator;
}

export type CollectorProfileManagerService = CollectorProfileManagerContainer;

export function createCollectorProfileManagerFromEnv(
  options: CreateCollectorProfileManagerFromEnvOptions,
): CollectorProfileManagerService {
  const config = loadCompositionConfig(options.environment);

  return createCollectorProfileManagerFromDatabase({
    databaseUrl: config.databaseUrl,
    sourceGroupReference: options.sourceGroupReference,
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
    ...(options.idGenerator !== undefined
      ? { idGenerator: options.idGenerator }
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
    options.sourceGroupReference,
    options,
  );
}

export function createCollectorProfileManagerFromDatabaseClient(
  databaseClient: DatabaseClient,
  sourceGroupReference: SourceGroupReferencePort,
  overrides: Partial<
    Pick<
      CreateCollectorProfileManagerOptions,
      "clock" | "tokenGenerator" | "leaseIdGenerator" | "idGenerator"
    >
  > = {},
): CollectorProfileManagerService {
  const profiles = new DrizzleProfileRepository(databaseClient.db);
  const leases = new DrizzleProfileLeaseRepository(databaseClient.db);
  const profileSourceAccess = new DrizzleProfileSourceAccessRepository(
    databaseClient.db,
  );
  const transactionManager = new DrizzleTransactionManager(databaseClient.db);

  return createCollectorProfileManager({
    profiles,
    leases,
    profileSourceAccess,
    sourceGroupReference,
    transactionManager,
    clock: overrides.clock ?? new SystemClock(),
    tokenGenerator: overrides.tokenGenerator ?? new CryptoTokenGenerator(),
    leaseIdGenerator:
      overrides.leaseIdGenerator ?? new CryptoLeaseIdGenerator(),
    idGenerator: overrides.idGenerator ?? new CryptoIdGenerator(),
    close: () => databaseClient.close(),
  });
}
