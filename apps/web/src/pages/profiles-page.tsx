import { Link } from "react-router-dom";
import { ArrowRight, Plus, RefreshCw, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProfileStatusBadge } from "@/features/profiles/profile-status-badge";
import { useProfilesQuery } from "@/features/profiles/profile-queries";
import { isApiResultError } from "@/lib/api/http-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";
import { PageShell } from "@/pages/page-shell";

export function ProfilesPage(): JSX.Element {
  const profilesQuery = useProfilesQuery();

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
        <ProfilesEmptyState />
      ) : null}
      {profilesQuery.isSuccess && profilesQuery.data.items.length > 0 ? (
        <ProfilesTable
          page={profilesQuery.data.page}
          profiles={profilesQuery.data.items}
        />
      ) : null}
    </PageShell>
  );
}

function ProfilesTable({
  page,
  profiles,
}: {
  readonly page: { readonly total?: number | undefined };
  readonly profiles: readonly ProfileSummary[];
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Profile Inventory</CardTitle>
          <CardDescription>
            {formatProfileCount(page.total ?? profiles.length)}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Users aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/45 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
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
            className="grid min-h-14 animate-pulse grid-cols-[minmax(12rem,1fr)_8rem_10rem_10rem] items-center gap-4 border-b border-border last:border-b-0"
          >
            <div className="h-4 rounded bg-muted" />
            <div className="h-6 rounded bg-muted" />
            <div className="h-4 rounded bg-muted" />
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

function formatProfileCount(count: number): string {
  return count === 1 ? "1 profile" : `${count} profiles`;
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
