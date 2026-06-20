/**
 * Synthetic fixtures for the Sprint 062 baseline E2E flow, the Sprint
 * 063C Source Publisher HTTP E2E flow, and the Sprint 065C1 home-feed
 * content ingestion E2E flow.
 *
 * These fixtures are deterministic, isolated to the E2E run, and never
 * reference real Facebook identifiers, sessions, cookies, localStorage,
 * tokens, proxies, account IDs, or payloads. They are intentionally
 * suffixed with the run timestamp so repeated runs produce fresh records
 * in the isolated E2E database.
 */

export interface SyntheticCategoryFixture {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
}

export interface SyntheticSourceGroupFixture {
  readonly platform: "FACEBOOK";
  readonly externalGroupId: string;
  readonly name: string;
  readonly url: string;
  readonly categoryId: string;
  readonly status: "ACTIVE";
  readonly collectionPriority: number;
  readonly notes: string;
}

export interface SyntheticSourcePublisherObservationFixture {
  readonly platform: "FACEBOOK";
  readonly kind: "GROUP" | "PAGE";
  readonly externalPublisherId: string;
  readonly observedAt: string;
  readonly displayName: string;
  readonly canonicalUrl: string;
}

export interface SyntheticHomeFeedContentFixture {
  readonly sourcePublisherId: string;
  readonly platform: "FACEBOOK";
  readonly externalPostId: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly bodyText: string;
  readonly authorDisplayName: string;
  readonly authorExternalId: string;
  readonly postedAt: string;
  readonly collectedAt: string;
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly topComments: readonly {
    readonly externalCommentId: string;
    readonly bodyText: string;
    readonly authorDisplayName: string;
    readonly reactionCount: number;
    readonly collectedAt: string;
  }[];
}

export function buildCategoryFixture(
  runStamp: string,
): SyntheticCategoryFixture {
  return {
    name: `Sprint 062 Category ${runStamp}`,
    slug: `sprint-062-cat-${runStamp}`,
    description:
      "Synthetic Content Manager category created by the Sprint 062 baseline E2E flow.",
  };
}

export function buildSourceGroupFixture(
  runStamp: string,
  categoryId: string,
): SyntheticSourceGroupFixture {
  return {
    platform: "FACEBOOK",
    externalGroupId: `sprint-062-ext-${runStamp}`,
    name: `Sprint 062 Source Group ${runStamp}`,
    // Synthetic URL only. Never opened, never resolved.
    url: `https://example.invalid/sprint-062-${runStamp}`,
    categoryId,
    status: "ACTIVE",
    collectionPriority: 0,
    notes: "Synthetic Content Manager source group created by Sprint 062 E2E.",
  };
}

export function buildSourcePublisherObservationFixture(
  runStamp: string,
  options: { readonly kind: "GROUP" | "PAGE"; readonly observedAt?: string },
): SyntheticSourcePublisherObservationFixture {
  return {
    platform: "FACEBOOK",
    kind: options.kind,
    externalPublisherId: `sprint-063c-${options.kind.toLowerCase()}-${runStamp}`,
    observedAt:
      options.observedAt ?? "2026-06-18T12:00:00.000Z",
    displayName: `Sprint 063C ${options.kind === "GROUP" ? "Group" : "Page"} ${runStamp}`,
    canonicalUrl: `https://example.invalid/sprint-063c-${options.kind.toLowerCase()}-${runStamp}`,
  };
}

export function buildSourcePublisherSecondObservationFixture(
  base: SyntheticSourcePublisherObservationFixture,
  options: { readonly observedAt: string },
): SyntheticSourcePublisherObservationFixture {
  return {
    platform: base.platform,
    kind: base.kind,
    externalPublisherId: base.externalPublisherId,
    observedAt: options.observedAt,
    displayName: `${base.displayName} (Updated)`,
    canonicalUrl: `${base.canonicalUrl}-v2`,
  };
}

export function buildHomeFeedContentFixture(
  runStamp: string,
  sourcePublisherId: string,
  options: { readonly externalPostId?: string } = {},
): SyntheticHomeFeedContentFixture {
  const externalPostId = options.externalPostId ?? `sprint-065c1-post-${runStamp}`;
  return {
    sourcePublisherId,
    platform: "FACEBOOK",
    externalPostId,
    sourceUrl: `https://example.invalid/sprint-065c1-${runStamp}`,
    title: `Sprint 065C1 Home-Feed Candidate ${runStamp}`,
    bodyText:
      "Synthetic normalized home-feed candidate body used by the Sprint 065C1 E2E flow. Never derived from a real Facebook payload.",
    authorDisplayName: `Sprint 065C1 Author ${runStamp}`,
    authorExternalId: `sprint-065c1-author-${runStamp}`,
    postedAt: "2026-02-01T09:00:00.000Z",
    collectedAt: "2026-02-01T10:00:00.000Z",
    reactionCount: 12,
    commentCount: 3,
    topComments: [
      {
        externalCommentId: `sprint-065c1-comment-${runStamp}`,
        bodyText: "Synthetic top comment for the Sprint 065C1 home-feed E2E flow.",
        authorDisplayName: `Sprint 065C1 Commenter ${runStamp}`,
        reactionCount: 9,
        collectedAt: "2026-02-01T10:00:00.000Z",
      },
    ],
  };
}

export function buildRunStamp(): string {
  // Deterministic per run, isolated across runs, filesystem-safe.
  return (
    process.env.E2E_RUN_STAMP?.trim() ||
    new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14)
  );
}