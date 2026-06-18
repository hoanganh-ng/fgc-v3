import {
  ContentValidationError,
  SourceGroupNotFoundError,
  SourcePublisherNotFoundError,
  ContentCategoryNotFoundError,
  ContentItemNotFoundError,
} from "./application-errors";
import type { ContentCategoryRepository } from "./ports/content-category-repository.port";
import type { ContentItemRepository } from "./ports/content-item-repository.port";
import type { SourceGroupRepository } from "./ports/source-group-repository.port";
import type { SourcePublisherRepository } from "./ports/source-publisher-repository.port";
import {
  validateCollectedContentInput,
  validateContentCategory,
  validateContentItem,
  validateSourceGroup,
  validateSourcePublisher,
} from "../domain";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentCategoryId,
  ContentId,
  ContentItem,
  ContentPlatform,
  ExternalPublisherId,
  IsoDateTime,
  SourceGroup,
  SourceGroupId,
  SourcePublisher,
  SourcePublisherId,
  SourcePublisherKind,
} from "../domain";

export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString();
}

export async function loadValidatedContentCategoryById(
  repository: ContentCategoryRepository,
  categoryId: ContentCategoryId,
): Promise<ContentCategory> {
  const category = await repository.findById(categoryId);

  if (category === null) {
    throw new ContentCategoryNotFoundError(categoryId);
  }

  return validateContentCategoryForApplication(category);
}

export async function loadValidatedSourceGroupById(
  repository: SourceGroupRepository,
  sourceGroupId: SourceGroupId,
): Promise<SourceGroup> {
  const sourceGroup = await repository.findById(sourceGroupId);

  if (sourceGroup === null) {
    throw new SourceGroupNotFoundError(sourceGroupId);
  }

  return validateSourceGroupForApplication(sourceGroup);
}

export async function loadValidatedContentItemById(
  repository: ContentItemRepository,
  contentId: ContentId,
): Promise<ContentItem> {
  const contentItem = await repository.findById(contentId);

  if (contentItem === null) {
    throw new ContentItemNotFoundError(contentId);
  }

  return validateContentItemForApplication(contentItem);
}

export async function loadValidatedSourcePublisherById(
  repository: SourcePublisherRepository,
  sourcePublisherId: SourcePublisherId,
): Promise<SourcePublisher> {
  const sourcePublisher = await repository.findById(sourcePublisherId);

  if (sourcePublisher === null) {
    throw new SourcePublisherNotFoundError(sourcePublisherId);
  }

  return validateSourcePublisherForApplication(sourcePublisher);
}

export async function loadValidatedSourcePublisherByIdentity(
  repository: SourcePublisherRepository,
  platform: ContentPlatform,
  kind: SourcePublisherKind,
  externalPublisherId: ExternalPublisherId,
): Promise<SourcePublisher | null> {
  const sourcePublisher = await repository.findByIdentity(
    platform,
    kind,
    externalPublisherId,
  );

  if (sourcePublisher === null) {
    return null;
  }

  return validateSourcePublisherForApplication(sourcePublisher);
}

export function validateContentCategoryForApplication(
  category: ContentCategory,
): ContentCategory {
  const result = validateContentCategory(category);

  if (!result.valid) {
    throw new ContentValidationError(result.issues);
  }

  return result.value;
}

export function validateSourceGroupForApplication(
  sourceGroup: SourceGroup,
): SourceGroup {
  const result = validateSourceGroup(sourceGroup);

  if (!result.valid) {
    throw new ContentValidationError(result.issues);
  }

  return result.value;
}

export function validateContentItemForApplication(
  contentItem: ContentItem,
): ContentItem {
  const result = validateContentItem(contentItem);

  if (!result.valid) {
    throw new ContentValidationError(result.issues);
  }

  return result.value;
}

export function validateCollectedContentInputForApplication(
  input: CollectedContentInput,
): CollectedContentInput {
  const result = validateCollectedContentInput(input);

  if (!result.valid) {
    throw new ContentValidationError(result.issues);
  }

  return result.value;
}

export function validateSourcePublisherForApplication(
  sourcePublisher: SourcePublisher,
): SourcePublisher {
  const result = validateSourcePublisher(sourcePublisher);

  if (!result.valid) {
    throw new ContentValidationError(result.issues);
  }

  return result.value;
}
