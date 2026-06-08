import type { ContentCategory, ContentCategoryId } from "../../domain";

export interface ContentCategoryRepository {
  save(category: ContentCategory): Promise<void>;
  findById(id: ContentCategoryId): Promise<ContentCategory | null>;
  findBySlug(slug: string): Promise<ContentCategory | null>;
  list(): Promise<readonly ContentCategory[]>;
}
