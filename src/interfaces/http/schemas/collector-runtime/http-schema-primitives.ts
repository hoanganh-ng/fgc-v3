import { z } from "zod";
import {
  DEFAULT_COLLECTION_RUN_LIST_LIMIT,
  MAX_COLLECTION_RUN_LIST_LIMIT,
} from "../../../../collector-runtime/application";

export { parseHttpInput } from "../http-validation";

export const nonEmptyStringJsonSchema = { type: "string", minLength: 1 } as const;

export const errorResponseJsonSchema = {
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

export const pageJsonSchema = {
  type: "object",
  required: ["limit", "offset"],
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_COLLECTION_RUN_LIST_LIMIT,
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

export const isoDateTimeJsonSchema = { type: "string", format: "date-time" } as const;

export const NonEmptyStringHttpSchema = z.string().trim().min(1);
