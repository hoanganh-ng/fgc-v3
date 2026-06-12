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
  CollectionRunIsoDateTime,
} from "../../../collector-runtime/domain";
import type { DatabaseSession } from "../client";
import {
  type CollectionRunRow,
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

  public async claimNextQueued(
    startedAt: CollectionRunIsoDateTime,
  ): Promise<CollectionRun | null> {
    const result = await this.db.execute<CollectionRunRow>(sql`
      WITH next_run AS (
        SELECT id
        FROM collector_collection_runs
        WHERE status = 'QUEUED'
        ORDER BY requested_at ASC, created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE collector_collection_runs
      SET
        status = 'RUNNING',
        started_at = ${startedAt},
        updated_at = ${startedAt}
      FROM next_run
      WHERE collector_collection_runs.id = next_run.id
      RETURNING
        collector_collection_runs.id,
        collector_collection_runs.source_group_id AS "sourceGroupId",
        collector_collection_runs.status,
        collector_collection_runs.trigger_type AS "triggerType",
        collector_collection_runs.parameters,
        collector_collection_runs.summary,
        collector_collection_runs.failure_reason AS "failureReason",
        collector_collection_runs.requested_at AS "requestedAt",
        collector_collection_runs.started_at AS "startedAt",
        collector_collection_runs.finished_at AS "finishedAt",
        collector_collection_runs.created_at AS "createdAt",
        collector_collection_runs.updated_at AS "updatedAt"
    `);
    const [row] = result.rows;

    return row === undefined ? null : toCollectionRunDomain(row);
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
