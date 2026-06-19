import type { infer as zInfer } from "zod";
import { ContentCollectionProvenanceConflictError } from "./content-errors";
import type { SourcePublisherId } from "./source-publisher";
import {
  CollectedContentProvenanceInputSchema,
  CollectionSurfaceSchema,
  ContentCollectionProvenanceSchema,
  ProfileHomeFeedCollectionSurfaceSchema,
  ProvenanceConflictFieldSchema,
  SourceGroupCollectionSurfaceSchema,
} from "./content-collection-provenance.schemas";
import type { SourceGroupId } from "./content";

export type CollectionSurfaceKind = zInfer<
  typeof CollectionSurfaceSchema
>["kind"];
export type SourceGroupCollectionSurface = zInfer<
  typeof SourceGroupCollectionSurfaceSchema
>;
export type ProfileHomeFeedCollectionSurface = zInfer<
  typeof ProfileHomeFeedCollectionSurfaceSchema
>;
export type CollectionSurface = zInfer<typeof CollectionSurfaceSchema>;
export type CollectedContentProvenanceInput = zInfer<
  typeof CollectedContentProvenanceInputSchema
>;
export type ContentCollectionProvenance = zInfer<
  typeof ContentCollectionProvenanceSchema
>;
export type ProvenanceConflictField = zInfer<
  typeof ProvenanceConflictFieldSchema
>;

export function createInitialContentCollectionProvenance(
  input: CollectedContentProvenanceInput,
): ContentCollectionProvenance {
  return buildProvenance(input, input.collectionSurface);
}

export function mergeContentCollectionProvenance(
  existing: ContentCollectionProvenance,
  incoming: CollectedContentProvenanceInput,
): ContentCollectionProvenance {
  return buildProvenance(incoming, existing.firstCollectionSurface, existing);
}

function buildProvenance(
  input: CollectedContentProvenanceInput,
  firstCollectionSurface: CollectionSurface,
  existing?: ContentCollectionProvenance,
): ContentCollectionProvenance {
  const nextSourcePublisherId = resolveSourcePublisherId(
    existing?.sourcePublisherId,
    input.sourcePublisherId,
  );
  const nextManagedSourceGroupId = resolveManagedSourceGroupId(
    existing?.managedSourceGroupId,
    input.managedSourceGroupId,
  );

  return {
    firstCollectionSurface,
    ...(nextSourcePublisherId !== undefined
      ? { sourcePublisherId: nextSourcePublisherId }
      : {}),
    ...(nextManagedSourceGroupId !== undefined
      ? { managedSourceGroupId: nextManagedSourceGroupId }
      : {}),
  };
}

function resolveSourcePublisherId(
  existing: SourcePublisherId | undefined,
  incoming: SourcePublisherId | undefined,
): SourcePublisherId | undefined {
  if (incoming === undefined) {
    return existing;
  }

  if (existing !== undefined && existing !== incoming) {
    throw new ContentCollectionProvenanceConflictError(
      "sourcePublisherId",
      existing,
      incoming,
    );
  }

  return incoming;
}

function resolveManagedSourceGroupId(
  existing: SourceGroupId | undefined,
  incoming: SourceGroupId | undefined,
): SourceGroupId | undefined {
  if (incoming === undefined) {
    return existing;
  }

  if (existing !== undefined && existing !== incoming) {
    throw new ContentCollectionProvenanceConflictError(
      "managedSourceGroupId",
      existing,
      incoming,
    );
  }

  return incoming;
}

export function isSourceGroupCollectionSurface(
  surface: CollectionSurface,
): surface is SourceGroupCollectionSurface {
  return surface.kind === "SOURCE_GROUP";
}

export function isProfileHomeFeedCollectionSurface(
  surface: CollectionSurface,
): surface is ProfileHomeFeedCollectionSurface {
  return surface.kind === "PROFILE_HOME_FEED";
}

export function collectionSurfaceEquals(
  left: CollectionSurface,
  right: CollectionSurface,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "SOURCE_GROUP" && right.kind === "SOURCE_GROUP") {
    return left.sourceGroupId === right.sourceGroupId;
  }

  return true;
}
