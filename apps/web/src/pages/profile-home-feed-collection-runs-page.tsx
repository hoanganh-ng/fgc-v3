import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertTriangle,
  Ban,
  ClipboardList,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useProfileHomeFeedCollectionRunsQuery,
} from "@/features/collector-runtime/profile-home-feed-collection-run-queries";
import {
  useCancelProfileHomeFeedCollectionRunMutation,
  useRequestProfileHomeFeedCollectionRunMutation,
} from "@/features/collector-runtime/profile-home-feed-collection-run-mutations";
import {
  RequestProfileHomeFeedCollectionRunFormSchema,
  canCancelProfileHomeFeedCollectionRun,
  filterEligibleProfileHomeFeedRunProfiles,
  formatProfileHomeFeedRunParameters,
  getPaginationModel,
  hasActiveProfileHomeFeedCollectionRuns,
  shouldShowPaginationControls,
  toRequestProfileHomeFeedCollectionRunRequest,
  type RequestProfileHomeFeedCollectionRunFormValues,
} from "@/features/collector-runtime/profile-home-feed-collection-run-view-model";
import { useProfilesQuery } from "@/features/profiles/profile-queries";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import { ProfileAccountStageBadge } from "@/features/profiles/profile-account-stage-badge";
import { ProfileAuthenticationHealthBadge } from "@/features/profiles/profile-authentication-health-badge";
import { ProfileStatusBadge } from "@/features/profiles/profile-status-badge";
import {
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunStatus,
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import type { ProfileSummary } from "@/lib/api/profile-manager-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { PageShell } from "@/pages/page-shell";

const runStatuses = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

const PROFILES_QUERY = {
  limit: 100,
  offset: 0,
} as const;

const POLL_INTERVAL_MS = 5_000;

interface ListRunsFilter {
  readonly status: ProfileHomeFeedCollectionRunStatus | "";
  readonly profileId: string;
}

export function ProfileHomeFeedCollectionRunsPage(): JSX.Element {
  const [filter, setFilter] = useState<ListRunsFilter>({
    status: "",
    profileId: "",
  });
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [filter.status, filter.profileId]);

  const query = {
    ...(filter.status !== "" ? { status: filter.status } : {}),
    ...(filter.profileId !== "" ? { profileId: filter.profileId } : {}),
    limit: DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
    offset,
  };

  const runsQuery = useProfileHomeFeedCollectionRunsQuery(query, {
    refetchInterval: false,
  });
  const runs = runsQuery.data?.items ?? [];
  const hasActiveRuns = useMemo(
    () => hasActiveProfileHomeFeedCollectionRuns(runs),
    [runs],
  );
  const pollQuery = useProfileHomeFeedCollectionRunsQuery(query, {
    refetchInterval: hasActiveRuns ? POLL_INTERVAL_MS : false,
  });
  const effectiveQuery = hasActiveRuns ? pollQuery : runsQuery;

  const profilesQuery = useProfilesQuery(PROFILES_QUERY);
  const profiles = profilesQuery.data?.items ?? [];
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const eligibleProfiles = useMemo(
    () => filterEligibleProfileHomeFeedRunProfiles(profiles),
    [profiles],
  );
  const hasPartialProfileInventory = useMemo(() => {
    if (!profilesQuery.data) {
      return false;
    }
    const total = profilesQuery.data.page.total;
    return total !== undefined && total > profilesQuery.data.items.length;
  }, [profilesQuery.data]);

  function refresh(): void {
    void runsQuery.refetch();
    if (hasActiveRuns) {
      void pollQuery.refetch();
    }
    void profilesQuery.refetch();
  }

  function resetFilters(): void {
    setFilter({ status: "", profileId: "" });
    setOffset(0);
  }

  return (
    <PageShell
      eyebrow="Collector Runtime"
      title="Home Feed Runs"
      description="Queue, monitor, filter, and cancel profile-bound Facebook home-feed collection runs."
      actions={
        <Button
          type="button"
          variant="secondary"
          onClick={refresh}
          disabled={runsQuery.isFetching || profilesQuery.isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            className={
              runsQuery.isFetching || profilesQuery.isFetching
                ? "size-4 animate-spin"
                : "size-4"
            }
          />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-5">
          {effectiveQuery.isPending ? <RunsLoadingState /> : null}
          {effectiveQuery.isError ? (
            <RunsErrorState error={effectiveQuery.error} onRetry={refresh} />
          ) : null}
          {effectiveQuery.isSuccess && effectiveQuery.data.items.length === 0 ? (
            <RunsEmptyState />
          ) : null}
          {effectiveQuery.isSuccess && effectiveQuery.data.items.length > 0 ? (
            <HomeFeedRunsList
              runs={effectiveQuery.data.items}
              page={effectiveQuery.data.page}
              profileById={profileById}
              onCancel={refresh}
            />
          ) : null}
          {effectiveQuery.isSuccess &&
          shouldShowPaginationControls({
            offset,
            limit: DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
            itemCount: effectiveQuery.data.items.length,
            total: effectiveQuery.data.page.total,
          }) ? (
            <PaginationControls
              offset={offset}
              limit={DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT}
              itemCount={effectiveQuery.data.items.length}
              total={effectiveQuery.data.page.total}
              onPrev={() => {
                setOffset((current) =>
                  Math.max(
                    0,
                    current -
                      DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
                  ),
                );
              }}
              onNext={() => {
                setOffset(
                  (current) =>
                    current + DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
                );
              }}
            />
          ) : null}
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <RequestHomeFeedRunCard
            eligibleProfiles={eligibleProfiles}
            profilesLoading={profilesQuery.isPending}
            profilesError={profilesQuery.error}
            hasLoadedProfiles={profiles.length > 0}
            hasPartialProfileInventory={hasPartialProfileInventory}
            onRetryProfiles={() => {
              void profilesQuery.refetch();
            }}
          />
          <FilterCard
            filter={filter}
            onFilterChange={setFilter}
            profiles={profiles}
            profilesUnavailable={profilesQuery.isPending || profilesQuery.isError}
            onReset={resetFilters}
          />
        </aside>
      </div>
    </PageShell>
  );
}

function HomeFeedRunsList({
  runs,
  page,
  profileById,
  onCancel,
}: {
  readonly runs: readonly ProfileHomeFeedCollectionRun[];
  readonly page: { readonly total?: number | undefined };
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Home Feed Runs</CardTitle>
          <CardDescription>
            {formatCount(page.total ?? runs.length, "home-feed run")}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <ClipboardList aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {runs.map((run) => (
            <HomeFeedRunRow
              key={run.id}
              run={run}
              profile={profileById.get(run.profileId)}
              onCancel={onCancel}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HomeFeedRunRow({
  run,
  profile,
  onCancel,
}: {
  readonly run: ProfileHomeFeedCollectionRun;
  readonly profile: ProfileSummary | undefined;
  readonly onCancel: () => void;
}): JSX.Element {
  const profileName = profile?.displayName ?? run.profileId;

  return (
    <article className="grid min-w-0 gap-3 px-4 py-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Run ID
          </p>
          <code
            className="mt-1 block max-w-[24rem] truncate rounded border border-border bg-muted/55 px-2 py-1 font-mono text-xs text-foreground"
            title={run.id}
          >
            {run.id}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatusBadge label={run.status} tone={runStatusTone(run.status)} />
          {canCancelProfileHomeFeedCollectionRun(run.status) ? (
            <CancelRunButton runId={run.id} onCancel={onCancel} />
          ) : null}
        </div>
      </div>

      <dl className="grid min-w-0 gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Profile
          </dt>
          <dd className="mt-1 min-w-0">
            <p className="truncate font-medium text-foreground" title={profileName}>
              {profileName}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={run.profileId}
            >
              {run.profileId}
            </p>
            {profile !== undefined ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ProfileStatusBadge status={profile.status} />
                <ProfileAccountStageBadge accountStage={profile.accountStage} />
                <ProfileAuthenticationHealthBadge
                  health={profile.authenticationHealth}
                />
              </div>
            ) : null}
          </dd>
        </div>

        <RunDefinitionTerm label="Trigger" value={run.triggerType} />
        <RunDefinitionTerm
          label="Account Stage At Request"
          value={run.accountStageAtRequest}
        />
        <RunDefinitionTerm
          label="Target"
          value={`${run.target.platform} / ${run.target.surface}`}
        />
        <RunDefinitionTerm
          label="Parameters"
          value={formatProfileHomeFeedRunParameters(run.parameters)}
        />
        <RunDefinitionTerm label="Requested" value={formatDateTime(run.requestedAt)} />
        <RunDefinitionTerm
          label="Started"
          value={run.startedAt !== undefined ? formatDateTime(run.startedAt) : "-"}
        />
        <RunDefinitionTerm
          label="Finished"
          value={
            run.finishedAt !== undefined ? formatDateTime(run.finishedAt) : "-"
          }
        />
      </dl>

      {run.summary !== undefined ? <SummaryPanel summary={run.summary} /> : null}
      {run.failureReason !== undefined ? (
        <FailurePanel failureReason={run.failureReason} />
      ) : null}
    </article>
  );
}

function RunDefinitionTerm({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-muted-foreground">{value}</dd>
    </div>
  );
}

function SummaryPanel({
  summary,
}: {
  readonly summary: ProfileHomeFeedCollectionRun["summary"];
}): JSX.Element | null {
  if (summary === undefined) {
    return null;
  }

  const items = [
    ["Captured", summary.capturedPayloads],
    ["Extracted", summary.extractorCandidates],
    ["Publishers observed", summary.sourcePublishersObserved],
    ["Submitted", summary.contentItemsSubmitted],
    ["Publisher observation failures", summary.failedPublisherObservations],
    ["Content submission failures", summary.failedContentSubmissions],
  ] as const;

  return (
    <div className="rounded border border-border bg-muted/25 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Summary
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {items.map(([label, value]) =>
          value !== undefined ? (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd>
                {value} {label.toLowerCase()}
              </dd>
            </div>
          ) : null,
        )}
        {summary.leaseReleased !== undefined ? (
          <div>
            <dt className="sr-only">Lease released</dt>
            <dd>{summary.leaseReleased ? "Lease released" : "Lease not released"}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function FailurePanel({
  failureReason,
}: {
  readonly failureReason: NonNullable<
    ProfileHomeFeedCollectionRun["failureReason"]
  >;
}): JSX.Element {
  return (
    <div className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-[#8f3030]"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#7f1d1d]">
            {failureReason.code}
          </p>
          <p className="mt-0.5 text-sm text-[#7f1d1d]">
            {failureReason.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function CancelRunButton({
  runId,
  onCancel,
}: {
  readonly runId: string;
  readonly onCancel: () => void;
}): JSX.Element {
  const cancelMutation = useCancelProfileHomeFeedCollectionRunMutation();

  async function cancel(): Promise<void> {
    cancelMutation.reset();
    try {
      await cancelMutation.mutateAsync({
        profileHomeFeedCollectionRunId: runId,
      });
      onCancel();
    } catch {
      return;
    }
  }

  return (
    <div className="grid max-w-sm justify-items-end gap-2">
      <Button
        aria-label={`Cancel home-feed run ${runId}`}
        disabled={cancelMutation.isPending}
        size="sm"
        variant="danger"
        onClick={() => {
          void cancel();
        }}
      >
        <Ban aria-hidden="true" className="size-4" />
        {cancelMutation.isPending ? "Canceling" : "Cancel"}
      </Button>
      <BackendErrorPanel
        error={cancelMutation.error}
        fallbackMessage="Home-feed run cancellation failed."
      />
    </div>
  );
}

function RequestHomeFeedRunCard({
  eligibleProfiles,
  profilesLoading,
  profilesError,
  hasLoadedProfiles,
  hasPartialProfileInventory,
  onRetryProfiles,
}: {
  readonly eligibleProfiles: readonly ProfileSummary[];
  readonly profilesLoading: boolean;
  readonly profilesError: unknown;
  readonly hasLoadedProfiles: boolean;
  readonly hasPartialProfileInventory: boolean;
  readonly onRetryProfiles: () => void;
}): JSX.Element {
  const requestMutation = useRequestProfileHomeFeedCollectionRunMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [createdRunId, setCreatedRunId] = useState<string>();
  const hasProfilesError = profilesError !== null && profilesError !== undefined;
  const noEligibleProfiles =
    !profilesLoading && !hasProfilesError && eligibleProfiles.length === 0;
  const form = useForm<RequestProfileHomeFeedCollectionRunFormValues>({
    defaultValues: {
      profileId: "",
      maxScrolls: "",
      maxDurationMs: "",
      maxPosts: "",
    },
  });

  async function submit(
    values: RequestProfileHomeFeedCollectionRunFormValues,
  ): Promise<void> {
    setValidationSummary(undefined);
    setCreatedRunId(undefined);
    requestMutation.reset();

    const parsed = RequestProfileHomeFeedCollectionRunFormSchema.safeParse(
      values,
    );

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Home-feed run request is invalid.",
      );
      return;
    }

    try {
      const response = await requestMutation.mutateAsync(
        toRequestProfileHomeFeedCollectionRunRequest(parsed.data),
      );
      form.reset({
        profileId: "",
        maxScrolls: "",
        maxDurationMs: "",
        maxPosts: "",
      });
      setCreatedRunId(response.profileHomeFeedCollectionRun.id);
    } catch {
      return;
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Request Home Feed Run</CardTitle>
          <CardDescription>
            Queue a manual home-feed run for an eligible profile.
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Play aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          {validationSummary !== undefined ? (
            <ValidationSummary message={validationSummary} />
          ) : null}
          <BackendErrorPanel
            error={requestMutation.error}
            fallbackMessage="Home-feed run request failed."
          />
          <BackendErrorPanel
            error={profilesError}
            fallbackMessage="Profiles could not load. Home-feed runs remain visible by profile ID."
          />
          {hasProfilesError ? (
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={onRetryProfiles}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Retry Profiles
              </Button>
            </div>
          ) : null}
          {createdRunId !== undefined ? (
            <SuccessPanel message={`Home-feed run ${createdRunId} was queued.`} />
          ) : null}
          {hasPartialProfileInventory ? (
            <div className="rounded border border-[#dfc36e] bg-[#fff7dc] px-3 py-2 text-xs font-medium text-[#76591a]">
              The selector contains only a partial profile inventory. Some
              eligible profiles may be missing.
            </div>
          ) : null}
          {noEligibleProfiles ? (
            <div
              role="status"
              className="rounded border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              {hasLoadedProfiles
                ? "No eligible profiles are READY, COLLECTION_READY, and HEALTHY."
                : "No profiles are available. Create and prepare a profile before requesting a home-feed run."}
            </div>
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.profileId)}
            htmlFor="home-feed-run-profile"
            label="Profile"
          >
            <Select
              id="home-feed-run-profile"
              disabled={profilesLoading || hasProfilesError || noEligibleProfiles}
              {...form.register("profileId")}
            >
              <option value="">Select eligible profile</option>
              {eligibleProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} · {profile.id}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <FormField
              error={getErrorMessage(form.formState.errors.maxScrolls)}
              htmlFor="home-feed-run-max-scrolls"
              label="Max Scrolls"
            >
              <Input
                id="home-feed-run-max-scrolls"
                autoComplete="off"
                inputMode="numeric"
                min={0}
                placeholder="Optional"
                type="number"
                {...form.register("maxScrolls")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.maxDurationMs)}
              htmlFor="home-feed-run-max-duration"
              label="Max Duration (ms)"
            >
              <Input
                id="home-feed-run-max-duration"
                autoComplete="off"
                inputMode="numeric"
                min={1}
                placeholder="Optional"
                type="number"
                {...form.register("maxDurationMs")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.maxPosts)}
              htmlFor="home-feed-run-max-posts"
              label="Max Posts"
            >
              <Input
                id="home-feed-run-max-posts"
                autoComplete="off"
                inputMode="numeric"
                min={1}
                placeholder="Optional"
                type="number"
                {...form.register("maxPosts")}
              />
            </FormField>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={
                profilesLoading ||
                hasProfilesError ||
                noEligibleProfiles ||
                requestMutation.isPending
              }
              type="submit"
            >
              <Play aria-hidden="true" className="size-4" />
              {requestMutation.isPending ? "Requesting" : "Request Run"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FilterCard({
  filter,
  onFilterChange,
  profiles,
  profilesUnavailable,
  onReset,
}: {
  readonly filter: ListRunsFilter;
  readonly onFilterChange: (filter: ListRunsFilter) => void;
  readonly profiles: readonly ProfileSummary[];
  readonly profilesUnavailable: boolean;
  readonly onReset: () => void;
}): JSX.Element {
  const hasActiveFilters = filter.status !== "" || filter.profileId !== "";

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>Narrow the home-feed run list.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField htmlFor="home-feed-run-filter-status" label="Status">
          <Select
            id="home-feed-run-filter-status"
            value={filter.status}
            onChange={(event) => {
              onFilterChange({
                ...filter,
                status: event.target.value as ProfileHomeFeedCollectionRunStatus | "",
              });
            }}
          >
            <option value="">All statuses</option>
            {runStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="home-feed-run-filter-profile" label="Profile">
          <Select
            id="home-feed-run-filter-profile"
            disabled={profilesUnavailable}
            value={filter.profileId}
            onChange={(event) => {
              onFilterChange({
                ...filter,
                profileId: event.target.value,
              });
            }}
          >
            <option value="">All profiles</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName} · {profile.id}
              </option>
            ))}
          </Select>
        </FormField>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
          >
            <X aria-hidden="true" className="size-4" />
            Clear Filters
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaginationControls({
  offset,
  limit,
  itemCount,
  total,
  onPrev,
  onNext,
}: {
  readonly offset: number;
  readonly limit: number;
  readonly itemCount: number;
  readonly total: number | undefined;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}): JSX.Element | null {
  const { canGoBack, canGoNext, visibleRange } = getPaginationModel({
    offset,
    limit,
    itemCount,
    total,
  });

  if (!canGoBack && !canGoNext && visibleRange === undefined) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <Button disabled={!canGoBack} variant="secondary" size="sm" onClick={onPrev}>
        Previous
      </Button>
      <p className="text-sm text-muted-foreground">
        {visibleRange !== undefined
          ? `Showing ${visibleRange.start}-${visibleRange.end}${
              total !== undefined ? ` of ${total}` : ""
            }`
          : "No results"}
      </p>
      <Button disabled={!canGoNext} variant="secondary" size="sm" onClick={onNext}>
        Next
      </Button>
    </div>
  );
}

function RunsLoadingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading Home Feed Runs</CardTitle>
        <CardDescription>
          Reading profile home-feed collection runs from Collector Runtime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {["one", "two", "three"].map((row) => (
          <div
            key={row}
            className="min-h-20 animate-pulse rounded border border-border bg-muted"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RunsErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Home Feed Runs Could Not Load</CardTitle>
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

function RunsEmptyState(): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>No Home Feed Runs</CardTitle>
          <CardDescription>
            No profile home-feed collection runs match the current filters.
          </CardDescription>
        </div>
        <StatusBadge label="Empty" tone="neutral" />
      </CardHeader>
    </Card>
  );
}

function ValidationSummary({
  message,
}: {
  readonly message: string;
}): JSX.Element {
  return (
    <div
      className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#7f1d1d]"
      role="alert"
    >
      {message}
    </div>
  );
}

function SuccessPanel({
  message,
}: {
  readonly message: string;
}): JSX.Element {
  return (
    <div
      className="rounded border border-[#9dd3aa] bg-[#f1fbf3] px-4 py-3 text-sm font-medium text-[#1f6b38]"
      role="status"
    >
      {message}
    </div>
  );
}

function runStatusTone(
  status: ProfileHomeFeedCollectionRunStatus,
): StatusBadgeTone {
  switch (status) {
    case "QUEUED":
      return "warning";
    case "RUNNING":
      return "info";
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "danger";
    case "CANCELED":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatApiError(error: unknown): string {
  const message = getErrorMessage(error);
  return message ?? "The request failed.";
}
