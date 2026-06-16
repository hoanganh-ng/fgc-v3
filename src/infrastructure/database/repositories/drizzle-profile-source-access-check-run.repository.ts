import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseSession } from "../client";
import { collectorProfileSourceAccessCheckRuns } from "../schema";
import {
  toDomainProfileSourceAccessCheckRun,
  toProfileSourceAccessCheckRunRecord,
} from "../mappers/profile-source-access-check-run.mapper";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunId,
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
    const conditions = [];

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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.client
      .select({ count: sql<number>`count(*)::int` })
      .from(collectorProfileSourceAccessCheckRuns)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    const results = await this.client
      .select()
      .from(collectorProfileSourceAccessCheckRuns)
      .where(whereClause)
      .orderBy(desc(collectorProfileSourceAccessCheckRuns.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    return {
      items: results.map(toDomainProfileSourceAccessCheckRun),
      total,
    };
  }
}
