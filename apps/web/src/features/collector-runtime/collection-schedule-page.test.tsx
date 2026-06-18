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

import {
  CollectionSchedulesPage,
  ScheduleEditor,
  SOURCE_GROUPS_QUERY,
} from "@/pages/collection-schedules-page";
import { resolveScheduleSubmit } from "@/features/collector-runtime/collection-schedule-view-model";
import { collectorRuntimeClient } from "@/lib/api/collector-runtime-client";
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

describe("ScheduleEditor", () => {
  function seedEditor(
    schedules: CollectionSchedule[] = [],
    sourceGroups: SourceGroup[] = [],
  ): QueryClient {
    const client = buildQueryClient();
    seedSchedules(client, schedules, schedules.length);
    seedSourceGroups(client, sourceGroups, sourceGroups.length);
    return client;
  }

  function renderEditor(
    state: { mode: "create" | "edit"; sourceGroupId: string },
    options: {
      createCandidates?: readonly SourceGroup[];
      allSchedulableSourceGroups?: readonly SourceGroup[];
      schedules?: CollectionSchedule[];
      sourceGroups?: SourceGroup[];
    } = {},
  ): { markup: string; client: QueryClient } {
    const client = seedEditor(
      options.schedules ?? [],
      options.sourceGroups ?? [],
    );
    const createCandidates =
      options.createCandidates ??
      options.sourceGroups ??
      [];
    const allSchedulableSourceGroups =
      options.allSchedulableSourceGroups ??
      options.sourceGroups ??
      [];
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ScheduleEditor
            state={state}
            createCandidates={createCandidates}
            allSchedulableSourceGroups={allSchedulableSourceGroups}
            onCancel={() => undefined}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return { markup, client };
  }

  it("renders the edit-detail loading state until the detail query resolves", () => {
    mocks.getCollectionSchedule.mockReturnValue(new Promise(() => undefined));
    const { markup } = renderEditor(
      { mode: "edit", sourceGroupId: "sg-1" },
      {
        sourceGroups: [
          createSourceGroup({ id: "sg-1", name: "Group One", status: "ACTIVE" }),
        ],
      },
    );

    expect(markup).toContain("schedule-detail-loading");
    expect(markup).toContain("Loading existing schedule");
  });

  it("renders the edit-detail error state with a Retry control", async () => {
    // The production editor's error branch is rendered when
    // `useCollectionScheduleQuery` reports isError. This test spies on
    // the production hook so the error branch is reached on the very
    // first render. The test only asserts the rendered error shell and
    // Retry control; the production Retry control invokes
    // `detailQuery.refetch()` (see collection-schedules-page.tsx), but
    // exercising that callback is not covered here.
    const queriesModule = await import(
      "@/features/collector-runtime/collection-schedule-queries"
    );
    const original = queriesModule.useCollectionScheduleQuery;
    const refetchSpy = vi.fn(async () => undefined);
    const spy = vi
      .spyOn(queriesModule, "useCollectionScheduleQuery")
      .mockImplementation((sourceGroupId: string) => {
        const result = original(sourceGroupId) as unknown as {
          isPending: boolean;
          isError: boolean;
          error: unknown;
          refetch: () => Promise<unknown>;
        };
        Object.defineProperty(result, "isPending", { value: false });
        Object.defineProperty(result, "isError", { value: true });
        Object.defineProperty(result, "error", {
          value: new Error("boom"),
        });
        result.refetch = refetchSpy as unknown as typeof result.refetch;
        return result as never;
      });

    try {
      const markup = renderToStaticMarkup(
        <QueryClientProvider client={buildQueryClient()}>
          <MemoryRouter>
            <ScheduleEditor
              state={{ mode: "edit", sourceGroupId: "sg-1" }}
              createCandidates={[]}
              allSchedulableSourceGroups={[
                createSourceGroup({
                  id: "sg-1",
                  name: "Group One",
                  status: "ACTIVE",
                }),
              ]}
              onCancel={() => undefined}
            />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(markup).toContain("schedule-detail-error");
      expect(markup).toContain("Retry");
    } finally {
      spy.mockRestore();
    }
  });

  it("disables submission before the edit detail query has succeeded", () => {
    mocks.getCollectionSchedule.mockReturnValue(new Promise(() => undefined));
    const { markup } = renderEditor(
      { mode: "edit", sourceGroupId: "sg-1" },
      {
        sourceGroups: [
          createSourceGroup({ id: "sg-1", name: "Group One", status: "ACTIVE" }),
        ],
      },
    );

    // The loading branch renders no submit button at all, which is the
    // strongest "unavailable" signal the production editor exposes.
    expect(markup).not.toContain("Save changes");
    expect(markup).not.toContain("Create schedule");
  });

  it("surfaces the 'every loaded eligible source group already has a schedule' state", () => {
    const { markup } = renderEditor(
      { mode: "create", sourceGroupId: "" },
      {
        sourceGroups: [
          createSourceGroup({ id: "sg-1", name: "Group One", status: "ACTIVE" }),
        ],
        createCandidates: [],
        allSchedulableSourceGroups: [
          createSourceGroup({ id: "sg-1", name: "Group One", status: "ACTIVE" }),
        ],
      },
    );

    expect(markup).toContain("source-group-all-scheduled");
    expect(markup).toContain("Every loaded eligible source group already has a schedule.");
  });

  it("blocks Create when the selected group has a schedule outside the visible list page", async () => {
    // The visible list page has zero schedules. The selected group is
    // in the create candidate list because the list-page filter never
    // saw it. The page's create-conflict check must still find the
    // off-page schedule via the production `getCollectionSchedule`.
    mocks.getCollectionSchedule.mockResolvedValue({
      ok: true,
      data: {
        collectionSchedule: createSchedule({ sourceGroupId: "sg-1" }),
      },
    });

    const outcome = await resolveScheduleSubmit({
      mode: "create",
      sourceGroupId: "sg-1",
      fetchSchedule: () => collectorRuntimeClient.getCollectionSchedule("sg-1"),
    });

    expect(outcome).toEqual({
      status: "exists",
      message:
        "A schedule already exists for this source group. Use Edit to modify it.",
    });
    expect(mocks.getCollectionSchedule).toHaveBeenCalledWith("sg-1");
  });
});
