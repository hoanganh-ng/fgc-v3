import { useCallback, useMemo } from "react";
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
import { isApiResultError } from "@/lib/api/http-client";
import {
  KnownProfileAuthenticationHealthSchema,
  KnownProfileStatusSchema,
  type KnownProfileAuthenticationHealth,
  type KnownProfileStatus,
  type ProfileSummary,
} from "@/lib/api/profile-manager-client";
import { PageShell } from "@/pages/page-shell";

const PROFILE_INVENTORY_PAGE_SIZE = 25;
const STATUS_VALUES = KnownProfileStatusSchema.options;
const AUTHENTICATION_HEALTH_VALUES =
  KnownProfileAuthenticationHealthSchema.options;

interface ResolvedFilters {
  readonly status: KnownProfileStatus | undefined;
  readonly authenticationHealth: KnownProfileAuthenticationHealth | undefined;
  readonly limit: number;
  readonly offset: number;
}

export function ProfilesPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const isFiltered = hasActiveFilters(filters);

  const updateSearchParams = useCallback(
    (next: URLSearchParams) => {
      navigate({ search: `?${next.toString()}` }, { replace: false });
    },
    [navigate],
  );

  const handleStatusChange = (value: string) => {
    setFilterParam(updateSearchParams, searchParams, "status", value);
  };

  const handleAuthHealthChange = (value: string) => {
    setFilterParam(
      updateSearchParams,
      searchParams,
      "authenticationHealth",
      value,
    );
  };

  const handleResetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    next.delete("authenticationHealth");
    next.delete("offset");
    updateSearchParams(next);
  };

  const handlePreviousPage = () => {
    goToOffset(updateSearchParams, searchParams, filters, filters.offset - filters.limit);
  };

  const handleNextPage = () => {
    goToOffset(updateSearchParams, searchParams, filters, filters.offset + filters.limit);
  };

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
      {profilesQuery.isSuccess && profilesQuery.data.items.length === 0 ? (
        isFiltered ? (
          <ProfilesNoMatchesState onReset={handleResetFilters} />
        ) : (
          <ProfilesEmptyState />
        )
      ) : null}
      {profilesQuery.isSuccess && profilesQuery.data.items.length > 0 ? (
        <ProfilesTable
          page={profilesQuery.data.page}
          profiles={profilesQuery.data.items}
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
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
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
              {AUTHENTICATION_HEALTH_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
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
  const total = page.total ?? profiles.length;
  const limit = page.limit;
  const offset = page.offset;
  const range = computeVisibleRange(limit, offset, profiles.length);
  const hasPrevious = offset > 0;
  const hasNext = total > 0 && offset + profiles.length < total;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Profile Inventory</CardTitle>
          <CardDescription>
            {formatProfileRange(range, total)}
            {" of "}
            {formatProfileCount(total)}
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
            Page size {limit} items.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={!hasPrevious}
              onClick={onPreviousPage}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!hasNext}
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
        <Link className={buttonVariants({ variant: "primary" })} to="/profiles/new">
          <Plus aria-hidden="true" className="size-4" />
          New Profile
        </Link>
      </CardContent>
    </Card>
  );
}

function formatProfileCount(count: number): string {
  return count === 1 ? "1 profile" : `${count} profiles`;
}

function formatProfileRange(
  range: { readonly start: number; readonly end: number },
  total: number,
): string {
  if (total === 0) {
    return "Showing 0";
  }

  return `Showing ${range.start}-${range.end}`;
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
): ResolvedFilters {
  const rawStatus = searchParams.get("status");
  const rawAuthHealth = searchParams.get("authenticationHealth");
  const rawOffset = searchParams.get("offset");
  const status = pickKnown(
    rawStatus,
    KnownProfileStatusSchema.options,
  ) as KnownProfileStatus | undefined;
  const authenticationHealth = pickKnown(
    rawAuthHealth,
    KnownProfileAuthenticationHealthSchema.options,
  ) as KnownProfileAuthenticationHealth | undefined;
  const offset = parseOffset(rawOffset);

  return {
    status,
    authenticationHealth,
    limit: PROFILE_INVENTORY_PAGE_SIZE,
    offset,
  };
}

function pickKnown<T extends string>(
  value: string | null,
  options: readonly T[],
): T | undefined {
  if (value === null) {
    return undefined;
  }

  return options.includes(value as T) ? (value as T) : undefined;
}

function parseOffset(rawOffset: string | null): number {
  if (rawOffset === null) {
    return 0;
  }

  const parsed = Number.parseInt(rawOffset, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function hasActiveFilters(filters: ResolvedFilters): boolean {
  return (
    filters.status !== undefined ||
    filters.authenticationHealth !== undefined
  );
}

function setFilterParam(
  updateSearchParams: (next: URLSearchParams) => void,
  searchParams: URLSearchParams,
  key: "status" | "authenticationHealth",
  value: string,
): void {
  const next = new URLSearchParams(searchParams);
  if (value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  // Changing a filter resets offset to zero.
  next.delete("offset");
  updateSearchParams(next);
}

function goToOffset(
  updateSearchParams: (next: URLSearchParams) => void,
  searchParams: URLSearchParams,
  filters: ResolvedFilters,
  nextOffset: number,
): void {
  if (nextOffset < 0) {
    return;
  }

  const next = new URLSearchParams(searchParams);
  if (nextOffset === 0) {
    next.delete("offset");
  } else {
    next.set("offset", String(nextOffset));
  }
  if (filters.status !== undefined) {
    next.set("status", filters.status);
  }
  if (filters.authenticationHealth !== undefined) {
    next.set("authenticationHealth", filters.authenticationHealth);
  }
  updateSearchParams(next);
}

function computeVisibleRange(
  limit: number,
  offset: number,
  visibleCount: number,
): { readonly start: number; readonly end: number } {
  if (visibleCount === 0) {
    return { start: 0, end: 0 };
  }

  return {
    start: offset + 1,
    end: offset + visibleCount,
  };
}
