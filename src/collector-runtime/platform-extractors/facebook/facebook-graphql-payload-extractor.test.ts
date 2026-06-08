import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCollectedContentInput } from "../../../content-manager/domain";
import {
  syntheticCommentsAndCountsPayload,
  syntheticDuplicatePostsPayload,
  syntheticUnsupportedPayload,
  syntheticValidGroupPostPayload,
} from "./__fixtures__";
import { FacebookGraphQLPayloadExtractor } from "./facebook-graphql-payload-extractor";
import type {
  FacebookExtractedContentCandidate,
  FacebookGraphQLExtractionResult,
} from "./facebook-extractor.types";

const sourceGroupId = "source-group-1";
const capturedAt = new Date("2026-03-01T12:00:00.000Z");

describe("FacebookGraphQLPayloadExtractor", () => {
  it("extracts one normalized post candidate from a valid group post payload", () => {
    const result = extract(syntheticValidGroupPostPayload);
    const candidate = onlyCandidate(result);

    expect(candidate).toMatchObject({
      platform: "FACEBOOK",
      sourceGroupId,
      externalPostId: "post-123",
      sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-123/",
      title: "Useful automation note",
      bodyText: "A practical idea for organizing collected knowledge posts.",
      authorDisplayName: "Synthetic Author",
      authorExternalId: "author-123",
      postedAt: "2026-02-03T10:15:00.000Z",
      collectedAt: "2026-03-01T12:00:00.000Z",
      reactionCount: 42,
      commentCount: 5,
      shareCount: 2,
    });
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["comment-1", "comment-2"]);
    expect(candidate.topComments[0]).toMatchObject({
      bodyText: "This is immediately useful.",
      authorDisplayName: "Synthetic Commenter One",
      authorExternalId: "comment-author-1",
      reactionCount: 9,
      replyCount: 1,
      postedAt: "2026-02-03T10:20:00.000Z",
      collectedAt: "2026-03-01T12:00:00.000Z",
    });
    expect(validateCollectedContentInput(candidate)).toEqual({
      valid: true,
      value: candidate,
    });
  });

  it("uses sourceUrlHint, extracts rich text, and keeps the top 10 comments sorted by reaction count", () => {
    const result = requireValid(
      new FacebookGraphQLPayloadExtractor().extract({
        sourceGroupId,
        capturedAt,
        payload: syntheticCommentsAndCountsPayload,
        sourceUrlHint:
          "https://www.facebook.com/groups/group-1/posts/post-with-comments/",
      }),
    );
    const candidate = onlyCandidate(result);

    expect(candidate.sourceUrl).toBe(
      "https://www.facebook.com/groups/group-1/posts/post-with-comments/",
    );
    expect(candidate.bodyText).toBe(
      "A longer group post with enough comments to verify top comment selection.",
    );
    expect(candidate.reactionCount).toBe(128);
    expect(candidate.commentCount).toBe(14);
    expect(candidate.shareCount).toBeUndefined();
    expect(candidate.authorDisplayName).toBeUndefined();
    expect(candidate.postedAt).toBeUndefined();
    expect(candidate.topComments).toHaveLength(10);
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual([
        "comment-02",
        "comment-03",
        "comment-06",
        "comment-08",
        "comment-11",
        "comment-12",
        "comment-05",
        "comment-09",
        "comment-10",
        "comment-01",
      ]);
    expect(candidate.topComments.map((comment) => comment.reactionCount))
      .toEqual([15, 15, 13, 11, 10, 9, 8, 7, 6, 5]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "MISSING_OPTIONAL_AUTHOR",
        "MISSING_POSTED_AT",
        "SKIPPED_COMMENT_WITHOUT_BODY_TEXT",
        "SKIPPED_COMMENT_WITHOUT_ID",
      ]),
    );
  });

  it("returns zero candidates plus a warning for unsupported payload shapes", () => {
    const result = requireValid(extract(syntheticUnsupportedPayload));

    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "UNSUPPORTED_PAYLOAD_SHAPE",
      }),
    ]);
  });

  it("does not treat renderer, plugin, or metadata fragments as post candidates", () => {
    const result = requireValid(
      new FacebookGraphQLPayloadExtractor().extract({
        sourceGroupId,
        capturedAt,
        payload: {
          data: {
            renderer: {
              __typename: "UFIStoryReactActionRenderer",
              post_id: "renderer-post",
              url: "https://www.facebook.com/groups/group-1/posts/renderer-post/",
              message: {
                text: "Renderer text should not become collected content.",
              },
            },
            plugin: {
              __typename: "CommentComposerGroupMentionsPlugin",
              post_id: "plugin-post",
              message: {
                text: "Plugin text should not become collected content.",
              },
            },
            metadata: [
              {
                story: {
                  __typename: "Story",
                  post_id: "metadata-post",
                  url: "https://www.facebook.com/groups/group-1/posts/metadata-post/",
                  message: {
                    text: "Metadata text should not become collected content.",
                  },
                },
              },
            ],
          },
        },
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "UNSUPPORTED_PAYLOAD_SHAPE",
    );
  });

  it("requires a strong post identity before producing a candidate", () => {
    const result = requireValid(
      new FacebookGraphQLPayloadExtractor().extract({
        sourceGroupId,
        capturedAt,
        payload: {
          data: {
            node: {
              __typename: "Story",
              id: "generic-graphql-node-id",
              message: {
                text: "A story body without a post-specific id is not enough.",
              },
            },
          },
        },
        sourceUrlHint: "https://www.facebook.com/groups/group-1",
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "SKIPPED_CANDIDATE_WITHOUT_POST_ID",
    );
  });

  it("requires body text before producing a candidate", () => {
    const result = requireValid(
      new FacebookGraphQLPayloadExtractor().extract({
        sourceGroupId,
        capturedAt,
        payload: {
          data: {
            node: {
              __typename: "Story",
              post_id: "post-without-body",
              url: "https://www.facebook.com/groups/group-1/posts/post-without-body/",
              feedback: {
                reaction_count: {
                  count: 4,
                },
              },
            },
          },
        },
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT",
    );
  });

  it("does not throw on malformed payloads", () => {
    const extractor = new FacebookGraphQLPayloadExtractor();
    const cyclicPayload: Record<string, unknown> = {};
    cyclicPayload.self = cyclicPayload;

    expect(() =>
      extractor.extract({
        sourceGroupId,
        capturedAt,
        payload: [null, 7, "unexpected", cyclicPayload],
      }),
    ).not.toThrow();

    const result = requireValid(
      extractor.extract({
        sourceGroupId,
        capturedAt,
        payload: null,
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "UNSUPPORTED_PAYLOAD_SHAPE",
    );
  });

  it("deduplicates duplicate post candidates inside one payload by keeping the richer candidate", () => {
    const result = requireValid(extract(syntheticDuplicatePostsPayload));
    const candidate = onlyCandidate(result);

    expect(candidate.externalPostId).toBe("duplicate-post");
    expect(candidate.bodyText).toBe(
      "Richer duplicate body with newer engagement metadata.",
    );
    expect(candidate.reactionCount).toBe(20);
    expect(candidate.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["duplicate-comment"]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "DUPLICATE_POST_CANDIDATE",
    );
  });

  it("does not include the raw GraphQL payload in extracted candidates", () => {
    const candidate = onlyCandidate(extract(syntheticValidGroupPostPayload));

    expect(candidate).not.toHaveProperty("payload");
    expect(candidate).not.toHaveProperty("rawGraphQLPayload");
    expect(candidate).not.toHaveProperty("rawPayload");
    expect(candidate).not.toHaveProperty("rawPayloadRef");
  });

  it("extracts normalized candidates from sanitized real Facebook payload fixtures", () => {
    for (const fixtureName of ["line1.json", "line2.json", "line3.json"]) {
      const result = requireValid(
        new FacebookGraphQLPayloadExtractor().extract({
          sourceGroupId,
          capturedAt,
          payload: loadJsonFixture(fixtureName),
          sourceUrlHint: "https://www.facebook.com/groups/sanitized-source",
        }),
      );

      expect(result.candidates).toHaveLength(1);
      expect(result.warnings.map((warning) => warning.code)).not.toContain(
        "UNSUPPORTED_PAYLOAD_SHAPE",
      );

      const candidate = result.candidates[0];

      if (candidate === undefined) {
        throw new Error(`Expected ${fixtureName} to extract one candidate.`);
      }

      expect(candidate.platform).toBe("FACEBOOK");
      expect(candidate.sourceGroupId).toBe(sourceGroupId);
      expect(candidate.bodyText.length).toBeGreaterThan(0);
      expect(candidate.sourceUrl.length).toBeGreaterThan(0);
      expect(candidate.authorDisplayName ?? candidate.authorExternalId).toBeDefined();
      expect(candidate.topComments.length).toBeGreaterThan(0);
      expect(validateCollectedContentInput(candidate).valid).toBe(true);
      expect(candidate).not.toHaveProperty("payload");
      expect(candidate).not.toHaveProperty("rawPayload");
    }
  });

  it("handles the sanitized real unsupported payload fixture", () => {
    const result = requireValid(
      new FacebookGraphQLPayloadExtractor().extract({
        sourceGroupId,
        capturedAt,
        payload: loadJsonFixture("line4.json"),
        sourceUrlHint: "https://www.facebook.com/groups/sanitized-source",
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "UNSUPPORTED_PAYLOAD_SHAPE",
    );
  });

  it("extracts post candidates from a concatenated sanitized real group feed fixture", () => {
    const payloads = loadJsonValuesFixture("group-feed-example.txt");
    const results = payloads.map((payload) =>
      requireValid(
        new FacebookGraphQLPayloadExtractor().extract({
          sourceGroupId,
          capturedAt,
          payload,
          sourceUrlHint: "https://www.facebook.com/groups/sanitized-source",
        }),
      ),
    );
    const candidates = results.flatMap((result) => result.candidates);

    expect(payloads).toHaveLength(4);
    expect(candidates).toHaveLength(3);

    for (const candidate of candidates) {
      expect(candidate.platform).toBe("FACEBOOK");
      expect(candidate.topComments.length).toBeGreaterThan(0);
      expect(validateCollectedContentInput(candidate).valid).toBe(true);
    }
  });
});

function extract(payload: unknown): FacebookGraphQLExtractionResult {
  return new FacebookGraphQLPayloadExtractor().extract({
    sourceGroupId,
    capturedAt,
    payload,
  });
}

function onlyCandidate(
  result: FacebookGraphQLExtractionResult,
): FacebookExtractedContentCandidate {
  const validResult = requireValid(result);

  expect(validResult.candidates).toHaveLength(1);

  const candidate = validResult.candidates[0];

  if (candidate === undefined) {
    throw new Error("Expected one extracted candidate.");
  }

  return candidate;
}

function requireValid(
  result: FacebookGraphQLExtractionResult,
): Extract<FacebookGraphQLExtractionResult, { readonly valid: true }> {
  if (!result.valid) {
    throw new Error(
      `Expected extraction to be valid: ${JSON.stringify(result.issues)}`,
    );
  }

  return result;
}

function loadJsonFixture(fileName: string): unknown {
  return JSON.parse(loadFixtureText(fileName));
}

function loadJsonValuesFixture(fileName: string): unknown[] {
  const text = loadFixtureText(fileName).trim();

  try {
    return [JSON.parse(text)];
  } catch {
    return parseConcatenatedJsonValues(text);
  }
}

function loadFixtureText(fileName: string): string {
  return readFileSync(
    new URL(`./__fixtures__/fixtures_fb_payload/${fileName}`, import.meta.url),
    "utf8",
  );
}

function parseConcatenatedJsonValues(text: string): unknown[] {
  const values: unknown[] = [];
  let inString = false;
  let escape = false;
  let depth = 0;
  let start = -1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);

    if (inString) {
      if (escape) {
        escape = false;
      } else if (character === "\\") {
        escape = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{" || character === "[") {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
      continue;
    }

    if (character === "}" || character === "]") {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        values.push(JSON.parse(text.slice(start, index + 1)));
        start = -1;
      }
    }
  }

  return values;
}
