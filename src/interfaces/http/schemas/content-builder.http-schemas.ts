import { z } from "zod";
import {
  TransformTypeIdSchema,
  TransformTypeStatusSchema,
  TRANSFORM_TYPE_STATUSES,
} from "../../../content-builder/domain";
import {
  DEFAULT_TRANSFORM_TYPE_LIST_LIMIT,
  MAX_TRANSFORM_TYPE_LIST_LIMIT,
} from "../../../content-builder/application";
export { parseHttpInput } from "./http-validation";

const NonEmptyStringHttpSchema = z.string().trim().min(1);

const OptionalDescriptionHttpSchema = z.string().trim();

export const CreateTransformTypeHttpBodySchema = z
  .object({
    name: NonEmptyStringHttpSchema,
    description: OptionalDescriptionHttpSchema.optional(),
    initialPrompt: NonEmptyStringHttpSchema,
  })
  .strict();

export const UpdateTransformTypeHttpBodySchema = z
  .object({
    name: NonEmptyStringHttpSchema.optional(),
    description: OptionalDescriptionHttpSchema.nullable().optional(),
    initialPrompt: NonEmptyStringHttpSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one transform type field is required.",
  });

export const TransformTypeIdHttpParamsSchema = z
  .object({
    transformTypeId: TransformTypeIdSchema,
  })
  .strict();

export const ListTransformTypesHttpQuerySchema = z
  .object({
    status: TransformTypeStatusSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_TRANSFORM_TYPE_LIST_LIMIT)
      .default(DEFAULT_TRANSFORM_TYPE_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CreateTransformTypeHttpBody = z.infer<
  typeof CreateTransformTypeHttpBodySchema
>;
export type UpdateTransformTypeHttpBody = z.infer<
  typeof UpdateTransformTypeHttpBodySchema
>;
export type TransformTypeIdHttpParams = z.infer<
  typeof TransformTypeIdHttpParamsSchema
>;
export type ListTransformTypesHttpQuery = z.infer<
  typeof ListTransformTypesHttpQuerySchema
>;

const nonEmptyStringJsonSchema = { type: "string", minLength: 1 } as const;

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

const pageJsonSchema = {
  type: "object",
  required: ["limit", "offset"],
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_TRANSFORM_TYPE_LIST_LIMIT,
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

const transformTypeJsonSchema = {
  type: "object",
  required: [
    "transformTypeId",
    "name",
    "initialPrompt",
    "status",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    transformTypeId: nonEmptyStringJsonSchema,
    name: nonEmptyStringJsonSchema,
    description: { type: "string" },
    initialPrompt: nonEmptyStringJsonSchema,
    status: {
      type: "string",
      enum: TRANSFORM_TYPE_STATUSES,
    },
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
  },
} as const;

const transformTypeResponseJsonSchema = {
  type: "object",
  required: ["transformType"],
  additionalProperties: false,
  properties: {
    transformType: transformTypeJsonSchema,
  },
} as const;

const transformTypeListResponseJsonSchema = {
  type: "object",
  required: ["items", "page"],
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: transformTypeJsonSchema,
    },
    page: pageJsonSchema,
  },
} as const;

const transformTypeIdParamsJsonSchema = {
  type: "object",
  required: ["transformTypeId"],
  additionalProperties: false,
  properties: {
    transformTypeId: nonEmptyStringJsonSchema,
  },
} as const;

const createTransformTypeBodyJsonSchema = {
  type: "object",
  required: ["name", "initialPrompt"],
  additionalProperties: false,
  properties: {
    name: nonEmptyStringJsonSchema,
    description: { type: "string" },
    initialPrompt: nonEmptyStringJsonSchema,
  },
} as const;

const updateTransformTypeBodyJsonSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: nonEmptyStringJsonSchema,
    description: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    initialPrompt: nonEmptyStringJsonSchema,
  },
} as const;

const listTransformTypesQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: TRANSFORM_TYPE_STATUSES,
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_TRANSFORM_TYPE_LIST_LIMIT,
      default: DEFAULT_TRANSFORM_TYPE_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
    },
  },
} as const;

export const createTransformTypeHttpRouteSchema = {
  body: createTransformTypeBodyJsonSchema,
  response: {
    201: transformTypeResponseJsonSchema,
    400: errorResponseJsonSchema,
    409: errorResponseJsonSchema,
  },
} as const;

export const listTransformTypesHttpRouteSchema = {
  querystring: listTransformTypesQueryJsonSchema,
  response: {
    200: transformTypeListResponseJsonSchema,
    400: errorResponseJsonSchema,
  },
} as const;

export const getTransformTypeHttpRouteSchema = {
  params: transformTypeIdParamsJsonSchema,
  response: {
    200: transformTypeResponseJsonSchema,
    404: errorResponseJsonSchema,
  },
} as const;

export const updateTransformTypeHttpRouteSchema = {
  params: transformTypeIdParamsJsonSchema,
  body: updateTransformTypeBodyJsonSchema,
  response: {
    200: transformTypeResponseJsonSchema,
    400: errorResponseJsonSchema,
    404: errorResponseJsonSchema,
    409: errorResponseJsonSchema,
  },
} as const;

export const archiveTransformTypeHttpRouteSchema = {
  params: transformTypeIdParamsJsonSchema,
  response: {
    200: transformTypeResponseJsonSchema,
    404: errorResponseJsonSchema,
  },
} as const;
