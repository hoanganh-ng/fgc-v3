import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  listProfileHomeFeedCollectionRuns: vi.fn(),
  getProfileHomeFeedCollectionRun: vi.fn(),
  requestProfileHomeFeedCollectionRun: vi.fn(),
  cancelProfileHomeFeedCollectionRun: vi.fn(),
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
      listProfileHomeFeedCollectionRuns:
        mocks.listProfileHomeFeedCollectionRuns,
      getProfileHomeFeedCollectionRun: mocks.getProfileHomeFeedCollectionRun,
      requestProfileHomeFeedCollectionRun:
        mocks.requestProfileHomeFeedCollectionRun,
      cancelProfileHomeFeedCollectionRun:
        mocks.cancelProfileHomeFeedCollectionRun,
      listCollectionSchedules: vi.fn(),
      getCollectionSchedule: vi.fn(),
      upsertCollectionSchedule: vi.fn(),
      listProfileHomeFeedCollectionSchedules: vi.fn(),
      getProfileHomeFeedCollectionSchedule: vi.fn(),
      upsertProfileHomeFeedCollectionSchedule: vi.fn(),
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

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("react-router-dom");
  return {
    ...actual,
    createBrowserRouter: (routes: unknown) => ({ routes }),
  };
});

import { primaryNavigation } from "@/app/navigation";
import { router } from "@/app/router";
import { ProfileHomeFeedCollectionRunsPage } from "@/pages/profile-home-feed-collection-runs-page";
import type { ProfileHomeFeedCollectionRun } from "@/lib/api/collector-runtime-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";

const timestamp = "2026-06-15T12:30:00.000Z";

function createRun(
  overrides: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id: "home-feed-run-1",
    profileId: "profile-1",
    triggerType: "MANUAL_API",
    status: "QUEUED",
    accountStageAtRequest: "COLLECTION_READY",
    target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
    parameters: {},
    requestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createProfile(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
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
  readonly runs: ProfileHomeFeedCollectionRun[];
  readonly total: number;
  readonly profiles: ProfileSummary[];
  readonly profilesTotal?: number;
}

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function seedRuns(
  client: QueryClient,
  runs: ProfileHomeFeedCollectionRun[],
  total: number,
): void {
  client.setQueryData(
    [
      "profile-home-feed-collection-runs",
      "list",
      { limit: 50, offset: 0 },
    ],
    {
      items: runs,
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
    ["profiles", "list", { limit: 100, offset: 0 }],
    {
      items: profiles,
      page: { limit: 100, offset: 0, total },
    },
  );
}

function wrapWithProviders(node: ReactNode, initial: PageInitialData): JSX.Element {
  const client = buildQueryClient();
  seedRuns(client, initial.runs, initial.total);
  seedProfiles(
    client,
    initial.profiles,
    initial.profilesTotal ?? initial.profiles.length,
  );

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProfileHomeFeedCollectionRunsPage", () => {
  it("registers the Profile Feed Runs navigation path and route", () => {
    expect(
      primaryNavigation.find((item) => item.label === "Profile Feed Runs")
        ?.path,
    ).toBe("/profile-home-feed-collection-runs");

    const root = router.routes[0];
    if (root === undefined) {
      throw new Error("expected root route to be registered");
    }
    expect(
      root.children?.some(
        (route) => route.path === "profile-home-feed-collection-runs",
      ),
    ).toBe(true);
  });

  it("renders list rows, filters, profile metadata, summary, and failure panels", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionRunsPage />, {
        runs: [
          createRun({
            id: "home-feed-run-queued",
            profileId: "profile-1",
            status: "QUEUED",
            parameters: { maxScrolls: 3, maxDurationMs: 30000, maxPosts: 20 },
          }),
          createRun({
            id: "home-feed-run-failed",
            profileId: "profile-2",
            status: "FAILED",
            startedAt: timestamp,
            finishedAt: timestamp,
            summary: {
              capturedPayloads: 2,
              extractorCandidates: 1,
              sourcePublishersObserved: 1,
              contentItemsSubmitted: 0,
              failedPublisherObservations: 0,
              failedContentSubmissions: 1,
              leaseReleased: true,
            },
            failureReason: {
              code: "HOME_FEED_CAPTURE_FAILED",
              message: "Home-feed capture failed.",
            },
          }),
        ],
        total: 2,
        profiles: [
          createProfile({ id: "profile-1", displayName: "Profile One" }),
          createProfile({ id: "profile-2", displayName: "Profile Two" }),
        ],
      }),
    );

    expect(markup).toContain("Home Feed Runs");
    expect(markup).toContain("home-feed-run-queued");
    expect(markup).toContain("Profile One");
    expect(markup).toContain("READY");
    expect(markup).toContain("COLLECTION_READY");
    expect(markup).toContain("HEALTHY");
    expect(markup).toContain("MANUAL_API");
    expect(markup).toContain("FACEBOOK / PROFILE_HOME_FEED");
    expect(markup).toContain("max scrolls: 3");
    expect(markup).toContain("Summary");
    expect(markup).toContain("2 captured");
    expect(markup).toContain("HOME_FEED_CAPTURE_FAILED");
    expect(markup).toContain("Home-feed capture failed.");
    expect(markup).toContain("All statuses");
    expect(markup).toContain("All profiles");
  });

  it("renders the profile id fallback when profile metadata is missing", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionRunsPage />, {
        runs: [
          createRun({
            profileId: "profile-missing",
            status: "SUCCEEDED",
            startedAt: timestamp,
            finishedAt: timestamp,
            summary: { capturedPayloads: 0, leaseReleased: true },
          }),
        ],
        total: 1,
        profiles: [],
      }),
    );

    expect(markup).toContain("profile-missing");
    expect(markup).toContain("SUCCEEDED");
  });

  it("disables the request form with an explanation when no eligible profiles exist", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionRunsPage />, {
        runs: [],
        total: 0,
        profiles: [
          createProfile({
            id: "profile-busy",
            displayName: "Busy Profile",
            status: "BUSY",
          }),
        ],
      }),
    );

    expect(markup).toContain(
      "No eligible profiles are READY, COLLECTION_READY, and HEALTHY.",
    );
    expect(markup).toContain("Select eligible profile");
    expect(markup).toContain("disabled");
  });

  it("shows cancel actions only for queued and running rows", () => {
    const markup = renderToStaticMarkup(
      wrapWithProviders(<ProfileHomeFeedCollectionRunsPage />, {
        runs: [
          createRun({ id: "run-queued", status: "QUEUED" }),
          createRun({ id: "run-running", status: "RUNNING", startedAt: timestamp }),
          createRun({
            id: "run-succeeded",
            status: "SUCCEEDED",
            startedAt: timestamp,
            finishedAt: timestamp,
            summary: { leaseReleased: true },
          }),
        ],
        total: 3,
        profiles: [createProfile()],
      }),
    );

    expect(markup).toContain("Cancel home-feed run run-queued");
    expect(markup).toContain("Cancel home-feed run run-running");
    expect(markup).not.toContain("Cancel home-feed run run-succeeded");
  });
});
