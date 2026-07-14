import { describe, expect, it } from "vitest";
import {
  getSourcePublisherApprovalGate,
  getSourcePublisherDisplayName,
  getSourcePublisherPromotionFormSchema,
  getSourcePublisherPromotionGate,
  SOURCE_PUBLISHER_APPROVAL_UNAVAILABLE_REASON,
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
    canonicalUrl: "https://www.facebook.com/groups/fb-group-1/",
    reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
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

  it("uses unnamed Facebook group/page labels instead of the opaque external ID", () => {
    const { displayName: _displayName, ...group } = createSourcePublisher();
    const { displayName: _pageName, ...page } = createSourcePublisher({
      kind: "PAGE",
      externalPublisherId: "fb-page-1",
    });

    expect(getSourcePublisherDisplayName(group)).toBe("Unnamed Facebook group");
    expect(getSourcePublisherDisplayName(page)).toBe("Unnamed Facebook page");
    expect(getSourcePublisherDisplayName(createSourcePublisher())).toBe(
      "Publisher Group",
    );
  });

  it("allows approval only when a safe reviewUrl is present", () => {
    expect(getSourcePublisherApprovalGate(createSourcePublisher())).toEqual({
      allowed: true,
    });

    const { reviewUrl: _reviewUrl, ...withoutReviewUrl } = createSourcePublisher({
      kind: "PAGE",
      canonicalUrl: undefined,
    });

    expect(getSourcePublisherApprovalGate(withoutReviewUrl)).toEqual({
      allowed: false,
      reason: SOURCE_PUBLISHER_APPROVAL_UNAVAILABLE_REASON,
    });
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

  it("builds promotion defaults from displayName and prefers canonicalUrl over reviewUrl", () => {
    expect(
      toSourcePublisherPromotionDefaultValues(
        createSourcePublisher(),
        "category-1",
      ),
    ).toEqual({
      categoryId: "category-1",
      collectionPriority: 50,
      name: "Publisher Group",
      url: "https://www.facebook.com/groups/fb-group-1/",
      notes: "",
    });
  });

  it("defaults promotion URL to reviewUrl when canonicalUrl is absent", () => {
    const { canonicalUrl: _canonicalUrl, ...publisher } = createSourcePublisher({
      reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
    });

    expect(
      toSourcePublisherPromotionDefaultValues(publisher, "category-1").url,
    ).toBe("https://www.facebook.com/groups/fb-group-1/");
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
      url: "https://www.facebook.com/groups/fb-group-1/",
    });
  });

  it("allows promotion with an empty operator URL when reviewUrl defaults apply", () => {
    const { canonicalUrl: _canonicalUrl, ...publisher } = createSourcePublisher({
      reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
    });

    expect(
      getSourcePublisherPromotionFormSchema(publisher).safeParse({
        categoryId: "category-1",
        collectionPriority: 50,
        name: "",
        url: "",
        notes: "",
      }).success,
    ).toBe(true);
  });

  it("requires an operator URL when the publisher has no canonical or review URL", () => {
    const {
      canonicalUrl: _canonicalUrl,
      reviewUrl: _reviewUrl,
      ...publisher
    } = createSourcePublisher();

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
