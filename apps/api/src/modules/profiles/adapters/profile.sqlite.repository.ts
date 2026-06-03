import { randomUUID } from 'node:crypto';

import type { Profile, ProfileStatus } from '../domain/index.js';
import type { IProfileRepository } from '../ports/profile.repository.interface.js';

export const PROFILE_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provisioningToken TEXT,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastLoginAt TEXT,
  lastActivityAt TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_provisioning_token
  ON profiles (provisioningToken);
`;

const SAVE_PROFILE_SQL = `
INSERT INTO profiles (
  id,
  name,
  provisioningToken,
  status,
  createdAt,
  updatedAt,
  lastLoginAt,
  lastActivityAt,
  payload
) VALUES (
  @id,
  @name,
  @provisioningToken,
  @status,
  @createdAt,
  @updatedAt,
  @lastLoginAt,
  @lastActivityAt,
  @payload
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  provisioningToken = excluded.provisioningToken,
  status = excluded.status,
  createdAt = excluded.createdAt,
  updatedAt = excluded.updatedAt,
  lastLoginAt = excluded.lastLoginAt,
  lastActivityAt = excluded.lastActivityAt,
  payload = excluded.payload;
`;

const FIND_PROFILE_BY_PROVISIONING_TOKEN_SQL = `
SELECT
  id,
  name,
  provisioningToken,
  status,
  createdAt,
  updatedAt,
  lastLoginAt,
  lastActivityAt,
  payload
FROM profiles
WHERE provisioningToken = @provisioningToken
LIMIT 1;
`;

export interface SqliteStatement<Row = unknown> {
  run(parameters?: Record<string, unknown>): unknown;
  get(parameters?: Record<string, unknown>): Row | undefined;
}

export interface SqliteDatabase {
  prepare<Row = unknown>(sql: string): SqliteStatement<Row>;
}

interface ProfileRow {
  id: string;
  name: string;
  provisioningToken: string | null;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  payload: string;
}

interface SerializedProfilePayload {
  networkIdentity: Profile['networkIdentity'];
  hardwareFingerprint: Profile['hardwareFingerprint'];
  authSessionState: Profile['authSessionState'];
  behavioralPersona: Profile['behavioralPersona'];
  contentPreferences: Profile['contentPreferences'];
  routine: Profile['routine'];
  lifecycle: Omit<Profile['lifecycle'], 'accountCreatedAt'> & {
    accountCreatedAt: string;
  };
}

export class ProfileSqliteRepository implements IProfileRepository {
  private readonly saveStatement: SqliteStatement;
  private readonly findByProvisioningTokenStatement: SqliteStatement<ProfileRow>;

  constructor(private readonly database: SqliteDatabase) {
    this.saveStatement = this.database.prepare(SAVE_PROFILE_SQL);
    this.findByProvisioningTokenStatement = this.database.prepare<ProfileRow>(
      FIND_PROFILE_BY_PROVISIONING_TOKEN_SQL,
    );
  }

  async save(profile: Profile): Promise<void> {
    const { administrativeMetadata } = profile;

    this.saveStatement.run({
      id: administrativeMetadata.id,
      name: administrativeMetadata.name,
      provisioningToken: administrativeMetadata.provisioningToken,
      status: administrativeMetadata.status,
      createdAt: administrativeMetadata.createdAt.toISOString(),
      updatedAt: administrativeMetadata.updatedAt.toISOString(),
      lastLoginAt: this.serializeNullableDate(administrativeMetadata.lastLoginAt),
      lastActivityAt: this.serializeNullableDate(administrativeMetadata.lastActivityAt),
      payload: JSON.stringify(this.serializePayload(profile)),
    });
  }

  async findByProvisioningToken(token: string): Promise<Profile | null> {
    const row = this.findByProvisioningTokenStatement.get({
      provisioningToken: token,
    });

    if (row === undefined) {
      return null;
    }

    return this.toDomain(row);
  }

  generateId(): string {
    return randomUUID();
  }

  private serializePayload(profile: Profile): SerializedProfilePayload {
    return {
      networkIdentity: profile.networkIdentity,
      hardwareFingerprint: profile.hardwareFingerprint,
      authSessionState: profile.authSessionState,
      behavioralPersona: profile.behavioralPersona,
      contentPreferences: profile.contentPreferences,
      routine: profile.routine,
      lifecycle: {
        ...profile.lifecycle,
        accountCreatedAt: profile.lifecycle.accountCreatedAt.toISOString(),
      },
    };
  }

  private toDomain(row: ProfileRow): Profile {
    const payload = JSON.parse(row.payload) as SerializedProfilePayload;

    return {
      administrativeMetadata: {
        id: row.id,
        name: row.name,
        provisioningToken: row.provisioningToken,
        status: row.status,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        lastLoginAt: this.parseNullableDate(row.lastLoginAt),
        lastActivityAt: this.parseNullableDate(row.lastActivityAt),
      },
      networkIdentity: payload.networkIdentity,
      hardwareFingerprint: payload.hardwareFingerprint,
      authSessionState: payload.authSessionState,
      behavioralPersona: payload.behavioralPersona,
      contentPreferences: payload.contentPreferences,
      routine: payload.routine,
      lifecycle: {
        ...payload.lifecycle,
        accountCreatedAt: new Date(payload.lifecycle.accountCreatedAt),
      },
    };
  }

  private serializeNullableDate(date: Date | null): string | null {
    return date === null ? null : date.toISOString();
  }

  private parseNullableDate(value: string | null): Date | null {
    return value === null ? null : new Date(value);
  }
}
