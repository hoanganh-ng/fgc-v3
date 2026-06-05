import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PoolConfig } from "pg";
import * as schema from "./schema/collector-profile-manager.schema";

export type DatabaseSchema = typeof schema;
export type CollectorProfileDatabase = NodePgDatabase<DatabaseSchema>;
export type CollectorProfileTransaction = Parameters<
  Parameters<CollectorProfileDatabase["transaction"]>[0]
>[0];
export type CollectorProfileDatabaseSession =
  | CollectorProfileDatabase
  | CollectorProfileTransaction;

export interface CreateDatabaseClientOptions {
  readonly databaseUrl?: string;
  readonly poolConfig?: Omit<PoolConfig, "connectionString">;
}

export interface DatabaseClient {
  readonly pool: Pool;
  readonly db: CollectorProfileDatabase;
  close(): Promise<void>;
}

export function createDatabaseClient(
  options: CreateDatabaseClientOptions = {},
): DatabaseClient {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL is required to create the database client.");
  }

  const pool = new Pool({
    ...options.poolConfig,
    connectionString: databaseUrl,
  });
  const db = drizzle(pool, { schema });

  return {
    pool,
    db,
    close: () => pool.end(),
  };
}
