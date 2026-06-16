import { and, desc, eq, inArray } from "drizzle-orm";
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

export class DrizzleProfileSourceAccessCheckRunRepository
  implements ProfileSourceAccessCheckRunRepository
{
  public constructor(private readonly client: DatabaseSession) {}

  public async save(run: ProfileSourceAccessCheckRun): Promise<void> {
    const record = toProfileSourceAccessCheckRunRecord(run);

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

    const results = await this.client
      .select()
      .from(collectorProfileSourceAccessCheckRuns)
      .where(whereClause)
      .orderBy(desc(collectorProfileSourceAccessCheckRuns.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    return {
      items: results.map(toDomainProfileSourceAccessCheckRun),
    };
  }
}
