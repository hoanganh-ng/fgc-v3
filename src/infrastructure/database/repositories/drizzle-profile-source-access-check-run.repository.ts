import { and, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DatabaseSession } from "../client";
import { collectorProfileSourceAccessCheckRuns } from "../schema";
import {
  type ProfileSourceAccessCheckRunRow,
  toDomainProfileSourceAccessCheckRun,
  toProfileSourceAccessCheckRunRecord,
} from "../mappers/profile-source-access-check-run.mapper";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunId,
  ProfileSourceAccessCheckRunIsoDateTime,
} from "../../../collector-runtime/domain";
import type {
  ProfileSourceAccessCheckRunListQuery,
  ProfileSourceAccessCheckRunListResult,
  ProfileSourceAccessCheckRunRepository,
} from "../../../collector-runtime/application";
import { ProfileSourceAccessCheckRunConflictError } from "../../../collector-runtime/application";

export class DrizzleProfileSourceAccessCheckRunRepository
  implements ProfileSourceAccessCheckRunRepository
{
  public constructor(private readonly client: DatabaseSession) {}

  public async save(run: ProfileSourceAccessCheckRun): Promise<void> {
    const record = toProfileSourceAccessCheckRunRecord(run);

    try {
      await this.client
        .insert(collectorProfileSourceAccessCheckRuns)
        .values(record)
        .onConflictDoUpdate({
          target: collectorProfileSourceAccessCheckRuns.id,
          set: {
            status: record.status,
            outcome: record.outcome,
            failureReason: record.failureReason,
            startedAt: record.startedAt,
            finishedAt: record.finishedAt,
            updatedAt: record.updatedAt,
          },
        });
    } catch (error: unknown) {
      const isConflict =
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "collector_psa_check_runs_active_unique_idx") ||
        (typeof error === "object" &&
          error !== null &&
          "cause" in error &&
          typeof error.cause === "object" &&
          error.cause !== null &&
          "code" in error.cause &&
          error.cause.code === "23505" &&
          "constraint" in error.cause &&
          error.cause.constraint === "collector_psa_check_runs_active_unique_idx");

      if (isConflict) {
        throw new ProfileSourceAccessCheckRunConflictError(
          run.profileId,
          run.sourceGroupId,
        );
      }
      throw error;
    }
  }

  public async findById(
    id: ProfileSourceAccessCheckRunId,
  ): Promise<ProfileSourceAccessCheckRun | null> {
    const results = await this.client
      .select()
      .from(collectorProfileSourceAccessCheckRuns)
      .where(eq(collectorProfileSourceAccessCheckRuns.id, id))
      .limit(1);

    if (results.length === 0 || results[0] === undefined) {
      return null;
    }

    return toDomainProfileSourceAccessCheckRun(results[0]);
  }

  public async findByProfileAndSourceGroup(
    profileId: string,
    sourceGroupId: string,
  ): Promise<readonly ProfileSourceAccessCheckRun[]> {
    const results = await this.client
      .select()
      .from(collectorProfileSourceAccessCheckRuns)
      .where(
        and(
          eq(collectorProfileSourceAccessCheckRuns.profileId, profileId),
          eq(collectorProfileSourceAccessCheckRuns.sourceGroupId, sourceGroupId),
        ),
      )
      .orderBy(desc(collectorProfileSourceAccessCheckRuns.createdAt));

    return results.map(toDomainProfileSourceAccessCheckRun);
  }

  public async list(
    query: ProfileSourceAccessCheckRunListQuery,
  ): Promise<ProfileSourceAccessCheckRunListResult> {
    const whereClause = getProfileSourceAccessCheckRunListWhere(query);

    const countResult = await this.client
      .select({ count: sql<number>`count(*)::int` })
      .from(collectorProfileSourceAccessCheckRuns)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    const results = await this.client
      .select()
      .from(collectorProfileSourceAccessCheckRuns)
      .where(whereClause)
      .orderBy(
        desc(collectorProfileSourceAccessCheckRuns.createdAt),
        desc(collectorProfileSourceAccessCheckRuns.id),
      )
      .limit(query.limit)
      .offset(query.offset);

    return {
      items: results.map(toDomainProfileSourceAccessCheckRun),
      total,
    };
  }

  public async claimNextQueued(
    startedAt: ProfileSourceAccessCheckRunIsoDateTime,
  ): Promise<ProfileSourceAccessCheckRun | null> {
    const result = await this.client.execute<ProfileSourceAccessCheckRunRow>(sql`
      WITH next_run AS (
        SELECT id
        FROM collector_profile_source_access_check_runs
        WHERE status = 'QUEUED'
        ORDER BY requested_at ASC, created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE collector_profile_source_access_check_runs
      SET
        status = 'RUNNING',
        started_at = ${startedAt},
        updated_at = ${startedAt}
      FROM next_run
      WHERE collector_profile_source_access_check_runs.id = next_run.id
      RETURNING
        collector_profile_source_access_check_runs.id,
        collector_profile_source_access_check_runs.profile_id AS "profileId",
        collector_profile_source_access_check_runs.source_group_id AS "sourceGroupId",
        collector_profile_source_access_check_runs.trigger_type AS "triggerType",
        collector_profile_source_access_check_runs.status,
        collector_profile_source_access_check_runs.account_stage_at_request AS "accountStageAtRequest",
        collector_profile_source_access_check_runs.target,
        collector_profile_source_access_check_runs.outcome,
        collector_profile_source_access_check_runs.failure_reason AS "failureReason",
        collector_profile_source_access_check_runs.requested_at AS "requestedAt",
        collector_profile_source_access_check_runs.started_at AS "startedAt",
        collector_profile_source_access_check_runs.finished_at AS "finishedAt",
        collector_profile_source_access_check_runs.created_at AS "createdAt",
        collector_profile_source_access_check_runs.updated_at AS "updatedAt"
    `);
    const [row] = result.rows;

    return row === undefined ? null : toDomainProfileSourceAccessCheckRun(row);
  }
}

function getProfileSourceAccessCheckRunListWhere(
  query: ProfileSourceAccessCheckRunListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(collectorProfileSourceAccessCheckRuns.status, query.status));
  }

  if (query.profileId !== undefined) {
    conditions.push(eq(collectorProfileSourceAccessCheckRuns.profileId, query.profileId));
  }

  if (query.sourceGroupId !== undefined) {
    conditions.push(
      eq(collectorProfileSourceAccessCheckRuns.sourceGroupId, query.sourceGroupId),
    );
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}
