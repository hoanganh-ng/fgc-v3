import { z } from "zod";

/**
 * Shared Content Manager identifier schemas.
 *
 * These narrow schemas are the single source of truth for
 * `SourceGroupId` and `SourcePublisherId` identifier strings. They
 * are owned by the Content Manager domain so other Content Manager
 * schemas can compose them without creating circular imports through
 * the aggregate-root schema modules (`content.schemas`,
 * `source-publisher.schemas`).
 *
 * Existing schema modules re-export these identifiers for backwards
 * compatibility with callers that import them from their original
 * location.
 */

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

export const SourceGroupIdSchema = NonEmptyStringSchema;
export const SourcePublisherIdSchema = NonEmptyStringSchema;