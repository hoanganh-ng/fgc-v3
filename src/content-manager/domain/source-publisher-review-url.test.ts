import { describe, expect, it } from "vitest";
import { resolveSourcePublisherReviewUrl } from "./source-publisher-review-url";

describe("resolveSourcePublisherReviewUrl", () => {
  it("normalizes https://facebook.com to www.facebook.com and strips query/fragment", () => {
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "group-1",
        canonicalUrl:
          "https://facebook.com/groups/knowledge-1/?ref=share#section",
      }),
    ).toBe("https://www.facebook.com/groups/knowledge-1/");
  });

  it("keeps an already-safe www.facebook.com canonical URL without query or fragment", () => {
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "PAGE",
        externalPublisherId: "page-1",
        canonicalUrl: "https://www.facebook.com/synthetic-page/",
      }),
    ).toBe("https://www.facebook.com/synthetic-page/");
  });

  it("derives a fixed-host group review URL with path-segment encoding", () => {
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "12345/evil?x=1",
      }),
    ).toBe("https://www.facebook.com/groups/12345%2Fevil%3Fx%3D1/");
  });

  it("rejects http, credentials, non-Facebook hosts, and lookalike hosts as canonical review URLs", () => {
    const pageIdentity = {
      platform: "FACEBOOK" as const,
      kind: "PAGE" as const,
      externalPublisherId: "page-1",
    };

    expect(
      resolveSourcePublisherReviewUrl({
        ...pageIdentity,
        canonicalUrl: "http://www.facebook.com/synthetic-page/",
      }),
    ).toBeUndefined();
    expect(
      resolveSourcePublisherReviewUrl({
        ...pageIdentity,
        canonicalUrl: "https://user:pass@www.facebook.com/synthetic-page/",
      }),
    ).toBeUndefined();
    expect(
      resolveSourcePublisherReviewUrl({
        ...pageIdentity,
        canonicalUrl: "https://evil.example/synthetic-page/",
      }),
    ).toBeUndefined();
    expect(
      resolveSourcePublisherReviewUrl({
        ...pageIdentity,
        canonicalUrl: "https://www.facebook.com.evil.example/synthetic-page/",
      }),
    ).toBeUndefined();
    expect(
      resolveSourcePublisherReviewUrl({
        ...pageIdentity,
        canonicalUrl: "javascript:alert(1)",
      }),
    ).toBeUndefined();
  });

  it("does not invent a Page URL from an ID without a usable canonical URL", () => {
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "PAGE",
        externalPublisherId: "page-1",
      }),
    ).toBeUndefined();
  });

  it("returns undefined for unsafe Page canonical URLs and never invents a Page ID URL", () => {
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "PAGE",
        externalPublisherId: "page-1",
        canonicalUrl: "https://lookalike.facebook.com.evil/page-1",
      }),
    ).toBeUndefined();
  });

  it("falls back to group derivation when canonical URL is present but unsafe", () => {
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "stable-group-99",
        canonicalUrl: "https://evil.example/groups/stable-group-99/",
      }),
    ).toBe("https://www.facebook.com/groups/stable-group-99/");
    expect(
      resolveSourcePublisherReviewUrl({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "group-1",
        canonicalUrl: "http://www.facebook.com/groups/group-1/",
      }),
    ).toBe("https://www.facebook.com/groups/group-1/");
  });
});
