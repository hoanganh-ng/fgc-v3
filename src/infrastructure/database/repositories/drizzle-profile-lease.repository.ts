import { and, eq, sql } from "drizzle-orm";
import type {
  ProfileLeaseRepository,
} from "../../../collector-profile-manager/application";
import type {
  ProfileId,
  ProfileLease,
  ProfileLeaseId,
} from "../../../collector-profile-manager/domain";
import type { CollectorProfileDatabaseSession } from "../client";
import {
  toProfileLeaseDomain,
  toProfileLeaseInsert,
} from "../mappers/profile-lease.mapper";
import {
  collectorProfileLeases,
} from "../schema/collector-profile-manager.schema";

export class DrizzleProfileLeaseRepository implements ProfileLeaseRepository {
  public constructor(private readonly db: CollectorProfileDatabaseSession) {}

  public async save(lease: ProfileLease): Promise<void> {
    const row = toProfileLeaseInsert(lease);

    await this.db
      .insert(collectorProfileLeases)
      .values(row)
      .onConflictDoUpdate({
        target: collectorProfileLeases.id,
        set: {
          profileId: row.profileId,
          purpose: row.purpose,
          status: row.status,
          leasedAt: row.leasedAt,
          expiresAt: row.expiresAt,
          releasedAt: row.releasedAt,
          updatedAt: sql`now()`,
        },
      });
  }

  public async findById(id: ProfileLeaseId): Promise<ProfileLease | null> {
    const [row] = await this.db
      .select()
      .from(collectorProfileLeases)
      .where(eq(collectorProfileLeases.id, id))
      .limit(1);

    return row === undefined ? null : toProfileLeaseDomain(row);
  }

  public async findActiveByProfileId(
    profileId: ProfileId,
  ): Promise<ProfileLease | null> {
    const [row] = await this.db
      .select()
      .from(collectorProfileLeases)
      .where(
        and(
          eq(collectorProfileLeases.profileId, profileId),
          eq(collectorProfileLeases.status, "ACTIVE"),
        ),
      )
      .limit(1);

    return row === undefined ? null : toProfileLeaseDomain(row);
  }

  public async updateStatus(lease: ProfileLease): Promise<void> {
    const row = toProfileLeaseInsert(lease);

    await this.db
      .update(collectorProfileLeases)
      .set({
        status: row.status,
        releasedAt: row.releasedAt,
        updatedAt: sql`now()`,
      })
      .where(eq(collectorProfileLeases.id, row.id));
  }
}
