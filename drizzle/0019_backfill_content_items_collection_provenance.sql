UPDATE "content_items"
SET "collection_provenance" = jsonb_build_object(
  'firstCollectionSurface',
  jsonb_build_object(
    'kind', 'SOURCE_GROUP',
    'sourceGroupId', "source_group_id"
  ),
  'managedSourceGroupId', "source_group_id"
)
WHERE "collection_provenance" IS NULL;--> statement-breakpoint