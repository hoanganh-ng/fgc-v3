import type {
  ContentCategory,
  ContentCategoryId,
  ContentId,
  ContentItem,
  ContentPlatform,
  ExternalGroupId,
  ExternalPublisherId,
  ExternalPostId,
  SourceGroup,
  SourceGroupId,
  SourcePublisher,
  SourcePublisherId,
  SourcePublisherKind,
} from "../../domain";
import { observeSourcePublisher } from "../../domain";
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
import type {
  AtomicSourcePublisherObservationInput,
  SourcePublisherListQuery,
  SourcePublisherListResult,
  SourcePublisherRepository,
  SourcePublisherStatusPersistenceInput,
} from "../ports/source-publisher-repository.port";

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

export class InMemorySourcePublisherRepository
  implements SourcePublisherRepository
{
  private readonly sourcePublishers = new Map<
    SourcePublisherId,
    SourcePublisher
  >();

  public async observeAtomically(
    input: AtomicSourcePublisherObservationInput,
  ): Promise<SourcePublisher> {
    const existing = await this.findByIdentity(
      input.platform,
      input.kind,
      input.externalPublisherId,
    );
    const next = observeSourcePublisher(
      existing,
      {
        id: input.candidateId,
        identity: {
          platform: input.platform,
          kind: input.kind,
          externalPublisherId: input.externalPublisherId,
        },
        observedAt: input.observedAt,
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.canonicalUrl !== undefined
          ? { canonicalUrl: input.canonicalUrl }
          : {}),
      },
      { updatedAt: input.updatedAt },
    );
    this.sourcePublishers.set(next.id, next);

    return next;
  }

  public async updateStatus(
    input: SourcePublisherStatusPersistenceInput,
  ): Promise<SourcePublisher | null> {
    const existing = this.sourcePublishers.get(input.sourcePublisherId);

    if (existing === undefined) {
      return null;
    }

    const next: SourcePublisher = {
      ...existing,
      status: input.status,
      updatedAt: input.updatedAt,
    };
    this.sourcePublishers.set(next.id, next);

    return next;
  }

  public async findById(
    id: SourcePublisherId,
  ): Promise<SourcePublisher | null> {
    return this.sourcePublishers.get(id) ?? null;
  }

  public async findByIdentity(
    platform: ContentPlatform,
    kind: SourcePublisherKind,
    externalPublisherId: ExternalPublisherId,
  ): Promise<SourcePublisher | null> {
    for (const sourcePublisher of this.sourcePublishers.values()) {
      if (
        sourcePublisher.platform === platform &&
        sourcePublisher.kind === kind &&
        sourcePublisher.externalPublisherId === externalPublisherId
      ) {
        return sourcePublisher;
      }
    }

    return null;
  }

  public async list(
    query: SourcePublisherListQuery,
  ): Promise<SourcePublisherListResult> {
    const matchingSourcePublishers = [...this.sourcePublishers.values()]
      .filter(
        (sourcePublisher) =>
          query.status === undefined || sourcePublisher.status === query.status,
      )
      .filter(
        (sourcePublisher) =>
          query.kind === undefined || sourcePublisher.kind === query.kind,
      )
      .filter(
        (sourcePublisher) =>
          query.platform === undefined ||
          sourcePublisher.platform === query.platform,
      )
      .sort(compareSourcePublishersByLastObservedAt);

    return {
      items: matchingSourcePublishers.slice(
        query.offset,
        query.offset + query.limit,
      ),
      total: matchingSourcePublishers.length,
    };
  }

  /**
   * Test-only seeding mechanism. Lets a test fixture pre-populate the in-memory
   * store with a fully-formed aggregate before exercising the use cases. This
   * is not part of the production SourcePublisherRepository port.
   */
  public seedForTest(sourcePublisher: SourcePublisher): void {
    this.sourcePublishers.set(sourcePublisher.id, sourcePublisher);
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

function compareSourcePublishersByLastObservedAt(
  left: SourcePublisher,
  right: SourcePublisher,
): number {
  const lastObservedComparison = compareIsoDates(
    left.lastObservedAt,
    right.lastObservedAt,
  );

  if (lastObservedComparison !== 0) {
    return -lastObservedComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareIsoDates(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}
