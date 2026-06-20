import { describe, expect, it } from "vitest";
import {
  CollectedContentProvenanceInputSchema,
  ContentCollectionProvenanceSchema,
} from "./content-collection-provenance.schemas";
import { HomeFeedCollectedContentInputSchema } from "./content.schemas";

const PROFILE_HOME_FEED_SURFACE = { kind: "PROFILE_HOME_FEED" } as const;

describe("HomeFeedCollectedContentInputSchema sourcePublisherId boundary", () => {
  it("accepts a home-feed input that carries sourcePublisherId", () => {
    const result = HomeFeedCollectedContentInputSchema.safeParse({
      sourcePublisherId: "source-publisher-1",
      platform: "FACEBOOK",
      externalPostId: "fb-post-1",
      sourceUrl: "https://facebook.test/posts/fb-post-1",
      bodyText: "A normalized post body.",
      collectedAt: "2026-02-01T12:00:00.000Z",
      reactionCount: 0,
      commentCount: 0,
      topComments: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a home-feed input that omits sourcePublisherId", () => {
    const result = HomeFeedCollectedContentInputSchema.safeParse({
      platform: "FACEBOOK",
      externalPostId: "fb-post-1",
      sourceUrl: "https://facebook.test/posts/fb-post-1",
      bodyText: "A normalized post body.",
      collectedAt: "2026-02-01T12:00:00.000Z",
      reactionCount: 0,
      commentCount: 0,
      topComments: [],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("sourcePublisherId");
    }
  });

  it("rejects a home-feed input with an empty sourcePublisherId", () => {
    const result = HomeFeedCollectedContentInputSchema.safeParse({
      sourcePublisherId: "",
      platform: "FACEBOOK",
      externalPostId: "fb-post-1",
      sourceUrl: "https://facebook.test/posts/fb-post-1",
      bodyText: "A normalized post body.",
      collectedAt: "2026-02-01T12:00:00.000Z",
      reactionCount: 0,
      commentCount: 0,
      topComments: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a home-feed input with a null sourcePublisherId", () => {
    const result = HomeFeedCollectedContentInputSchema.safeParse({
      sourcePublisherId: null,
      platform: "FACEBOOK",
      externalPostId: "fb-post-1",
      sourceUrl: "https://facebook.test/posts/fb-post-1",
      bodyText: "A normalized post body.",
      collectedAt: "2026-02-01T12:00:00.000Z",
      reactionCount: 0,
      commentCount: 0,
      topComments: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("Generic CollectedContentProvenanceInputSchema PROFILE_HOME_FEED boundary", () => {
  it("still accepts PROFILE_HOME_FEED input with no sourcePublisherId", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      collectionSurface: PROFILE_HOME_FEED_SURFACE,
    });

    expect(result.success).toBe(true);
  });

  it("still accepts PROFILE_HOME_FEED input with a sourcePublisherId", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      collectionSurface: PROFILE_HOME_FEED_SURFACE,
      sourcePublisherId: "source-publisher-1",
    });

    expect(result.success).toBe(true);
  });
});

describe("Generic ContentCollectionProvenanceSchema PROFILE_HOME_FEED boundary", () => {
  it("still accepts durable PROFILE_HOME_FEED provenance with no sourcePublisherId", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: PROFILE_HOME_FEED_SURFACE,
    });

    expect(result.success).toBe(true);
  });

  it("still accepts durable PROFILE_HOME_FEED provenance with a sourcePublisherId", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: PROFILE_HOME_FEED_SURFACE,
      sourcePublisherId: "source-publisher-1",
    });

    expect(result.success).toBe(true);
  });
});
