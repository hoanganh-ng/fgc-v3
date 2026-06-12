import {
  and,
  asc,
  eq,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type {
  ProfileCheckoutCandidateQuery,
  ProfileListQuery,
  ProfileListResult,
  ProfileRepository,
} from "../../../collector-profile-manager/application";
import type {
  CollectorProfile,
  ProfileId,
} from "../../../collector-profile-manager/domain";
import type { CollectorProfileDatabaseSession } from "../client";
import {
  hashProvisioningToken,
} from "../provisioning-token-hashing";
import {
  collectorProfiles,
} from "../schema/collector-profile-manager.schema";
import {
  toCollectorProfileDomain,
  toCollectorProfileRow,
} from "../mappers/collector-profile.mapper";

export class DrizzleProfileRepository implements ProfileRepository {
  public constructor(private readonly db: CollectorProfileDatabaseSession) {}

  public async save(profile: CollectorProfile): Promise<void> {
    const row = toCollectorProfileRow(profile);

    await this.db
      .insert(collectorProfiles)
      .values(row)
      .onConflictDoUpdate({
        target: collectorProfiles.id,
        set: {
          displayName: row.displayName,
          status: row.status,
          accountStage: row.accountStage,
          provisioningTokenStatus: row.provisioningTokenStatus,
          provisioningTokenHash: row.provisioningTokenHash,
          provisioningTokenIssuedAt: row.provisioningTokenIssuedAt,
          provisioningTokenExpiresAt: row.provisioningTokenExpiresAt,
          provisioningTokenConsumedAt: row.provisioningTokenConsumedAt,
          lastCheckoutAt: row.lastCheckoutAt,
          lastReleasedAt: row.lastReleasedAt,
          nextAvailableAt: row.nextAvailableAt,
          dailyUsageLocalDate: row.dailyUsageLocalDate,
          dailySessionsStarted: row.dailySessionsStarted,
          dailyActiveDurationMinutes: row.dailyActiveDurationMinutes,
          dailyMacroActions: row.dailyMacroActions,
          version: sql`${collectorProfiles.version} + 1`,
          updatedAt: row.updatedAt,
          identityMetadata: row.identityMetadata,
          networkContext: row.networkContext,
          hardwareFingerprint: row.hardwareFingerprint,
          authenticationState: row.authenticationState,
          behavioralPersona: row.behavioralPersona,
          temporalRoutine: row.temporalRoutine,
          safetyThresholds: row.safetyThresholds,
          contentAffinities: row.contentAffinities,
        },
      });
  }

  public async findById(id: ProfileId): Promise<CollectorProfile | null> {
    const [row] = await this.db
      .select()
      .from(collectorProfiles)
      .where(eq(collectorProfiles.id, id))
      .limit(1);

    return row === undefined ? null : toCollectorProfileDomain(row);
  }

  public async listProfiles(
    query: ProfileListQuery,
  ): Promise<ProfileListResult> {
    const offset = query.offset ?? 0;

    if (query.status === undefined) {
      const rows = await this.db
        .select()
        .from(collectorProfiles)
        .orderBy(asc(collectorProfiles.createdAt), asc(collectorProfiles.id))
        .limit(query.limit)
        .offset(offset);
      const [totalRow] = await this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(collectorProfiles);

      return toProfileListResult(rows, totalRow?.total);
    }

    const rows = await this.db
      .select()
      .from(collectorProfiles)
      .where(eq(collectorProfiles.status, query.status))
      .orderBy(asc(collectorProfiles.createdAt), asc(collectorProfiles.id))
      .limit(query.limit)
      .offset(offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(collectorProfiles)
      .where(eq(collectorProfiles.status, query.status));

    return toProfileListResult(rows, totalRow?.total);
  }

  public async findCheckoutCandidates(
    query: ProfileCheckoutCandidateQuery,
  ): Promise<readonly CollectorProfile[]> {
    const baseQuery = this.db
      .select()
      .from(collectorProfiles)
      .where(
        and(
          eq(collectorProfiles.status, query.status),
          or(
            isNull(collectorProfiles.nextAvailableAt),
            lte(collectorProfiles.nextAvailableAt, query.availableAt),
          ),
        ),
      )
      .orderBy(asc(collectorProfiles.createdAt), asc(collectorProfiles.id));
    const rows =
      query.limit === undefined ? await baseQuery : await baseQuery.limit(query.limit);

    return rows.map((row) => toCollectorProfileDomain(row));
  }

  public async findByProvisioningToken(
    token: string,
  ): Promise<CollectorProfile | null> {
    const tokenHash = hashProvisioningToken(token);
    const [row] = await this.db
      .select()
      .from(collectorProfiles)
      .where(
        and(
          eq(collectorProfiles.provisioningTokenStatus, "ISSUED"),
          eq(collectorProfiles.provisioningTokenHash, tokenHash),
        ),
      )
      .limit(1);

    return row === undefined
      ? null
      : toCollectorProfileDomain(row, {
          verifiedProvisioningToken: token,
        });
  }

  public async existsByDisplayName(
    displayName: string,
    excludeProfileId?: ProfileId,
  ): Promise<boolean> {
    const where =
      excludeProfileId === undefined
        ? eq(collectorProfiles.displayName, displayName)
        : and(
            eq(collectorProfiles.displayName, displayName),
            ne(collectorProfiles.id, excludeProfileId),
          );
    const rows = await this.db
      .select({ id: collectorProfiles.id })
      .from(collectorProfiles)
      .where(where)
      .limit(1);

    return rows.length > 0;
  }
}

function toProfileListResult(
  rows: readonly (typeof collectorProfiles.$inferSelect)[],
  totalValue: number | undefined,
): ProfileListResult {
  const items = rows.map((row) => toCollectorProfileDomain(row));

  if (totalValue === undefined) {
    return {
      items,
    };
  }

  return {
    items,
    total: Number(totalValue),
  };
}
