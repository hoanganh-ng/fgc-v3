import { z } from "zod";
import { CONTENT_PLATFORMS } from "./content-platform";
import { CONTENT_STATUSES } from "./content-status";
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
export const SourceGroupIdSchema = NonEmptyStringSchema;
export const ExternalGroupIdSchema = NonEmptyStringSchema;
export const ExternalPostIdSchema = NonEmptyStringSchema;
export const ExternalCommentIdSchema = NonEmptyStringSchema;
export const ContentPlatformSchema = z.enum(CONTENT_PLATFORMS);
export const SourceGroupStatusSchema = z.enum(SOURCE_GROUP_STATUSES);
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
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

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
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

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
