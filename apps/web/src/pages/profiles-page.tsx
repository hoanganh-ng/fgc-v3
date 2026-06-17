import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProfileAccountStageBadge } from "@/features/profiles/profile-account-stage-badge";
import { ProfileAuthenticationHealthBadge } from "@/features/profiles/profile-authentication-health-badge";
import { ProfileStatusBadge } from "@/features/profiles/profile-status-badge";
import { useProfilesQuery } from "@/features/profiles/profile-queries";
import {
  PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS,
  PROFILE_INVENTORY_PAGE_SIZE,
  PROFILE_INVENTORY_STATUS_OPTIONS,
  applyProfileInventoryFilterChange,
  applyProfileInventoryOffsetChange,
  applyProfileInventoryResetFilters,
  formatProfileInventoryRangeText,
  getProfileAuthenticationHealthLabel,
  getProfileInventoryPaginationModel,
  getProfileStatusLabel,
  hasActiveProfileInventoryFilters,
  parseProfileInventoryOffset,
  pickKnownValue,
  resolveProfileInventoryEmptyState,
  type ProfileInventoryEmptyState,
  type ProfileInventoryFilters,
} from "@/features/profiles/profile-inventory-view-model";
import { isApiResultError } from "@/lib/api/http-client";
import {
  KnownProfileAuthenticationHealthSchema,
  KnownProfileStatusSchema,
  type KnownProfileAuthenticationHealth,
  type KnownProfileStatus,
  type ProfileSummary,
} from "@/lib/api/profile-manager-client";
import { PageShell } from "@/pages/page-shell";

export function ProfilesPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const navigateReplace = useCallback(
    (next: URLSearchParams) => {
      const search = next.toString();
      navigate(
        { search: search.length > 0 ? `?${search}` : "" },
        { replace: true },
      );
    },
    [navigate],
  );
  const filters = useMemo(
    () => resolveFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const profilesQuery = useProfilesQuery({
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.authenticationHealth !== undefined
      ? { authenticationHealth: filters.authenticationHealth }
      : {}),
    limit: filters.limit,
    offset: filters.offset,
  });
  const isFiltered = hasActiveProfileInventoryFilters(filters);
  const responsePage =
    profilesQuery.data?.page ?? {
      limit: filters.limit,
      offset: filters.offset,
    };
  const responseTotal = responsePage.total;
  const itemCount = profilesQuery.data?.items.length ?? 0;
  const emptyState = resolveProfileInventoryEmptyState({
    itemCount,
    total: responseTotal,
    offset: filters.offset,
    hasActiveFilters: isFiltered,
  });
  const paginationModel = getProfileInventoryPaginationModel({
    offset: filters.offset,
    limit: filters.limit,
    itemCount,
    total: responseTotal,
  });

  const navigateWithParams = useCallback(
    (next: URLSearchParams) => {
      const search = next.toString();
      navigate({ search: search.length > 0 ? `?${search}` : "" }, { replace: false });
    },
    [navigate],
  );

  const handleStatusChange = (value: string) => {
    navigateWithParams(
      applyProfileInventoryFilterChange({
        searchParams,
        key: "status",
        value,
      }),
    );
  };

  const handleAuthHealthChange = (value: string) => {
    navigateWithParams(
      applyProfileInventoryFilterChange({
        searchParams,
        key: "authenticationHealth",
        value,
      }),
    );
  };

  const handleResetFilters = () => {
    navigateWithParams(applyProfileInventoryResetFilters(searchParams));
  };

  const handlePreviousPage = () => {
    navigateWithParams(
      applyProfileInventoryOffsetChange({
        searchParams,
        filters,
        nextOffset: filters.offset - filters.limit,
      }),
    );
  };

  const handleNextPage = () => {
    navigateWithParams(
      applyProfileInventoryOffsetChange({
        searchParams,
        filters,
        nextOffset: filters.offset + filters.limit,
      }),
    );
  };

  // Stale out-of-range offset recovery: when items are empty but total is
  // present and > 0, normalize the URL to offset 0 using replace navigation,
  // preserving active filters.
  const lastNormalizedOffsetRef = useRef<number | null>(null);
  useEffect(() => {
    if (!profilesQuery.isSuccess) {
      return;
    }
    if (emptyState !== "OUT_OF_RANGE") {
      lastNormalizedOffsetRef.current = null;
      return;
    }
    if (lastNormalizedOffsetRef.current === filters.offset) {
      return;
    }
    lastNormalizedOffsetRef.current = filters.offset;
    navigateReplace(
      applyProfileInventoryOffsetChange({
        searchParams,
        filters,
        nextOffset: 0,
      }),
    );
  }, [emptyState, filters, navigateReplace, profilesQuery.isSuccess, searchParams]);

  return (
    <PageShell
      eyebrow="Collector Profile Manager"
      title="Profiles"
      description="Read-only profile inventory from the safe Profile Manager API."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "primary" })} to="/profiles/new">
            <Plus aria-hidden="true" className="size-4" />
            New Profile
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              void profilesQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>
      }
    >
      <ProfilesFilterBar
        status={filters.status}
        authenticationHealth={filters.authenticationHealth}
        isFiltered={isFiltered}
        onStatusChange={handleStatusChange}
        onAuthenticationHealthChange={handleAuthHealthChange}
        onReset={handleResetFilters}
      />
      {profilesQuery.isPending ? <ProfilesLoadingState /> : null}
      {profilesQuery.isError ? (
        <ProfilesErrorState
          error={profilesQuery.error}
          onRetry={() => {
            void profilesQuery.refetch();
          }}
        />
      ) : null}
      {profilesQuery.isSuccess && emptyState === "FILTERED_NO_MATCH" ? (
        <ProfilesNoMatchesState onReset={handleResetFilters} />
      ) : null}
      {profilesQuery.isSuccess && emptyState === "GLOBAL_NO_PROFILES" ? (
        <ProfilesEmptyState />
      ) : null}
      {profilesQuery.isSuccess && itemCount > 0 ? (
        <ProfilesTable
          page={responsePage}
          profiles={profilesQuery.data?.items ?? []}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />
      ) : null}
    </PageShell>
  );
}

function ProfilesFilterBar({
  status,
  authenticationHealth,
  isFiltered,
  onStatusChange,
  onAuthenticationHealthChange,
  onReset,
}: {
  readonly status: KnownProfileStatus | undefined;
  readonly authenticationHealth: KnownProfileAuthenticationHealth | undefined;
  readonly isFiltered: boolean;
  readonly onStatusChange: (value: string) => void;
  readonly onAuthenticationHealthChange: (value: string) => void;
  readonly onReset: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            <span>Status</span>
            <Select
              value={status ?? ""}
              onChange={(event) => onStatusChange(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All</option>
              {PROFILE_INVENTORY_STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {getProfileStatusLabel(value)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            <span>Authentication Health</span>
            <Select
              value={authenticationHealth ?? ""}
              onChange={(event) => onAuthenticationHealthChange(event.target.value)}
              aria-label="Filter by authentication health"
            >
              <option value="">All</option>
              {PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {getProfileAuthenticationHealthLabel(value)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          {isFiltered ? (
            <Button variant="secondary" onClick={onReset}>
              Reset filters
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfilesTable({
  page,
  profiles,
  onPreviousPage,
  onNextPage,
}: {
  readonly page: {
    readonly limit: number;
    readonly offset: number;
    readonly total?: number | undefined;
  };
  readonly profiles: readonly ProfileSummary[];
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
}): JSX.Element {
  const paginationModel = getProfileInventoryPaginationModel({
    offset: page.offset,
    limit: page.limit,
    itemCount: profiles.length,
    total: page.total,
  });
  const rangeText = formatProfileInventoryRangeText({
    limit: page.limit,
    offset: page.offset,
    itemCount: profiles.length,
    total: page.total,
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Profile Inventory</CardTitle>
          <CardDescription>
            {rangeText.rangeText}
            {" "}
            {rangeText.totalText}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Users aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[80rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/45 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Account Stage</th>
                <th className="px-4 py-3">Authentication Health</th>
                <th className="px-4 py-3">Health Updated</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/35"
                >
                  <td className="px-4 py-4">
                    <div className="min-w-0">
                      <Link
                        className="font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                        to={`/profiles/${encodeURIComponent(profile.id)}`}
                      >
                        {profile.displayName}
                      </Link>
                      <p className="mt-1 max-w-[22rem] truncate text-xs text-muted-foreground">
                        {profile.id}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <ProfileStatusBadge status={profile.status} />
                  </td>
                  <td className="px-4 py-4">
                    <ProfileAccountStageBadge
                      accountStage={profile.accountStage}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <ProfileAuthenticationHealthBadge
                      health={profile.authenticationHealth}
                    />
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDateTime(profile.authenticationHealthUpdatedAt)}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {profile.timezone}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDateTime(profile.createdAt)}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDateTime(profile.updatedAt)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      aria-label={`Open ${profile.displayName}`}
                      className="inline-flex size-9 items-center justify-center rounded border border-border text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
                      to={`/profiles/${encodeURIComponent(profile.id)}`}
                    >
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page size {page.limit} items.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={!paginationModel.canGoBack}
              onClick={onPreviousPage}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!paginationModel.canGoNext}
              onClick={onNextPage}
            >
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfilesLoadingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading Profiles</CardTitle>
        <CardDescription>Reading profile summaries from the API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {["one", "two", "three", "four"].map((row) => (
          <div
            key={row}
            className="grid min-h-14 animate-pulse grid-cols-[minmax(12rem,1fr)_8rem_10rem_10rem_10rem] items-center gap-4 border-b border-border last:border-b-0"
          >
            <div className="h-4 rounded bg-muted" />
            <div className="h-6 rounded bg-muted" />
            <div className="h-4 rounded bg-muted" />
            <div className="h-6 rounded bg-muted" />
            <div className="h-4 rounded bg-muted" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProfilesErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profiles Could Not Load</CardTitle>
        <CardDescription>{formatApiError(error)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfilesEmptyState(): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>No Profiles</CardTitle>
          <CardDescription>No profile summaries were returned.</CardDescription>
        </div>
        <StatusBadge label="Empty" tone="neutral" />
      </CardHeader>
      <CardContent>
        <Link className={buttonVariants({ variant: "primary" })} to="/profiles/new">
          <Plus aria-hidden="true" className="size-4" />
          New Profile
        </Link>
      </CardContent>
    </Card>
  );
}

function ProfilesNoMatchesState({
  onReset,
}: {
  readonly onReset: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>No Matching Profiles</CardTitle>
          <CardDescription>
            No profile summaries matched the active filters.
          </CardDescription>
        </div>
        <StatusBadge label="No matches" tone="neutral" />
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onReset}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Reset filters
        </Button>
      </CardContent>
    </Card>
  );
}

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The profile list request failed.";
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function resolveFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ProfileInventoryFilters {
  const rawStatus = searchParams.get("status");
  const rawAuthHealth = searchParams.get("authenticationHealth");
  const rawOffset = searchParams.get("offset");
  const status = pickKnownValue(
    rawStatus,
    KnownProfileStatusSchema.options,
  ) as KnownProfileStatus | undefined;
  const authenticationHealth = pickKnownValue(
    rawAuthHealth,
    KnownProfileAuthenticationHealthSchema.options,
  ) as KnownProfileAuthenticationHealth | undefined;
  const offset = parseProfileInventoryOffset(rawOffset);

  return {
    status,
    authenticationHealth,
    limit: PROFILE_INVENTORY_PAGE_SIZE,
    offset,
  };
}

// Re-exported for tests that may want to import the empty-state markers.
export type { ProfileInventoryEmptyState };
