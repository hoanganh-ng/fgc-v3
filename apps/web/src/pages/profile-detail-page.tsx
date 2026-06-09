import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
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
import { useProfileQuery } from "@/features/profiles/profile-queries";
import { isApiResultError } from "@/lib/api/http-client";
import type { ProfileDetail } from "@/lib/api/profile-manager-client";
import { PageShell } from "@/pages/page-shell";

export function ProfileDetailPage(): JSX.Element {
  const navigate = useNavigate();
  const { profileId: routeProfileId } = useParams();
  const profileId = routeProfileId ?? "";
  const profileQuery = useProfileQuery(profileId);
  const profile = profileQuery.data?.profile;

  return (
    <PageShell
      eyebrow="Collector Profile Manager"
      title={profile?.displayName ?? profileId}
      description={profile !== undefined ? profile.id : "Profile detail"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Button>
          {profileId.trim().length > 0 ? (
            <Link
              className={buttonVariants({ variant: "primary" })}
              to={`/profiles/${encodeURIComponent(profileId)}/configure`}
            >
              <Settings2 aria-hidden="true" className="size-4" />
              Configure
            </Link>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              void profileQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>
      }
    >
      {profileId.trim().length === 0 ? <ProfileNotFoundState /> : null}
      {profileId.trim().length > 0 && profileQuery.isPending ? (
        <ProfileDetailLoadingState />
      ) : null}
      {profileId.trim().length > 0 && profileQuery.isError ? (
        isProfileNotFoundError(profileQuery.error) ? (
          <ProfileNotFoundState />
        ) : (
          <ProfileDetailErrorState
            error={profileQuery.error}
            onRetry={() => {
              void profileQuery.refetch();
            }}
          />
        )
      ) : null}
      {profile !== undefined ? <ProfileDetailView profile={profile} /> : null}
    </PageShell>
  );
}

function ProfileDetailView({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        <IdentitySummaryCard profile={profile} />
        <ConfigurationSummaryCard profile={profile} />
      </div>
      <div className="grid content-start gap-5">
        <StatusSummaryCard profile={profile} />
        <TimestampSummaryCard profile={profile} />
      </div>
    </div>
  );
}

function IdentitySummaryCard({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Identity</CardTitle>
          <CardDescription>{profile.displayName}</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <UserRound aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Profile ID" value={profile.id} />
          <Field label="Timezone" value={profile.timezone} />
          <Field
            label="External Reference"
            value={profile.externalReference ?? "None"}
          />
          <Field
            label="Labels"
            value={
              profile.labels !== undefined && profile.labels.length > 0
                ? profile.labels.join(", ")
                : "None"
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function StatusSummaryCard({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <CardDescription>Current backend state and safe readiness flags.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Profile Status</span>
          <ProfileStatusBadge status={profile.status} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Authentication</span>
          <StatusBadge
            label={profile.hasAuthenticationState ? "Captured" : "Missing"}
            tone={profile.hasAuthenticationState ? "success" : "warning"}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Fingerprint</span>
          <StatusBadge
            label={profile.hasHardwareFingerprint ? "Present" : "Missing"}
            tone={profile.hasHardwareFingerprint ? "success" : "warning"}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Proxy Routing</span>
          <StatusBadge
            label={profile.networkContext.proxy === null ? "Direct" : "Configured"}
            tone={profile.networkContext.proxy === null ? "neutral" : "info"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigurationSummaryCard({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  const proxy = profile.networkContext.proxy;
  const hardware = profile.hardwareFingerprint;
  const primaryTopics = profile.contentAffinities.primaryTopics
    .slice(0, 3)
    .map((topic) => topic.topic)
    .join(", ");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Safe Configuration</CardTitle>
          <CardDescription>Profile configuration groups exposed by safe reads.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Proxy"
            value={
              proxy === null
                ? "Direct connection"
                : `${proxy.protocol} ${proxy.host}:${proxy.port}`
            }
          />
          <Field
            label="Proxy Region"
            value={
              proxy === null
                ? "None"
                : [proxy.countryCode, proxy.region].filter(Boolean).join(" / ") ||
                  "Unspecified"
            }
          />
          <Field
            label="Killswitch"
            value={
              profile.networkContext.killswitch.enabled
                ? profile.networkContext.killswitch.failClosed
                  ? "Enabled, fail closed"
                  : "Enabled"
                : "Disabled"
            }
          />
          <Field
            label="Hardware"
            value={
              hardware === null
                ? "Missing"
                : `${hardware.viewport.width}x${hardware.viewport.height}, ${hardware.languages.length} languages`
            }
          />
          <Field
            label="Platform"
            value={hardware?.platform ?? "Unspecified"}
          />
          <Field
            label="Device"
            value={
              hardware === null
                ? "Unspecified"
                : `${hardware.hardwareConcurrency} threads${
                    hardware.deviceMemoryGb !== undefined
                      ? `, ${hardware.deviceMemoryGb} GB`
                      : ""
                  }`
            }
          />
          <Field
            label="Routine"
            value={`${profile.temporalRoutine.chronotype}, ${profile.temporalRoutine.activeWindows.length} windows`}
          />
          <Field
            label="Cooldown"
            value={`${profile.temporalRoutine.cooldownMinutes} minutes`}
          />
          <Field
            label="Behavior"
            value={`${profile.behavioralPersona.scrollStyle}, ${formatPercent(
              profile.behavioralPersona.reverseScrollProbability,
            )} reverse scroll`}
          />
          <Field
            label="Safety"
            value={`${profile.safetyThresholds.maxSessionsPerDay} sessions/day, ${profile.safetyThresholds.maxSessionDurationMinutes} min/session`}
          />
          <Field
            label="Macro Limit"
            value={`${profile.safetyThresholds.maxMacroActionsPerDay} actions/day`}
          />
          <Field
            label="Topics"
            value={
              primaryTopics.length > 0
                ? primaryTopics
                : `${profile.contentAffinities.primaryTopics.length} primary topics`
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function TimestampSummaryCard({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Timestamps</CardTitle>
          <CardDescription>Profile lifecycle timing.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <CalendarClock aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          <Field label="Created" value={formatDateTime(profile.createdAt)} />
          <Field label="Updated" value={formatDateTime(profile.updatedAt)} />
          <Field
            label="Last Checkout"
            value={formatNullableDateTime(profile.lastCheckoutAt)}
          />
          <Field
            label="Last Release"
            value={formatNullableDateTime(profile.lastReleasedAt)}
          />
          <Field
            label="Next Available"
            value={formatNullableDateTime(profile.nextAvailableAt)}
          />
          <Field
            label="Daily Usage"
            value={`${profile.dailyUsage.sessionsStarted} sessions, ${profile.dailyUsage.activeDurationMinutes} minutes, ${profile.dailyUsage.macroActions} actions`}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function ProfileDetailLoadingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading Profile</CardTitle>
        <CardDescription>Reading profile detail from the API.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {["one", "two", "three", "four", "five", "six"].map((row) => (
          <div
            key={row}
            className="h-20 animate-pulse rounded border border-border bg-muted/70"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ProfileDetailErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Could Not Load</CardTitle>
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

function ProfileNotFoundState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Not Found</CardTitle>
        <CardDescription>No safe profile detail was returned for this id.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link className={buttonVariants({ variant: "secondary" })} to="/profiles">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Profiles
        </Link>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded border border-border bg-muted/35 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function isProfileNotFoundError(error: unknown): boolean {
  return (
    isApiResultError(error) &&
    error.error.kind === "http" &&
    error.error.status === 404
  );
}

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The profile detail request failed.";
}

function formatNullableDateTime(value: string | null): string {
  return value === null ? "None" : formatDateTime(value);
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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
