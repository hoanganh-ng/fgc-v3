import { and, desc, eq } from "drizzle-orm";
import type {
  ProfileSourceAccessRepository,
} from "../../../collector-profile-manager/application";
import type {
  ProfileId,
  ProfileSourceAccess,
  ProfileSourceAccessSourceGroupId,
} from "../../../collector-profile-manager/domain";
import type { CollectorProfileDatabaseSession } from "../client";
import {
  toProfileSourceAccessDomain,
  toProfileSourceAccessRow,
} from "../mappers/profile-source-access.mapper";
import {
  collectorProfileSourceAccess,
} from "../schema/collector-profile-manager.schema";

export class DrizzleProfileSourceAccessRepository
  implements ProfileSourceAccessRepository
{
  public constructor(private readonly db: CollectorProfileDatabaseSession) {}

  public async upsert(
    profileSourceAccess: ProfileSourceAccess,
  ): Promise<void> {
    const row = toProfileSourceAccessRow(profileSourceAccess);

    await this.db
      .insert(collectorProfileSourceAccess)
      .values(row)
      .onConflictDoUpdate({
        target: [
          collectorProfileSourceAccess.profileId,
          collectorProfileSourceAccess.sourceGroupId,
        ],
        set: {
          accessState: row.accessState,
          lastCheckedAt: row.lastCheckedAt,
          lastSuccessfulAt: row.lastSuccessfulAt,
          lastFailureReason: row.lastFailureReason,
          joinRequestedAt: row.joinRequestedAt,
          notes: row.notes,
          updatedAt: row.updatedAt,
        },
      });
  }

  public async getByProfileAndSourceGroup(
    profileId: ProfileId,
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<ProfileSourceAccess | null> {
    const [row] = await this.db
      .select()
      .from(collectorProfileSourceAccess)
      .where(
        and(
          eq(collectorProfileSourceAccess.profileId, profileId),
          eq(collectorProfileSourceAccess.sourceGroupId, sourceGroupId),
        ),
      )
      .limit(1);

    return row === undefined ? null : toProfileSourceAccessDomain(row);
  }

  public async listByProfile(
    profileId: ProfileId,
  ): Promise<readonly ProfileSourceAccess[]> {
    const rows = await this.db
      .select()
      .from(collectorProfileSourceAccess)
      .where(eq(collectorProfileSourceAccess.profileId, profileId))
      .orderBy(
        desc(collectorProfileSourceAccess.updatedAt),
        desc(collectorProfileSourceAccess.id),
      );

    return rows.map((row) => toProfileSourceAccessDomain(row));
  }

  public async listBySourceGroup(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<readonly ProfileSourceAccess[]> {
    const rows = await this.db
      .select()
      .from(collectorProfileSourceAccess)
      .where(eq(collectorProfileSourceAccess.sourceGroupId, sourceGroupId))
      .orderBy(
        desc(collectorProfileSourceAccess.updatedAt),
        desc(collectorProfileSourceAccess.id),
      );

    return rows.map((row) => toProfileSourceAccessDomain(row));
  }
}
