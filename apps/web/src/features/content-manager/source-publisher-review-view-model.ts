import { z } from "zod";
import {
  ContentPlatformSchema,
  SourcePublisherKindSchema,
  SourcePublisherStatusSchema,
  type ContentCategory,
  type PromoteSourcePublisherToSourceGroupRequest,
  type SourcePublisher,
} from "@/lib/api/content-manager-client";

export const SOURCE_PUBLISHER_STATUS_FILTER_OPTIONS = [
  "DISCOVERED",
  "APPROVED",
  "IGNORED",
  "BLOCKED",
] as const;

export const SOURCE_PUBLISHER_KIND_FILTER_OPTIONS = ["GROUP", "PAGE"] as const;
export const SOURCE_PUBLISHER_PLATFORM_FILTER_OPTIONS = ["FACEBOOK"] as const;

export const SourcePublisherFilterSchema = z
  .object({
    status: z.union([SourcePublisherStatusSchema, z.literal("ALL")]),
    kind: z.union([SourcePublisherKindSchema, z.literal("ALL")]),
    platform: z.union([ContentPlatformSchema, z.literal("ALL")]),
  })
  .strict();

export const SourcePublisherPromotionFormSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Category is required."),
    collectionPriority: z
      .number()
      .int("Collection priority must be an integer.")
      .min(0, "Collection priority must be at least 0.")
      .max(100, "Collection priority must be at most 100."),
    name: z.string(),
    url: z.string().refine(
      (value) => {
        const url = value.trim();

        return url.length === 0 || isHttpUrl(url);
      },
      { message: "URL must be a valid http or https URL." },
    ),
    notes: z.string(),
  })
  .strict();

export type SourcePublisherFilterValues = z.infer<
  typeof SourcePublisherFilterSchema
>;
export type SourcePublisherPromotionFormValues = z.infer<
  typeof SourcePublisherPromotionFormSchema
>;

export interface SourcePublisherPromotionGate {
  readonly allowed: boolean;
  readonly reason?: string;
}

export function getSourcePublisherDisplayName(
  sourcePublisher: SourcePublisher,
): string {
  return sourcePublisher.displayName ?? sourcePublisher.externalPublisherId;
}

export function getSourcePublisherPromotionGate(
  sourcePublisher: SourcePublisher,
  categories: readonly ContentCategory[],
): SourcePublisherPromotionGate {
  if (sourcePublisher.platform !== "FACEBOOK") {
    return { allowed: false, reason: "Only Facebook publishers can be promoted." };
  }

  if (sourcePublisher.kind !== "GROUP") {
    return { allowed: false, reason: "Only group publishers can be promoted." };
  }

  if (sourcePublisher.status !== "APPROVED") {
    return {
      allowed: false,
      reason: "Approve this group publisher before promotion.",
    };
  }

  if (categories.length === 0) {
    return {
      allowed: false,
      reason: "Create a content category before promoting a source publisher.",
    };
  }

  return { allowed: true };
}

export function toSourcePublisherPromotionDefaultValues(
  sourcePublisher: SourcePublisher,
  firstCategoryId: string | undefined,
): SourcePublisherPromotionFormValues {
  return {
    categoryId: firstCategoryId ?? "",
    collectionPriority: 50,
    name: getSourcePublisherDisplayName(sourcePublisher),
    url: sourcePublisher.canonicalUrl ?? "",
    notes: "",
  };
}

export function getSourcePublisherPromotionFormSchema(
  sourcePublisher: SourcePublisher,
) {
  return SourcePublisherPromotionFormSchema.superRefine((values, context) => {
    if (
      sourcePublisher.canonicalUrl === undefined &&
      values.url.trim().length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL is required when the publisher has no canonical URL.",
        path: ["url"],
      });
    }
  });
}

export function toPromoteSourcePublisherRequest(
  values: SourcePublisherPromotionFormValues,
): PromoteSourcePublisherToSourceGroupRequest {
  const name = values.name.trim();
  const url = values.url.trim();
  const notes = values.notes.trim();

  return {
    categoryId: values.categoryId,
    collectionPriority: values.collectionPriority,
    ...(name.length > 0 ? { name } : {}),
    ...(url.length > 0 ? { url } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
