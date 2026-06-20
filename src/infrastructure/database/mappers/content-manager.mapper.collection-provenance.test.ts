import { describe, expect, it } from "vitest";
import {
  InvalidPersistedContentManagerRecordError,
  toContentItemDomain,
  toContentItemRow,
  type ContentItemRow,
} from "./content-manager.mapper";
import type {
  ContentCollectionProvenance,
  ContentItem,
  IsoDateTime,
  TopComment,
} from "../../../content-manager/domain";

const defaultUpdatedAt = "2026-06-01T08:00:00.000Z";

function createTopComment(): TopComment {
  return {
    externalCommentId: "comment-1",
    bodyText: "Useful comment.",
    authorDisplayName: "Comment Author",
    authorExternalId: "comment-author-1",
    reactionCount: 10,
    replyCount: 2,
    postedAt: "2026-06-01T07:55:00.000Z",
    collectedAt: defaultUpdatedAt,
  };
}

function createProvenance(
  sourceGroupId: string,
): ContentCollectionProvenance {
  return {
    firstCollectionSurface: {
      kind: "SOURCE_GROUP",
      sourceGroupId,
    },
    managedSourceGroupId: sourceGroupId,
  };
}

function createHomeFeedProvenance(
  managedSourceGroupId: string,
): ContentCollectionProvenance {
  return {
    firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
    sourcePublisherId: "source-publisher-1",
    managedSourceGroupId,
  };
}

function makeDomainItem(
  overrides: Partial<ContentItem> = {},
): ContentItem {
  const sourceGroupId = overrides.sourceGroupId ?? "source-group-1";

  return {
    id: "content-1",
    platform: "FACEBOOK",
    sourceGroupId,
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/source-group-1/posts/post-1",
    title: "Title",
    bodyText: "Body text",
    authorDisplayName: "Author",
    authorExternalId: "author-1",
    postedAt: "2026-06-01T07:50:00.000Z",
    firstCollectedAt: "2026-06-01T07:55:00.000Z",
    lastCollectedAt: defaultUpdatedAt,
    reactionCount: 10,
    commentCount: 2,
    shareCount: 1,
    topComments: [createTopComment()],
    status: "COLLECTED",
    rawPayloadRef: "payload-ref-1",
    collectionProvenance: createProvenance(sourceGroupId),
    createdAt: defaultUpdatedAt,
    updatedAt: defaultUpdatedAt,
    ...overrides,
  };
}

function makeRow(overrides: Partial<ContentItemRow> = {}): ContentItemRow {
  return {
    id: "content-1",
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/source-group-1/posts/post-1",
    title: "Title",
    bodyText: "Body text",
    authorDisplayName: "Author",
    authorExternalId: "author-1",
    postedAt: "2026-06-01T07:50:00.000Z",
    firstCollectedAt: "2026-06-01T07:55:00.000Z",
    lastCollectedAt: defaultUpdatedAt,
    reactionCount: 10,
    commentCount: 2,
    shareCount: 1,
    topComments: [createTopComment()],
    status: "COLLECTED",
    rawPayloadRef: "payload-ref-1",
    collectionProvenance: createProvenance("source-group-1"),
    createdAt: defaultUpdatedAt,
    updatedAt: defaultUpdatedAt,
    ...overrides,
  };
}

describe("content-manager mapper — content item collection provenance", () => {
  it("round-trips a SOURCE_GROUP collectionProvenance", () => {
    const item = makeDomainItem();

    const row = toContentItemRow(item);
    const persistedRow: ContentItemRow = {
      ...row,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      postedAt: row.postedAt as string,
      firstCollectedAt: row.firstCollectedAt as string,
      lastCollectedAt: row.lastCollectedAt as string,
    } as ContentItemRow;
    const back = toContentItemDomain(persistedRow);

    expect(back.collectionProvenance).toEqual({
      firstCollectionSurface: {
        kind: "SOURCE_GROUP",
        sourceGroupId: "source-group-1",
      },
      managedSourceGroupId: "source-group-1",
    });
    expect(back.sourceGroupId).toBe("source-group-1");
  });

  it("round-trips a valid PROFILE_HOME_FEED first surface with a managed group", () => {
    const item = makeDomainItem({
      collectionProvenance: createHomeFeedProvenance("source-group-1"),
    });

    const row = toContentItemRow(item);
    const persistedRow: ContentItemRow = {
      ...row,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      postedAt: row.postedAt as string,
      firstCollectedAt: row.firstCollectedAt as string,
      lastCollectedAt: row.lastCollectedAt as string,
    } as ContentItemRow;
    const back = toContentItemDomain(persistedRow);

    expect(back.collectionProvenance).toEqual({
      firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
      sourcePublisherId: "source-publisher-1",
      managedSourceGroupId: "source-group-1",
    });
    expect(back.sourceGroupId).toBe("source-group-1");
  });

  it("rejects a domain item whose SOURCE_GROUP collectionProvenance sourceGroupId disagrees with sourceGroupId", () => {
    const item = makeDomainItem({
      collectionProvenance: createProvenance("different-source-group"),
    });

    expect(() => toContentItemRow(item)).toThrow(
      InvalidPersistedContentManagerRecordError,
    );
  });

  it("rejects a domain item whose PROFILE_HOME_FEED managed group disagrees with sourceGroupId", () => {
    const item = makeDomainItem({
      collectionProvenance: createHomeFeedProvenance("different-source-group"),
    });

    expect(() => toContentItemRow(item)).toThrow(
      InvalidPersistedContentManagerRecordError,
    );
  });

  it("rejects a domain item that lacks collectionProvenance", () => {
    const { collectionProvenance: _drop, ...withoutProvenance } =
      makeDomainItem();

    expect(() => toContentItemRow(withoutProvenance as ContentItem)).toThrow(
      InvalidPersistedContentManagerRecordError,
    );
  });

  it("reports the real content item id when persistence validation fails", () => {
    const item = makeDomainItem({
      id: "content-real-id-42",
      collectionProvenance: createProvenance("different-source-group"),
    });

    let caught: unknown;
    try {
      toContentItemRow(item);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidPersistedContentManagerRecordError);
    expect((caught as InvalidPersistedContentManagerRecordError).recordId).toBe(
      "content-real-id-42",
    );
  });

  it("reports the real content item id when read validation fails", () => {
    const row = makeRow({
      id: "content-real-id-99",
      collectionProvenance: createProvenance("different-source-group"),
    });

    let caught: unknown;
    try {
      toContentItemDomain(row);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidPersistedContentManagerRecordError);
    expect((caught as InvalidPersistedContentManagerRecordError).recordId).toBe(
      "content-real-id-99",
    );
  });

  it("rejects a persisted row whose collection_provenance is structurally invalid", () => {
    const row = makeRow({
      collectionProvenance: { unknown: true } as unknown as ContentCollectionProvenance,
    });

    expect(() => toContentItemDomain(row)).toThrow(
      InvalidPersistedContentManagerRecordError,
    );
  });

  it("rejects a persisted row whose collection_provenance surface disagrees with source_group_id", () => {
    const row = makeRow({
      collectionProvenance: createProvenance("different-source-group"),
    });

    expect(() => toContentItemDomain(row)).toThrow(
      InvalidPersistedContentManagerRecordError,
    );
  });

  it("preserves Date timestamps in collectionProvenance unchanged (no Date fields are inside provenance)", () => {
    const item = makeDomainItem({
      firstCollectedAt: "2026-06-01T07:55:00.000Z" as IsoDateTime,
      lastCollectedAt: defaultUpdatedAt,
    });

    const row = toContentItemRow(item);

    expect(typeof row.collectionProvenance).toBe("object");
    expect(row.collectionProvenance).toEqual(
      createProvenance("source-group-1"),
    );
  });
});