import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  listProfileHomeFeedCollectionSchedules: vi.fn(),
  getProfileHomeFeedCollectionSchedule: vi.fn(),
  upsertProfileHomeFeedCollectionSchedule: vi.fn(),
  listProfiles: vi.fn(),
  invalidateQueries: vi.fn(async () => undefined),
}));

vi.mock("@/lib/api/collector-runtime-client", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@/lib/api/collector-runtime-client");
  return {
    ...actual,
    collectorRuntimeClient: {
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
      listCollectionSchedules: vi.fn(),
      getCollectionSchedule: vi.fn(),
      upsertCollectionSchedule: vi.fn(),
      listProfileHomeFeedCollectionSchedules:
        mocks.listProfileHomeFeedCollectionSchedules,
      getProfileHomeFeedCollectionSchedule:
        mocks.getProfileHomeFeedCollectionSchedule,
      upsertProfileHomeFeedCollectionSchedule:
        mocks.upsertProfileHomeFeedCollectionSchedule,
    },
  };
});

vi.mock("@/lib/api/profile-manager-client", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@/lib/api/profile-manager-client");
  return {
    ...actual,
    profileManagerClient: {
      listProfiles: mocks.listProfiles,
      getProfile: vi.fn(),
      createProfile: vi.fn(),
      updateProfileConfiguration: vi.fn(),
      updateProfileAccountStage: vi.fn(),
      startProfileProvisioning: vi.fn(),
      listProfileSourceAccess: vi.fn(),
      upsertProfileSourceAccess: vi.fn(),
      listProfileSourceAccessForSourceGroup: vi.fn(),
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
  ProfileHomeFeedCollectionSchedulesPage,
  ScheduleEditor,
  PROFILES_QUERY,
} from "@/pages/profile-home-feed-collection-schedules-page";
import { primaryNavigation } from "@/app/navigation";
import { resolveProfileHomeFeedScheduleSubmit } from "@/features/collector-runtime/profile-home-feed-collection-schedule-view-model";
import { collectorRuntimeClient } from "@/lib/api/collector-runtime-client";
import type { ProfileHomeFeedCollectionSchedule } from "@/lib/api/collector-runtime-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";

const timestamp = "2026-06-15T12:30:00.000Z";

function createSchedule(
  overrides: Partial<ProfileHomeFeedCollectionSchedule> = {},
): ProfileHomeFeedCollectionSchedule {
  return {
    profileId: "profile-1",
    enabled: true,
    intervalMinutes: 30,
    nextRunAt: timestamp,
    parameters: {},
    consecutiveFailures: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createProfile(
  overrides: Partial<ProfileSummary> = {},
): ProfileSummary {
  return {
    id: overrides.id ?? "profile-1",
    displayName: overrides.displayName ?? "Profile One",
    status: overrides.status ?? "READY",
    accountStage: overrides.accountStage ?? "COLLECTION_READY",
    timezone: "UTC",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastCheckoutAt: null,
    lastReleasedAt: null,
    nextAvailableAt: null,
    dailyUsage: {
      localDate: null,
      sessionsStarted: 0,
      activeDurationMinutes: 0,
      macroActions: 0,
    },
    hasHardwareFingerprint: true,
    hasAuthenticationState: true,
    authenticationHealth: overrides.authenticationHealth ?? "HEALTHY",
    authenticationHealthUpdatedAt: timestamp,
    ...overrides,
  };
}

interface PageInitialData {
  readonly schedules: ProfileHomeFeedCollectionSchedule[];
  readonly total: number;
  readonly profiles: ProfileSummary[];
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
  schedules: ProfileHomeFeedCollectionSchedule[],
  total: number,
): void {
  client.setQueryData(
    [
      "profile-home-feed-collection-schedules",
      "list",
      { limit: 50, offset: 0 },
    ],
    {
      items: schedules,
      page: { limit: 50, offset: 0, total },
    },
  );
}

function seedProfiles(
  client: QueryClient,
  profiles: ProfileSummary[],
  total: number,
): void {
  client.setQueryData(
    ["profiles", "list", PROFILES_QUERY],
    {
      items: profiles,
      page: { limit: 100, offset: 0, total },
    },
  );
}

function wrapWithProviders(node: ReactNode, initial: PageInitialData): JSX.Element {
  const client = buildQueryClient();
  seedSchedules(client, initial.schedules, initial.total);
  seedProfiles(client, initial.profiles, initial.profiles.length);

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProfileHomeFeedCollectionSchedulesPage", () => {
  it("registers the Home Feed Schedules navigation path", () => {
    expect(
      primaryNavigation.find((item) => item.label === "Home Feed Schedules")
        ?.path,
    ).toBe("/profile-home-feed-schedules");
  });

  it("renders a paginated list of schedules with profile metadata", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionSchedulesPage />, {
        schedules: [
          createSchedule({
            profileId: "profile-1",
            enabled: true,
            intervalMinutes: 30,
            parameters: { maxScrolls: 5, maxDurationMs: 60_000, maxPosts: 20 },
            updatedAt: timestamp,
          }),
        ],
        total: 1,
        profiles: [
          createProfile({
            id: "profile-1",
            displayName: "Profile One",
            status: "READY",
            accountStage: "COLLECTION_READY",
          }),
        ],
      }),
    );

    expect(markup).toContain("Home Feed Schedules");
    expect(markup).toContain("Profile One");
    expect(markup).toContain("profile-1");
    expect(markup).toContain("Enabled");
    expect(markup).toContain("30 min");
    expect(markup).toContain("max scrolls: 5");
    expect(markup).toContain("max duration: 60000 ms");
    expect(markup).toContain("max posts: 20");
    expect(markup).toContain("READY");
    expect(markup).toContain("COLLECTION_READY");
  });

  it("shows the empty-state when there are no schedules", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionSchedulesPage />, {
        schedules: [],
        total: 0,
        profiles: [],
      }),
    );

    expect(markup).toContain(
      "No profile home-feed collection schedules yet.",
    );
  });

  it("renders the profileId fallback when the profile metadata has not loaded", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionSchedulesPage />, {
        schedules: [
          createSchedule({
            profileId: "profile-unknown",
            enabled: false,
            intervalMinutes: 60,
          }),
        ],
        total: 1,
        profiles: [],
      }),
    );

    expect(markup).toContain("(unknown profile)");
    expect(markup).toContain("profile-unknown");
    expect(markup).toContain("Disabled");
  });

  it("renders a partial profile inventory warning when total exceeds loaded items", () => {
    const client = buildQueryClient();
    seedSchedules(client, [], 0);
    seedProfiles(
      client,
      [createProfile({ id: "profile-1", displayName: "Profile One" })],
      150,
    );

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfileHomeFeedCollectionSchedulesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(markup).toContain("partial profile inventory");
  });
});

describe("ScheduleEditor", () => {
  function seedEditor(
    schedules: ProfileHomeFeedCollectionSchedule[] = [],
    profiles: ProfileSummary[] = [],
  ): QueryClient {
    const client = buildQueryClient();
    seedSchedules(client, schedules, schedules.length);
    seedProfiles(client, profiles, profiles.length);
    return client;
  }

  function renderEditor(
    state: { mode: "create" | "edit"; profileId: string },
    options: {
      profiles?: ProfileSummary[];
    } = {},
  ): { markup: string; client: QueryClient } {
    const client = seedEditor([], options.profiles ?? []);
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ScheduleEditor
            state={state}
            profiles={options.profiles ?? []}
            onCancel={() => undefined}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return { markup, client };
  }

  it("renders the edit-detail loading state until the detail query resolves", () => {
    mocks.getProfileHomeFeedCollectionSchedule.mockReturnValue(
      new Promise(() => undefined),
    );
    const { markup } = renderEditor(
      { mode: "edit", profileId: "profile-1" },
      {
        profiles: [createProfile({ id: "profile-1", displayName: "Profile One" })],
      },
    );

    expect(markup).toContain("profile-home-feed-schedule-detail-loading");
    expect(markup).toContain("Loading existing schedule");
  });

  it("disables submission before the edit detail query has succeeded", () => {
    mocks.getProfileHomeFeedCollectionSchedule.mockReturnValue(
      new Promise(() => undefined),
    );
    const { markup } = renderEditor(
      { mode: "edit", profileId: "profile-1" },
      {
        profiles: [createProfile({ id: "profile-1", displayName: "Profile One" })],
      },
    );

    expect(markup).not.toContain("Save changes");
    expect(markup).not.toContain("Create schedule");
  });

  it("blocks Create when the selected profile has a schedule outside the visible list page", async () => {
    mocks.getProfileHomeFeedCollectionSchedule.mockResolvedValue({
      ok: true,
      data: {
        schedule: createSchedule({
          profileId: "profile-1",
        }),
      },
    });

    const outcome = await resolveProfileHomeFeedScheduleSubmit({
      mode: "create",
      profileId: "profile-1",
      fetchSchedule: () =>
        collectorRuntimeClient.getProfileHomeFeedCollectionSchedule(
          "profile-1",
        ),
    });

    expect(outcome).toEqual({
      status: "exists",
      message:
        "A schedule already exists for this profile. Use Edit to modify it.",
    });
    expect(mocks.getProfileHomeFeedCollectionSchedule).toHaveBeenCalledWith(
      "profile-1",
    );
  });

  it("locks the profileId field while editing (renders read-only Input)", async () => {
    const queriesModule = await import(
      "@/features/collector-runtime/profile-home-feed-collection-schedule-queries"
    );
    const original = queriesModule.useProfileHomeFeedCollectionScheduleQuery;
    const spy = vi
      .spyOn(queriesModule, "useProfileHomeFeedCollectionScheduleQuery")
      .mockImplementation((profileId: string) => {
        const result = original(profileId) as unknown as {
          isPending: boolean;
          isError: boolean;
          data?: unknown;
        };
        Object.defineProperty(result, "isPending", { value: false });
        Object.defineProperty(result, "isError", { value: false });
        result.data = {
          schedule: createSchedule({
            profileId: "profile-1",
          }),
        };
        return result as never;
      });

    try {
      const { markup } = renderEditor(
        { mode: "edit", profileId: "profile-1" },
        {
          profiles: [
            createProfile({ id: "profile-1", displayName: "Profile One" }),
          ],
        },
      );

      // The locked profileId field renders the path-only id, not a select.
      expect(markup).toContain("Profile (locked)");
      expect(markup).toContain("profile-1");
      expect(markup).not.toContain("Select a profile");
    } finally {
      spy.mockRestore();
    }
  });
});
