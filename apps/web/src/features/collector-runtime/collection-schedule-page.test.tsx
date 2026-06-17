import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  listCollectionSchedules: vi.fn(),
  getCollectionSchedule: vi.fn(),
  upsertCollectionSchedule: vi.fn(),
  listSourceGroups: vi.fn(),
  invalidateQueries: vi.fn(async () => undefined),
}));

vi.mock("@/lib/api/collector-runtime-client", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@/lib/api/collector-runtime-client");
  return {
    ...actual,
    collectorRuntimeClient: {
      listCollectionSchedules: mocks.listCollectionSchedules,
      getCollectionSchedule: mocks.getCollectionSchedule,
      upsertCollectionSchedule: mocks.upsertCollectionSchedule,
      listCollectionRuns: vi.fn(),
      requestCollectionRun: vi.fn(),
      cancelCollectionRun: vi.fn(),
      listAccountExerciseRuns: vi.fn(),
      getAccountExerciseRun: vi.fn(),
      requestAccountExerciseRun: vi.fn(),
      cancelAccountExerciseRun: vi.fn(),
      listProfileSourceAccessCheckRuns: vi.fn(),
      getProfileSourceAccessCheckRun: vi.fn(),
      requestProfileSourceAccessCheckRun: vi.fn(),
      cancelProfileSourceAccessCheckRun: vi.fn(),
    },
  };
});

vi.mock("@/lib/api/content-manager-client", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@/lib/api/content-manager-client");
  return {
    ...actual,
    contentManagerClient: {
      listSourceGroups: mocks.listSourceGroups,
      listContentCategories: vi.fn(),
      createContentCategory: vi.fn(),
      createSourceGroup: vi.fn(),
      updateSourceGroupStatus: vi.fn(),
      createSourceGroupEntryRoute: vi.fn(),
      updateSourceGroupEntryRoute: vi.fn(),
      removeSourceGroupEntryRoute: vi.fn(),
      listContentItems: vi.fn(),
      getContentItem: vi.fn(),
      updateContentItemStatus: vi.fn(),
    },
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
    }),
  };
});

import { CollectionSchedulesPage } from "@/pages/collection-schedules-page";
import type { CollectionSchedule } from "@/lib/api/collector-runtime-client";
import type { SourceGroup } from "@/lib/api/content-manager-client";

const timestamp = "2026-06-15T12:30:00.000Z";

function createSchedule(overrides: Partial<CollectionSchedule> = {}): CollectionSchedule {
  return {
    sourceGroupId: "sg-1",
    enabled: true,
    intervalMinutes: 30,
    nextRunAt: timestamp,
    parameters: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createSourceGroup(overrides: Partial<SourceGroup> = {}): SourceGroup {
  return {
    id: overrides.id ?? "sg-1",
    platform: "FACEBOOK",
    externalGroupId: "ext-1",
    name: overrides.name ?? "Group One",
    url: "https://www.facebook.com/groups/group-one",
    categoryId: "cat-1",
    status: overrides.status ?? "ACTIVE",
    collectionPriority: 50,
    entryRoutes: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

interface PageInitialData {
  readonly schedules: CollectionSchedule[];
  readonly total: number;
  readonly sourceGroups: SourceGroup[];
}

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function seedSchedules(
  client: QueryClient,
  schedules: CollectionSchedule[],
  total: number,
): void {
  client.setQueryData(
    ["collection-schedules", "list", { limit: 50, offset: 0 }],
    {
      items: schedules,
      page: { limit: 50, offset: 0, total },
    },
  );
}

function seedSourceGroups(
  client: QueryClient,
  groups: SourceGroup[],
  total: number,
): void {
  client.setQueryData(
    ["content-manager", "source-groups", { limit: 100, offset: 0 }],
    {
      items: groups,
      page: { limit: 100, offset: 0, total },
    },
  );
}

function wrapWithProviders(node: ReactNode, initial: PageInitialData): JSX.Element {
  const client = buildQueryClient();
  seedSchedules(client, initial.schedules, initial.total);
  seedSourceGroups(client, initial.sourceGroups, initial.sourceGroups.length);

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CollectionSchedulesPage", () => {
  it("renders a paginated list of schedules with source-group metadata", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<CollectionSchedulesPage />, {
        schedules: [
          createSchedule({
            sourceGroupId: "sg-1",
            enabled: true,
            intervalMinutes: 30,
            parameters: { maxScrolls: 5, maxDurationMs: 60_000 },
            updatedAt: timestamp,
          }),
        ],
        total: 1,
        sourceGroups: [
          createSourceGroup({ id: "sg-1", name: "Group One", status: "ACTIVE" }),
        ],
      }),
    );

    expect(markup).toContain("Collection Schedules");
    expect(markup).toContain("Group One");
    expect(markup).toContain("sg-1");
    expect(markup).toContain("Enabled");
    expect(markup).toContain("30 min");
    expect(markup).toContain("max scrolls: 5");
    expect(markup).toContain("max duration: 60000 ms");
  });

  it("shows the empty-state when there are no schedules", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<CollectionSchedulesPage />, {
        schedules: [],
        total: 0,
        sourceGroups: [],
      }),
    );

    expect(markup).toContain("No collection schedules yet.");
  });

  it("renders the source-group status badge for known groups", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<CollectionSchedulesPage />, {
        schedules: [
          createSchedule({
            sourceGroupId: "sg-paused",
            enabled: false,
            intervalMinutes: 60,
          }),
        ],
        total: 1,
        sourceGroups: [
          createSourceGroup({
            id: "sg-paused",
            name: "Paused Group",
            status: "PAUSED",
          }),
        ],
      }),
    );

    expect(markup).toContain("Paused Group");
    expect(markup).toContain("Disabled");
    expect(markup).toContain("PAUSED");
  });

  it("renders a partial source-group inventory warning when total exceeds loaded items (regression: supported limit 100, not 200)", () => {
    // Only seed the supported `limit: 100` key. The partial-inventory warning
    // is derived from `useSourceGroupsQuery(...)`, which is called with
    // `{ limit: 100, offset: 0 }`. If the page ever switched back to
    // `limit: 200`, the seeded data would not match the active query key
    // and the warning would not render.
    const client = buildQueryClient();
    seedSchedules(client, [], 0);
    seedSourceGroups(
      client,
      [createSourceGroup({ id: "sg-1", name: "Group One", status: "ACTIVE" })],
      150,
    );

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CollectionSchedulesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(markup).toContain("partial source-group inventory");
  });
});
