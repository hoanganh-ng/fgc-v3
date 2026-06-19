import { describe, expect, it } from "vitest";
import {
  syntheticHomeFeedDuplicatePostsPayload,
  syntheticHomeFeedFixtures,
  syntheticHomeFeedGroupPostByIndividualPayload,
  syntheticHomeFeedMissingStablePublisherIdPayload,
  syntheticHomeFeedPagePostPayload,
  syntheticHomeFeedPersonalProfilePostPayload,
  syntheticHomeFeedSponsoredGroupPostPayload,
  syntheticHomeFeedSponsoredPagePostPayload,
  syntheticHomeFeedSponsoredWordOnlyPayload,
  syntheticHomeFeedUnknownPublisherKindPayload,
  syntheticHomeFeedUnrelatedNestedProfilePayload,
} from "./__fixtures__";
import { FacebookGraphQLPayloadExtractor } from "./facebook-graphql-payload-extractor";
import { FacebookHomeFeedGraphQLPayloadExtractor } from "./facebook-home-feed-graphql-payload-extractor";
import type {
  FacebookHomeFeedExtractedContentCandidate,
  FacebookHomeFeedGraphQLExtractionResult,
} from "./facebook-home-feed-extractor.types";

const sourceGroupId = "source-group-1";
const capturedAt = new Date("2026-04-03T12:00:00.000Z");

describe("FacebookHomeFeedGraphQLPayloadExtractor", () => {
  it("rejects an invalid capturedAt", () => {
    const result = new FacebookHomeFeedGraphQLPayloadExtractor().extract({
      capturedAt: new Date("invalid"),
      payload: syntheticHomeFeedGroupPostByIndividualPayload,
    });

    expect(result).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "INVALID_CAPTURED_AT",
          path: "capturedAt",
        }),
      ],
    });
  });

  it("rejects a negative topCommentLimit", () => {
    const result = new FacebookHomeFeedGraphQLPayloadExtractor().extract(
      {
        capturedAt,
        payload: syntheticHomeFeedGroupPostByIndividualPayload,
      },
      { topCommentLimit: -1 },
    );

    expect(result).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "INVALID_TOP_COMMENT_LIMIT",
          path: "topCommentLimit",
        }),
      ],
    });
  });

  it("rejects a non-finite topCommentLimit", () => {
    const result = new FacebookHomeFeedGraphQLPayloadExtractor().extract(
      {
        capturedAt,
        payload: syntheticHomeFeedGroupPostByIndividualPayload,
      },
      { topCommentLimit: Number.POSITIVE_INFINITY },
    );

    expect(result).toEqual({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "INVALID_TOP_COMMENT_LIMIT",
          path: "topCommentLimit",
        }),
      ],
    });
  });

  it("extracts a group post authored by an individual with the group as publisher", () => {
    const candidate = onlyCandidate(
      extract(syntheticHomeFeedGroupPostByIndividualPayload),
    );

    expect(candidate).toMatchObject({
      platform: "FACEBOOK",
      externalPostId: "home-group-post-1",
      sourceUrl:
        "https://www.facebook.com/groups/synthetic-home-feed-group/posts/home-group-post-1/",
      bodyText: "A home-feed group post written by an individual member.",
      authorDisplayName: "Synthetic Group Member",
      authorExternalId: "member-author-123",
      postedAt: "2026-04-01T09:15:00.000Z",
      collectedAt: "2026-04-03T12:00:00.000Z",
      reactionCount: 14,
      commentCount: 2,
      shareCount: 1,
      publisherObservation: {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "stable-group-123",
        observedAt: "2026-04-03T12:00:00.000Z",
        displayName: "Synthetic Home Feed Group",
        canonicalUrl:
          "https://www.facebook.com/groups/synthetic-home-feed-group/",
      },
    });
    expect(candidate).not.toHaveProperty("sourceGroupId");
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["home-group-comment-1"]);
  });

  it("extracts a page post with the page as publisher", () => {
    const candidate = onlyCandidate(extract(syntheticHomeFeedPagePostPayload));

    expect(candidate).toMatchObject({
      platform: "FACEBOOK",
      externalPostId: "home-page-post-1",
      title: "Page update",
      bodyText:
        "A page post discovered from the home feed with normalized body text.",
      reactionCount: 30,
      commentCount: 1,
      shareCount: 4,
      publisherObservation: {
        platform: "FACEBOOK",
        kind: "PAGE",
        externalPublisherId: "stable-page-456",
        observedAt: "2026-04-03T12:00:00.000Z",
        displayName: "Synthetic Home Feed Page",
        canonicalUrl: "https://www.facebook.com/synthetic-home-feed-page/",
      },
    });
    expect(candidate).not.toHaveProperty("sourceGroupId");
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["home-page-comment-1"]);
  });

  it("excludes sponsored group and page posts from explicit ad metadata", () => {
    const groupResult = requireValid(
      extract(syntheticHomeFeedSponsoredGroupPostPayload),
    );
    const pageResult = requireValid(
      extract(syntheticHomeFeedSponsoredPagePostPayload),
    );

    expect(groupResult.candidates).toEqual([]);
    expect(pageResult.candidates).toEqual([]);
    expect(groupResult.warnings).toEqual([
      expect.objectContaining({
        code: "EXCLUDED_SPONSORED_POST",
        externalPostId: "sponsored-group-post",
      }),
    ]);
    expect(pageResult.warnings).toEqual([
      expect.objectContaining({
        code: "EXCLUDED_SPONSORED_POST",
        externalPostId: "sponsored-page-post",
      }),
    ]);
  });

  it("excludes explicit personal-profile posts", () => {
    const result = requireValid(
      extract(syntheticHomeFeedPersonalProfilePostPayload),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "EXCLUDED_PERSONAL_PROFILE_POST",
        externalPostId: "personal-profile-post",
        publisherKind: "PROFILE",
      }),
    ]);
  });

  it("skips unknown publisher kinds with a typed warning", () => {
    const result = requireValid(
      extract(syntheticHomeFeedUnknownPublisherKindPayload),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "UNKNOWN_PUBLISHER_KIND",
        externalPostId: "unknown-publisher-kind-post",
        publisherKind: "EVENT",
      }),
    ]);
  });

  it("skips group/page publishers without a stable external publisher id", () => {
    const result = requireValid(
      extract(syntheticHomeFeedMissingStablePublisherIdPayload),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "MISSING_STABLE_PUBLISHER_ID",
        externalPostId: "missing-stable-publisher-id-post",
        publisherKind: "GROUP",
      }),
    ]);
  });

  it("does not throw on malformed payloads", () => {
    const extractor = new FacebookHomeFeedGraphQLPayloadExtractor();
    const cyclicPayload: Record<string, unknown> = {};
    cyclicPayload.self = cyclicPayload;

    expect(() =>
      extractor.extract({
        capturedAt,
        payload: [null, 7, "unexpected", cyclicPayload],
      }),
    ).not.toThrow();

    const result = requireValid(
      extractor.extract({
        capturedAt,
        payload: null,
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "UNSUPPORTED_PAYLOAD_SHAPE",
    );
  });

  it("deduplicates duplicate candidates by keeping the richer post", () => {
    const result = requireValid(extract(syntheticHomeFeedDuplicatePostsPayload));
    const candidate = onlyCandidate(result);

    expect(candidate.externalPostId).toBe("duplicate-home-feed-post");
    expect(candidate.bodyText).toBe(
      "Richer duplicate home-feed body with comments.",
    );
    expect(candidate.reactionCount).toBe(22);
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["duplicate-home-comment"]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "DUPLICATE_POST_CANDIDATE",
    );
  });

  it("keeps the default top-comment limit at ten when more comments are present", () => {
    const candidate = onlyCandidate(extract(buildCommentOrderingPayload()));

    expect(candidate.topComments).toHaveLength(10);
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual([
        "comment-11",
        "comment-12",
        "comment-03",
        "comment-04",
        "comment-05",
        "comment-06",
        "comment-07",
        "comment-08",
        "comment-09",
        "comment-10",
      ]);
  });

  it("orders equal-reaction top comments deterministically by comment id", () => {
    const candidate = onlyCandidate(extract(buildCommentOrderingPayload()));

    expect(
      candidate.topComments
        .filter((comment) => comment.reactionCount === 5)
        .map((comment) => comment.externalCommentId),
    ).toEqual([
      "comment-03",
      "comment-04",
      "comment-05",
      "comment-06",
      "comment-07",
      "comment-08",
      "comment-09",
      "comment-10",
    ]);
  });

  it("honors a custom topCommentLimit", () => {
    const candidate = onlyCandidate(
      new FacebookHomeFeedGraphQLPayloadExtractor().extract(
        {
          capturedAt,
          payload: buildCommentOrderingPayload(),
        },
        { topCommentLimit: 3 },
      ),
    );

    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["comment-11", "comment-12", "comment-03"]);
  });

  it("skips otherwise valid group/page posts that have no post-specific source URL", () => {
    const result = requireValid(extract(buildPostWithoutSourceUrlPayload()));

    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "MISSING_SOURCE_URL",
        externalPostId: "post-without-source-url",
      }),
    ]);
  });

  it("does not assign a home-feed browser URL as a candidate post URL", () => {
    const browserUrl = "https://www.facebook.com/";
    const candidate = onlyCandidate(
      extract({
        browserUrl,
        data: {
          home_feed: {
            edges: [
              {
                node: {
                  __typename: "CometFeedStory",
                  post_id: "post-with-post-specific-url",
                  url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/post-with-post-specific-url/",
                  sourcePublisher: {
                    kind: "GROUP",
                    group_id: "stable-group-123",
                  },
                  message: {
                    text: "A group post with its own post-specific URL.",
                  },
                },
              },
            ],
          },
        },
      }),
    );

    expect(candidate.sourceUrl).toBe(
      "https://www.facebook.com/groups/synthetic-home-feed-group/posts/post-with-post-specific-url/",
    );
    expect(candidate.sourceUrl).not.toBe(browserUrl);
  });

  it("does not exclude normal body text merely containing the word sponsored", () => {
    const result = requireValid(extract(syntheticHomeFeedSponsoredWordOnlyPayload));
    const candidate = onlyCandidate(result);

    expect(candidate.externalPostId).toBe("body-contains-sponsored-word");
    expect(candidate.bodyText).toContain("sponsored");
    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      "EXCLUDED_SPONSORED_POST",
    );
  });

  it("does not let unrelated nested profile data invalidate a group post", () => {
    const candidate = onlyCandidate(
      extract(syntheticHomeFeedUnrelatedNestedProfilePayload),
    );

    expect(candidate.externalPostId).toBe(
      "group-post-with-unrelated-profile-data",
    );
    expect(candidate.publisherObservation).toMatchObject({
      kind: "GROUP",
      externalPublisherId: "stable-group-123",
    });
    expect(candidate.authorDisplayName).toBe("Synthetic Nested Profile Author");
  });

  it("does not include raw or sensitive payload data in output or fixtures", () => {
    const fixtureText = JSON.stringify(syntheticHomeFeedFixtures).toLowerCase();
    const forbiddenFixtureFragments = [
      "access_token",
      "authorization",
      "cookie",
      "fb_dtsg",
      "localstorage",
      "proxycredential",
      "rawpayload",
      "sessionsecret",
      "viewer_id",
      "viewerid",
    ];

    for (const fragment of forbiddenFixtureFragments) {
      expect(fixtureText).not.toContain(fragment);
    }

    const candidate = onlyCandidate(
      extract(syntheticHomeFeedGroupPostByIndividualPayload),
    );
    const outputText = JSON.stringify(candidate).toLowerCase();

    for (const fragment of forbiddenFixtureFragments) {
      expect(outputText).not.toContain(fragment);
    }

    expect(candidate).not.toHaveProperty("payload");
    expect(candidate).not.toHaveProperty("rawGraphQLPayload");
    expect(candidate).not.toHaveProperty("rawPayload");
    expect(candidate).not.toHaveProperty("rawPayloadRef");
  });

  it("keeps the existing source-group extractor contract separate", () => {
    const sourceGroupResult = new FacebookGraphQLPayloadExtractor().extract({
      sourceGroupId,
      capturedAt,
      payload: syntheticHomeFeedGroupPostByIndividualPayload,
    });
    const homeFeedCandidate = onlyCandidate(
      extract(syntheticHomeFeedGroupPostByIndividualPayload),
    );

    if (!sourceGroupResult.valid) {
      throw new Error(
        `Expected source-group extraction to be valid: ${JSON.stringify(
          sourceGroupResult.issues,
        )}`,
      );
    }

    expect(sourceGroupResult.candidates[0]).toMatchObject({
      sourceGroupId,
      externalPostId: "home-group-post-1",
    });
    expect(homeFeedCandidate).not.toHaveProperty("sourceGroupId");
  });
});

function extract(payload: unknown): FacebookHomeFeedGraphQLExtractionResult {
  return new FacebookHomeFeedGraphQLPayloadExtractor().extract({
    capturedAt,
    payload,
  });
}

function buildCommentOrderingPayload(): unknown {
  return {
    data: {
      home_feed: {
        edges: [
          {
            node: {
              __typename: "CometFeedStory",
              post_id: "home-feed-comment-ordering-post",
              url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/home-feed-comment-ordering-post/",
              sourcePublisher: {
                kind: "GROUP",
                group_id: "stable-group-123",
              },
              message: {
                text: "A group post with more than ten top-level comments.",
              },
              comments: {
                nodes: [
                  buildComment("comment-10", 5),
                  buildComment("comment-03", 5),
                  buildComment("comment-12", 8),
                  buildComment("comment-01", 1),
                  buildComment("comment-07", 5),
                  buildComment("comment-05", 5),
                  buildComment("comment-02", 2),
                  buildComment("comment-11", 9),
                  buildComment("comment-09", 5),
                  buildComment("comment-08", 5),
                  buildComment("comment-06", 5),
                  buildComment("comment-04", 5),
                ],
              },
            },
          },
        ],
      },
    },
  };
}

function buildComment(commentId: string, reactionCount: number): unknown {
  return {
    __typename: "Comment",
    comment_id: commentId,
    body: {
      text: `Synthetic comment ${commentId}.`,
    },
    reaction_count: reactionCount,
  };
}

function buildPostWithoutSourceUrlPayload(): unknown {
  return {
    sourceUrl: "https://www.facebook.com/",
    data: {
      home_feed: {
        edges: [
          {
            node: {
              __typename: "CometFeedStory",
              post_id: "post-without-source-url",
              sourcePublisher: {
                kind: "PAGE",
                page_id: "stable-page-456",
              },
              message: {
                text: "A valid page post with identity and body but no source URL.",
              },
            },
          },
        ],
      },
    },
  };
}

function onlyCandidate(
  result: FacebookHomeFeedGraphQLExtractionResult,
): FacebookHomeFeedExtractedContentCandidate {
  const validResult = requireValid(result);

  expect(validResult.candidates).toHaveLength(1);

  const candidate = validResult.candidates[0];

  if (candidate === undefined) {
    throw new Error("Expected one extracted home-feed candidate.");
  }

  return candidate;
}

function requireValid(
  result: FacebookHomeFeedGraphQLExtractionResult,
): Extract<FacebookHomeFeedGraphQLExtractionResult, { readonly valid: true }> {
  if (!result.valid) {
    throw new Error(
      `Expected home-feed extraction to be valid: ${JSON.stringify(
        result.issues,
      )}`,
    );
  }

  return result;
}
