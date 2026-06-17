import { asc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  CollectionScheduleListQuery,
  CollectionScheduleListResult,
  CollectionScheduleRepository,
} from "../../../collector-runtime/application";
import type {
  CollectionSchedule,
  CollectionScheduleSourceGroupId,
} from "../../../collector-runtime/domain";
import type { DatabaseSession } from "../client";
import { toCollectionScheduleDomain, toCollectionScheduleRow } from "../mappers/collector-runtime.mapper";
import { collectorCollectionSchedules } from "../schema/collector-runtime.schema";

export class DrizzleCollectionScheduleRepository
  implements CollectionScheduleRepository
{
  public constructor(private readonly db: DatabaseSession) {}

  public async save(schedule: CollectionSchedule): Promise<void> {
    const row = toCollectionScheduleRow(schedule);

    await this.db
      .insert(collectorCollectionSchedules)
      .values(row)
      .onConflictDoUpdate({
        target: collectorCollectionSchedules.sourceGroupId,
        set: {
          enabled: row.enabled,
          intervalMinutes: row.intervalMinutes,
          nextRunAt: row.nextRunAt,
          parameters: row.parameters,
          updatedAt: row.updatedAt,
        },
      });
  }

  public async findBySourceGroupId(
    sourceGroupId: CollectionScheduleSourceGroupId,
  ): Promise<CollectionSchedule | null> {
    const [row] = await this.db
      .select()
      .from(collectorCollectionSchedules)
      .where(eq(collectorCollectionSchedules.sourceGroupId, sourceGroupId))
      .limit(1);

    return row === undefined ? null : toCollectionScheduleDomain(row);
  }

  public async list(
    query: CollectionScheduleListQuery,
  ): Promise<CollectionScheduleListResult> {
    const where: SQL | undefined = undefined;
    const rows = await this.db
      .select()
      .from(collectorCollectionSchedules)
      .where(where)
      .orderBy(
        asc(collectorCollectionSchedules.nextRunAt),
        asc(collectorCollectionSchedules.sourceGroupId),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(collectorCollectionSchedules)
      .where(where);

    return {
      items: rows.map((row) => toCollectionScheduleDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }
}