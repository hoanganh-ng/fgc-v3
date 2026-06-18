import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contentCategories,
  contentItems,
  contentPlatformEnum,
  contentStatusEnum,
  sourceGroups,
  sourceGroupStatusEnum,
  sourcePublisherKindEnum,
  sourcePublisherStatusEnum,
  sourcePublishers,
} from "./content-manager.schema";

describe("content manager database schema", () => {
  it("exports content category table metadata for migration generation", () => {
    expect(contentCategories.id.name).toBe("id");
    expect(contentCategories.slug.name).toBe("slug");
    expect(contentCategories.description.name).toBe("description");
    expect(contentCategories.createdAt.name).toBe("created_at");
  });

  it("exports source group table metadata for migration generation", () => {
    expect(sourceGroups.id.name).toBe("id");
    expect(sourceGroups.externalGroupId.name).toBe("external_group_id");
    expect(sourceGroups.categoryId.name).toBe("category_id");
    expect(sourceGroups.collectionPriority.name).toBe("collection_priority");
    expect(sourceGroups.entryRoutes.name).toBe("entry_routes");
  });

  it("exports content item table metadata for migration generation", () => {
    expect(contentItems.id.name).toBe("id");
    expect(contentItems.sourceGroupId.name).toBe("source_group_id");
    expect(contentItems.externalPostId.name).toBe("external_post_id");
    expect(contentItems.topComments.name).toBe("top_comments");
    expect(contentItems.rawPayloadRef.name).toBe("raw_payload_ref");
  });

  it("exports source publisher table metadata for migration generation", () => {
    expect(sourcePublishers.id.name).toBe("id");
    expect(sourcePublishers.kind.name).toBe("kind");
    expect(sourcePublishers.externalPublisherId.name).toBe(
      "external_publisher_id",
    );
    expect(sourcePublishers.displayName.name).toBe("display_name");
    expect(sourcePublishers.canonicalUrl.name).toBe("canonical_url");
    expect(sourcePublishers.firstObservedAt.name).toBe("first_observed_at");
    expect(sourcePublishers.lastObservedAt.name).toBe("last_observed_at");
    expect(sourcePublishers.observationCount.name).toBe("observation_count");
  });

  it("keeps database enum values aligned with the Content Manager model", () => {
    expect(contentPlatformEnum.enumValues).toEqual(["FACEBOOK"]);
    expect(sourceGroupStatusEnum.enumValues).toEqual([
      "ACTIVE",
      "PAUSED",
      "ARCHIVED",
    ]);
    expect(contentStatusEnum.enumValues).toEqual([
      "COLLECTED",
      "SELECTED",
      "REJECTED",
      "USED",
    ]);
    expect(sourcePublisherKindEnum.enumValues).toEqual(["GROUP", "PAGE"]);
    expect(sourcePublisherStatusEnum.enumValues).toEqual([
      "DISCOVERED",
      "APPROVED",
      "IGNORED",
      "BLOCKED",
    ]);
  });

  it("creates the source publisher lastObservedAt-id index as DESC, ASC", () => {
    const migrationPath = resolve(
      process.cwd(),
      "drizzle/0017_curious_dust.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    const match = sql.match(
      /CREATE INDEX "source_publishers_last_observed_at_id_idx"[^;]+;/i,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/"last_observed_at"\s+DESC/i);
    expect(match![0]).toMatch(/"id"\s+ASC/i);
  });
});
