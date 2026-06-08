import type {
  ContentCategory,
  ContentCategoryId,
  ContentId,
  ContentItem,
  ContentPlatform,
  ExternalGroupId,
  ExternalPostId,
  SourceGroup,
  SourceGroupId,
} from "../../domain";
import type { ContentCategoryRepository } from "../ports/content-category-repository.port";
import type {
  ContentItemListQuery,
  ContentItemListResult,
  ContentItemRepository,
} from "../ports/content-item-repository.port";
import type {
  SourceGroupListQuery,
  SourceGroupListResult,
  SourceGroupRepository,
} from "../ports/source-group-repository.port";

export class InMemoryContentCategoryRepository
  implements ContentCategoryRepository
{
  private readonly categories = new Map<ContentCategoryId, ContentCategory>();

  public async save(category: ContentCategory): Promise<void> {
    this.categories.set(category.id, category);
  }

  public async findById(
    id: ContentCategoryId,
  ): Promise<ContentCategory | null> {
    return this.categories.get(id) ?? null;
  }

  public async findBySlug(slug: string): Promise<ContentCategory | null> {
    for (const category of this.categories.values()) {
      if (category.slug === slug) {
        return category;
      }
    }

    return null;
  }

  public async list(): Promise<readonly ContentCategory[]> {
    return [...this.categories.values()].sort(compareCategoriesByCreatedAt);
  }
}

export class InMemorySourceGroupRepository implements SourceGroupRepository {
  private readonly sourceGroups = new Map<SourceGroupId, SourceGroup>();

  public async save(sourceGroup: SourceGroup): Promise<void> {
    this.sourceGroups.set(sourceGroup.id, sourceGroup);
  }

  public async findById(id: SourceGroupId): Promise<SourceGroup | null> {
    return this.sourceGroups.get(id) ?? null;
  }

  public async findByPlatformAndExternalGroupId(
    platform: ContentPlatform,
    externalGroupId: ExternalGroupId,
  ): Promise<SourceGroup | null> {
    for (const sourceGroup of this.sourceGroups.values()) {
      if (
        sourceGroup.platform === platform &&
        sourceGroup.externalGroupId === externalGroupId
      ) {
        return sourceGroup;
      }
    }

    return null;
  }

  public async list(query: SourceGroupListQuery): Promise<SourceGroupListResult> {
    const matchingSourceGroups = [...this.sourceGroups.values()]
      .filter(
        (sourceGroup) =>
          query.status === undefined || sourceGroup.status === query.status,
      )
      .filter(
        (sourceGroup) =>
          query.categoryId === undefined ||
          sourceGroup.categoryId === query.categoryId,
      )
      .sort(compareSourceGroupsByCreatedAt);

    return {
      items: matchingSourceGroups.slice(
        query.offset,
        query.offset + query.limit,
      ),
      total: matchingSourceGroups.length,
    };
  }
}

export class InMemoryContentItemRepository implements ContentItemRepository {
  private readonly contentItems = new Map<ContentId, ContentItem>();

  public async save(contentItem: ContentItem): Promise<void> {
    this.contentItems.set(contentItem.id, contentItem);
  }

  public async findById(id: ContentId): Promise<ContentItem | null> {
    return this.contentItems.get(id) ?? null;
  }

  public async findByPlatformAndExternalPostId(
    platform: ContentPlatform,
    externalPostId: ExternalPostId,
  ): Promise<ContentItem | null> {
    for (const contentItem of this.contentItems.values()) {
      if (
        contentItem.platform === platform &&
        contentItem.externalPostId === externalPostId
      ) {
        return contentItem;
      }
    }

    return null;
  }

  public async list(query: ContentItemListQuery): Promise<ContentItemListResult> {
    const matchingContentItems = [...this.contentItems.values()]
      .filter(
        (contentItem) =>
          query.status === undefined || contentItem.status === query.status,
      )
      .filter(
        (contentItem) =>
          query.sourceGroupId === undefined ||
          contentItem.sourceGroupId === query.sourceGroupId,
      )
      .sort(compareContentItemsByCreatedAt);

    return {
      items: matchingContentItems.slice(query.offset, query.offset + query.limit),
      total: matchingContentItems.length,
    };
  }
}

function compareCategoriesByCreatedAt(
  left: ContentCategory,
  right: ContentCategory,
): number {
  const createdAtComparison = compareIsoDates(left.createdAt, right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareSourceGroupsByCreatedAt(
  left: SourceGroup,
  right: SourceGroup,
): number {
  const createdAtComparison = compareIsoDates(left.createdAt, right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareContentItemsByCreatedAt(
  left: ContentItem,
  right: ContentItem,
): number {
  const createdAtComparison = compareIsoDates(left.createdAt, right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareIsoDates(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}
