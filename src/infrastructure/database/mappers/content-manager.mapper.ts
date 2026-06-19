import type {
  ContentCategory,
  ContentCollectionProvenance,
  ContentItem,
  IsoDateTime,
  SourceGroup,
  SourcePublisher,
  ValidationIssue,
} from "../../../content-manager/domain";
import {
  validateContentCategory,
  validateContentCollectionProvenance,
  validateContentItem,
  validateSourceGroup,
  validateSourcePublisher,
} from "../../../content-manager/domain";
import {
  contentCategories,
  contentItems,
  sourceGroups,
  sourcePublishers,
} from "../schema/content-manager.schema";

export type ContentCategoryRow = typeof contentCategories.$inferSelect;
export type ContentCategoryInsert = typeof contentCategories.$inferInsert;
export type SourceGroupRow = typeof sourceGroups.$inferSelect;
export type SourceGroupInsert = typeof sourceGroups.$inferInsert;
export type ContentItemRow = typeof contentItems.$inferSelect;
export type ContentItemInsert = typeof contentItems.$inferInsert;
export type SourcePublisherRow = typeof sourcePublishers.$inferSelect;
export type SourcePublisherInsert = typeof sourcePublishers.$inferInsert;

type ContentManagerRecordType =
  | "content category"
  | "source group"
  | "content item"
  | "source publisher";

export class InvalidPersistedContentManagerRecordError extends Error {
  public readonly recordType: ContentManagerRecordType;
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(
    recordType: ContentManagerRecordType,
    recordId: string,
    issues: readonly ValidationIssue[],
  ) {
    super(`Persisted ${recordType} is invalid: ${recordId}.`);
    this.name = "InvalidPersistedContentManagerRecordError";
    this.recordType = recordType;
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toContentCategoryRow(
  category: ContentCategory,
): ContentCategoryInsert {
  const validCategory = parseContentCategoryForPersistence(category);

  return {
    id: validCategory.id,
    name: validCategory.name,
    slug: validCategory.slug,
    description: validCategory.description ?? null,
    createdAt: validCategory.createdAt,
    updatedAt: validCategory.updatedAt,
  };
}

export function toContentCategoryDomain(
  row: ContentCategoryRow,
): ContentCategory {
  const candidate = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ...optional("description", row.description),
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateContentCategory(candidate);

  if (!result.valid) {
    throw invalidPersisted("content category", row.id, result.issues);
  }

  return result.value;
}

export function toSourceGroupRow(
  sourceGroup: SourceGroup,
): SourceGroupInsert {
  const validSourceGroup = parseSourceGroupForPersistence(sourceGroup);

  return {
    id: validSourceGroup.id,
    platform: validSourceGroup.platform,
    externalGroupId: validSourceGroup.externalGroupId,
    name: validSourceGroup.name,
    url: validSourceGroup.url,
    categoryId: validSourceGroup.categoryId,
    status: validSourceGroup.status,
    collectionPriority: validSourceGroup.collectionPriority,
    notes: validSourceGroup.notes ?? null,
    entryRoutes: validSourceGroup.entryRoutes.map((route) => ({ ...route })),
    createdAt: validSourceGroup.createdAt,
    updatedAt: validSourceGroup.updatedAt,
  };
}

export function toSourceGroupDomain(row: SourceGroupRow): SourceGroup {
  const candidate = {
    id: row.id,
    platform: row.platform,
    externalGroupId: row.externalGroupId,
    name: row.name,
    url: row.url,
    categoryId: row.categoryId,
    status: row.status,
    collectionPriority: row.collectionPriority,
    ...optional("notes", row.notes),
    entryRoutes: row.entryRoutes ?? [],
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateSourceGroup(candidate);

  if (!result.valid) {
    throw invalidPersisted("source group", row.id, result.issues);
  }

  return result.value;
}

export function toContentItemRow(contentItem: ContentItem): ContentItemInsert {
  const validContentItem = parseContentItemForPersistence(contentItem);

  return {
    id: validContentItem.id,
    platform: validContentItem.platform,
    sourceGroupId: validContentItem.sourceGroupId,
    externalPostId: validContentItem.externalPostId,
    sourceUrl: validContentItem.sourceUrl,
    title: validContentItem.title ?? null,
    bodyText: validContentItem.bodyText,
    authorDisplayName: validContentItem.authorDisplayName ?? null,
    authorExternalId: validContentItem.authorExternalId ?? null,
    postedAt: validContentItem.postedAt ?? null,
    firstCollectedAt: validContentItem.firstCollectedAt,
    lastCollectedAt: validContentItem.lastCollectedAt,
    reactionCount: validContentItem.reactionCount,
    commentCount: validContentItem.commentCount,
    shareCount: validContentItem.shareCount ?? null,
    topComments: validContentItem.topComments.map((comment) => ({ ...comment })),
    status: validContentItem.status,
    rawPayloadRef: validContentItem.rawPayloadRef ?? null,
    collectionProvenance: parseCollectionProvenanceForPersistence(
      validContentItem.collectionProvenance,
      validContentItem.sourceGroupId,
    ),
    createdAt: validContentItem.createdAt,
    updatedAt: validContentItem.updatedAt,
  };
}

export function toContentItemDomain(row: ContentItemRow): ContentItem {
  const candidate = {
    id: row.id,
    platform: row.platform,
    sourceGroupId: row.sourceGroupId,
    externalPostId: row.externalPostId,
    sourceUrl: row.sourceUrl,
    ...optional("title", row.title),
    bodyText: row.bodyText,
    ...optional("authorDisplayName", row.authorDisplayName),
    ...optional("authorExternalId", row.authorExternalId),
    ...optionalIsoDateTime("postedAt", row.postedAt),
    firstCollectedAt: normalizeIsoDateTime(row.firstCollectedAt),
    lastCollectedAt: normalizeIsoDateTime(row.lastCollectedAt),
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    ...optionalNumber("shareCount", row.shareCount),
    topComments: row.topComments,
    status: row.status,
    ...optional("rawPayloadRef", row.rawPayloadRef),
    collectionProvenance: parseCollectionProvenanceForRead(
      row.collectionProvenance,
      row.sourceGroupId,
      row.id,
    ),
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateContentItem(candidate);

  if (!result.valid) {
    throw invalidPersisted("content item", row.id, result.issues);
  }

  return result.value;
}

export function toSourcePublisherRow(
  sourcePublisher: SourcePublisher,
): SourcePublisherInsert {
  const validSourcePublisher = parseSourcePublisherForPersistence(
    sourcePublisher,
  );

  return {
    id: validSourcePublisher.id,
    platform: validSourcePublisher.platform,
    kind: validSourcePublisher.kind,
    externalPublisherId: validSourcePublisher.externalPublisherId,
    displayName: validSourcePublisher.displayName ?? null,
    canonicalUrl: validSourcePublisher.canonicalUrl ?? null,
    status: validSourcePublisher.status,
    firstObservedAt: validSourcePublisher.firstObservedAt,
    lastObservedAt: validSourcePublisher.lastObservedAt,
    observationCount: validSourcePublisher.observationCount,
    createdAt: validSourcePublisher.createdAt,
    updatedAt: validSourcePublisher.updatedAt,
  };
}

export function toSourcePublisherDomain(
  row: SourcePublisherRow,
): SourcePublisher {
  const candidate = {
    id: row.id,
    platform: row.platform,
    kind: row.kind,
    externalPublisherId: row.externalPublisherId,
    ...optional("displayName", row.displayName),
    ...optional("canonicalUrl", row.canonicalUrl),
    status: row.status,
    firstObservedAt: normalizeIsoDateTime(row.firstObservedAt),
    lastObservedAt: normalizeIsoDateTime(row.lastObservedAt),
    observationCount: row.observationCount,
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateSourcePublisher(candidate);

  if (!result.valid) {
    throw invalidPersisted("source publisher", row.id, result.issues);
  }

  return result.value;
}

function parseSourcePublisherForPersistence(
  sourcePublisher: SourcePublisher,
): SourcePublisher {
  const result = validateSourcePublisher(sourcePublisher);

  if (!result.valid) {
    throw invalidPersisted(
      "source publisher",
      sourcePublisher.id,
      result.issues,
    );
  }

  return result.value;
}

function parseContentCategoryForPersistence(
  category: ContentCategory,
): ContentCategory {
  const result = validateContentCategory(category);

  if (!result.valid) {
    throw invalidPersisted("content category", category.id, result.issues);
  }

  return result.value;
}

function parseSourceGroupForPersistence(sourceGroup: SourceGroup): SourceGroup {
  const result = validateSourceGroup(sourceGroup);

  if (!result.valid) {
    throw invalidPersisted("source group", sourceGroup.id, result.issues);
  }

  return result.value;
}

function parseContentItemForPersistence(contentItem: ContentItem): ContentItem {
  const result = validateContentItem(contentItem);

  if (!result.valid) {
    throw invalidPersisted("content item", contentItem.id, result.issues);
  }

  return result.value;
}

function parseCollectionProvenanceForPersistence(
  provenance: ContentCollectionProvenance,
  sourceGroupId: string,
): ContentCollectionProvenance {
  const result = validateContentCollectionProvenance(provenance);

  if (!result.valid) {
    throw invalidPersisted(
      "content item",
      sourceGroupId,
      result.issues,
    );
  }

  assertSourceGroupConsistency(result.value, sourceGroupId, sourceGroupId);

  return { ...result.value };
}

function parseCollectionProvenanceForRead(
  provenance: unknown,
  sourceGroupId: string,
  contentItemId: string,
): ContentCollectionProvenance {
  const result = validateContentCollectionProvenance(provenance);

  if (!result.valid) {
    throw invalidPersisted("content item", contentItemId, result.issues);
  }

  assertSourceGroupConsistency(result.value, sourceGroupId, contentItemId);

  return { ...result.value };
}

function assertSourceGroupConsistency(
  provenance: ContentCollectionProvenance,
  sourceGroupId: string,
  contentItemId: string,
): void {
  const surface = provenance.firstCollectionSurface;

  if (surface.kind !== "SOURCE_GROUP") {
    throw new InvalidPersistedContentManagerRecordError(
      "content item",
      contentItemId,
      [
        {
          path: "collectionProvenance.firstCollectionSurface.kind",
          message:
            "collectionProvenance.firstCollectionSurface.kind must be SOURCE_GROUP for a source-group content item.",
        },
      ],
    );
  }

  if (surface.sourceGroupId !== sourceGroupId) {
    throw new InvalidPersistedContentManagerRecordError(
      "content item",
      contentItemId,
      [
        {
          path: "collectionProvenance.firstCollectionSurface.sourceGroupId",
          message:
            "collectionProvenance.firstCollectionSurface.sourceGroupId must equal sourceGroupId.",
        },
      ],
    );
  }

  if (
    provenance.managedSourceGroupId !== undefined &&
    provenance.managedSourceGroupId !== surface.sourceGroupId
  ) {
    throw new InvalidPersistedContentManagerRecordError(
      "content item",
      contentItemId,
      [
        {
          path: "collectionProvenance.managedSourceGroupId",
          message:
            "collectionProvenance.managedSourceGroupId must equal firstCollectionSurface.sourceGroupId.",
        },
      ],
    );
  }
}

function invalidPersisted(
  recordType: ContentManagerRecordType,
  recordId: string,
  issues: readonly ValidationIssue[],
): InvalidPersistedContentManagerRecordError {
  return new InvalidPersistedContentManagerRecordError(
    recordType,
    recordId,
    issues,
  );
}

function optional<T>(
  key: string,
  value: T | null,
): Record<string, T> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return {
    [key]: value,
  };
}

function optionalNumber(
  key: string,
  value: number | null,
): Record<string, number> | Record<string, never> {
  return optional(key, value);
}

function optionalIsoDateTime(
  key: string,
  value: string | Date | null,
): Record<string, IsoDateTime> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return {
    [key]: normalizeIsoDateTime(value),
  };
}

function normalizeIsoDateTime(value: string | Date): IsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
