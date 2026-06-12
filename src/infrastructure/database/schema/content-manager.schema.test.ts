import { describe, expect, it } from "vitest";
import {
  contentCategories,
  contentItems,
  contentPlatformEnum,
  contentStatusEnum,
  sourceGroups,
  sourceGroupStatusEnum,
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
  });
});
