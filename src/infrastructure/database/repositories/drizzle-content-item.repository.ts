import { and, asc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  ContentItemListQuery,
  ContentItemListResult,
  ContentItemRepository,
} from "../../../content-manager/application";
import type {
  ContentId,
  ContentItem,
  ContentPlatform,
  ExternalPostId,
} from "../../../content-manager/domain";
import type { DatabaseSession } from "../client";
import {
  toContentItemDomain,
  toContentItemRow,
} from "../mappers/content-manager.mapper";
import { contentItems } from "../schema/content-manager.schema";

export class DrizzleContentItemRepository implements ContentItemRepository {
  public constructor(private readonly db: DatabaseSession) {}

  public async save(contentItem: ContentItem): Promise<void> {
    const row = toContentItemRow(contentItem);

    await this.db
      .insert(contentItems)
      .values(row)
      .onConflictDoUpdate({
        target: contentItems.id,
        set: {
          platform: row.platform,
          sourceGroupId: row.sourceGroupId,
          externalPostId: row.externalPostId,
          sourceUrl: row.sourceUrl,
          title: row.title,
          bodyText: row.bodyText,
          authorDisplayName: row.authorDisplayName,
          authorExternalId: row.authorExternalId,
          postedAt: row.postedAt,
          firstCollectedAt: row.firstCollectedAt,
          lastCollectedAt: row.lastCollectedAt,
          reactionCount: row.reactionCount,
          commentCount: row.commentCount,
          shareCount: row.shareCount,
          topComments: row.topComments,
          status: row.status,
          rawPayloadRef: row.rawPayloadRef,
          updatedAt: row.updatedAt,
        },
      });
  }

  public async findById(id: ContentId): Promise<ContentItem | null> {
    const [row] = await this.db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, id))
      .limit(1);

    return row === undefined ? null : toContentItemDomain(row);
  }

  public async findByPlatformAndExternalPostId(
    platform: ContentPlatform,
    externalPostId: ExternalPostId,
  ): Promise<ContentItem | null> {
    const [row] = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.platform, platform),
          eq(contentItems.externalPostId, externalPostId),
        ),
      )
      .limit(1);

    return row === undefined ? null : toContentItemDomain(row);
  }

  public async list(query: ContentItemListQuery): Promise<ContentItemListResult> {
    const where = getContentItemListWhere(query);
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(where)
      .orderBy(asc(contentItems.createdAt), asc(contentItems.id))
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(contentItems)
      .where(where);

    return {
      items: rows.map((row) => toContentItemDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }
}

function getContentItemListWhere(
  query: ContentItemListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(contentItems.status, query.status));
  }

  if (query.sourceGroupId !== undefined) {
    conditions.push(eq(contentItems.sourceGroupId, query.sourceGroupId));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}
