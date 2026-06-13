import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  KeyRound,
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
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProfileAccountStageBadge } from "@/features/profiles/profile-account-stage-badge";
import {
  useStartProfileProvisioningMutation,
  useUpdateProfileAccountStageMutation,
} from "@/features/profiles/profile-mutations";
import { ProfileSourceAccessCard } from "@/features/profiles/profile-source-access-card";
import { ProfileStatusBadge } from "@/features/profiles/profile-status-badge";
import { useProfileQuery } from "@/features/profiles/profile-queries";
import { isApiResultError } from "@/lib/api/http-client";
import type {
  KnownProfileAccountStage,
  ProfileAccountStage,
  ProfileDetail,
} from "@/lib/api/profile-manager-client";
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
        <ProfileSourceAccessCard profileId={profile.id} />
      </div>
      <div className="grid content-start gap-5">
        <StatusSummaryCard profile={profile} />
        <AccountStageCard
          key={`${profile.id}-${profile.accountStage}`}
          profile={profile}
        />
        <StartProvisioningCard key={profile.id} profile={profile} />
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
          <span className="text-sm text-muted-foreground">Account Stage</span>
          <ProfileAccountStageBadge accountStage={profile.accountStage} />
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

function AccountStageCard({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  const updateAccountStage = useUpdateProfileAccountStageMutation();
  const allowedStages = getAllowedAccountStageTransitions(profile.accountStage);
  const [selectedStage, setSelectedStage] = useState<
    KnownProfileAccountStage | ""
  >(allowedStages[0] ?? "");
  const canSubmit =
    selectedStage !== "" &&
    selectedStage !== profile.accountStage &&
    !updateAccountStage.isPending;

  function updateStage(): void {
    if (selectedStage === "" || !canSubmit) {
      return;
    }

    updateAccountStage.reset();
    void updateAccountStage.mutateAsync({
      profileId: profile.id,
      request: {
        accountStage: selectedStage,
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Stage</CardTitle>
        <CardDescription>
          Manual maturity gate for collection checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Current Stage</span>
          <ProfileAccountStageBadge accountStage={profile.accountStage} />
        </div>

        {allowedStages.length > 0 ? (
          <div className="grid gap-2">
            <Select
              aria-label="Account stage"
              disabled={updateAccountStage.isPending}
              value={selectedStage}
              onChange={(event) =>
                setSelectedStage(
                  event.currentTarget.value as KnownProfileAccountStage,
                )
              }
            >
              {allowedStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={updateStage}
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              {updateAccountStage.isPending ? "Updating Stage" : "Update Stage"}
            </Button>
          </div>
        ) : (
          <StatusBadge label="No transition" tone="neutral" />
        )}

        {updateAccountStage.isError ? (
          <div
            className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-3 py-3 text-sm text-[#7f1d1d]"
            role="alert"
          >
            <div className="flex gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p className="min-w-0 break-words">
                {formatApiError(updateAccountStage.error)}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StartProvisioningCard({
  profile,
}: {
  readonly profile: ProfileDetail;
}): JSX.Element {
  const startProvisioning = useStartProfileProvisioningMutation();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [provisioningSuccess, setProvisioningSuccess] =
    useState<ImmediateProvisioningSuccess | null>(null);
  const canStartProvisioning = profile.status === "PENDING_CONFIG";
  const provisioningToken = provisioningSuccess?.provisioningToken;
  const expiresAt = provisioningSuccess?.expiresAt;

  function start(): void {
    const confirmed = window.confirm(
      `Start provisioning for ${profile.displayName} (${profile.id})?\n\nThe backend may issue a one-time provisioning token. Save it immediately if it is returned.`,
    );

    if (!confirmed) {
      return;
    }

    setCopyState("idle");
    setProvisioningSuccess(null);
    startProvisioning.reset();
    void (async () => {
      try {
        const response = await startProvisioning.mutateAsync({
          profileId: profile.id,
        });

        setProvisioningSuccess({
          ...(response.provisioningToken !== undefined
            ? { provisioningToken: response.provisioningToken }
            : {}),
          ...(response.expiresAt !== undefined
            ? { expiresAt: response.expiresAt }
            : {}),
        });
        startProvisioning.reset();
      } catch {
        return;
      }
    })();
  }

  async function copyProvisioningToken(): Promise<void> {
    if (provisioningToken === undefined) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      navigator.clipboard === undefined
    ) {
      setCopyState("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(provisioningToken);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Provisioning</CardTitle>
          <CardDescription>Start login provisioning through the backend API.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <KeyRound aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Current Status</span>
          <ProfileStatusBadge status={profile.status} />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {getProvisioningStatusText(profile.status)}
        </p>

        {canStartProvisioning ? (
          <Button
            className="w-full"
            disabled={startProvisioning.isPending}
            onClick={start}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            {startProvisioning.isPending
              ? "Starting Provisioning"
              : "Start Provisioning"}
          </Button>
        ) : null}

        {startProvisioning.isError ? (
          <div
            className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-3 py-3 text-sm text-[#7f1d1d]"
            role="alert"
          >
            <div className="flex gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-semibold">Provisioning could not start.</p>
                <p className="mt-1 break-words">
                  {formatApiError(startProvisioning.error)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {provisioningSuccess !== null ? (
          <div
            className="rounded border border-[#8ac6a7] bg-[#f1fbf5] px-3 py-3 text-sm text-[#23563b]"
            role="status"
          >
            <div className="flex gap-2">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-semibold">Provisioning started.</p>
                <p className="mt-1 leading-6">
                  The profile list and detail are refreshing from the backend.
                </p>
              </div>
            </div>

            {provisioningToken !== undefined ? (
              <div className="mt-3 rounded border border-[#8ac6a7] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#36724f]">
                  One-Time Provisioning Token
                </p>
                <code className="mt-2 block max-h-28 overflow-auto break-all rounded border border-border bg-muted/60 p-2 text-xs text-foreground">
                  {provisioningToken}
                </code>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void copyProvisioningToken();
                    }}
                  >
                    <Clipboard aria-hidden="true" className="size-4" />
                    {copyState === "copied" ? "Copied" : "Copy"}
                  </Button>
                  {expiresAt !== undefined ? (
                    <span className="text-xs text-[#36724f]">
                      Expires {formatDateTime(expiresAt)}
                    </span>
                  ) : null}
                </div>
                {copyState === "failed" ? (
                  <p className="mt-2 text-xs font-medium text-[#7f1d1d]">
                    Clipboard copy is unavailable in this browser.
                  </p>
                ) : null}
                <p className="mt-3 text-xs font-medium leading-5 text-[#7f1d1d]">
                  Save this token now. It may not be visible again, and it
                  disappears after a page refresh.
                </p>
              </div>
            ) : (
              <p className="mt-3 leading-6">
                No raw token was returned. Continue with the trusted
                provisioning workflow outside this UI.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface ImmediateProvisioningSuccess {
  readonly provisioningToken?: string;
  readonly expiresAt?: string;
}

const profileAccountStages = [
  "NEW_ACCOUNT",
  "WARMING",
  "COLLECTION_READY",
  "LIMITED",
  "NEEDS_REVIEW",
  "RETIRED",
] as const satisfies readonly KnownProfileAccountStage[];

const allowedAccountStageTransitions = {
  NEW_ACCOUNT: ["WARMING", "NEEDS_REVIEW"],
  WARMING: ["COLLECTION_READY", "LIMITED", "NEEDS_REVIEW"],
  COLLECTION_READY: ["LIMITED", "NEEDS_REVIEW", "RETIRED"],
  LIMITED: ["WARMING", "COLLECTION_READY", "RETIRED"],
  NEEDS_REVIEW: ["WARMING", "RETIRED"],
  RETIRED: [],
} satisfies Record<
  KnownProfileAccountStage,
  readonly KnownProfileAccountStage[]
>;

function getAllowedAccountStageTransitions(
  accountStage: ProfileAccountStage,
): readonly KnownProfileAccountStage[] {
  if (!isKnownAccountStage(accountStage)) {
    return [];
  }

  return allowedAccountStageTransitions[accountStage];
}

function isKnownAccountStage(
  accountStage: ProfileAccountStage,
): accountStage is KnownProfileAccountStage {
  return profileAccountStages.some((stage) => stage === accountStage);
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

function getProvisioningStatusText(status: string): string {
  if (status === "PENDING_CONFIG") {
    return "PENDING_CONFIG can start provisioning after the backend accepts the required configuration.";
  }

  if (status === "PENDING_LOGIN") {
    return "PENDING_LOGIN means provisioning has started and login is the next lifecycle step.";
  }

  if (status === "READY") {
    return "READY means authentication state is already captured for backend checkout.";
  }

  if (status === "BUSY") {
    return "BUSY means the profile is currently checked out by runtime work.";
  }

  return `${status} is reported by the backend.`;
}
