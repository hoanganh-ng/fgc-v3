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
  SourceGroupEntryRouteIdSchema,
  SourceGroupEntryRouteSchema,
  SourceGroupIdSchema,
  SourceGroupSchema,
  TopCommentSchema,
} from "./content.schemas";
import {
  SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_ID,
  SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_RISK_LEVEL,
} from "./source-group-entry-route";

export const DEFAULT_TOP_COMMENT_LIMIT = 10;

export type IsoDateTime = zInfer<typeof IsoDateTimeSchema>;
export type ContentId = zInfer<typeof ContentIdSchema>;
export type ContentCategoryId = zInfer<typeof ContentCategoryIdSchema>;
export type SourceGroupId = zInfer<typeof SourceGroupIdSchema>;
export type SourceGroupEntryRouteId = zInfer<
  typeof SourceGroupEntryRouteIdSchema
>;
export type ExternalGroupId = zInfer<typeof ExternalGroupIdSchema>;
export type ExternalPostId = zInfer<typeof ExternalPostIdSchema>;
export type ExternalCommentId = zInfer<typeof ExternalCommentIdSchema>;
export type ContentCategory = zInfer<typeof ContentCategorySchema>;
export type SourceGroupEntryRoute = zInfer<
  typeof SourceGroupEntryRouteSchema
>;
export type SourceGroup = zInfer<typeof SourceGroupSchema>;
export type TopComment = zInfer<typeof TopCommentSchema>;
export type ContentItem = zInfer<typeof ContentItemSchema>;
export type CollectedContentInput = zInfer<typeof CollectedContentInputSchema>;

export interface MergeCollectedContentOptions {
  readonly updatedAt: IsoDateTime;
  readonly topCommentLimit?: number;
}

export function createDefaultSourceGroupEntryRoute(
  sourceGroup: Pick<SourceGroup, "url" | "createdAt" | "updatedAt">,
): SourceGroupEntryRoute {
  return {
    id: SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_ID,
    type: "DIRECT_GROUP_URL",
    url: sourceGroup.url,
    riskLevel: SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_RISK_LEVEL,
    isDefault: true,
    createdAt: sourceGroup.createdAt,
    updatedAt: sourceGroup.updatedAt,
  };
}

export function resolveSourceGroupEntryRoutes(
  sourceGroup: SourceGroup,
): readonly SourceGroupEntryRoute[] {
  if (sourceGroup.entryRoutes.some((route) => route.isDefault)) {
    return sourceGroup.entryRoutes;
  }

  const directRouteIndex = sourceGroup.entryRoutes.findIndex(
    (route) => route.id === SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_ID,
  );

  if (directRouteIndex >= 0) {
    return sourceGroup.entryRoutes.map((route, index) =>
      index === directRouteIndex ? { ...route, isDefault: true } : route,
    );
  }

  return [
    createDefaultSourceGroupEntryRoute(sourceGroup),
    ...sourceGroup.entryRoutes,
  ];
}

export function withDefaultSourceGroupEntryRoutes(
  sourceGroup: SourceGroup,
): SourceGroup {
  return {
    ...sourceGroup,
    entryRoutes: [...resolveSourceGroupEntryRoutes(sourceGroup)],
  };
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
