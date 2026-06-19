import { z } from "zod";
import { SourceGroupIdSchema } from "./content.schemas";
import { SourcePublisherIdSchema } from "./source-publisher.schemas";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

export const CollectionSurfaceKindSchema = z.enum([
  "SOURCE_GROUP",
  "PROFILE_HOME_FEED",
]);

export const SourceGroupCollectionSurfaceSchema = z
  .object({
    kind: z.literal("SOURCE_GROUP"),
    sourceGroupId: SourceGroupIdSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionSurfaceSchema = z
  .object({
    kind: z.literal("PROFILE_HOME_FEED"),
  })
  .strict();

export const CollectionSurfaceSchema = z.discriminatedUnion("kind", [
  SourceGroupCollectionSurfaceSchema,
  ProfileHomeFeedCollectionSurfaceSchema,
]);

export const ManagedSourceGroupIdSchema = SourceGroupIdSchema;

export const CollectedContentProvenanceInputSchema = z
  .object({
    collectionSurface: CollectionSurfaceSchema,
    sourcePublisherId: SourcePublisherIdSchema.optional(),
    managedSourceGroupId: ManagedSourceGroupIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.collectionSurface.kind === "SOURCE_GROUP") {
      const surfaceSourceGroupId = value.collectionSurface.sourceGroupId;

      if (value.managedSourceGroupId === undefined) {
        context.addIssue({
          code: "custom",
          path: ["managedSourceGroupId"],
          message:
            "managedSourceGroupId is required when collectionSurface.kind is SOURCE_GROUP.",
        });
        return;
      }

      if (value.managedSourceGroupId !== surfaceSourceGroupId) {
        context.addIssue({
          code: "custom",
          path: ["managedSourceGroupId"],
          message:
            "managedSourceGroupId must equal collectionSurface.sourceGroupId when collectionSurface.kind is SOURCE_GROUP.",
        });
      }
    } else if (value.managedSourceGroupId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["managedSourceGroupId"],
        message:
          "managedSourceGroupId must be omitted when collectionSurface.kind is PROFILE_HOME_FEED.",
      });
    }
  });

export const ContentCollectionProvenanceSchema = z
  .object({
    firstCollectionSurface: CollectionSurfaceSchema,
    sourcePublisherId: SourcePublisherIdSchema.optional(),
    managedSourceGroupId: ManagedSourceGroupIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.firstCollectionSurface.kind === "SOURCE_GROUP" &&
      value.managedSourceGroupId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["managedSourceGroupId"],
        message:
          "managedSourceGroupId is required when firstCollectionSurface.kind is SOURCE_GROUP.",
      });
    } else if (
      value.firstCollectionSurface.kind === "PROFILE_HOME_FEED" &&
      value.managedSourceGroupId !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["managedSourceGroupId"],
        message:
          "managedSourceGroupId must be omitted when firstCollectionSurface.kind is PROFILE_HOME_FEED.",
      });
    }
  });

export const ProvenanceConflictFieldSchema = z.enum([
  "sourcePublisherId",
  "managedSourceGroupId",
]);

// Re-export the non-empty string schema for downstream typing convenience.
export { NonEmptyStringSchema };
