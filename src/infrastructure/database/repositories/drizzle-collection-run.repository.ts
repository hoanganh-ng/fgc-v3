import { and, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  CollectionRunListQuery,
  CollectionRunListResult,
  CollectionRunRepository,
} from "../../../collector-runtime/application";
import type {
  CollectionRun,
  CollectionRunId,
} from "../../../collector-runtime/domain";
import type { DatabaseSession } from "../client";
import {
  toCollectionRunDomain,
  toCollectionRunRow,
} from "../mappers/collector-runtime.mapper";
import { collectorCollectionRuns } from "../schema/collector-runtime.schema";

export class DrizzleCollectionRunRepository
  implements CollectionRunRepository
{
  public constructor(private readonly db: DatabaseSession) {}

  public async save(collectionRun: CollectionRun): Promise<void> {
    const row = toCollectionRunRow(collectionRun);

    await this.db
      .insert(collectorCollectionRuns)
      .values(row)
      .onConflictDoUpdate({
        target: collectorCollectionRuns.id,
        set: {
          sourceGroupId: row.sourceGroupId,
          status: row.status,
          triggerType: row.triggerType,
          parameters: row.parameters,
          summary: row.summary,
          failureReason: row.failureReason,
          requestedAt: row.requestedAt,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
  }

  public async findById(
    id: CollectionRunId,
  ): Promise<CollectionRun | null> {
    const [row] = await this.db
      .select()
      .from(collectorCollectionRuns)
      .where(eq(collectorCollectionRuns.id, id))
      .limit(1);

    return row === undefined ? null : toCollectionRunDomain(row);
  }

  public async list(
    query: CollectionRunListQuery,
  ): Promise<CollectionRunListResult> {
    const where = getCollectionRunListWhere(query);
    const rows = await this.db
      .select()
      .from(collectorCollectionRuns)
      .where(where)
      .orderBy(
        desc(collectorCollectionRuns.createdAt),
        desc(collectorCollectionRuns.id),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(collectorCollectionRuns)
      .where(where);

    return {
      items: rows.map((row) => toCollectionRunDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }
}

function getCollectionRunListWhere(
  query: CollectionRunListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(collectorCollectionRuns.status, query.status));
  }

  if (query.sourceGroupId !== undefined) {
    conditions.push(
      eq(collectorCollectionRuns.sourceGroupId, query.sourceGroupId),
    );
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}
