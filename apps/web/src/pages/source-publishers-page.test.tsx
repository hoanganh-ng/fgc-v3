import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { primaryNavigation } from "@/app/navigation";
import { contentManagerQueryKeys } from "@/features/content-manager/content-manager-queries";
import {
  SOURCE_PUBLISHER_APPROVAL_UNAVAILABLE_REASON,
  SOURCE_PUBLISHER_REVIEW_GUIDANCE,
} from "@/features/content-manager/source-publisher-review-view-model";
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
    canonicalUrl: "https://www.facebook.com/groups/fb-group-1/",
    reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
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

  it("renders ID-only groups with unnamed heading, Open on Facebook, guidance, and Approve enabled", () => {
    const { displayName: _displayName, canonicalUrl: _canonicalUrl, ...publisher } =
      createSourcePublisher({
        reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
      });
    const markup = renderPage({ sourcePublishers: [publisher] });

    expect(markup).toContain("Unnamed Facebook group");
    expect(markup).toContain("External Publisher ID");
    expect(markup).toContain("fb-group-1");
    expect(markup).toContain("Open on Facebook");
    expect(markup).toContain('href="https://www.facebook.com/groups/fb-group-1/"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain(SOURCE_PUBLISHER_REVIEW_GUIDANCE);
    expect(markup).toContain("Approve");
    expect(markup).not.toContain("Approve unavailable");
    expect(markup).not.toContain(SOURCE_PUBLISHER_APPROVAL_UNAVAILABLE_REASON);
  });

  it("renders a captured display name instead of the unnamed heading", () => {
    const markup = renderPage({
      sourcePublishers: [createSourcePublisher()],
    });

    expect(markup).toContain("Publisher Group");
    expect(markup).not.toContain("Unnamed Facebook group");
  });

  it("disables Approve and explains missing review links for non-reviewable pages", () => {
    const {
      displayName: _displayName,
      canonicalUrl: _canonicalUrl,
      reviewUrl: _reviewUrl,
      ...publisher
    } = createSourcePublisher({
      kind: "PAGE",
      externalPublisherId: "fb-page-1",
    });
    const markup = renderPage({ sourcePublishers: [publisher] });

    expect(markup).toContain("Unnamed Facebook page");
    expect(markup).toContain(SOURCE_PUBLISHER_APPROVAL_UNAVAILABLE_REASON);
    expect(markup).toContain("Approve unavailable for Unnamed Facebook page");
    expect(markup).toContain("disabled=\"\"");
    expect(markup).not.toContain("Open on Facebook");
  });

  it("renders default review filters, review link, and status actions", () => {
    const markup = renderPage({
      sourcePublishers: [createSourcePublisher()],
    });

    expect(markup).toContain("Review Filters");
    expect(markup).toContain("DISCOVERED");
    expect(markup).toContain("fb-group-1");
    expect(markup).toContain("https://www.facebook.com/groups/fb-group-1/");
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

  it("does not require a promotion URL when reviewUrl can default the form", () => {
    const { canonicalUrl: _canonicalUrl, ...publisher } = createSourcePublisher({
      status: "APPROVED",
      reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
    });
    const markup = renderPage({
      sourcePublishers: [publisher],
      categories: [createCategory()],
    });

    expect(markup).toContain("Promote to Source Group");
    expect(markup).toContain("Open on Facebook");
    expect(markup).toContain('href="https://www.facebook.com/groups/fb-group-1/"');
    expect(markup).not.toContain(
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
