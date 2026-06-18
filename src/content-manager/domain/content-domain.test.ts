import { describe, expect, it } from "vitest";
import {
  InvalidContentStatusTransitionError,
  SourcePublisherIdentityMismatchError,
  applySourcePublisherObservation,
  applySourcePublisherStatusUpdate,
  createDefaultSourceGroupEntryRoute,
  createInitialSourcePublisher,
  mergeCollectedContent,
  normalizeTopComments,
  observeSourcePublisher,
  sourcePublishersShareIdentity,
  transitionContentStatus,
  validateCollectedContentInput,
  validateContentCategory,
  validateContentItem,
  validateSourceGroup,
  validateSourcePublisher,
} from "./index";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentItem,
  ContentStatus,
  SourceGroup,
  SourceGroupEntryRoute,
  SourcePublisher,
  TopComment,
  ValidationResult,
} from "./index";

const createdAt = "2026-01-01T00:00:00.000Z";
const updatedAt = "2026-01-01T00:05:00.000Z";
const firstCollectedAt = "2026-01-01T00:10:00.000Z";
const lastCollectedAt = "2026-01-01T00:15:00.000Z";
const latestCollectedAt = "2026-01-02T00:20:00.000Z";
const latestUpdatedAt = "2026-01-02T00:25:00.000Z";

describe("content category validation", () => {
  it("passes a valid content category", () => {
    const result = validateContentCategory(createContentCategory());

    expect(result.valid).toBe(true);
  });

  it("fails when slug is not lowercase URL-safe text", () => {
    const result = validateContentCategory({
      ...createContentCategory(),
      slug: "Knowledge Groups",
    });

    expectValidationIssue(result, "slug");
  });
});

describe("source group validation", () => {
  it("passes a valid source group", () => {
    const result = validateSourceGroup(createSourceGroup());

    expect(result.valid).toBe(true);
  });

  it("passes source groups with no explicit entry routes", () => {
    const result = validateSourceGroup(createSourceGroup({ entryRoutes: [] }));

    expect(result.valid).toBe(true);
  });

  it("fails when status is invalid", () => {
    const result = validateSourceGroup({
      ...createSourceGroup(),
      status: "UNKNOWN",
    });

    expectValidationIssue(result, "status");
  });

  it("fails when collection priority is outside the allowed range", () => {
    const result = validateSourceGroup({
      ...createSourceGroup(),
      collectionPriority: 101,
    });

    expectValidationIssue(result, "collectionPriority");
  });

  it("fails when an entry route type is invalid", () => {
    const result = validateSourceGroup(
      createSourceGroup({
        entryRoutes: [
          createSourceGroupEntryRoute({
            type: "UNKNOWN" as SourceGroupEntryRoute["type"],
          }),
        ],
      }),
    );

    expectValidationIssue(result, "entryRoutes.0.type");
  });

  it("fails when an entry route URL is invalid", () => {
    const result = validateSourceGroup(
      createSourceGroup({
        entryRoutes: [createSourceGroupEntryRoute({ url: "not-a-url" })],
      }),
    );

    expectValidationIssue(result, "entryRoutes.0.url");
  });

  it("fails when an entry route risk level is invalid", () => {
    const result = validateSourceGroup(
      createSourceGroup({
        entryRoutes: [
          createSourceGroupEntryRoute({
            riskLevel: "UNKNOWN" as SourceGroupEntryRoute["riskLevel"],
          }),
        ],
      }),
    );

    expectValidationIssue(result, "entryRoutes.0.riskLevel");
  });

  it("fails when more than one entry route is default", () => {
    const result = validateSourceGroup(
      createSourceGroup({
        entryRoutes: [
          createSourceGroupEntryRoute({ id: "route-1", isDefault: true }),
          createSourceGroupEntryRoute({ id: "route-2", isDefault: true }),
        ],
      }),
    );

    expectValidationIssue(result, "entryRoutes");
  });
});

describe("content item validation", () => {
  it("passes a valid content item", () => {
    const result = validateContentItem(createContentItem());

    expect(result.valid).toBe(true);
  });

  it("fails when engagement counts are negative", () => {
    const result = validateContentItem({
      ...createContentItem(),
      reactionCount: -1,
      commentCount: -1,
      shareCount: -1,
    });

    expectValidationIssue(result, "reactionCount");
    expectValidationIssue(result, "commentCount");
    expectValidationIssue(result, "shareCount");
  });

  it("fails when top comment engagement counts are negative", () => {
    const result = validateContentItem({
      ...createContentItem(),
      topComments: [
        createTopComment({
          reactionCount: -1,
          replyCount: -1,
        }),
      ],
    });

    expectValidationIssue(result, "topComments.0.reactionCount");
    expectValidationIssue(result, "topComments.0.replyCount");
  });
});

describe("collected content input validation", () => {
  it("passes a valid normalized ingestion input", () => {
    const result = validateCollectedContentInput(createCollectedContentInput());

    expect(result.valid).toBe(true);
  });
});

describe("content status transitions", () => {
  const allowedTransitions: readonly (readonly [
    ContentStatus,
    ContentStatus,
  ])[] = [
    ["COLLECTED", "SELECTED"],
    ["COLLECTED", "REJECTED"],
    ["SELECTED", "REJECTED"],
    ["REJECTED", "SELECTED"],
    ["SELECTED", "USED"],
  ];

  for (const [from, to] of allowedTransitions) {
    it(`allows ${from} -> ${to}`, () => {
      expect(transitionContentStatus(from, to)).toBe(to);
    });
  }

  it("treats USED as terminal", () => {
    for (const to of ["COLLECTED", "SELECTED", "REJECTED", "USED"] as const) {
      expect(() => transitionContentStatus("USED", to)).toThrow(
        InvalidContentStatusTransitionError,
      );
    }
  });

  it("rejects COLLECTED -> USED", () => {
    expect(() => transitionContentStatus("COLLECTED", "USED")).toThrow(
      InvalidContentStatusTransitionError,
    );
  });

  it("rejects REJECTED -> USED", () => {
    expect(() => transitionContentStatus("REJECTED", "USED")).toThrow(
      InvalidContentStatusTransitionError,
    );
  });
});

describe("top comment normalization", () => {
  it("sorts comments by reaction count descending with deterministic ties", () => {
    const comments = [
      createTopComment({ externalCommentId: "comment-c", reactionCount: 5 }),
      createTopComment({ externalCommentId: "comment-b", reactionCount: 9 }),
      createTopComment({ externalCommentId: "comment-a", reactionCount: 9 }),
    ];

    expect(
      normalizeTopComments(comments).map((comment) => comment.externalCommentId),
    ).toEqual(["comment-a", "comment-b", "comment-c"]);
  });

  it("limits comments to the default top 10", () => {
    const comments = Array.from({ length: 12 }, (_, index) =>
      createTopComment({
        externalCommentId: `comment-${String(index).padStart(2, "0")}`,
        reactionCount: index,
      }),
    );

    const normalized = normalizeTopComments(comments);

    expect(normalized).toHaveLength(10);
    expect(normalized[0]?.reactionCount).toBe(11);
    expect(normalized[9]?.reactionCount).toBe(2);
  });

  it("supports a custom top N limit", () => {
    const comments = [
      createTopComment({ externalCommentId: "comment-1", reactionCount: 1 }),
      createTopComment({ externalCommentId: "comment-2", reactionCount: 2 }),
      createTopComment({ externalCommentId: "comment-3", reactionCount: 3 }),
    ];

    const normalized = normalizeTopComments(comments, 2);

    expect(normalized.map((comment) => comment.externalCommentId)).toEqual([
      "comment-3",
      "comment-2",
    ]);
  });
});

describe("collected content merge", () => {
  it("preserves id, createdAt, firstCollectedAt, and status", () => {
    const existing = createContentItem({
      id: "content-existing",
      firstCollectedAt,
      createdAt,
      status: "REJECTED",
    });
    const incoming = createCollectedContentInput();

    const merged = mergeCollectedContent(existing, incoming, {
      updatedAt: latestUpdatedAt,
    });

    expect(merged.id).toBe(existing.id);
    expect(merged.createdAt).toBe(existing.createdAt);
    expect(merged.firstCollectedAt).toBe(existing.firstCollectedAt);
    expect(merged.status).toBe(existing.status);
  });

  it("updates latest content fields, engagement counts, comments, and timestamps", () => {
    const existing = createContentItem();
    const incoming = createCollectedContentInput({
      sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1-latest",
      title: "Latest title",
      bodyText: "Latest body text",
      reactionCount: 300,
      commentCount: 40,
      shareCount: 12,
      collectedAt: latestCollectedAt,
      topComments: [
        createTopComment({ externalCommentId: "comment-low", reactionCount: 1 }),
        createTopComment({ externalCommentId: "comment-high", reactionCount: 5 }),
      ],
    });

    const merged = mergeCollectedContent(existing, incoming, {
      updatedAt: latestUpdatedAt,
    });

    expect(merged.sourceUrl).toBe(incoming.sourceUrl);
    expect(merged.title).toBe(incoming.title);
    expect(merged.bodyText).toBe(incoming.bodyText);
    expect(merged.reactionCount).toBe(incoming.reactionCount);
    expect(merged.commentCount).toBe(incoming.commentCount);
    expect(merged.shareCount).toBe(incoming.shareCount);
    expect(merged.lastCollectedAt).toBe(incoming.collectedAt);
    expect(merged.updatedAt).toBe(latestUpdatedAt);
    expect(merged.topComments.map((comment) => comment.externalCommentId)).toEqual(
      ["comment-high", "comment-low"],
    );
  });

  it("does not reset SELECTED content back to COLLECTED", () => {
    const existing = createContentItem({ status: "SELECTED" });
    const incoming = createCollectedContentInput();

    const merged = mergeCollectedContent(existing, incoming, {
      updatedAt: latestUpdatedAt,
    });

    expect(merged.status).toBe("SELECTED");
  });
});

function createContentCategory(
  overrides: Partial<ContentCategory> = {},
): ContentCategory {
  return {
    id: "category-1",
    name: "Knowledge Groups",
    slug: "knowledge-groups",
    description: "Groups that produce knowledge-rich text posts.",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createSourceGroup(overrides: Partial<SourceGroup> = {}): SourceGroup {
  const base = {
    id: "source-group-1",
    platform: "FACEBOOK",
    externalGroupId: "facebook-group-1",
    name: "Knowledge Group 1",
    url: overrides.url ?? "https://www.facebook.com/groups/group-1",
    categoryId: "category-1",
    status: "ACTIVE",
    collectionPriority: 80,
    notes: "High-signal group.",
    createdAt: overrides.createdAt ?? createdAt,
    updatedAt: overrides.updatedAt ?? updatedAt,
  } satisfies Omit<SourceGroup, "entryRoutes">;

  return {
    ...base,
    entryRoutes:
      overrides.entryRoutes ?? [createDefaultSourceGroupEntryRoute(base)],
    ...overrides,
  };
}

function createSourceGroupEntryRoute(
  overrides: Partial<SourceGroupEntryRoute> = {},
): SourceGroupEntryRoute {
  return {
    id: "direct-group-url",
    type: "DIRECT_GROUP_URL",
    url: "https://www.facebook.com/groups/group-1",
    riskLevel: "MEDIUM",
    isDefault: true,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createTopComment(overrides: Partial<TopComment> = {}): TopComment {
  return {
    externalCommentId: "comment-1",
    bodyText: "Useful comment.",
    authorDisplayName: "Comment Author",
    authorExternalId: "author-1",
    reactionCount: 10,
    replyCount: 2,
    postedAt: firstCollectedAt,
    collectedAt: lastCollectedAt,
    ...overrides,
  };
}

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1",
    title: "Useful post",
    bodyText: "A useful knowledge-rich post.",
    authorDisplayName: "Post Author",
    authorExternalId: "post-author-1",
    postedAt: firstCollectedAt,
    firstCollectedAt,
    lastCollectedAt,
    reactionCount: 100,
    commentCount: 20,
    shareCount: 5,
    topComments: [createTopComment()],
    status: "COLLECTED",
    rawPayloadRef: "payload-ref-1",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createCollectedContentInput(
  overrides: Partial<CollectedContentInput> = {},
): CollectedContentInput {
  return {
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1",
    title: "Useful post",
    bodyText: "A useful knowledge-rich post.",
    authorDisplayName: "Post Author",
    authorExternalId: "post-author-1",
    postedAt: firstCollectedAt,
    collectedAt: latestCollectedAt,
    reactionCount: 150,
    commentCount: 25,
    shareCount: 7,
    topComments: [createTopComment()],
    rawPayloadRef: "payload-ref-2",
    ...overrides,
  };
}

function expectValidationIssue<T>(
  result: ValidationResult<T>,
  path: string,
): void {
  expect(result.valid).toBe(false);

  if (!result.valid) {
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  }
}

const publisherFirstObservedAt = "2026-03-01T08:00:00.000Z";
const publisherUpdatedAt = "2026-03-01T08:05:00.000Z";
const publisherLaterObservedAt = "2026-03-01T09:00:00.000Z";
const publisherNewerUpdatedAt = "2026-03-01T09:05:00.000Z";
const publisherOlderObservedAt = "2026-03-01T07:30:00.000Z";

describe("source publisher validation", () => {
  it("passes a valid source publisher", () => {
    const result = validateSourcePublisher(createSourcePublisher());

    expect(result.valid).toBe(true);
  });

  it("passes when displayName and canonicalUrl are omitted", () => {
    const result = validateSourcePublisher(
      createSourcePublisher({ displayName: undefined, canonicalUrl: undefined }),
    );

    expect(result.valid).toBe(true);
  });

  it("fails when an unknown field is provided", () => {
    const result = validateSourcePublisher({
      ...createSourcePublisher(),
      leakedField: "nope",
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]?.message).toMatch(/leakedField/);
    }
  });

  it("fails when kind is unknown", () => {
    const result = validateSourcePublisher({
      ...createSourcePublisher(),
      kind: "UNKNOWN" as SourcePublisher["kind"],
    });

    expectValidationIssue(result, "kind");
  });

  it("fails when status is unknown", () => {
    const result = validateSourcePublisher({
      ...createSourcePublisher(),
      status: "UNKNOWN" as SourcePublisher["status"],
    });

    expectValidationIssue(result, "status");
  });

  it("fails when observationCount is zero", () => {
    const result = validateSourcePublisher({
      ...createSourcePublisher(),
      observationCount: 0,
    });

    expectValidationIssue(result, "observationCount");
  });

  it("fails when firstObservedAt is after lastObservedAt", () => {
    const result = validateSourcePublisher({
      ...createSourcePublisher({
        firstObservedAt: publisherLaterObservedAt,
        lastObservedAt: publisherFirstObservedAt,
      }),
    });

    expectValidationIssue(result, "lastObservedAt");
  });

  it("rejects null optional metadata", () => {
    const result = validateSourcePublisher({
      ...createSourcePublisher(),
      displayName: null,
    });

    expect(result.valid).toBe(false);
  });
});

describe("source publisher observation", () => {
  it("creates a DISCOVERED source publisher with observationCount 1 on first observation", () => {
    const sourcePublisher = createInitialSourcePublisher(
      {
        id: "publisher-1",
        identity: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
        },
        observedAt: publisherFirstObservedAt,
        displayName: "Knowledge Group 1",
        canonicalUrl: "https://www.facebook.com/groups/knowledge-1",
      },
      { updatedAt: publisherUpdatedAt },
    );

    expect(sourcePublisher.status).toBe("DISCOVERED");
    expect(sourcePublisher.observationCount).toBe(1);
    expect(sourcePublisher.firstObservedAt).toBe(publisherFirstObservedAt);
    expect(sourcePublisher.lastObservedAt).toBe(publisherFirstObservedAt);
    expect(sourcePublisher.displayName).toBe("Knowledge Group 1");
    expect(sourcePublisher.canonicalUrl).toBe(
      "https://www.facebook.com/groups/knowledge-1",
    );
  });

  it("preserves id, identity, createdAt, firstObservedAt, and status on subsequent observations", () => {
    const existing = createSourcePublisher({
      id: "publisher-1",
      createdAt: "2026-02-01T00:00:00.000Z",
      firstObservedAt: "2026-02-01T00:00:00.000Z",
      status: "IGNORED",
      observationCount: 3,
      lastObservedAt: "2026-02-15T00:00:00.000Z",
    });

    const merged = observeSourcePublisher(
      existing,
      {
        id: existing.id,
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherLaterObservedAt,
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.id).toBe(existing.id);
    expect(merged.platform).toBe(existing.platform);
    expect(merged.kind).toBe(existing.kind);
    expect(merged.externalPublisherId).toBe(existing.externalPublisherId);
    expect(merged.createdAt).toBe(existing.createdAt);
    expect(merged.firstObservedAt).toBe(existing.firstObservedAt);
    expect(merged.status).toBe(existing.status);
    expect(merged.observationCount).toBe(existing.observationCount + 1);
  });

  it("moves lastObservedAt forward when the incoming observation is newer", () => {
    const existing = createSourcePublisher({
      lastObservedAt: publisherFirstObservedAt,
    });

    const merged = applySourcePublisherObservation(
      existing,
      {
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherLaterObservedAt,
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.lastObservedAt).toBe(publisherLaterObservedAt);
  });

  it("keeps lastObservedAt when the incoming observation is older", () => {
    const existing = createSourcePublisher({
      lastObservedAt: publisherLaterObservedAt,
    });

    const merged = applySourcePublisherObservation(
      existing,
      {
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherOlderObservedAt,
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.lastObservedAt).toBe(publisherLaterObservedAt);
  });

  it("does not overwrite newer metadata with an older observation", () => {
    const existing = createSourcePublisher({
      displayName: "Latest Display Name",
      canonicalUrl: "https://www.facebook.com/groups/latest",
      firstObservedAt: publisherFirstObservedAt,
      lastObservedAt: publisherLaterObservedAt,
    });

    const merged = applySourcePublisherObservation(
      existing,
      {
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherOlderObservedAt,
        displayName: "Stale Display Name",
        canonicalUrl: "https://www.facebook.com/groups/stale",
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.displayName).toBe("Latest Display Name");
    expect(merged.canonicalUrl).toBe("https://www.facebook.com/groups/latest");
  });

  it("does not clear existing metadata when the incoming observation omits it", () => {
    const existing = createSourcePublisher({
      displayName: "Stable Display Name",
      canonicalUrl: "https://www.facebook.com/groups/stable",
    });

    const merged = applySourcePublisherObservation(
      existing,
      {
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherLaterObservedAt,
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.displayName).toBe("Stable Display Name");
    expect(merged.canonicalUrl).toBe("https://www.facebook.com/groups/stable");
  });

  it("never changes the review status from an observation", () => {
    const existing = createSourcePublisher({ status: "BLOCKED" });

    const merged = observeSourcePublisher(
      existing,
      {
        id: existing.id,
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherLaterObservedAt,
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.status).toBe("BLOCKED");
  });

  it("replaces provided metadata when observedAt equals lastObservedAt", () => {
    const existing = createSourcePublisher({
      displayName: "Old Display Name",
      canonicalUrl: "https://www.facebook.com/groups/old",
      lastObservedAt: publisherFirstObservedAt,
    });

    const merged = applySourcePublisherObservation(
      existing,
      {
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherFirstObservedAt,
        displayName: "Updated Display Name",
        canonicalUrl: "https://www.facebook.com/groups/updated",
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.displayName).toBe("Updated Display Name");
    expect(merged.canonicalUrl).toBe(
      "https://www.facebook.com/groups/updated",
    );
    expect(merged.lastObservedAt).toBe(publisherFirstObservedAt);
    expect(merged.observationCount).toBe(existing.observationCount + 1);
  });

  it("fills previously omitted metadata on equal-timestamp observation", () => {
    const existing = createSourcePublisher({
      displayName: undefined,
      canonicalUrl: undefined,
      lastObservedAt: publisherFirstObservedAt,
    });

    const merged = applySourcePublisherObservation(
      existing,
      {
        identity: {
          platform: existing.platform,
          kind: existing.kind,
          externalPublisherId: existing.externalPublisherId,
        },
        observedAt: publisherFirstObservedAt,
        displayName: "Newly Provided Display Name",
        canonicalUrl: "https://www.facebook.com/groups/new",
      },
      { updatedAt: publisherNewerUpdatedAt },
    );

    expect(merged.displayName).toBe("Newly Provided Display Name");
    expect(merged.canonicalUrl).toBe(
      "https://www.facebook.com/groups/new",
    );
    expect(merged.lastObservedAt).toBe(publisherFirstObservedAt);
    expect(merged.observationCount).toBe(existing.observationCount + 1);
  });

  it("rejects observation whose platform differs from the existing aggregate", () => {
    const existing = createSourcePublisher({ platform: "FACEBOOK" });

    expect(() =>
      applySourcePublisherObservation(
        existing,
        {
          identity: {
            platform: "TWITTER" as SourcePublisher["platform"],
            kind: existing.kind,
            externalPublisherId: existing.externalPublisherId,
          },
          observedAt: publisherLaterObservedAt,
        },
        { updatedAt: publisherNewerUpdatedAt },
      ),
    ).toThrow(SourcePublisherIdentityMismatchError);
  });

  it("rejects observation whose kind differs from the existing aggregate", () => {
    const existing = createSourcePublisher({ kind: "GROUP" });

    expect(() =>
      applySourcePublisherObservation(
        existing,
        {
          identity: {
            platform: existing.platform,
            kind: "PAGE" as SourcePublisher["kind"],
            externalPublisherId: existing.externalPublisherId,
          },
          observedAt: publisherLaterObservedAt,
        },
        { updatedAt: publisherNewerUpdatedAt },
      ),
    ).toThrow(SourcePublisherIdentityMismatchError);
  });

  it("rejects observation whose externalPublisherId differs from the existing aggregate", () => {
    const existing = createSourcePublisher({
      externalPublisherId: "facebook-group-1",
    });

    expect(() =>
      applySourcePublisherObservation(
        existing,
        {
          identity: {
            platform: existing.platform,
            kind: existing.kind,
            externalPublisherId: "facebook-group-2",
          },
          observedAt: publisherLaterObservedAt,
        },
        { updatedAt: publisherNewerUpdatedAt },
      ),
    ).toThrow(SourcePublisherIdentityMismatchError);
  });

  it("does not mutate the existing aggregate when identity mismatches", () => {
    const existing = createSourcePublisher({
      id: "publisher-1",
      externalPublisherId: "facebook-group-1",
      observationCount: 4,
      lastObservedAt: publisherFirstObservedAt,
      displayName: "Stable Display Name",
      canonicalUrl: "https://www.facebook.com/groups/stable",
    });
    const snapshot = JSON.parse(JSON.stringify(existing));

    expect(() =>
      applySourcePublisherObservation(
        existing,
        {
          identity: {
            platform: existing.platform,
            kind: existing.kind,
            externalPublisherId: "facebook-group-2",
          },
          observedAt: publisherLaterObservedAt,
          displayName: "Mutated Display Name",
          canonicalUrl: "https://www.facebook.com/groups/mutated",
        },
        { updatedAt: publisherNewerUpdatedAt },
      ),
    ).toThrow(SourcePublisherIdentityMismatchError);

    expect(existing).toEqual(snapshot);
  });
});

describe("source publisher status update", () => {
  it("applies a new status and updates updatedAt", () => {
    const existing = createSourcePublisher({ status: "DISCOVERED" });

    const updated = applySourcePublisherStatusUpdate(existing, "APPROVED", {
      updatedAt: publisherNewerUpdatedAt,
    });

    expect(updated.status).toBe("APPROVED");
    expect(updated.updatedAt).toBe(publisherNewerUpdatedAt);
  });

  it("is idempotent when reapplying the current status", () => {
    const existing = createSourcePublisher({
      status: "APPROVED",
      updatedAt: publisherUpdatedAt,
    });

    const updated = applySourcePublisherStatusUpdate(existing, "APPROVED", {
      updatedAt: publisherNewerUpdatedAt,
    });

    expect(updated).toBe(existing);
  });
});

describe("source publisher identity comparison", () => {
  it("matches on platform + kind + externalPublisherId", () => {
    const sourcePublisher = createSourcePublisher({
      platform: "FACEBOOK",
      kind: "PAGE",
      externalPublisherId: "facebook-page-1",
    });

    expect(
      sourcePublishersShareIdentity(sourcePublisher, {
        platform: "FACEBOOK",
        kind: "PAGE",
        externalPublisherId: "facebook-page-1",
      }),
    ).toBe(true);

    expect(
      sourcePublishersShareIdentity(sourcePublisher, {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-page-1",
      }),
    ).toBe(false);
  });
});

function createSourcePublisher(
  overrides: Partial<SourcePublisher> = {},
): SourcePublisher {
  return {
    id: "publisher-1",
    platform: "FACEBOOK",
    kind: "GROUP",
    externalPublisherId: "facebook-group-1",
    displayName: "Knowledge Group 1",
    canonicalUrl: "https://www.facebook.com/groups/knowledge-1",
    status: "DISCOVERED",
    firstObservedAt: publisherFirstObservedAt,
    lastObservedAt: publisherFirstObservedAt,
    observationCount: 1,
    createdAt: publisherUpdatedAt,
    updatedAt: publisherUpdatedAt,
    ...overrides,
  };
}
