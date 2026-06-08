import { and, asc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  SourceGroupListQuery,
  SourceGroupListResult,
  SourceGroupRepository,
} from "../../../content-manager/application";
import type {
  ContentPlatform,
  ExternalGroupId,
  SourceGroup,
  SourceGroupId,
} from "../../../content-manager/domain";
import type { DatabaseSession } from "../client";
import {
  toSourceGroupDomain,
  toSourceGroupRow,
} from "../mappers/content-manager.mapper";
import { sourceGroups } from "../schema/content-manager.schema";

export class DrizzleSourceGroupRepository implements SourceGroupRepository {
  public constructor(private readonly db: DatabaseSession) {}

  public async save(sourceGroup: SourceGroup): Promise<void> {
    const row = toSourceGroupRow(sourceGroup);

    await this.db
      .insert(sourceGroups)
      .values(row)
      .onConflictDoUpdate({
        target: sourceGroups.id,
        set: {
          platform: row.platform,
          externalGroupId: row.externalGroupId,
          name: row.name,
          url: row.url,
          categoryId: row.categoryId,
          status: row.status,
          collectionPriority: row.collectionPriority,
          notes: row.notes,
          updatedAt: row.updatedAt,
        },
      });
  }

  public async findById(id: SourceGroupId): Promise<SourceGroup | null> {
    const [row] = await this.db
      .select()
      .from(sourceGroups)
      .where(eq(sourceGroups.id, id))
      .limit(1);

    return row === undefined ? null : toSourceGroupDomain(row);
  }

  public async findByPlatformAndExternalGroupId(
    platform: ContentPlatform,
    externalGroupId: ExternalGroupId,
  ): Promise<SourceGroup | null> {
    const [row] = await this.db
      .select()
      .from(sourceGroups)
      .where(
        and(
          eq(sourceGroups.platform, platform),
          eq(sourceGroups.externalGroupId, externalGroupId),
        ),
      )
      .limit(1);

    return row === undefined ? null : toSourceGroupDomain(row);
  }

  public async list(query: SourceGroupListQuery): Promise<SourceGroupListResult> {
    const where = getSourceGroupListWhere(query);
    const rows = await this.db
      .select()
      .from(sourceGroups)
      .where(where)
      .orderBy(asc(sourceGroups.createdAt), asc(sourceGroups.id))
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(sourceGroups)
      .where(where);

    return {
      items: rows.map((row) => toSourceGroupDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }
}

function getSourceGroupListWhere(
  query: SourceGroupListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(sourceGroups.status, query.status));
  }

  if (query.categoryId !== undefined) {
    conditions.push(eq(sourceGroups.categoryId, query.categoryId));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}
