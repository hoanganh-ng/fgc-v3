import { z } from "zod";
import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  CollectedContentInputSchema,
  ContentCategoryIdSchema,
  ContentCategorySlugSchema,
  ContentIdSchema,
  ContentPlatformSchema,
  ContentStatusSchema,
  ExternalGroupIdSchema,
  ExternalPostIdSchema,
  IsoDateTimeSchema,
  SourceGroupIdSchema,
  SourceGroupStatusSchema,
  SOURCE_GROUP_STATUSES,
  TopCommentSchema,
} from "../../../content-manager/domain";
import {
  DEFAULT_CONTENT_ITEM_LIST_LIMIT,
  DEFAULT_SOURCE_GROUP_LIST_LIMIT,
  MAX_CONTENT_ITEM_LIST_LIMIT,
  MAX_SOURCE_GROUP_LIST_LIMIT,
} from "../../../content-manager/application";
export { parseHttpInput } from "./http-validation";

const NonEmptyStringHttpSchema = z.string().trim().min(1);

export const CreateContentCategoryHttpBodySchema = z
  .object({
    name: NonEmptyStringHttpSchema,
    slug: ContentCategorySlugSchema,
    description: NonEmptyStringHttpSchema.optional(),
  })
  .strict();

export const SourceGroupIdHttpParamsSchema = z
  .object({
    sourceGroupId: SourceGroupIdSchema,
  })
  .strict();

export const ContentItemIdHttpParamsSchema = z
  .object({
    contentItemId: ContentIdSchema,
  })
  .strict();

export const CreateSourceGroupHttpBodySchema = z
  .object({
    platform: ContentPlatformSchema,
    externalGroupId: ExternalGroupIdSchema,
    name: NonEmptyStringHttpSchema,
    url: NonEmptyStringHttpSchema,
    categoryId: ContentCategoryIdSchema,
    status: SourceGroupStatusSchema.optional(),
    collectionPriority: z.number().int().min(0).max(100),
    notes: NonEmptyStringHttpSchema.optional(),
  })
  .strict();

export const ListSourceGroupsHttpQuerySchema = z
  .object({
    status: SourceGroupStatusSchema.optional(),
    categoryId: ContentCategoryIdSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_SOURCE_GROUP_LIST_LIMIT)
      .default(DEFAULT_SOURCE_GROUP_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const UpdateSourceGroupStatusHttpBodySchema = z
  .object({
    status: SourceGroupStatusSchema,
  })
  .strict();

export const IngestCollectedContentHttpBodySchema = CollectedContentInputSchema;

export const ListContentItemsHttpQuerySchema = z
  .object({
    status: ContentStatusSchema.optional(),
    sourceGroupId: SourceGroupIdSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_CONTENT_ITEM_LIST_LIMIT)
      .default(DEFAULT_CONTENT_ITEM_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const UpdateContentStatusHttpBodySchema = z
  .object({
    status: ContentStatusSchema,
  })
  .strict();

export type CreateContentCategoryHttpBody = z.infer<
  typeof CreateContentCategoryHttpBodySchema
>;
export type SourceGroupIdHttpParams = z.infer<
  typeof SourceGroupIdHttpParamsSchema
>;
export type ContentItemIdHttpParams = z.infer<
  typeof ContentItemIdHttpParamsSchema
>;
export type CreateSourceGroupHttpBody = z.infer<
  typeof CreateSourceGroupHttpBodySchema
>;
export type ListSourceGroupsHttpQuery = z.infer<
  typeof ListSourceGroupsHttpQuerySchema
>;
export type UpdateSourceGroupStatusHttpBody = z.infer<
  typeof UpdateSourceGroupStatusHttpBodySchema
>;
export type IngestCollectedContentHttpBody = z.infer<
  typeof IngestCollectedContentHttpBodySchema
>;
export type ListContentItemsHttpQuery = z.infer<
  typeof ListContentItemsHttpQuerySchema
>;
export type UpdateContentStatusHttpBody = z.infer<
  typeof UpdateContentStatusHttpBodySchema
>;

const nonEmptyStringJsonSchema = { type: "string", minLength: 1 } as const;
const optionalStringJsonSchema = { type: "string" } as const;

const errorResponseJsonSchema = {
  type: "object",
  required: ["error"],
  additionalProperties: false,
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      additionalProperties: true,
      properties: {
        code: nonEmptyStringJsonSchema,
        message: nonEmptyStringJsonSchema,
      },
    },
  },
} as const;

const topCommentJsonSchema = {
  type: "object",
  required: [
    "externalCommentId",
    "bodyText",
    "reactionCount",
    "collectedAt",
  ],
  additionalProperties: false,
  properties: {
    externalCommentId: nonEmptyStringJsonSchema,
    bodyText: nonEmptyStringJsonSchema,
    authorDisplayName: nonEmptyStringJsonSchema,
    authorExternalId: nonEmptyStringJsonSchema,
    reactionCount: {
      type: "integer",
      minimum: 0,
    },
    replyCount: {
      type: "integer",
      minimum: 0,
    },
    postedAt: nonEmptyStringJsonSchema,
    collectedAt: nonEmptyStringJsonSchema,
  },
} as const;

const contentCategoryJsonSchema = {
  type: "object",
  required: ["id", "name", "slug", "createdAt", "updatedAt"],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    name: nonEmptyStringJsonSchema,
    slug: nonEmptyStringJsonSchema,
    description: nonEmptyStringJsonSchema,
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
  },
} as const;

const sourceGroupJsonSchema = {
  type: "object",
  required: [
    "id",
    "platform",
    "externalGroupId",
    "name",
    "url",
    "categoryId",
    "status",
    "collectionPriority",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    platform: {
      type: "string",
      enum: CONTENT_PLATFORMS,
    },
    externalGroupId: nonEmptyStringJsonSchema,
    name: nonEmptyStringJsonSchema,
    url: nonEmptyStringJsonSchema,
    categoryId: nonEmptyStringJsonSchema,
    status: {
      type: "string",
      enum: SOURCE_GROUP_STATUSES,
    },
    collectionPriority: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    notes: nonEmptyStringJsonSchema,
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
  },
} as const;

const contentItemJsonSchema = {
  type: "object",
  required: [
    "id",
    "platform",
    "sourceGroupId",
    "externalPostId",
    "sourceUrl",
    "bodyText",
    "firstCollectedAt",
    "lastCollectedAt",
    "reactionCount",
    "commentCount",
    "topComments",
    "status",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    platform: {
      type: "string",
      enum: CONTENT_PLATFORMS,
    },
    sourceGroupId: nonEmptyStringJsonSchema,
    externalPostId: nonEmptyStringJsonSchema,
    sourceUrl: nonEmptyStringJsonSchema,
    title: nonEmptyStringJsonSchema,
    bodyText: nonEmptyStringJsonSchema,
    authorDisplayName: nonEmptyStringJsonSchema,
    authorExternalId: nonEmptyStringJsonSchema,
    postedAt: nonEmptyStringJsonSchema,
    firstCollectedAt: nonEmptyStringJsonSchema,
    lastCollectedAt: nonEmptyStringJsonSchema,
    reactionCount: {
      type: "integer",
      minimum: 0,
    },
    commentCount: {
      type: "integer",
      minimum: 0,
    },
    shareCount: {
      type: "integer",
      minimum: 0,
    },
    topComments: {
      type: "array",
      items: topCommentJsonSchema,
    },
    status: {
      type: "string",
      enum: CONTENT_STATUSES,
    },
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
  },
} as const;

const sourceGroupsQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: SOURCE_GROUP_STATUSES,
    },
    categoryId: nonEmptyStringJsonSchema,
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_SOURCE_GROUP_LIST_LIMIT,
      default: DEFAULT_SOURCE_GROUP_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
    },
  },
} as const;

const contentItemsQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: CONTENT_STATUSES,
    },
    sourceGroupId: nonEmptyStringJsonSchema,
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_CONTENT_ITEM_LIST_LIMIT,
      default: DEFAULT_CONTENT_ITEM_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
    },
  },
} as const;

const pageJsonSchema = {
  type: "object",
  required: ["limit", "offset"],
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 100,
    },
    offset: {
      type: "integer",
      minimum: 0,
    },
    total: {
      type: "integer",
      minimum: 0,
    },
  },
} as const;

const sourceGroupIdParamsJsonSchema = {
  type: "object",
  required: ["sourceGroupId"],
  additionalProperties: false,
  properties: {
    sourceGroupId: nonEmptyStringJsonSchema,
  },
} as const;

const contentItemIdParamsJsonSchema = {
  type: "object",
  required: ["contentItemId"],
  additionalProperties: false,
  properties: {
    contentItemId: nonEmptyStringJsonSchema,
  },
} as const;

const contentCategoryBodyJsonSchema = {
  type: "object",
  required: ["name", "slug"],
  additionalProperties: false,
  properties: {
    name: nonEmptyStringJsonSchema,
    slug: nonEmptyStringJsonSchema,
    description: nonEmptyStringJsonSchema,
  },
} as const;

const sourceGroupBodyJsonSchema = {
  type: "object",
  required: [
    "platform",
    "externalGroupId",
    "name",
    "url",
    "categoryId",
    "collectionPriority",
  ],
  additionalProperties: false,
  properties: {
    platform: {
      type: "string",
      enum: CONTENT_PLATFORMS,
    },
    externalGroupId: nonEmptyStringJsonSchema,
    name: nonEmptyStringJsonSchema,
    url: nonEmptyStringJsonSchema,
    categoryId: nonEmptyStringJsonSchema,
    status: {
      type: "string",
      enum: SOURCE_GROUP_STATUSES,
    },
    collectionPriority: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    notes: nonEmptyStringJsonSchema,
  },
} as const;

const sourceGroupStatusBodyJsonSchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: SOURCE_GROUP_STATUSES,
    },
  },
} as const;

const topCommentBodyJsonSchema = {
  ...topCommentJsonSchema,
} as const;

const contentItemIngestBodyJsonSchema = {
  type: "object",
  required: [
    "platform",
    "sourceGroupId",
    "externalPostId",
    "sourceUrl",
    "bodyText",
    "collectedAt",
    "reactionCount",
    "commentCount",
    "topComments",
  ],
  additionalProperties: false,
  properties: {
    platform: {
      type: "string",
      enum: CONTENT_PLATFORMS,
    },
    sourceGroupId: nonEmptyStringJsonSchema,
    externalPostId: nonEmptyStringJsonSchema,
    sourceUrl: nonEmptyStringJsonSchema,
    title: nonEmptyStringJsonSchema,
    bodyText: nonEmptyStringJsonSchema,
    authorDisplayName: nonEmptyStringJsonSchema,
    authorExternalId: nonEmptyStringJsonSchema,
    postedAt: nonEmptyStringJsonSchema,
    collectedAt: nonEmptyStringJsonSchema,
    reactionCount: {
      type: "integer",
      minimum: 0,
    },
    commentCount: {
      type: "integer",
      minimum: 0,
    },
    shareCount: {
      type: "integer",
      minimum: 0,
    },
    topComments: {
      type: "array",
      items: topCommentBodyJsonSchema,
    },
    rawPayloadRef: nonEmptyStringJsonSchema,
  },
} as const;

const contentStatusBodyJsonSchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: CONTENT_STATUSES,
    },
  },
} as const;

export const createContentCategoryHttpRouteSchema = {
  body: contentCategoryBodyJsonSchema,
  response: {
    201: {
      type: "object",
      required: ["category"],
      additionalProperties: false,
      properties: {
        category: contentCategoryJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listContentCategoriesHttpRouteSchema = {
  response: {
    200: {
      type: "object",
      required: ["items"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: contentCategoryJsonSchema,
        },
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const createSourceGroupHttpRouteSchema = {
  body: sourceGroupBodyJsonSchema,
  response: {
    201: {
      type: "object",
      required: ["sourceGroup"],
      additionalProperties: false,
      properties: {
        sourceGroup: sourceGroupJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listSourceGroupsHttpRouteSchema = {
  querystring: sourceGroupsQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: sourceGroupJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const updateSourceGroupStatusHttpRouteSchema = {
  params: sourceGroupIdParamsJsonSchema,
  body: sourceGroupStatusBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["sourceGroup"],
      additionalProperties: false,
      properties: {
        sourceGroup: sourceGroupJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const ingestCollectedContentHttpRouteSchema = {
  body: contentItemIngestBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["contentItem"],
      additionalProperties: false,
      properties: {
        contentItem: contentItemJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listContentItemsHttpRouteSchema = {
  querystring: contentItemsQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: contentItemJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getContentItemHttpRouteSchema = {
  params: contentItemIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["contentItem"],
      additionalProperties: false,
      properties: {
        contentItem: contentItemJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const updateContentStatusHttpRouteSchema = {
  params: contentItemIdParamsJsonSchema,
  body: contentStatusBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["contentItem"],
      additionalProperties: false,
      properties: {
        contentItem: contentItemJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
