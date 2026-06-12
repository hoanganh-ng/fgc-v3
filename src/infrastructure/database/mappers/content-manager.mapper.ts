import type {
  ContentCategory,
  ContentItem,
  IsoDateTime,
  SourceGroup,
  ValidationIssue,
} from "../../../content-manager/domain";
import {
  validateContentCategory,
  validateContentItem,
  validateSourceGroup,
} from "../../../content-manager/domain";
import {
  contentCategories,
  contentItems,
  sourceGroups,
} from "../schema/content-manager.schema";

export type ContentCategoryRow = typeof contentCategories.$inferSelect;
export type ContentCategoryInsert = typeof contentCategories.$inferInsert;
export type SourceGroupRow = typeof sourceGroups.$inferSelect;
export type SourceGroupInsert = typeof sourceGroups.$inferInsert;
export type ContentItemRow = typeof contentItems.$inferSelect;
export type ContentItemInsert = typeof contentItems.$inferInsert;

type ContentManagerRecordType =
  | "content category"
  | "source group"
  | "content item";

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
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateContentItem(candidate);

  if (!result.valid) {
    throw invalidPersisted("content item", row.id, result.issues);
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
