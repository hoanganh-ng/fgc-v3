import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useProfilesQuery,
  useSourceGroupProfileAccessQuery,
} from "@/features/profiles/profile-queries";
import {
  type ProfileSourceAccess,
  type ProfileSourceAccessState,
  type ProfileSummary,
} from "@/lib/api/profile-manager-client";
import { isApiResultError } from "@/lib/api/http-client";
import { ProfileSourceAccessStateBadge } from "@/features/profiles/profile-source-access-state-badge";

const SUCCESSFUL_STATES: ProfileSourceAccessState[] = [
  "PUBLIC_ACCESSIBLE",
  "JOINED_ACCESSIBLE",
];

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SourceGroupProfileAccessPanel({
  sourceGroupId,
}: {
  readonly sourceGroupId: string;
}): JSX.Element {
  const accessQuery = useSourceGroupProfileAccessQuery(sourceGroupId);
  const profilesQuery = useProfilesQuery();

  const {
    recordedOutcomes,
    successfulAccess,
    needsAttention,
  } = useMemo(() => {
    if (!accessQuery.data) {
      return { recordedOutcomes: 0, successfulAccess: 0, needsAttention: 0 };
    }

    let successful = 0;
    let attention = 0;

    for (const record of accessQuery.data.items) {
      if (SUCCESSFUL_STATES.includes(record.accessState)) {
        successful++;
      } else {
        attention++;
      }
    }

    return {
      recordedOutcomes: accessQuery.data.items.length,
      successfulAccess: successful,
      needsAttention: attention,
    };
  }, [accessQuery.data]);

  const profileMap = useMemo(() => {
    if (!profilesQuery.data) {
      return new Map<string, ProfileSummary>();
    }
    return new Map(
      profilesQuery.data.items.map((profile) => [profile.id, profile])
    );
  }, [profilesQuery.data]);

  const hasPaginationWarning = useMemo(() => {
    if (!profilesQuery.data || !accessQuery.data) {
      return false;
    }
    const total = profilesQuery.data.page.total;
    return total !== undefined && total > profilesQuery.data.items.length;
  }, [profilesQuery.data, accessQuery.data]);

  const profileQueryFailed = profilesQuery.isError;

  if (accessQuery.isPending) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Loading Profile Access</CardTitle>
          <CardDescription>Reading access records for this source group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {["one", "two", "three"].map((row) => (
            <div
              key={row}
              className="h-16 animate-pulse rounded border border-border bg-muted"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (accessQuery.isError) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Profile Access Could Not Load</CardTitle>
          <CardDescription>
            {isApiResultError(accessQuery.error)
              ? accessQuery.error.message
              : "The profile access request failed."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="secondary"
            onClick={() => {
              void accessQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (accessQuery.isSuccess && accessQuery.data.items.length === 0) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>No Access Records</CardTitle>
          <CardDescription>
            No access outcomes have been recorded for this source group.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Profile Access Readiness</CardTitle>
          <CardDescription>
            Recorded outcomes for this source group.
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void accessQuery.refetch();
            void profilesQuery.refetch();
          }}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <StatusBadge
            label={`Recorded outcomes: ${recordedOutcomes}`}
            tone="neutral"
          />
          <StatusBadge
            label={`Successful access: ${successfulAccess}`}
            tone="success"
          />
          <StatusBadge
            label={`Needs attention: ${needsAttention}`}
            tone="warning"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Successful access is one collection requirement and does not guarantee current checkout eligibility.
        </p>

        {hasPaginationWarning && (
          <div className="rounded border border-[#dfc36e] bg-[#fff7dc] px-4 py-3 text-sm font-medium text-[#76591a]">
            Some profile names may be unresolved because the profile list is paginated. Profile IDs remain authoritative.
          </div>
        )}

        {profileQueryFailed && (
          <div className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#7f1d1d]">
            <div className="flex items-start gap-2">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>Profile summary data could not be loaded. Access records are still visible by ID.</p>
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {accessQuery.data.items.map((record) => {
            const profile = profileMap.get(record.profileId);
            return (
              <ProfileAccessRow
                key={record.id}
                record={record}
                profile={profile}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileAccessRow({
  record,
  profile,
}: {
  readonly record: ProfileSourceAccess;
  readonly profile: ProfileSummary | undefined;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copyProfileId(): Promise<void> {
    if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(record.profileId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  }

  return (
    <div className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Profile
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {profile ? (
              <Link
                to={`/profiles/${encodeURIComponent(profile.id)}`}
                className="truncate font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                title={profile.displayName}
              >
                {profile.displayName}
              </Link>
            ) : (
              <span className="truncate font-mono text-sm text-muted-foreground">
                {record.profileId}
              </span>
            )}
            <Button
              aria-label={`Copy profile ID ${record.profileId}`}
              size="sm"
              variant="ghost"
              className="size-6 p-0"
              onClick={copyProfileId}
            >
              <Copy aria-hidden="true" className="size-3" />
            </Button>
            {copied && (
              <span className="text-xs text-muted-foreground">Copied</span>
            )}
          </div>
        </div>
        <ProfileSourceAccessStateBadge accessState={record.accessState} />
      </div>

      {profile && (
        <dl className="grid min-w-0 gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Operational Status
            </dt>
            <dd className="mt-1 truncate text-foreground">
              {profile.status}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Account Stage
            </dt>
            <dd className="mt-1 truncate text-foreground">
              {profile.accountStage}
            </dd>
          </div>
        </dl>
      )}

      <dl className="grid min-w-0 gap-x-5 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Last Checked
          </dt>
          <dd className="mt-1 truncate text-muted-foreground">
            {formatDateTime(record.lastCheckedAt)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Last Successful
          </dt>
          <dd className="mt-1 truncate text-muted-foreground">
            {formatDateTime(record.lastSuccessfulAt)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Join Requested
          </dt>
          <dd className="mt-1 truncate text-muted-foreground">
            {formatDateTime(record.joinRequestedAt)}
          </dd>
        </div>
      </dl>

      {record.lastFailureReason && (
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Failure Reason
          </p>
          <p className="mt-1 text-sm text-[#7f1d1d]">
            {record.lastFailureReason.code}: {record.lastFailureReason.message}
          </p>
        </div>
      )}

      {record.notes && (
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {record.notes}
          </p>
        </div>
      )}
    </div>
  );
}