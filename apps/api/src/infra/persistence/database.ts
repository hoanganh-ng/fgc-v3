import { Kysely, PostgresDialect, type ColumnType } from "kysely";
import { Pool } from "pg";
import type { ProfileStatus } from "@dtpm/core";

export interface ProfilesTable {
  id: ColumnType<string, string, never>;
  status: ProfileStatus;
  version: number;
  pillars: unknown;
  provisioning_token_hash: string | null;
  provisioning_token_expires_at: ColumnType<Date | null, Date | null, Date | null>;
  next_available_window_at: ColumnType<Date | null, Date | null, Date | null>;
  daily_safety_metrics: unknown;
  active_lease: unknown | null;
  created_at: ColumnType<Date, Date, never>;
  updated_at: ColumnType<Date, Date, Date>;
}

export interface Database {
  profiles: ProfilesTable;
}

export function createDatabase(databaseUrl: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl
      })
    })
  });
}
