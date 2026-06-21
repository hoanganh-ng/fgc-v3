import { and, asc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  ProfileHomeFeedCollectionScheduleListQuery,
  ProfileHomeFeedCollectionScheduleListResult,
  ProfileHomeFeedCollectionScheduleRepository,
} from "../../../collector-runtime/application";
import type {
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../../../collector-runtime/domain";
import type { DatabaseSession } from "../client";
import {
  toDomainProfileHomeFeedCollectionSchedule,
  toProfileHomeFeedCollectionScheduleRecord,
} from "../mappers/profile-home-feed-collection-schedule.mapper";
import { profileHomeFeedCollectionSchedules } from "../schema/collector-runtime.schema";

export class DrizzleProfileHomeFeedCollectionScheduleRepository
  implements ProfileHomeFeedCollectionScheduleRepository
{
  public constructor(private readonly db: DatabaseSession) {}

  public async save(
    schedule: ProfileHomeFeedCollectionSchedule,
  ): Promise<void> {
    const record = toProfileHomeFeedCollectionScheduleRecord(schedule);

    await this.db
      .insert(profileHomeFeedCollectionSchedules)
      .values(record)
      .onConflictDoUpdate({
        target: profileHomeFeedCollectionSchedules.profileId,
        set: {
          enabled: record.enabled,
          intervalMinutes: record.intervalMinutes,
          nextRunAt: record.nextRunAt,
          parameters: record.parameters,
          lastAttemptedAt: record.lastAttemptedAt,
          lastDispatchStatus: record.lastDispatchStatus,
          lastFailureReason: record.lastFailureReason,
          consecutiveFailures: record.consecutiveFailures,
          updatedAt: record.updatedAt,
        },
      });
  }

  public async findByProfileId(
    profileId: ProfileHomeFeedCollectionScheduleProfileId,
  ): Promise<ProfileHomeFeedCollectionSchedule | null> {
    const [row] = await this.db
      .select()
      .from(profileHomeFeedCollectionSchedules)
      .where(eq(profileHomeFeedCollectionSchedules.profileId, profileId))
      .limit(1);

    return row === undefined
      ? null
      : toDomainProfileHomeFeedCollectionSchedule(row);
  }

  public async list(
    query: ProfileHomeFeedCollectionScheduleListQuery,
  ): Promise<ProfileHomeFeedCollectionScheduleListResult> {
    const where = getListWhere(query);
    const rows = await this.db
      .select()
      .from(profileHomeFeedCollectionSchedules)
      .where(where)
      .orderBy(
        asc(profileHomeFeedCollectionSchedules.nextRunAt),
        asc(profileHomeFeedCollectionSchedules.profileId),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(profileHomeFeedCollectionSchedules)
      .where(where);

    return {
      items: rows.map(toDomainProfileHomeFeedCollectionSchedule),
      total: Number(totalRow?.total ?? 0),
    };
  }
}

function getListWhere(
  query: ProfileHomeFeedCollectionScheduleListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.enabled !== undefined) {
    conditions.push(
      eq(profileHomeFeedCollectionSchedules.enabled, query.enabled),
    );
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}
