import {
  HomeFeedCollectedContentPlatformMismatchError,
} from "../application-errors";
import {
  loadValidatedSourcePublisherById,
  toIsoDateTime,
  validateContentItemForApplication,
  validateHomeFeedCollectedContentInputForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { ContentItemRepository } from "../ports/content-item-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import {
  createInitialContentCollectionProvenance,
  mergeContentCollectionProvenance,
  normalizeTopComments,
} from "../../domain";
import type {
  ContentItem,
  HomeFeedCollectedContentInput,
  IsoDateTime,
} from "../../domain";

export class IngestHomeFeedCollectedContentUseCase {
  public constructor(
    private readonly contentItems: ContentItemRepository,
    private readonly sourcePublishers: SourcePublisherRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: HomeFeedCollectedContentInput,
  ): Promise<ContentItem> {
    const collectedContent =
      validateHomeFeedCollectedContentInputForApplication(input);

    const publisher = await loadValidatedSourcePublisherById(
      this.sourcePublishers,
      collectedContent.sourcePublisherId,
    );

    if (publisher.platform !== collectedContent.platform) {
      throw new HomeFeedCollectedContentPlatformMismatchError(
        collectedContent.sourcePublisherId,
        publisher.platform,
        collectedContent.platform,
      );
    }

    const existingContent =
      await this.contentItems.findByPlatformAndExternalPostId(
        collectedContent.platform,
        collectedContent.externalPostId,
      );
    const updatedAt = toIsoDateTime(this.clock.now());

    if (existingContent !== null) {
      const validExistingContent =
        validateContentItemForApplication(existingContent);
      const mergedProvenance = mergeContentCollectionProvenance(
        validExistingContent.collectionProvenance,
        buildHomeFeedProvenanceInput(collectedContent.sourcePublisherId),
      );

      const mergedContent = validateContentItemForApplication(
        applyHomeFeedObservation(
          validExistingContent,
          collectedContent,
          { updatedAt, collectionProvenance: mergedProvenance },
        ),
      );

      await this.contentItems.save(mergedContent);

      return mergedContent;
    }

    const initialProvenance = createInitialContentCollectionProvenance(
      buildHomeFeedProvenanceInput(collectedContent.sourcePublisherId),
    );
    const newContent = validateContentItemForApplication({
      id: await this.ids.generateId(),
      platform: collectedContent.platform,
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
      collectionProvenance: initialProvenance,
      createdAt: updatedAt,
      updatedAt,
    });

    await this.contentItems.save(newContent);

    return newContent;
  }
}

interface ApplyHomeFeedObservationOptions {
  readonly updatedAt: IsoDateTime;
  readonly collectionProvenance: ContentItem["collectionProvenance"];
}

function applyHomeFeedObservation(
  existing: ContentItem,
  incoming: HomeFeedCollectedContentInput,
  options: ApplyHomeFeedObservationOptions,
): ContentItem {
  return {
    ...existing,
    sourceUrl: incoming.sourceUrl,
    title: incoming.title ?? existing.title,
    bodyText: incoming.bodyText,
    authorDisplayName:
      incoming.authorDisplayName ?? existing.authorDisplayName,
    authorExternalId: incoming.authorExternalId ?? existing.authorExternalId,
    postedAt: incoming.postedAt ?? existing.postedAt,
    lastCollectedAt: incoming.collectedAt,
    reactionCount: incoming.reactionCount,
    commentCount: incoming.commentCount,
    shareCount: incoming.shareCount ?? existing.shareCount,
    topComments: normalizeTopComments(incoming.topComments),
    collectionProvenance: options.collectionProvenance,
    updatedAt: options.updatedAt,
  };
}

function buildHomeFeedProvenanceInput(sourcePublisherId: string) {
  return {
    collectionSurface: { kind: "PROFILE_HOME_FEED" as const },
    sourcePublisherId,
  };
}