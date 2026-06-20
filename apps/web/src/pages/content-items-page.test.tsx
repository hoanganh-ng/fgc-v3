import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/api/content-manager-client";

// Hoisted mock for the queries module. The page component reads data
// through React Query hooks; this mock returns the synthetic data we
// need to drive the rendering path under test without touching the
// real HTTP client.
const queriesMock = vi.hoisted(() => ({
  contentItemsQuery: {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { items: [] as ContentItem[], page: { limit: 100, offset: 0, total: 0 } },
    error: undefined,
    refetch: () => Promise.resolve(),
  },
  contentItemQuery: {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: undefined as { contentItem: ContentItem } | undefined,
    error: undefined,
    refetch: () => Promise.resolve(),
  },
  sourceGroupsQuery: {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      items: [
        {
          id: "source-group-1",
          platform: "FACEBOOK" as const,
          externalGroupId: "fb-group-1",
          name: "Knowledge Group",
          url: "https://facebook.test/groups/source-group-1",
          categoryId: "category-1",
          status: "ACTIVE" as const,
          collectionPriority: 80,
          entryRoutes: [],
          createdAt: "2026-02-01T10:00:00.000Z",
          updatedAt: "2026-02-01T10:00:00.000Z",
        },
      ],
      page: { limit: 100, offset: 0, total: 1 },
    },
    error: undefined,
    refetch: () => Promise.resolve(),
  },
}));

vi.mock("@/features/content-manager/content-manager-queries", () => ({
  useContentItemsQuery: () => queriesMock.contentItemsQuery,
  useContentItemQuery: () => queriesMock.contentItemQuery,
  useSourceGroupsQuery: () => queriesMock.sourceGroupsQuery,
}));

function renderWithProviders(node: JSX.Element): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeHomeFeedContentItem(): ContentItem {
  return {
    id: "content-home-feed-1",
    platform: "FACEBOOK",
    externalPostId: "fb-post-home-feed-1",
    sourceUrl: "https://facebook.test/posts/fb-post-home-feed-1",
    bodyText: "A normalized home-feed candidate body.",
    firstCollectedAt: "2026-02-01T10:00:00.000Z",
    lastCollectedAt: "2026-02-01T10:00:00.000Z",
    reactionCount: 12,
    commentCount: 3,
    topComments: [
      {
        externalCommentId: "comment-1",
        bodyText: "Useful comment.",
        reactionCount: 9,
        collectedAt: "2026-02-01T10:00:00.000Z",
      },
    ],
    status: "COLLECTED",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
  };
}

function makeSourceGroupContentItem(): ContentItem {
  return {
    ...makeHomeFeedContentItem(),
    id: "content-source-group-1",
    sourceGroupId: "source-group-1",
    externalPostId: "fb-post-source-group-1",
    bodyText: "A legacy source-group-backed content body.",
  };
}

describe("ContentItemsPage (Sprint 065C1)", () => {
  it("renders 'No managed source group' for an item with omitted sourceGroupId", async () => {
    queriesMock.contentItemsQuery.data = {
      items: [makeHomeFeedContentItem()],
      page: { limit: 100, offset: 0, total: 1 },
    };
    queriesMock.contentItemsQuery.isSuccess = true;

    const { ContentItemsPage } = await import("@/pages/content-items-page");
    const markup = renderWithProviders(<ContentItemsPage />);

    expect(markup).toContain("No managed source group");
  });

  it("renders the source and category for a source-group-backed item", async () => {
    queriesMock.contentItemsQuery.data = {
      items: [makeSourceGroupContentItem()],
      page: { limit: 100, offset: 0, total: 1 },
    };
    queriesMock.contentItemsQuery.isSuccess = true;

    const { ContentItemsPage } = await import("@/pages/content-items-page");
    const markup = renderWithProviders(<ContentItemsPage />);

    // The legacy path renders the source group id and category id when
    // the lookup is available.
    expect(markup).toContain("source-group-1");
    expect(markup).toContain("category-1");
    expect(markup).not.toContain("No managed source group");
  });
});
