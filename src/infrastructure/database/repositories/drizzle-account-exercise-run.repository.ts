import { and, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  AccountExerciseRunListQuery,
  AccountExerciseRunListResult,
  AccountExerciseRunRepository,
} from "../../../collector-runtime/application";
import type {
  AccountExerciseRun,
  AccountExerciseRunId,
  AccountExerciseRunIsoDateTime,
} from "../../../collector-runtime/domain";
import type { DatabaseSession } from "../client";
import {
  type AccountExerciseRunRow,
  toAccountExerciseRunDomain,
  toAccountExerciseRunRow,
} from "../mappers/account-exercise-run.mapper";
import { collectorAccountExerciseRuns } from "../schema/collector-runtime.schema";

export class DrizzleAccountExerciseRunRepository
  implements AccountExerciseRunRepository
{
  public constructor(private readonly db: DatabaseSession) {}

  public async save(accountExerciseRun: AccountExerciseRun): Promise<void> {
    const row = toAccountExerciseRunRow(accountExerciseRun);

    await this.db
      .insert(collectorAccountExerciseRuns)
      .values(row)
      .onConflictDoUpdate({
        target: collectorAccountExerciseRuns.id,
        set: {
          profileId: row.profileId,
          leaseId: row.leaseId,
          exerciseType: row.exerciseType,
          status: row.status,
          stageAtStart: row.stageAtStart,
          actionBudget: row.actionBudget,
          target: row.target,
          safeSummary: row.safeSummary,
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
    id: AccountExerciseRunId,
  ): Promise<AccountExerciseRun | null> {
    const [row] = await this.db
      .select()
      .from(collectorAccountExerciseRuns)
      .where(eq(collectorAccountExerciseRuns.id, id))
      .limit(1);

    return row === undefined ? null : toAccountExerciseRunDomain(row);
  }

  public async list(
    query: AccountExerciseRunListQuery,
  ): Promise<AccountExerciseRunListResult> {
    const where = getAccountExerciseRunListWhere(query);
    const rows = await this.db
      .select()
      .from(collectorAccountExerciseRuns)
      .where(where)
      .orderBy(
        desc(collectorAccountExerciseRuns.createdAt),
        desc(collectorAccountExerciseRuns.id),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(collectorAccountExerciseRuns)
      .where(where);

    return {
      items: rows.map((row) => toAccountExerciseRunDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }

  public async claimNextQueued(
    startedAt: AccountExerciseRunIsoDateTime,
  ): Promise<AccountExerciseRun | null> {
    const result = await this.db.execute<AccountExerciseRunRow>(sql`
      WITH next_run AS (
        SELECT id
        FROM collector_account_exercise_runs
        WHERE status = 'QUEUED'
        ORDER BY requested_at ASC, created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE collector_account_exercise_runs
      SET
        status = 'RUNNING',
        started_at = ${startedAt},
        updated_at = ${startedAt}
      FROM next_run
      WHERE collector_account_exercise_runs.id = next_run.id
      RETURNING
        collector_account_exercise_runs.id,
        collector_account_exercise_runs.profile_id AS "profileId",
        collector_account_exercise_runs.lease_id AS "leaseId",
        collector_account_exercise_runs.exercise_type AS "exerciseType",
        collector_account_exercise_runs.status,
        collector_account_exercise_runs.stage_at_start AS "stageAtStart",
        collector_account_exercise_runs.action_budget AS "actionBudget",
        collector_account_exercise_runs.target AS "target",
        collector_account_exercise_runs.safe_summary AS "safeSummary",
        collector_account_exercise_runs.failure_reason AS "failureReason",
        collector_account_exercise_runs.requested_at AS "requestedAt",
        collector_account_exercise_runs.started_at AS "startedAt",
        collector_account_exercise_runs.finished_at AS "finishedAt",
        collector_account_exercise_runs.created_at AS "createdAt",
        collector_account_exercise_runs.updated_at AS "updatedAt"
    `);
    const [row] = result.rows;

    return row === undefined ? null : toAccountExerciseRunDomain(row);
  }
}

function getAccountExerciseRunListWhere(
  query: AccountExerciseRunListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(collectorAccountExerciseRuns.status, query.status));
  }

  if (query.profileId !== undefined) {
    conditions.push(eq(collectorAccountExerciseRuns.profileId, query.profileId));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}
