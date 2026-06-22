import { describe, expect, it } from "vitest";
import {
  getSourcePublisherDisplayName,
  getSourcePublisherPromotionFormSchema,
  getSourcePublisherPromotionGate,
  SourcePublisherFilterSchema,
  SourcePublisherPromotionFormSchema,
  toPromoteSourcePublisherRequest,
  toSourcePublisherPromotionDefaultValues,
} from "@/features/content-manager/source-publisher-review-view-model";
import type {
  ContentCategory,
  SourcePublisher,
} from "@/lib/api/content-manager-client";

const timestamp = "2026-06-18T10:00:00.000Z";

function createSourcePublisher(
  overrides: Partial<SourcePublisher> = {},
): SourcePublisher {
  return {
    id: "source-publisher-1",
    platform: "FACEBOOK",
    kind: "GROUP",
    externalPublisherId: "fb-group-1",
    displayName: "Publisher Group",
    canonicalUrl: "https://facebook.test/groups/fb-group-1",
    status: "APPROVED",
    firstObservedAt: timestamp,
    lastObservedAt: timestamp,
    observationCount: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createCategory(overrides: Partial<ContentCategory> = {}): ContentCategory {
  return {
    id: "category-1",
    name: "Category One",
    slug: "category-one",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("source publisher review view model", () => {
  it("defaults the status filter to DISCOVERED and accepts ALL filter values", () => {
    expect(
      SourcePublisherFilterSchema.safeParse({
        status: "DISCOVERED",
        kind: "ALL",
        platform: "ALL",
      }).success,
    ).toBe(true);
  });

  it("falls back to externalPublisherId when displayName is omitted", () => {
    const { displayName: _displayName, ...publisher } = createSourcePublisher();

    expect(
      getSourcePublisherDisplayName(publisher),
    ).toBe("fb-group-1");
  });

  it("allows promotion only for approved Facebook group publishers with categories", () => {
    expect(
      getSourcePublisherPromotionGate(createSourcePublisher(), [
        createCategory(),
      ]),
    ).toEqual({ allowed: true });
    expect(
      getSourcePublisherPromotionGate(
        createSourcePublisher({ status: "DISCOVERED" }),
        [createCategory()],
      ).allowed,
    ).toBe(false);
    expect(
      getSourcePublisherPromotionGate(createSourcePublisher({ kind: "PAGE" }), [
        createCategory(),
      ]).allowed,
    ).toBe(false);
    expect(getSourcePublisherPromotionGate(createSourcePublisher(), []).allowed).toBe(
      false,
    );
  });

  it("builds promotion defaults from publisher displayName, canonicalUrl, and first category", () => {
    expect(
      toSourcePublisherPromotionDefaultValues(
        createSourcePublisher(),
        "category-1",
      ),
    ).toEqual({
      categoryId: "category-1",
      collectionPriority: 50,
      name: "Publisher Group",
      url: "https://facebook.test/groups/fb-group-1",
      notes: "",
    });
  });

  it("validates promotion form priority bounds", () => {
    expect(
      SourcePublisherPromotionFormSchema.safeParse({
        categoryId: "category-1",
        collectionPriority: 0,
        name: "",
        url: "",
        notes: "",
      }).success,
    ).toBe(true);
    expect(
      SourcePublisherPromotionFormSchema.safeParse({
        categoryId: "category-1",
        collectionPriority: 101,
        name: "",
        url: "",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("validates populated promotion URLs as http or https URLs", () => {
    expect(
      SourcePublisherPromotionFormSchema.safeParse({
        categoryId: "category-1",
        collectionPriority: 50,
        name: "",
        url: "not-a-url",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      SourcePublisherPromotionFormSchema.safeParse({
        categoryId: "category-1",
        collectionPriority: 50,
        name: "",
        url: "ftp://facebook.test/groups/fb-group-1",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("allows canonical-url publishers to promote with the default URL included", () => {
    const defaults = toSourcePublisherPromotionDefaultValues(
      createSourcePublisher(),
      "category-1",
    );

    expect(
      getSourcePublisherPromotionFormSchema(
        createSourcePublisher(),
      ).safeParse(defaults).success,
    ).toBe(true);
    expect(toPromoteSourcePublisherRequest(defaults)).toEqual({
      categoryId: "category-1",
      collectionPriority: 50,
      name: "Publisher Group",
      url: "https://facebook.test/groups/fb-group-1",
    });
  });

  it("requires an operator URL when the publisher has no canonical URL", () => {
    const { canonicalUrl: _canonicalUrl, ...publisher } = createSourcePublisher();

    expect(
      getSourcePublisherPromotionFormSchema(publisher).safeParse({
        categoryId: "category-1",
        collectionPriority: 50,
        name: "",
        url: "",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("omits empty optional promotion fields and never sends null", () => {
    expect(
      toPromoteSourcePublisherRequest({
        categoryId: "category-1",
        collectionPriority: 50,
        name: "  ",
        url: "",
        notes: " ",
      }),
    ).toEqual({
      categoryId: "category-1",
      collectionPriority: 50,
    });
  });

  it("includes a trimmed operator URL while omitting empty name and notes", () => {
    expect(
      toPromoteSourcePublisherRequest({
        categoryId: "category-1",
        collectionPriority: 50,
        name: "  ",
        url: "  https://facebook.test/groups/manual-group  ",
        notes: " ",
      }),
    ).toEqual({
      categoryId: "category-1",
      collectionPriority: 50,
      url: "https://facebook.test/groups/manual-group",
    });
  });

  it("trims populated optional promotion fields", () => {
    expect(
      toPromoteSourcePublisherRequest({
        categoryId: "category-1",
        collectionPriority: 25,
        name: "  Publisher Group  ",
        url: "  https://facebook.test/groups/fb-group-1  ",
        notes: "  reviewed  ",
      }),
    ).toEqual({
      categoryId: "category-1",
      collectionPriority: 25,
      name: "Publisher Group",
      url: "https://facebook.test/groups/fb-group-1",
      notes: "reviewed",
    });
  });
});
