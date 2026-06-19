import { and, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { ProfileHomeFeedCollectionRunConflictError } from "../../../collector-runtime/application";
import type {
  ProfileHomeFeedCollectionRunListQuery,
  ProfileHomeFeedCollectionRunListResult,
  ProfileHomeFeedCollectionRunRepository,
  ProfileHomeFeedCollectionRunStatusTransition,
  ProfileHomeFeedCollectionRunStatusTransitionResult,
} from "../../../collector-runtime/application";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
} from "../../../collector-runtime/domain";
import type { DatabaseSession } from "../client";
import {
  type ProfileHomeFeedCollectionRunInsert,
  type ProfileHomeFeedCollectionRunRow,
  toDomainProfileHomeFeedCollectionRun,
  toProfileHomeFeedCollectionRunRecord,
} from "../mappers/profile-home-feed-collection-run.mapper";
import { profileHomeFeedCollectionRuns } from "../schema/collector-runtime.schema";

export class DrizzleProfileHomeFeedCollectionRunRepository
  implements ProfileHomeFeedCollectionRunRepository
{
  public constructor(private readonly db: DatabaseSession) {}

  public async save(run: ProfileHomeFeedCollectionRun): Promise<void> {
    const record = toProfileHomeFeedCollectionRunRecord(run);

    try {
      await this.db
        .insert(profileHomeFeedCollectionRuns)
        .values(record)
        .onConflictDoUpdate({
          target: profileHomeFeedCollectionRuns.id,
          set: {
            status: record.status,
            summary: record.summary,
            failureReason: record.failureReason,
            startedAt: record.startedAt,
            finishedAt: record.finishedAt,
            updatedAt: record.updatedAt,
          },
        });
    } catch (error: unknown) {
      if (isActiveRunUniqueConflict(error)) {
        throw new ProfileHomeFeedCollectionRunConflictError(run.profileId);
      }

      throw error;
    }
  }

  public async findById(
    id: ProfileHomeFeedCollectionRunId,
  ): Promise<ProfileHomeFeedCollectionRun | null> {
    const [row] = await this.db
      .select()
      .from(profileHomeFeedCollectionRuns)
      .where(eq(profileHomeFeedCollectionRuns.id, id))
      .limit(1);

    return row === undefined ? null : toDomainProfileHomeFeedCollectionRun(row);
  }

  public async list(
    query: ProfileHomeFeedCollectionRunListQuery,
  ): Promise<ProfileHomeFeedCollectionRunListResult> {
    const where = getProfileHomeFeedCollectionRunListWhere(query);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(profileHomeFeedCollectionRuns)
      .where(where);
    const rows = await this.db
      .select()
      .from(profileHomeFeedCollectionRuns)
      .where(where)
      .orderBy(
        desc(profileHomeFeedCollectionRuns.requestedAt),
        desc(profileHomeFeedCollectionRuns.id),
      )
      .limit(query.limit)
      .offset(query.offset);

    return {
      items: rows.map(toDomainProfileHomeFeedCollectionRun),
      total: Number(totalRow?.total ?? 0),
    };
  }

  public async claimNextQueued(
    startedAt: ProfileHomeFeedCollectionRunIsoDateTime,
  ): Promise<ProfileHomeFeedCollectionRun | null> {
    const result = await this.db.execute<ProfileHomeFeedCollectionRunRow>(sql`
      WITH next_run AS (
        SELECT id
        FROM profile_home_feed_collection_runs
        WHERE status = 'QUEUED'
        ORDER BY requested_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE profile_home_feed_collection_runs
      SET
        status = 'RUNNING',
        started_at = ${startedAt},
        updated_at = ${startedAt}
      FROM next_run
      WHERE profile_home_feed_collection_runs.id = next_run.id
      RETURNING
        profile_home_feed_collection_runs.id,
        profile_home_feed_collection_runs.profile_id AS "profileId",
        profile_home_feed_collection_runs.trigger_type AS "triggerType",
        profile_home_feed_collection_runs.status,
        profile_home_feed_collection_runs.account_stage_at_request AS "accountStageAtRequest",
        profile_home_feed_collection_runs.target,
        profile_home_feed_collection_runs.parameters,
        profile_home_feed_collection_runs.summary,
        profile_home_feed_collection_runs.failure_reason AS "failureReason",
        profile_home_feed_collection_runs.requested_at AS "requestedAt",
        profile_home_feed_collection_runs.started_at AS "startedAt",
        profile_home_feed_collection_runs.finished_at AS "finishedAt",
        profile_home_feed_collection_runs.created_at AS "createdAt",
        profile_home_feed_collection_runs.updated_at AS "updatedAt"
    `);
    const [row] = result.rows;

    return row === undefined ? null : toDomainProfileHomeFeedCollectionRun(row);
  }

  public async transitionStatus(
    transition: ProfileHomeFeedCollectionRunStatusTransition,
  ): Promise<ProfileHomeFeedCollectionRunStatusTransitionResult> {
    const updateSet: Partial<ProfileHomeFeedCollectionRunInsert> = {
      status: transition.nextStatus,
      updatedAt: transition.updatedAt,
    };

    if (transition.finishedAt !== undefined) {
      updateSet.finishedAt = transition.finishedAt;
    }

    if (transition.summary !== undefined) {
      updateSet.summary = transition.summary;
    }

    if (transition.failureReason !== undefined) {
      updateSet.failureReason = transition.failureReason;
    }

    const [updatedRow] = await this.db
      .update(profileHomeFeedCollectionRuns)
      .set(updateSet)
      .where(
        and(
          eq(profileHomeFeedCollectionRuns.id, transition.runId),
          eq(profileHomeFeedCollectionRuns.status, transition.expectedStatus),
        ),
      )
      .returning();

    if (updatedRow !== undefined) {
      return {
        ok: true,
        run: toDomainProfileHomeFeedCollectionRun(updatedRow),
      };
    }

    const currentRun = await this.findById(transition.runId);

    if (currentRun === null) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    return {
      ok: false,
      reason: "status_conflict",
      currentRun,
    };
  }
}

function getProfileHomeFeedCollectionRunListWhere(
  query: ProfileHomeFeedCollectionRunListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(profileHomeFeedCollectionRuns.status, query.status));
  }

  if (query.profileId !== undefined) {
    conditions.push(eq(profileHomeFeedCollectionRuns.profileId, query.profileId));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}

function isActiveRunUniqueConflict(error: unknown): boolean {
  return (
    hasPostgresConstraint(
      error,
      "profile_home_feed_collection_runs_active_profile_uidx",
    ) ||
    (typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      hasPostgresConstraint(
        error.cause,
        "profile_home_feed_collection_runs_active_profile_uidx",
      ))
  );
}

function hasPostgresConstraint(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === constraint
  );
}
