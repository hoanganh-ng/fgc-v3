import { asc, eq } from "drizzle-orm";
import type {
  ContentCategoryRepository,
} from "../../../content-manager/application";
import type {
  ContentCategory,
  ContentCategoryId,
} from "../../../content-manager/domain";
import type { DatabaseSession } from "../client";
import {
  toContentCategoryDomain,
  toContentCategoryRow,
} from "../mappers/content-manager.mapper";
import { contentCategories } from "../schema/content-manager.schema";

export class DrizzleContentCategoryRepository
  implements ContentCategoryRepository
{
  public constructor(private readonly db: DatabaseSession) {}

  public async save(category: ContentCategory): Promise<void> {
    const row = toContentCategoryRow(category);

    await this.db
      .insert(contentCategories)
      .values(row)
      .onConflictDoUpdate({
        target: contentCategories.id,
        set: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          updatedAt: row.updatedAt,
        },
      });
  }

  public async findById(
    id: ContentCategoryId,
  ): Promise<ContentCategory | null> {
    const [row] = await this.db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.id, id))
      .limit(1);

    return row === undefined ? null : toContentCategoryDomain(row);
  }

  public async findBySlug(slug: string): Promise<ContentCategory | null> {
    const [row] = await this.db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.slug, slug))
      .limit(1);

    return row === undefined ? null : toContentCategoryDomain(row);
  }

  public async list(): Promise<readonly ContentCategory[]> {
    const rows = await this.db
      .select()
      .from(contentCategories)
      .orderBy(asc(contentCategories.createdAt), asc(contentCategories.id));

    return rows.map((row) => toContentCategoryDomain(row));
  }
}
