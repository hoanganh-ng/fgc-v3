import {
  loadValidatedSourceGroupById,
  toIsoDateTime,
  validateCollectedContentInputForApplication,
  validateContentItemForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { ContentItemRepository } from "../ports/content-item-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import {
  mergeCollectedContent,
  normalizeTopComments,
} from "../../domain";
import type {
  CollectedContentInput,
  ContentItem,
} from "../../domain";

export class IngestCollectedContentUseCase {
  public constructor(
    private readonly contentItems: ContentItemRepository,
    private readonly sourceGroups: SourceGroupRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(input: CollectedContentInput): Promise<ContentItem> {
    const collectedContent = validateCollectedContentInputForApplication(input);

    await loadValidatedSourceGroupById(
      this.sourceGroups,
      collectedContent.sourceGroupId,
    );

    const existingContent =
      await this.contentItems.findByPlatformAndExternalPostId(
        collectedContent.platform,
        collectedContent.externalPostId,
      );
    const updatedAt = toIsoDateTime(this.clock.now());

    if (existingContent !== null) {
      const validExistingContent =
        validateContentItemForApplication(existingContent);
      const mergedContent = validateContentItemForApplication(
        mergeCollectedContent(
          validExistingContent,
          preserveMissingOptionalFields(validExistingContent, collectedContent),
          { updatedAt },
        ),
      );

      await this.contentItems.save(mergedContent);

      return mergedContent;
    }

    const newContent = validateContentItemForApplication({
      id: await this.ids.generateId(),
      platform: collectedContent.platform,
      sourceGroupId: collectedContent.sourceGroupId,
      externalPostId: collectedContent.externalPostId,
      sourceUrl: collectedContent.sourceUrl,
      ...(collectedContent.title !== undefined
        ? { title: collectedContent.title }
        : {}),
      bodyText: collectedContent.bodyText,
      ...(collectedContent.authorDisplayName !== undefined
        ? { authorDisplayName: collectedContent.authorDisplayName }
        : {}),
      ...(collectedContent.authorExternalId !== undefined
        ? { authorExternalId: collectedContent.authorExternalId }
        : {}),
      ...(collectedContent.postedAt !== undefined
        ? { postedAt: collectedContent.postedAt }
        : {}),
      firstCollectedAt: collectedContent.collectedAt,
      lastCollectedAt: collectedContent.collectedAt,
      reactionCount: collectedContent.reactionCount,
      commentCount: collectedContent.commentCount,
      ...(collectedContent.shareCount !== undefined
        ? { shareCount: collectedContent.shareCount }
        : {}),
      topComments: normalizeTopComments(collectedContent.topComments),
      status: "COLLECTED",
      ...(collectedContent.rawPayloadRef !== undefined
        ? { rawPayloadRef: collectedContent.rawPayloadRef }
        : {}),
      createdAt: updatedAt,
      updatedAt,
    });

    await this.contentItems.save(newContent);

    return newContent;
  }
}

function preserveMissingOptionalFields(
  existingContent: ContentItem,
  collectedContent: CollectedContentInput,
): CollectedContentInput {
  return {
    ...collectedContent,
    ...(collectedContent.title === undefined &&
    existingContent.title !== undefined
      ? { title: existingContent.title }
      : {}),
  };
}
