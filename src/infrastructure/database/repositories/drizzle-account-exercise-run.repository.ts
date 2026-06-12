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
