import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Eye,
  RefreshCw,
  X,
  ClipboardList,
} from "lucide-react";
import {
  useProfileSourceAccessCheckRunQuery,
  useProfileSourceAccessCheckRunsQuery,
} from "@/features/collector-runtime/profile-source-access-check-run-queries";
import {
  useCancelProfileSourceAccessCheckRunMutation,
  useRequestProfileSourceAccessCheckRunMutation,
} from "@/features/collector-runtime/profile-source-access-check-run-mutations";
import {
  RequestProfileSourceAccessCheckRunFormSchema,
  canCancelProfileSourceAccessCheckRun,
  getPaginationModel,
  getProfileDisplay,
  getSourceGroupDisplay,
  getOutcomePresentation,
  hasActiveProfileSourceAccessCheckRuns,
  shouldShowPaginationControls,
  toRequestProfileSourceAccessCheckRunRequest,
  type RequestProfileSourceAccessCheckRunFormValues,
} from "@/features/collector-runtime/profile-source-access-check-run-view-model";
import {
  getProfileSourceAccessCheckRunDetailContentState,
  getProfileSourceAccessCheckRunRowSelectionState,
  getNextProfileSourceAccessCheckRunDetailDrawerState,
  shouldRestoreProfileSourceAccessCheckRunDetailFocus,
  type ProfileSourceAccessCheckRunDetailCloseSource,
} from "@/features/collector-runtime/profile-source-access-check-run-detail-drawer-state";
import { useProfilesQuery } from "@/features/profiles/profile-queries";
import { useSourceGroupsQuery } from "@/features/content-manager/content-manager-queries";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
} from "@/features/profiles/profile-form-support";
import { isApiResultError } from "@/lib/api/http-client";
import {
  type ProfileSourceAccessCheckRun,
  type ProfileSourceAccessCheckRunStatus,
  DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { type ProfileSummary } from "@/lib/api/profile-manager-client";
import { type SourceGroup } from "@/lib/api/content-manager-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { PageShell } from "@/pages/page-shell";

interface ListProfileSourceAccessCheckRunsFilter {
  status: ProfileSourceAccessCheckRunStatus | "";
  profileId: string;
  sourceGroupId: string;
}

const POLL_INTERVAL_MS = 5_000;

export function ProfileSourceAccessCheckRunsPage(): JSX.Element {
  const [filter, setFilter] = useState<ListProfileSourceAccessCheckRunsFilter>({
    status: "",
    profileId: "",
    sourceGroupId: "",
  });
  const [offset, setOffset] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const selectedRunDetailsButtonRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreRunDetailsFocusRef = useRef(false);

  useEffect(() => {
    setOffset(0);
  }, [filter.status, filter.profileId, filter.sourceGroupId]);

  useEffect(() => {
    if (selectedRunId !== undefined || !shouldRestoreRunDetailsFocusRef.current) {
      return;
    }

    shouldRestoreRunDetailsFocusRef.current = false;
    window.requestAnimationFrame(() => {
      selectedRunDetailsButtonRef.current?.focus();
    });
  }, [selectedRunId]);

  const query = {
    ...(filter.status !== "" ? { status: filter.status } : {}),
    ...(filter.profileId.trim() !== ""
      ? { profileId: filter.profileId.trim() }
      : {}),
    ...(filter.sourceGroupId.trim() !== ""
      ? { sourceGroupId: filter.sourceGroupId.trim() }
      : {}),
    limit: DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
    offset,
  };

  const runsQuery = useProfileSourceAccessCheckRunsQuery(query, {
    refetchInterval: false,
  });
  const runs = runsQuery.data?.items ?? [];
  const hasActiveRuns = useMemo(
    () => hasActiveProfileSourceAccessCheckRuns(runs),
    [runs],
  );

  const pollQuery = useProfileSourceAccessCheckRunsQuery(query, {
    refetchInterval: hasActiveRuns ? POLL_INTERVAL_MS : false,
  });
  const effectiveQuery = hasActiveRuns ? pollQuery : runsQuery;

  const profilesQuery = useProfilesQuery();
  const profiles = profilesQuery.data?.items ?? [];
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const sourceGroupsQuery = useSourceGroupsQuery({
    limit: 100,
    offset: 0,
  });
  const sourceGroups = sourceGroupsQuery.data?.items ?? [];
  const activeFacebookSourceGroups = useMemo(
    () =>
      sourceGroups.filter(
        (sg) => sg.platform === "FACEBOOK" && sg.status === "ACTIVE",
      ),
    [sourceGroups],
  );
  const sourceGroupById = useMemo(
    () => new Map(sourceGroups.map((sg) => [sg.id, sg])),
    [sourceGroups],
  );

  const hasProfilePaginationWarning = useMemo(() => {
    const profileData = profilesQuery.data;
    if (!profileData) {
      return false;
    }
    const total = profileData.page.total;
    return total !== undefined && total > profileData.items.length;
  }, [profilesQuery.data]);

  const hasSourceGroupsPaginationWarning = useMemo(() => {
    const sgData = sourceGroupsQuery.data;
    if (!sgData) {
      return false;
    }
    const total = sgData.page.total;
    return total !== undefined && total > sgData.items.length;
  }, [sourceGroupsQuery.data]);

  function refresh(): void {
    void runsQuery.refetch();
    if (hasActiveRuns) {
      void pollQuery.refetch();
    }
  }

  function resetFilters(): void {
    setFilter({ status: "", profileId: "", sourceGroupId: "" });
    setOffset(0);
  }

  function selectRunDetail(
    checkRunId: string,
    opener: HTMLButtonElement,
  ): void {
    selectedRunDetailsButtonRef.current = opener;
    setSelectedRunId(
      getNextProfileSourceAccessCheckRunDetailDrawerState(
        { selectedRunId },
        { type: "select", checkRunId },
      ).selectedRunId,
    );
  }

  function closeRunDetail(source: ProfileSourceAccessCheckRunDetailCloseSource): void {
    const nextState = getNextProfileSourceAccessCheckRunDetailDrawerState(
      { selectedRunId },
      { type: "close", source },
    );
    const shouldRestoreFocus = shouldRestoreProfileSourceAccessCheckRunDetailFocus({
      previousSelectedRunId: selectedRunId,
      nextSelectedRunId: nextState.selectedRunId,
    });

    setSelectedRunId(nextState.selectedRunId);

    if (shouldRestoreFocus) {
      shouldRestoreRunDetailsFocusRef.current = true;
    }
  }

  return (
    <PageShell
      eyebrow="Collector Runtime"
      title="Profile-Source Access Check Runs"
      description="Request, monitor, inspect, and cancel queued profile-source access checks."
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
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
            <ProfileSourceAccessCheckRunsList
              runs={effectiveQuery.data.items}
              page={effectiveQuery.data.page}
              profileById={profileById}
              sourceGroupById={sourceGroupById}
              selectedRunId={selectedRunId}
              onCancel={refresh}
              onSelectRun={selectRunDetail}
            />
          ) : null}
          {effectiveQuery.isSuccess &&
          shouldShowPaginationControls({
            offset,
            limit: DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
            itemCount: effectiveQuery.data.items.length,
            total: effectiveQuery.data.page.total,
          }) ? (
            <PaginationControls
              offset={offset}
              limit={DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT}
              itemCount={effectiveQuery.data.items.length}
              total={effectiveQuery.data.page.total}
              onPrev={() =>
                setOffset((currentOffset) =>
                  Math.max(
                    0,
                    currentOffset - DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
                  ),
                )
              }
              onNext={() =>
                setOffset(
                  (currentOffset) =>
                    currentOffset + DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
                )
              }
            />
          ) : null}
        </div>

        <aside className="grid min-w-0 gap-5 content-start">
          <RequestProfileSourceAccessCheckRunCard
            profiles={profiles}
            profilesLoading={profilesQuery.isPending}
            profilesError={profilesQuery.error}
            hasProfilesPaginationWarning={hasProfilePaginationWarning}
            onRetryProfiles={() => {
              void profilesQuery.refetch();
            }}
            sourceGroups={activeFacebookSourceGroups}
            sourceGroupsLoading={sourceGroupsQuery.isPending}
            sourceGroupsError={sourceGroupsQuery.error}
            hasSourceGroupsPaginationWarning={hasSourceGroupsPaginationWarning}
            onRetrySourceGroups={() => {
              void sourceGroupsQuery.refetch();
            }}
            onSuccess={refresh}
          />

          <FilterCard
            filter={filter}
            onFilterChange={setFilter}
            profiles={profiles}
            sourceGroups={sourceGroups}
            onReset={resetFilters}
          />
        </aside>
      </div>
      <ProfileSourceAccessCheckRunDetailDrawer
        checkRunId={selectedRunId}
        profileById={profileById}
        sourceGroupById={sourceGroupById}
        onClose={closeRunDetail}
      />
    </PageShell>
  );
}

function ProfileSourceAccessCheckRunsList({
  runs,
  page,
  profileById,
  sourceGroupById,
  selectedRunId,
  onCancel,
  onSelectRun,
}: {
  readonly runs: readonly ProfileSourceAccessCheckRun[];
  readonly page: { readonly total?: number | undefined };
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly sourceGroupById: ReadonlyMap<string, SourceGroup>;
  readonly selectedRunId: string | undefined;
  readonly onCancel: () => void;
  readonly onSelectRun: (
    checkRunId: string,
    opener: HTMLButtonElement,
  ) => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Access Check Runs</CardTitle>
          <CardDescription>
            {formatCount(page.total ?? runs.length, "access check run")}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <ClipboardList aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {runs.map((run) => (
            <ProfileSourceAccessCheckRunRow
              key={run.id}
              run={run}
              profileById={profileById}
              sourceGroupById={sourceGroupById}
              selected={selectedRunId === run.id}
              onCancel={onCancel}
              onSelectRun={onSelectRun}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSourceAccessCheckRunRow({
  run,
  profileById,
  sourceGroupById,
  selected,
  onCancel,
  onSelectRun,
}: {
  readonly run: ProfileSourceAccessCheckRun;
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly sourceGroupById: ReadonlyMap<string, SourceGroup>;
  readonly selected: boolean;
  readonly onCancel: () => void;
  readonly onSelectRun: (
    checkRunId: string,
    opener: HTMLButtonElement,
  ) => void;
}): JSX.Element {
  const profileDisplay = getProfileDisplay(run.profileId, profileById);
  const sourceGroupDisplay = getSourceGroupDisplay(run.sourceGroupId, sourceGroupById);
  const selectionState = getProfileSourceAccessCheckRunRowSelectionState({
    runId: run.id,
    selectedRunId: selected ? run.id : undefined,
  });

  return (
    <article className={selectionState.articleClassName}>
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
          <StatusBadge label={run.status} tone={getRunStatusTone(run.status)} />
          <Button
            aria-pressed={selected}
            size="sm"
            variant={selectionState.detailsButtonVariant}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              onSelectRun(run.id, event.currentTarget);
            }}
          >
            <Eye aria-hidden="true" className="size-4" />
            Details
          </Button>
          {canCancelProfileSourceAccessCheckRun(run.status) ? (
            <CancelRunButton checkRunId={run.id} onCancel={onCancel} />
          ) : null}
        </div>
      </div>

      <dl className="grid min-w-0 gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Profile
          </dt>
          <dd className="mt-1 min-w-0">
            <p
              className="truncate font-medium text-foreground"
              title={profileDisplay.primary}
            >
              {profileDisplay.primary}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={profileDisplay.secondary}
            >
              {profileDisplay.secondary}
            </p>
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Source Group
          </dt>
          <dd className="mt-1 min-w-0">
            <p
              className="truncate font-medium text-foreground"
              title={sourceGroupDisplay.primary}
            >
              {sourceGroupDisplay.primary}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={sourceGroupDisplay.secondary}
            >
              {sourceGroupDisplay.secondary}
            </p>
          </dd>
        </div>

        <RunDefinitionFields run={run} />
      </dl>

      <RunOutcomeSection run={run} />
      <RunFailureReason run={run} />
    </article>
  );
}

function RunDefinitionFields({
  run,
}: {
  readonly run: ProfileSourceAccessCheckRun;
}): JSX.Element {
  return (
    <>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Stage At Request
        </dt>
        <dd className="mt-1 text-muted-foreground">{run.accountStageAtRequest}</dd>
      </div>

      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Requested
        </dt>
        <dd className="mt-1 text-muted-foreground">
          {formatDateTime(run.requestedAt)}
        </dd>
      </div>

      {run.startedAt !== undefined && (
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Started
          </dt>
          <dd className="mt-1 text-muted-foreground">
            {formatDateTime(run.startedAt)}
          </dd>
        </div>
      )}

      {run.finishedAt !== undefined && (
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Finished
          </dt>
          <dd className="mt-1 text-muted-foreground">
            {formatDateTime(run.finishedAt)}
          </dd>
        </div>
      )}
    </>
  );
}

function RunOutcomeSection({
  run,
}: {
  readonly run: ProfileSourceAccessCheckRun;
}): JSX.Element | null {
  if (run.outcome === undefined) {
    return null;
  }

  const outcomeDetails = getOutcomePresentation(run.outcome);

  return (
    <div className="rounded border border-border bg-muted/25 px-3 py-2 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Outcome
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {outcomeDetails.label}
        </p>
      </div>
      <StatusBadge label={run.outcome} tone={outcomeDetails.tone} />
    </div>
  );
}

function RunFailureReason({
  run,
}: {
  readonly run: ProfileSourceAccessCheckRun;
}): JSX.Element | null {
  if (run.failureReason === undefined) {
    return null;
  }

  return (
    <div className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-[#8f3030]"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#7f1d1d]">
            {run.failureReason.code}
          </p>
          <p className="mt-0.5 text-sm text-[#7f1d1d]">
            {run.failureReason.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function CancelRunButton({
  checkRunId,
  onCancel,
}: {
  readonly checkRunId: string;
  readonly onCancel: () => void;
}): JSX.Element {
  const cancelMutation = useCancelProfileSourceAccessCheckRunMutation();

  async function cancel(): Promise<void> {
    cancelMutation.reset();

    try {
      await cancelMutation.mutateAsync({ checkRunId });
      onCancel();
    } catch {
      // Error handled by local BackendErrorPanel
    }
  }

  return (
    <div className="grid max-w-sm justify-items-end gap-2">
      <Button
        aria-label={`Cancel access check run ${checkRunId}`}
        disabled={cancelMutation.isPending}
        size="sm"
        variant="danger"
        onClick={cancel}
      >
        <Ban aria-hidden="true" className="size-4" />
        {cancelMutation.isPending ? "Canceling" : "Cancel"}
      </Button>
      <BackendErrorPanel
        error={cancelMutation.error}
        fallbackMessage="Access check run cancellation failed."
      />
    </div>
  );
}

function RequestProfileSourceAccessCheckRunCard({
  profiles,
  profilesLoading,
  profilesError,
  hasProfilesPaginationWarning,
  onRetryProfiles,
  sourceGroups,
  sourceGroupsLoading,
  sourceGroupsError,
  hasSourceGroupsPaginationWarning,
  onRetrySourceGroups,
  onSuccess,
}: {
  readonly profiles: readonly ProfileSummary[];
  readonly profilesLoading: boolean;
  readonly profilesError: unknown;
  readonly hasProfilesPaginationWarning: boolean;
  readonly onRetryProfiles: () => void;
  readonly sourceGroups: readonly SourceGroup[];
  readonly sourceGroupsLoading: boolean;
  readonly sourceGroupsError: unknown;
  readonly hasSourceGroupsPaginationWarning: boolean;
  readonly onRetrySourceGroups: () => void;
  readonly onSuccess: () => void;
}): JSX.Element {
  const requestMutation = useRequestProfileSourceAccessCheckRunMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [createdRun, setCreatedRun] = useState<{ id: string }>();

  const form = useForm<RequestProfileSourceAccessCheckRunFormValues>({
    defaultValues: {
      profileId: "",
      sourceGroupId: "",
    },
  });
  const { reset } = form;

  async function submit(values: RequestProfileSourceAccessCheckRunFormValues): Promise<void> {
    setValidationSummary(undefined);
    setCreatedRun(undefined);
    requestMutation.reset();

    const parsed = RequestProfileSourceAccessCheckRunFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ?? "Request is invalid.",
      );
      return;
    }

    try {
      const body = toRequestProfileSourceAccessCheckRunRequest(parsed.data);
      const response = await requestMutation.mutateAsync(body);

      reset({
        profileId: "",
        sourceGroupId: "",
      });
      setCreatedRun({
        id: response.profileSourceAccessCheckRun.id,
      });
      onSuccess();
    } catch {
      // Error handled by BackendErrorPanel
    }
  }

  const hasProfilesError = profilesError !== null && profilesError !== undefined;
  const hasSourceGroupsError = sourceGroupsError !== null && sourceGroupsError !== undefined;

  const isSubmitDisabled =
    profilesLoading ||
    hasProfilesError ||
    profiles.length === 0 ||
    sourceGroupsLoading ||
    hasSourceGroupsError ||
    sourceGroups.length === 0 ||
    requestMutation.isPending;

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Request Access Check</CardTitle>
          <CardDescription>
            Queue an access check run for a profile and Facebook source group.
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <RefreshCw aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 italic">
          “Successful access is one collection requirement and does not guarantee current checkout eligibility.”
        </p>

        <form
          aria-label="Request Profile-Source Access Check Run"
          className="grid gap-4"
          onSubmit={form.handleSubmit(submit)}
        >
          {profilesLoading ? (
            <p className="text-sm text-muted-foreground">Loading profiles...</p>
          ) : hasProfilesError ? (
            <div className="grid gap-2">
              <p className="text-sm text-red-600">Failed to load profiles.</p>
              <Button variant="secondary" size="sm" onClick={onRetryProfiles}>
                Retry Profiles
              </Button>
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles available.</p>
          ) : (
            <FormField
              label="Profile"
              htmlFor="profileId"
              error={form.formState.errors.profileId?.message}
            >
              <Select
                id="profileId"
                disabled={requestMutation.isPending}
                {...form.register("profileId")}
              >
                <option value="">Select profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.id})
                  </option>
                ))}
              </Select>
              {hasProfilesPaginationWarning && (
                <p className="mt-1 text-xs text-yellow-600">
                  Warning: More profiles exist than were loaded in this view.
                </p>
              )}
            </FormField>
          )}

          {sourceGroupsLoading ? (
            <p className="text-sm text-muted-foreground">Loading source groups...</p>
          ) : hasSourceGroupsError ? (
            <div className="grid gap-2">
              <p className="text-sm text-red-600">Failed to load source groups.</p>
              <Button variant="secondary" size="sm" onClick={onRetrySourceGroups}>
                Retry Source Groups
              </Button>
            </div>
          ) : sourceGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active Facebook source groups available.</p>
          ) : (
            <FormField
              label="Source Group"
              htmlFor="sourceGroupId"
              error={form.formState.errors.sourceGroupId?.message}
            >
              <Select
                id="sourceGroupId"
                disabled={requestMutation.isPending}
                {...form.register("sourceGroupId")}
              >
                <option value="">Select source group...</option>
                {sourceGroups.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.name} ({sg.id})
                  </option>
                ))}
              </Select>
              {hasSourceGroupsPaginationWarning && (
                <p className="mt-1 text-xs text-yellow-600">
                  Warning: More source groups exist than were loaded in this view.
                </p>
              )}
            </FormField>
          )}

          {validationSummary !== undefined && (
            <ValidationSummary message={validationSummary} />
          )}

          {createdRun !== undefined && (
            <SuccessPanel
              message={`Successfully queued Access Check Run: ${createdRun.id}`}
            />
          )}

          <BackendErrorPanel
            error={requestMutation.error}
            fallbackMessage="Request to check access failed."
          />

          <Button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full justify-center"
          >
            {requestMutation.isPending ? "Queueing..." : "Queue Access Check"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FilterCard({
  filter,
  onFilterChange,
  profiles,
  sourceGroups,
  onReset,
}: {
  readonly filter: ListProfileSourceAccessCheckRunsFilter;
  readonly onFilterChange: (filter: ListProfileSourceAccessCheckRunsFilter) => void;
  readonly profiles: readonly ProfileSummary[];
  readonly sourceGroups: readonly SourceGroup[];
  readonly onReset: () => void;
}): JSX.Element {
  const activeStatuses = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>
          Filter access check runs by status, profile, or source group.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField label="Status" htmlFor="filter-status">
          <Select
            id="filter-status"
            value={filter.status}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                status: e.target.value as ProfileSourceAccessCheckRunStatus | "",
              })
            }
          >
            <option value="">All Statuses</option>
            {activeStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Profile" htmlFor="filter-profileId">
          <Select
            id="filter-profileId"
            value={filter.profileId}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                profileId: e.target.value,
              })
            }
          >
            <option value="">All Profiles</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Source Group" htmlFor="filter-sourceGroupId">
          <Select
            id="filter-sourceGroupId"
            value={filter.sourceGroupId}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                sourceGroupId: e.target.value,
              })
            }
          >
            <option value="">All Source Groups</option>
            {sourceGroups.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.name}
              </option>
            ))}
          </Select>
        </FormField>

        <Button variant="secondary" onClick={onReset} className="w-full justify-center">
          Reset Filters
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileSourceAccessCheckRunDetailDrawer({
  checkRunId,
  profileById,
  sourceGroupById,
  onClose,
}: {
  readonly checkRunId: string | undefined;
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly sourceGroupById: ReadonlyMap<string, SourceGroup>;
  readonly onClose: (source: ProfileSourceAccessCheckRunDetailCloseSource) => void;
}): JSX.Element {
  const detailQuery = useProfileSourceAccessCheckRunQuery(checkRunId);
  const run = detailQuery.data?.profileSourceAccessCheckRun;

  const contentState = getProfileSourceAccessCheckRunDetailContentState({
    checkRunId,
    isPending: detailQuery.isPending,
    isError: detailQuery.isError,
    isSuccess: detailQuery.isSuccess,
  });

  return (
    <Drawer
      open={checkRunId !== undefined}
      title="Access Check Run Details"
      description={checkRunId !== undefined ? `Inspect run ID ${checkRunId}` : undefined}
      onClose={onClose}
    >
      {contentState.showLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading check run details...
        </p>
      )}

      {contentState.showError && (
        <div className="grid gap-3">
          <p className="text-sm text-red-600">
            Failed to load access check details.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {contentState.showContent && run !== undefined && (
        <DetailDrawerContent
          run={run}
          profileById={profileById}
          sourceGroupById={sourceGroupById}
        />
      )}
    </Drawer>
  );
}

function DetailDrawerContent({
  run,
  profileById,
  sourceGroupById,
}: {
  readonly run: ProfileSourceAccessCheckRun;
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly sourceGroupById: ReadonlyMap<string, SourceGroup>;
}): JSX.Element {
  const profileDisplay = getProfileDisplay(run.profileId, profileById);
  const sourceGroupDisplay = getSourceGroupDisplay(run.sourceGroupId, sourceGroupById);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={run.status} tone={getRunStatusTone(run.status)} />
        <StatusBadge label={run.triggerType} tone="info" />
      </div>

      <dl className="grid gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Profile
          </dt>
          <dd className="mt-1 min-w-0">
            <p className="truncate font-medium text-foreground">
              {profileDisplay.primary}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {profileDisplay.secondary}
            </p>
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Source Group
          </dt>
          <dd className="mt-1 min-w-0">
            <p className="truncate font-medium text-foreground">
              {sourceGroupDisplay.primary}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {sourceGroupDisplay.secondary}
            </p>
          </dd>
        </div>

        <RunDefinitionFields run={run} />
      </dl>

      <div className="rounded border border-border bg-muted/20 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
          Frozen Target
        </p>
        <dl className="grid gap-2 text-xs">
          <div>
            <dt className="font-semibold text-muted-foreground inline">Platform: </dt>
            <dd className="inline font-mono">{run.target.platform}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground inline">Route Type: </dt>
            <dd className="inline font-mono">{run.target.routeType}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground inline">URL: </dt>
            <dd className="inline font-mono break-all">{run.target.url}</dd>
          </div>
        </dl>
      </div>

      <RunOutcomeSection run={run} />
      <RunFailureReason run={run} />
    </div>
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
          ? `Showing ${visibleRange.start}-${visibleRange.end}${total !== undefined ? ` of ${total}` : ""}`
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
        <CardTitle>Loading Access Check Runs</CardTitle>
        <CardDescription>
          Reading access check runs from Collector Runtime.
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
        <CardTitle>Access Check Runs Could Not Load</CardTitle>
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
          <CardTitle>No Access Check Runs</CardTitle>
          <CardDescription>
            No access check runs match the current filters.
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
      className="rounded border border-[#8ac6a7] bg-[#f1fbf5] px-4 py-3 text-sm text-[#23563b]"
      role="status"
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}

function getRunStatusTone(status: ProfileSourceAccessCheckRunStatus): StatusBadgeTone {
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
  }
}

function formatCount(count: number, singularLabel: string): string {
  return count === 1 ? `1 ${singularLabel}` : `${count} ${singularLabel}s`;
}

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The access check run request failed.";
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
