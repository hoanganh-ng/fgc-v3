import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { primaryNavigation } from "@/app/navigation";
import { contentManagerQueryKeys } from "@/features/content-manager/content-manager-queries";
import { SourcePublishersPage } from "@/pages/source-publishers-page";
import type {
  ContentCategory,
  SourcePublisher,
} from "@/lib/api/content-manager-client";

const timestamp = "2026-06-18T10:00:00.000Z";
const defaultSourcePublishersQuery = {
  status: "DISCOVERED" as const,
  limit: 100,
  offset: 0,
};

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
    status: "DISCOVERED",
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

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function seedSourcePublishers(
  client: QueryClient,
  sourcePublishers: SourcePublisher[],
): void {
  client.setQueryData(
    contentManagerQueryKeys.sourcePublishersList(defaultSourcePublishersQuery),
    {
      items: sourcePublishers,
      page: { limit: 100, offset: 0, total: sourcePublishers.length },
    },
  );
}

function seedCategories(
  client: QueryClient,
  categories: ContentCategory[],
): void {
  client.setQueryData(contentManagerQueryKeys.categories(), {
    items: categories,
  });
}

function renderPage({
  categories = [createCategory()],
  sourcePublishers,
}: {
  readonly categories?: ContentCategory[];
  readonly sourcePublishers: SourcePublisher[];
}): string {
  const client = buildQueryClient();
  seedSourcePublishers(client, sourcePublishers);
  seedCategories(client, categories);

  return renderToStaticMarkup(
    wrapWithProviders(<SourcePublishersPage />, client),
  );
}

function wrapWithProviders(node: ReactNode, client: QueryClient): JSX.Element {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SourcePublishersPage", () => {
  it("registers the Discovered Sources navigation path", () => {
    expect(
      primaryNavigation.find((item) => item.label === "Discovered Sources")
        ?.path,
    ).toBe("/source-publishers");
  });

  it("renders default review filters, fallback display name, canonical URL, and status actions", () => {
    const { displayName: _displayName, ...publisher } = createSourcePublisher();
    const markup = renderPage({ sourcePublishers: [publisher] });

    expect(markup).toContain("Review Filters");
    expect(markup).toContain("DISCOVERED");
    expect(markup).toContain("fb-group-1");
    expect(markup).toContain("https://facebook.test/groups/fb-group-1");
    expect(markup).toContain("Approve");
    expect(markup).toContain("Ignore");
    expect(markup).toContain("Block");
  });

  it("shows the promotion form for an approved Facebook group with categories", () => {
    const markup = renderPage({
      sourcePublishers: [
        createSourcePublisher({
          status: "APPROVED",
        }),
      ],
      categories: [createCategory()],
    });

    expect(markup).toContain("Promote to Source Group");
    expect(markup).toContain("Category One");
    expect(markup).toContain("Promote");
    expect(markup).toContain("Publisher Group");
  });

  it("marks the promotion URL as required when an approved group has no canonical URL", () => {
    const { canonicalUrl: _canonicalUrl, ...publisher } = createSourcePublisher({
      status: "APPROVED",
    });
    const markup = renderPage({
      sourcePublishers: [publisher],
      categories: [createCategory()],
    });

    expect(markup).toContain("Promote to Source Group");
    expect(markup).toContain(
      'id="source-publisher-1-promotion-url" autoComplete="off" required=""',
    );
  });

  it("disables promotion when no content categories exist", () => {
    const markup = renderPage({
      sourcePublishers: [createSourcePublisher({ status: "APPROVED" })],
      categories: [],
    });

    expect(markup).toContain(
      "Create a content category before promoting a source publisher.",
    );
  });

  it("renders a disabled promotion panel for unapproved Facebook groups", () => {
    const markup = renderPage({
      sourcePublishers: [createSourcePublisher({ status: "DISCOVERED" })],
      categories: [createCategory()],
    });

    expect(markup).toContain("Promote to Source Group");
    expect(markup).toContain("Approve this group publisher before promotion.");
    expect(markup).toContain(
      'id="source-publisher-1-promotion-category" disabled=""',
    );
    expect(markup).toContain('type="submit" disabled=""');
  });

  it("does not render PAGE promotion", () => {
    const markup = renderPage({
      sourcePublishers: [
        createSourcePublisher({
          kind: "PAGE",
          status: "APPROVED",
        }),
      ],
    });

    expect(markup).not.toContain("Promote to Source Group");
  });
});
