import type { infer as zInfer } from "zod";
import type {
  CollectedContentInputSchema,
  ContentCategoryIdSchema,
  ContentCategorySchema,
  ContentIdSchema,
  ContentItemSchema,
  ExternalCommentIdSchema,
  ExternalGroupIdSchema,
  ExternalPostIdSchema,
  IsoDateTimeSchema,
  SourceGroupIdSchema,
  SourceGroupSchema,
  TopCommentSchema,
} from "./content.schemas";

export const DEFAULT_TOP_COMMENT_LIMIT = 10;

export type IsoDateTime = zInfer<typeof IsoDateTimeSchema>;
export type ContentId = zInfer<typeof ContentIdSchema>;
export type ContentCategoryId = zInfer<typeof ContentCategoryIdSchema>;
export type SourceGroupId = zInfer<typeof SourceGroupIdSchema>;
export type ExternalGroupId = zInfer<typeof ExternalGroupIdSchema>;
export type ExternalPostId = zInfer<typeof ExternalPostIdSchema>;
export type ExternalCommentId = zInfer<typeof ExternalCommentIdSchema>;
export type ContentCategory = zInfer<typeof ContentCategorySchema>;
export type SourceGroup = zInfer<typeof SourceGroupSchema>;
export type TopComment = zInfer<typeof TopCommentSchema>;
export type ContentItem = zInfer<typeof ContentItemSchema>;
export type CollectedContentInput = zInfer<typeof CollectedContentInputSchema>;

export interface MergeCollectedContentOptions {
  readonly updatedAt: IsoDateTime;
  readonly topCommentLimit?: number;
}

export function normalizeTopComments(
  comments: readonly TopComment[],
  limit = DEFAULT_TOP_COMMENT_LIMIT,
): TopComment[] {
  return [...comments]
    .sort(compareTopComments)
    .slice(0, normalizeLimit(limit));
}

export function mergeCollectedContent(
  existing: ContentItem,
  incoming: CollectedContentInput,
  options: MergeCollectedContentOptions,
): ContentItem {
  return {
    ...existing,
    sourceUrl: incoming.sourceUrl,
    title: incoming.title,
    bodyText: incoming.bodyText,
    authorDisplayName:
      incoming.authorDisplayName ?? existing.authorDisplayName,
    authorExternalId: incoming.authorExternalId ?? existing.authorExternalId,
    postedAt: incoming.postedAt ?? existing.postedAt,
    lastCollectedAt: incoming.collectedAt,
    reactionCount: incoming.reactionCount,
    commentCount: incoming.commentCount,
    shareCount: incoming.shareCount,
    topComments: normalizeTopComments(
      incoming.topComments,
      options.topCommentLimit,
    ),
    rawPayloadRef: incoming.rawPayloadRef ?? existing.rawPayloadRef,
    updatedAt: options.updatedAt,
  };
}

function compareTopComments(left: TopComment, right: TopComment): number {
  if (left.reactionCount !== right.reactionCount) {
    return right.reactionCount - left.reactionCount;
  }

  const idComparison = left.externalCommentId.localeCompare(
    right.externalCommentId,
  );

  if (idComparison !== 0) {
    return idComparison;
  }

  const collectedAtComparison = left.collectedAt.localeCompare(right.collectedAt);

  if (collectedAtComparison !== 0) {
    return collectedAtComparison;
  }

  return left.bodyText.localeCompare(right.bodyText);
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return Math.floor(limit);
}
