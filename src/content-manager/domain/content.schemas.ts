import { z } from "zod";
import { ContentCollectionProvenanceSchema } from "./content-collection-provenance.schemas";
import { CONTENT_PLATFORMS } from "./content-platform";
import { CONTENT_STATUSES } from "./content-status";
import { SourceGroupIdSchema } from "./shared-identifier.schemas";
import {
  SOURCE_GROUP_ENTRY_ROUTE_RISK_LEVELS,
  SOURCE_GROUP_ENTRY_ROUTE_TYPES,
} from "./source-group-entry-route";
import { SOURCE_GROUP_STATUSES } from "./source-group-status";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

const NonNegativeIntegerSchema = z.number().int().min(0);

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const ContentIdSchema = NonEmptyStringSchema;
export const ContentCategoryIdSchema = NonEmptyStringSchema;
// `SourceGroupIdSchema` is re-exported below for callers that still
// import it from `content.schemas`. The schema itself is owned by
// `./shared-identifier.schemas`.
export { SourceGroupIdSchema };
export const SourceGroupEntryRouteIdSchema = NonEmptyStringSchema;
export const ExternalGroupIdSchema = NonEmptyStringSchema;
export const ExternalPostIdSchema = NonEmptyStringSchema;
export const ExternalCommentIdSchema = NonEmptyStringSchema;
export const ContentPlatformSchema = z.enum(CONTENT_PLATFORMS);
export const SourceGroupStatusSchema = z.enum(SOURCE_GROUP_STATUSES);
export const SourceGroupEntryRouteTypeSchema = z.enum(
  SOURCE_GROUP_ENTRY_ROUTE_TYPES,
);
export const SourceGroupEntryRouteRiskLevelSchema = z.enum(
  SOURCE_GROUP_ENTRY_ROUTE_RISK_LEVELS,
);
export const ContentStatusSchema = z.enum(CONTENT_STATUSES);
export const ContentCategorySlugSchema = z
  .string()
  .regex(slugPattern, "Expected lowercase URL-safe slug.");

export const ContentCategorySchema = z
  .object({
    id: ContentCategoryIdSchema,
    name: NonEmptyStringSchema,
    slug: ContentCategorySlugSchema,
    description: NonEmptyStringSchema.optional(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const SourceGroupEntryRouteSchema = z
  .object({
    id: SourceGroupEntryRouteIdSchema,
    type: SourceGroupEntryRouteTypeSchema,
    url: z.url(),
    label: NonEmptyStringSchema.optional(),
    notes: NonEmptyStringSchema.optional(),
    riskLevel: SourceGroupEntryRouteRiskLevelSchema,
    isDefault: z.boolean(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const SourceGroupSchema = z
  .object({
    id: SourceGroupIdSchema,
    platform: ContentPlatformSchema,
    externalGroupId: ExternalGroupIdSchema,
    name: NonEmptyStringSchema,
    url: NonEmptyStringSchema,
    categoryId: ContentCategoryIdSchema,
    status: SourceGroupStatusSchema,
    collectionPriority: z.number().int().min(0).max(100),
    notes: NonEmptyStringSchema.optional(),
    entryRoutes: z.array(SourceGroupEntryRouteSchema),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((sourceGroup, context) => {
    const defaultRoutes = sourceGroup.entryRoutes.filter(
      (route) => route.isDefault,
    );

    if (defaultRoutes.length > 1) {
      context.addIssue({
        code: "custom",
        path: ["entryRoutes"],
        message: "At most one source group entry route can be default.",
      });
    }

    const routeIds = new Set<string>();

    for (const [index, route] of sourceGroup.entryRoutes.entries()) {
      if (routeIds.has(route.id)) {
        context.addIssue({
          code: "custom",
          path: ["entryRoutes", index, "id"],
          message: "Source group entry route ids must be unique.",
        });
      }

      routeIds.add(route.id);
    }
  });

export const TopCommentSchema = z
  .object({
    externalCommentId: ExternalCommentIdSchema,
    bodyText: NonEmptyStringSchema,
    authorDisplayName: NonEmptyStringSchema.optional(),
    authorExternalId: NonEmptyStringSchema.optional(),
    reactionCount: NonNegativeIntegerSchema,
    replyCount: NonNegativeIntegerSchema.optional(),
    postedAt: IsoDateTimeSchema.optional(),
    collectedAt: IsoDateTimeSchema,
  })
  .strict();

export const ContentItemSchema = z
  .object({
    id: ContentIdSchema,
    platform: ContentPlatformSchema,
    sourceGroupId: SourceGroupIdSchema,
    externalPostId: ExternalPostIdSchema,
    sourceUrl: NonEmptyStringSchema,
    title: NonEmptyStringSchema.optional(),
    bodyText: NonEmptyStringSchema,
    authorDisplayName: NonEmptyStringSchema.optional(),
    authorExternalId: NonEmptyStringSchema.optional(),
    postedAt: IsoDateTimeSchema.optional(),
    firstCollectedAt: IsoDateTimeSchema,
    lastCollectedAt: IsoDateTimeSchema,
    reactionCount: NonNegativeIntegerSchema,
    commentCount: NonNegativeIntegerSchema,
    shareCount: NonNegativeIntegerSchema.optional(),
    topComments: z.array(TopCommentSchema),
    status: ContentStatusSchema,
    rawPayloadRef: NonEmptyStringSchema.optional(),
    collectionProvenance: ContentCollectionProvenanceSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((item, context) => {
    const provenance = item.collectionProvenance;
    const surface = provenance.firstCollectionSurface;

    if (surface.kind === "SOURCE_GROUP") {
      const surfaceSourceGroupId = surface.sourceGroupId;

      if (
        provenance.managedSourceGroupId !== undefined &&
        provenance.managedSourceGroupId !== surfaceSourceGroupId
      ) {
        context.addIssue({
          code: "custom",
          path: ["collectionProvenance", "managedSourceGroupId"],
          message:
            "managedSourceGroupId must equal firstCollectionSurface.sourceGroupId when firstCollectionSurface.kind is SOURCE_GROUP.",
        });
      }

      if (item.sourceGroupId !== surfaceSourceGroupId) {
        context.addIssue({
          code: "custom",
          path: ["collectionProvenance", "firstCollectionSurface"],
          message:
            "collectionProvenance.firstCollectionSurface.sourceGroupId must equal sourceGroupId for a SOURCE_GROUP surface.",
        });
      }

      return;
    }

    // PROFILE_HOME_FEED first surface.
    // The legacy `sourceGroupId` field remains required for
    // compatibility. When the first surface is a home feed, the
    // durable provenance must carry a `managedSourceGroupId` that
    // equals the legacy `sourceGroupId`; bare home-feed ingestion is
    // still unsupported.
    if (provenance.managedSourceGroupId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["collectionProvenance", "managedSourceGroupId"],
        message:
          "managedSourceGroupId is required when firstCollectionSurface.kind is PROFILE_HOME_FEED for a ContentItem.",
      });
      return;
    }

    if (provenance.managedSourceGroupId !== item.sourceGroupId) {
      context.addIssue({
        code: "custom",
        path: ["collectionProvenance", "managedSourceGroupId"],
        message:
          "managedSourceGroupId must equal sourceGroupId when firstCollectionSurface.kind is PROFILE_HOME_FEED.",
      });
    }
  });

export const CollectedContentInputSchema = z
  .object({
    platform: ContentPlatformSchema,
    sourceGroupId: SourceGroupIdSchema,
    externalPostId: ExternalPostIdSchema,
    sourceUrl: NonEmptyStringSchema,
    title: NonEmptyStringSchema.optional(),
    bodyText: NonEmptyStringSchema,
    authorDisplayName: NonEmptyStringSchema.optional(),
    authorExternalId: NonEmptyStringSchema.optional(),
    postedAt: IsoDateTimeSchema.optional(),
    collectedAt: IsoDateTimeSchema,
    reactionCount: NonNegativeIntegerSchema,
    commentCount: NonNegativeIntegerSchema,
    shareCount: NonNegativeIntegerSchema.optional(),
    topComments: z.array(TopCommentSchema),
    rawPayloadRef: NonEmptyStringSchema.optional(),
  })
  .strict();
