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
} from "lucide-react";
import {
  useAccountExerciseRunQuery,
  useAccountExerciseRunsQuery,
} from "@/features/collector-runtime/account-exercise-run-queries";
import {
  useCancelAccountExerciseRunMutation,
  useRequestAccountExerciseRunMutation,
} from "@/features/collector-runtime/account-exercise-run-mutations";
import {
  RequestAccountExerciseRunFormSchema,
  canCancelAccountExerciseRun,
  getPaginationModel,
  getProfileDisplay,
  hasActiveAccountExerciseRuns,
  shouldShowPaginationControls,
  toRequestAccountExerciseRunRequest,
  deriveEligibleCategoryBrowseRoutes,
  getSourceGroupAvailabilityHint,
  getSourceGroupDisplayName,
  deriveRequestPreviewModel,
  isRequestSubmitDisabled,
  handleExerciseTypeChange,
  handleSourceGroupChange,
  type RequestAccountExerciseRunFormValues,
} from "@/features/collector-runtime/account-exercise-run-view-model";
import {
  getAccountExerciseRunDetailContentState,
  getAccountExerciseRunRowSelectionState,
  getNextAccountExerciseRunDetailDrawerState,
  shouldRestoreAccountExerciseRunDetailFocus,
  type AccountExerciseRunDetailCloseSource,
} from "@/features/collector-runtime/account-exercise-run-detail-drawer-state";
import { useProfilesQuery } from "@/features/profiles/profile-queries";
import {
  useContentCategoriesQuery,
  useSourceGroupsQuery,
} from "@/features/content-manager/content-manager-queries";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import { isApiResultError } from "@/lib/api/http-client";
import {
  type AccountExerciseRun,
  AccountExerciseRunStatusSchema,
  type AccountExerciseRunStatus,
  DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { type ProfileSummary } from "@/lib/api/profile-manager-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { PageShell } from "@/pages/page-shell";

const accountExerciseRunStatuses = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

interface ListAccountExerciseRunsFilter {
  status: AccountExerciseRunStatus | "";
  profileId: string;
}

const POLL_INTERVAL_MS = 5_000;

export function AccountExerciseRunsPage(): JSX.Element {
  const [filter, setFilter] = useState<ListAccountExerciseRunsFilter>({
    status: "",
    profileId: "",
  });
  const [offset, setOffset] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const selectedRunDetailsButtonRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreRunDetailsFocusRef = useRef(false);

  useEffect(() => {
    setOffset(0);
  }, [filter.status, filter.profileId]);

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
    limit: DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
    offset,
  };

  const runsQuery = useAccountExerciseRunsQuery(query, {
    refetchInterval: false,
  });
  const runs = runsQuery.data?.items ?? [];
  const hasActiveRuns = useMemo(
    () => hasActiveAccountExerciseRuns(runs),
    [runs],
  );

  const pollQuery = useAccountExerciseRunsQuery(query, {
    refetchInterval: hasActiveRuns ? POLL_INTERVAL_MS : false,
  });
  const effectiveQuery = hasActiveRuns ? pollQuery : runsQuery;

  const profilesQuery = useProfilesQuery();
  const profiles = profilesQuery.data?.items ?? [];
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const hasProfilePaginationWarning = useMemo(() => {
    const profileData = profilesQuery.data;
    if (!profileData) {
      return false;
    }
    const total = profileData.page.total;
    return total !== undefined && total > profileData.items.length;
  }, [profilesQuery.data]);

  function refresh(): void {
    void runsQuery.refetch();
    if (hasActiveRuns) {
      void pollQuery.refetch();
    }
  }

  function resetFilters(): void {
    setFilter({ status: "", profileId: "" });
    setOffset(0);
  }

  function selectRunDetail(
    accountExerciseRunId: string,
    opener: HTMLButtonElement,
  ): void {
    selectedRunDetailsButtonRef.current = opener;
    setSelectedRunId(
      getNextAccountExerciseRunDetailDrawerState(
        { selectedRunId },
        { type: "select", accountExerciseRunId },
      ).selectedRunId,
    );
  }

  function closeRunDetail(source: AccountExerciseRunDetailCloseSource): void {
    const nextState = getNextAccountExerciseRunDetailDrawerState(
      { selectedRunId },
      { type: "close", source },
    );
    const shouldRestoreFocus = shouldRestoreAccountExerciseRunDetailFocus({
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
      title="Account Exercise Runs"
      description="Request, monitor, inspect, and cancel queued account exercise runs."
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
            <AccountExerciseRunsList
              runs={effectiveQuery.data.items}
              page={effectiveQuery.data.page}
              profileById={profileById}
              selectedRunId={selectedRunId}
              onCancel={refresh}
              onSelectRun={selectRunDetail}
            />
          ) : null}
          {effectiveQuery.isSuccess &&
          shouldShowPaginationControls({
            offset,
            limit: DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
            itemCount: effectiveQuery.data.items.length,
            total: effectiveQuery.data.page.total,
          }) ? (
            <PaginationControls
              offset={offset}
              limit={DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT}
              itemCount={effectiveQuery.data.items.length}
              total={effectiveQuery.data.page.total}
              onPrev={() =>
                setOffset((currentOffset) =>
                  Math.max(
                    0,
                    currentOffset - DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
                  ),
                )
              }
              onNext={() =>
                setOffset(
                  (currentOffset) =>
                    currentOffset + DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
                )
              }
            />
          ) : null}
        </div>

        <aside className="grid min-w-0 gap-5 content-start">
          <RequestAccountExerciseRunCard
            profiles={profiles}
            profilesLoading={profilesQuery.isPending}
            profilesError={profilesQuery.error}
            hasPaginationWarning={hasProfilePaginationWarning}
            onRetryProfiles={() => {
              void profilesQuery.refetch();
            }}
            onSuccess={refresh}
          />

          <FilterCard
            filter={filter}
            onFilterChange={setFilter}
            onReset={resetFilters}
          />
        </aside>
      </div>
      <AccountExerciseRunDetailDrawer
        accountExerciseRunId={selectedRunId}
        profileById={profileById}
        onClose={closeRunDetail}
      />
    </PageShell>
  );
}

function AccountExerciseRunsList({
  runs,
  page,
  profileById,
  selectedRunId,
  onCancel,
  onSelectRun,
}: {
  readonly runs: readonly AccountExerciseRun[];
  readonly page: { readonly total?: number | undefined };
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly selectedRunId: string | undefined;
  readonly onCancel: () => void;
  readonly onSelectRun: (
    accountExerciseRunId: string,
    opener: HTMLButtonElement,
  ) => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Account Exercise Runs</CardTitle>
          <CardDescription>
            {formatCount(page.total ?? runs.length, "account exercise run")}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Activity aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {runs.map((run) => (
            <AccountExerciseRunRow
              key={run.id}
              run={run}
              profileById={profileById}
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

function AccountExerciseRunRow({
  run,
  profileById,
  selected,
  onCancel,
  onSelectRun,
}: {
  readonly run: AccountExerciseRun;
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly selected: boolean;
  readonly onCancel: () => void;
  readonly onSelectRun: (
    accountExerciseRunId: string,
    opener: HTMLButtonElement,
  ) => void;
}): JSX.Element {
  const profileDisplay = getProfileDisplay(run.profileId, profileById);
  const selectionState = getAccountExerciseRunRowSelectionState({
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
          {canCancelAccountExerciseRun(run.status) ? (
            <CancelRunButton accountExerciseRunId={run.id} onCancel={onCancel} />
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

        <RunDefinitionFields run={run} />
      </dl>

      <RunSafeSummary run={run} />
      <RunFailureReason run={run} />
    </article>
  );
}

function RunDefinitionFields({
  run,
}: {
  readonly run: AccountExerciseRun;
}): JSX.Element {
  return (
    <>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Exercise
        </dt>
        <dd className="mt-1 text-muted-foreground">{run.exerciseType}</dd>
      </div>

      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Stage At Start
        </dt>
        <dd className="mt-1 text-muted-foreground">{run.stageAtStart}</dd>
      </div>

      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Requested
        </dt>
        <dd className="mt-1 text-muted-foreground">
          {formatDateTime(run.requestedAt)}
        </dd>
      </div>

      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Max Duration
        </dt>
        <dd className="mt-1 text-muted-foreground">
          {formatDuration(run.actionBudget.maxDurationMs)}
        </dd>
      </div>

      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Max Scrolls
        </dt>
        <dd className="mt-1 text-muted-foreground">
          {run.actionBudget.maxScrolls}
        </dd>
      </div>

      {run.actionBudget.minDwellMs !== undefined && (
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Min Dwell
          </dt>
          <dd className="mt-1 text-muted-foreground">
            {formatDuration(run.actionBudget.minDwellMs)}
          </dd>
        </div>
      )}

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

function RunSafeSummary({
  run,
}: {
  readonly run: AccountExerciseRun;
}): JSX.Element | null {
  if (run.safeSummary === undefined) {
    return null;
  }

  return (
    <div className="rounded border border-border bg-muted/25 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Safe Summary
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="sr-only">Page Loaded</dt>
          <dd>{run.safeSummary.pageLoaded ? "Page loaded" : "Page not loaded"}</dd>
        </div>
        <div>
          <dt className="sr-only">Login Required</dt>
          <dd>
            {run.safeSummary.loginRequired
              ? "Login required"
              : "Login not required"}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Checkpoint Detected</dt>
          <dd>
            {run.safeSummary.checkpointDetected
              ? "Checkpoint detected"
              : "No checkpoint detected"}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Scrolls Performed</dt>
          <dd>{run.safeSummary.scrollsPerformed} scrolls</dd>
        </div>
        <div>
          <dt className="sr-only">Duration</dt>
          <dd>{formatDuration(run.safeSummary.durationMs)}</dd>
        </div>
        <div>
          <dt className="sr-only">Lease Released</dt>
          <dd>{run.safeSummary.leaseReleased ? "Released" : "Not released"}</dd>
        </div>
      </dl>
    </div>
  );
}

function RunFailureReason({
  run,
}: {
  readonly run: AccountExerciseRun;
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
  accountExerciseRunId,
  onCancel,
}: {
  readonly accountExerciseRunId: string;
  readonly onCancel: () => void;
}): JSX.Element {
  const cancelMutation = useCancelAccountExerciseRunMutation();

  async function cancel(): Promise<void> {
    cancelMutation.reset();

    try {
      await cancelMutation.mutateAsync({ accountExerciseRunId });
      onCancel();
    } catch {
      // Error handled by the local BackendErrorPanel below.
    }
  }

  return (
    <div className="grid max-w-sm justify-items-end gap-2">
      <Button
        aria-label={`Cancel account exercise run ${accountExerciseRunId}`}
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
        fallbackMessage="Account exercise run cancellation failed."
      />
    </div>
  );
}

function RequestAccountExerciseRunCard({
  profiles,
  profilesLoading,
  profilesError,
  hasPaginationWarning,
  onRetryProfiles,
  onSuccess,
}: {
  readonly profiles: readonly ProfileSummary[];
  readonly profilesLoading: boolean;
  readonly profilesError: unknown;
  readonly hasPaginationWarning: boolean;
  readonly onRetryProfiles: () => void;
  readonly onSuccess: () => void;
}): JSX.Element {
  const requestMutation = useRequestAccountExerciseRunMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [createdRun, setCreatedRun] = useState<{ id: string; exerciseType: string }>();
  const hasProfilesError = profilesError !== null && profilesError !== undefined;
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const sourceGroupsQuery = useSourceGroupsQuery({
    status: "ACTIVE",
    limit: 100,
    offset: 0,
  });
  const categoriesQuery = useContentCategoriesQuery();

  const sourceGroups = sourceGroupsQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const form = useForm<RequestAccountExerciseRunFormValues>({
    defaultValues: {
      profileId: "",
      exerciseType: "AMBIENT_ACCOUNT",
      sourceGroupId: "",
      entryRouteId: "",
      maxDurationMs: "",
      maxScrolls: "",
      minDwellMs: "",
    },
  });
  const { reset } = form;

  const exerciseType = form.watch("exerciseType");
  const sourceGroupId = form.watch("sourceGroupId");
  const profileIdWatch = form.watch("profileId");
  const entryRouteIdWatch = form.watch("entryRouteId");

  const previousExerciseTypeRef = useRef(exerciseType);
  useEffect(() => {
    if (exerciseType !== previousExerciseTypeRef.current) {
      handleExerciseTypeChange(
        (exerciseType ?? "AMBIENT_ACCOUNT") as "AMBIENT_ACCOUNT" | "CATEGORY_BROWSE",
        form.setValue,
        form.clearErrors,
      );
      previousExerciseTypeRef.current = exerciseType;
    }
  }, [exerciseType, form]);

  const previousSourceGroupIdRef = useRef(sourceGroupId);
  useEffect(() => {
    if (sourceGroupId !== previousSourceGroupIdRef.current) {
      handleSourceGroupChange(form.setValue);
      previousSourceGroupIdRef.current = sourceGroupId;
    }
  }, [sourceGroupId, form]);

  const selectedSourceGroup = useMemo(() => {
    return sourceGroups.find((sg) => sg.id === sourceGroupId);
  }, [sourceGroups, sourceGroupId]);

  const eligibleRoutes = useMemo(() => {
    if (!selectedSourceGroup) {
      return [];
    }
    return deriveEligibleCategoryBrowseRoutes(selectedSourceGroup.entryRoutes);
  }, [selectedSourceGroup]);

  const preview = useMemo(() => {
    return deriveRequestPreviewModel({
      profileId: profileIdWatch,
      sourceGroupId: sourceGroupId ?? "",
      entryRouteId: entryRouteIdWatch,
      profileById,
      sourceGroups,
      categoriesById: categoryById,
    });
  }, [profileIdWatch, sourceGroupId, entryRouteIdWatch, profileById, sourceGroups, categoryById]);

  const hasSourceGroupsPaginationWarning = useMemo(() => {
    const sourceGroupsData = sourceGroupsQuery.data;
    if (!sourceGroupsData) {
      return false;
    }
    const total = sourceGroupsData.page.total;
    return total !== undefined && total > sourceGroupsData.items.length;
  }, [sourceGroupsQuery.data]);

  async function submit(values: RequestAccountExerciseRunFormValues): Promise<void> {
    setValidationSummary(undefined);
    setCreatedRun(undefined);
    requestMutation.reset();

    const parsed = RequestAccountExerciseRunFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Request is invalid.",
      );
      return;
    }

    const profile = profileById.get(parsed.data.profileId);

    if (profile === undefined) {
      setValidationSummary("Select a profile from the loaded safe profile list.");
      return;
    }

    try {
      const body = toRequestAccountExerciseRunRequest(parsed.data, profile);
      const response = await requestMutation.mutateAsync(body);

      reset({
        profileId: "",
        exerciseType: "AMBIENT_ACCOUNT",
        sourceGroupId: "",
        entryRouteId: "",
        maxDurationMs: "",
        maxScrolls: "",
        minDwellMs: "",
      });
      setCreatedRun({
        id: response.accountExerciseRun.id,
        exerciseType: response.accountExerciseRun.exerciseType,
      });
      onSuccess();
    } catch {
      return;
    }
  }

  const isSubmitDisabled = isRequestSubmitDisabled({
    exerciseType: (exerciseType ?? "AMBIENT_ACCOUNT") as "AMBIENT_ACCOUNT" | "CATEGORY_BROWSE",
    profilesLoading,
    hasProfilesError,
    hasProfiles: profiles.length > 0,
    requestPending: requestMutation.isPending,
    sourceGroupsPending: sourceGroupsQuery.isPending,
    sourceGroupsError: sourceGroupsQuery.isError,
    hasSourceGroups: sourceGroups.length > 0,
  });

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Request Exercise Run</CardTitle>
          <CardDescription>
            Queue an Ambient Account Exercise or Category Browse run for one profile.
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <ArrowUpRight aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          {validationSummary !== undefined ? (
            <ValidationSummary message={validationSummary} />
          ) : null}

          <BackendErrorPanel
            error={requestMutation.error}
            fallbackMessage="Account exercise run request failed."
          />

          <BackendErrorPanel
            error={profilesError}
            fallbackMessage="Profiles could not load. Existing runs remain visible by profile ID."
          />

          {hasProfilesError ? (
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={onRetryProfiles}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Retry Profiles
              </Button>
            </div>
          ) : null}

          {createdRun !== undefined ? (
            <SuccessPanel
              message={`Account exercise run ${createdRun.id} (${createdRun.exerciseType}) was queued.`}
            />
          ) : null}

          {hasPaginationWarning ? (
            <div className="rounded border border-[#dfc36e] bg-[#fff7dc] px-3 py-2 text-xs font-medium text-[#76591a]">
              Some profiles may not appear in the selector because the list is paginated.
            </div>
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.exerciseType)}
            htmlFor="exercise-type"
            label="Exercise Type"
          >
            <Select
              id="exercise-type"
              {...form.register("exerciseType")}
            >
              <option value="AMBIENT_ACCOUNT">Ambient Account</option>
              <option value="CATEGORY_BROWSE">Category Browse</option>
            </Select>
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.profileId)}
            htmlFor="exercise-profile"
            label="Profile"
          >
            <Select
              id="exercise-profile"
              disabled={profilesLoading || hasProfilesError}
              {...form.register("profileId")}
            >
              <option value="">Select profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} ({profile.accountStage})
                </option>
              ))}
            </Select>
          </FormField>

          {exerciseType === "CATEGORY_BROWSE" && (
            <div className="grid gap-4">
              {sourceGroupsQuery.isPending && (
                <div className="text-sm text-muted-foreground animate-pulse py-2">
                  Loading active source groups...
                </div>
              )}

              {sourceGroupsQuery.isError && (
                <div className="grid gap-2 rounded border border-[#e4a0a0] bg-[#fff5f5] p-3 text-sm text-[#8f3030]">
                  <p>Failed to load active source groups.</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => void sourceGroupsQuery.refetch()}
                  >
                    <RefreshCw aria-hidden="true" className="mr-2 size-4" />
                    Retry Source Groups
                  </Button>
                </div>
              )}

              {sourceGroupsQuery.isSuccess && sourceGroups.length === 0 && (
                <div className="rounded border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  No active source groups found.
                </div>
              )}

              {sourceGroupsQuery.isSuccess && sourceGroups.length > 0 && (
                <>
                  {hasSourceGroupsPaginationWarning && (
                    <div className="rounded border border-[#dfc36e] bg-[#fff7dc] px-3 py-2 text-xs font-medium text-[#76591a]">
                      Some active source groups may not appear in the selector because the list is paginated.
                    </div>
                  )}

                  <FormField
                    error={getErrorMessage(form.formState.errors.sourceGroupId)}
                    htmlFor="exercise-source-group"
                    label="Source Group"
                  >
                    <Select
                      id="exercise-source-group"
                      {...form.register("sourceGroupId")}
                    >
                      <option value="">Select source group</option>
                      {sourceGroups.map((sg) => {
                        const displayName = getSourceGroupDisplayName(sg, categoryById);
                        const hint = getSourceGroupAvailabilityHint(sg.entryRoutes);

                        return (
                          <option key={sg.id} value={sg.id}>
                            {displayName} ({hint})
                          </option>
                        );
                      })}
                    </Select>
                  </FormField>

                  <FormField
                    error={getErrorMessage(form.formState.errors.entryRouteId)}
                    htmlFor="exercise-entry-route"
                    label="Entry Route"
                  >
                    <Select
                      id="exercise-entry-route"
                      {...form.register("entryRouteId")}
                    >
                      <option value="">Auto-select safest eligible route</option>
                      {eligibleRoutes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.label || route.id} ({route.riskLevel})
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <div className="rounded border border-border bg-muted/40 p-3 text-xs">
                    <p className="font-semibold text-muted-foreground mb-2">
                      Request Preview
                    </p>
                    <dl className="grid gap-1 font-mono text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Type: </span>
                        <span>CATEGORY_BROWSE</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Profile: </span>
                        <span>{preview.profileName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Group: </span>
                        <span>{preview.sourceGroupName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Category: </span>
                        <span>{preview.categoryName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Route: </span>
                        <span>{preview.routeName}</span>
                      </div>
                    </dl>
                    <p className="mt-3 text-muted-foreground text-[10px] leading-relaxed">
                      The server validates and freezes the final managed route when the run is queued.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(form.formState.errors.maxDurationMs)}
              htmlFor="exercise-max-duration"
              label="Max Duration (ms)"
            >
              <Input
                id="exercise-max-duration"
                autoComplete="off"
                inputMode="numeric"
                min={1}
                placeholder="120000"
                type="number"
                {...form.register("maxDurationMs")}
              />
            </FormField>

            <FormField
              error={getErrorMessage(form.formState.errors.maxScrolls)}
              htmlFor="exercise-max-scrolls"
              label="Max Scrolls"
            >
              <Input
                id="exercise-max-scrolls"
                autoComplete="off"
                inputMode="numeric"
                min={0}
                placeholder="2"
                type="number"
                {...form.register("maxScrolls")}
              />
            </FormField>
          </div>

          <FormField
            error={getErrorMessage(form.formState.errors.minDwellMs)}
            htmlFor="exercise-min-dwell"
            label="Min Dwell (ms)"
          >
            <Input
              id="exercise-min-dwell"
              autoComplete="off"
              inputMode="numeric"
              min={0}
              placeholder="Optional"
              type="number"
              {...form.register("minDwellMs")}
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={isSubmitDisabled}
              type="submit"
            >
              <ArrowUpRight aria-hidden="true" className="size-4" />
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
  onReset,
}: {
  readonly filter: ListAccountExerciseRunsFilter;
  readonly onFilterChange: (filter: ListAccountExerciseRunsFilter) => void;
  readonly onReset: () => void;
}): JSX.Element {
  const hasActiveFilters =
    filter.status !== "" || filter.profileId.trim() !== "";

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow the account exercise run list.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField htmlFor="exercise-filter-status" label="Status">
          <Select
            id="exercise-filter-status"
            value={filter.status}
            onChange={(event) => {
              const nextStatus =
                event.target.value === ""
                  ? ""
                  : AccountExerciseRunStatusSchema.parse(event.target.value);
              onFilterChange({
                ...filter,
                status: nextStatus,
              });
            }}
          >
            <option value="">All statuses</option>
            {accountExerciseRunStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField htmlFor="exercise-filter-profile" label="Profile ID">
          <Input
            id="exercise-filter-profile"
            autoComplete="off"
            placeholder="Filter by profileId"
            value={filter.profileId}
            onChange={(event) => {
              onFilterChange({
                ...filter,
                profileId: event.target.value,
              });
            }}
          />
        </FormField>

        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onReset();
            }}
          >
            <X aria-hidden="true" className="size-4" />
            Clear Filters
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountExerciseRunDetailDrawer({
  accountExerciseRunId,
  profileById,
  onClose,
}: {
  readonly accountExerciseRunId: string | undefined;
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
  readonly onClose: (source: AccountExerciseRunDetailCloseSource) => void;
}): JSX.Element {
  const detailQuery = useAccountExerciseRunQuery(accountExerciseRunId);
  const contentState = getAccountExerciseRunDetailContentState({
    accountExerciseRunId,
    isPending: detailQuery.isPending,
    isError: detailQuery.isError,
    isSuccess: detailQuery.isSuccess,
  });

  return (
    <Drawer
      open={accountExerciseRunId !== undefined}
      title="Run Detail"
      description={accountExerciseRunId}
      closeLabel="Close run detail drawer"
      onClose={onClose}
    >
      <div className="grid gap-4">
        {contentState.showLoading ? (
          <div className="min-h-24 animate-pulse rounded border border-border bg-muted" />
        ) : null}
        {contentState.showError ? (
          <div className="grid gap-3">
            <p className="text-sm text-[#7f1d1d]">
              {formatApiError(detailQuery.error)}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void detailQuery.refetch();
              }}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Retry
            </Button>
          </div>
        ) : null}
        {contentState.showContent && detailQuery.isSuccess ? (
          <RunDetailContent
            run={detailQuery.data.accountExerciseRun}
            profileById={profileById}
          />
        ) : null}
      </div>
    </Drawer>
  );
}

function RunDetailContent({
  run,
  profileById,
}: {
  readonly run: AccountExerciseRun;
  readonly profileById: ReadonlyMap<string, ProfileSummary>;
}): JSX.Element {
  const profileDisplay = getProfileDisplay(run.profileId, profileById);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={run.status} tone={getRunStatusTone(run.status)} />
        <StatusBadge label={run.exerciseType} tone="info" />
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
        <RunDefinitionFields run={run} />
      </dl>

      {run.target !== undefined && (
        <div className="rounded border border-border bg-muted/20 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Category Browse Target
          </p>
          <dl className="grid gap-2 text-xs">
            <div>
              <dt className="font-semibold text-muted-foreground inline">Category ID: </dt>
              <dd className="inline font-mono">{run.target.categoryId}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground inline">Source Group ID: </dt>
              <dd className="inline font-mono">{run.target.sourceGroupId}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground inline">Entry Route ID: </dt>
              <dd className="inline font-mono">{run.target.entryRouteId}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground inline">Entry Route Type: </dt>
              <dd className="inline font-mono">{run.target.entryRouteType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground inline">URL: </dt>
              <dd className="inline font-mono break-all">{run.target.url}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground inline">Risk Level: </dt>
              <dd className="inline font-medium text-foreground ml-1">{run.target.riskLevel}</dd>
            </div>
          </dl>
        </div>
      )}

      <RunSafeSummary run={run} />
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
        <CardTitle>Loading Account Exercise Runs</CardTitle>
        <CardDescription>
          Reading account exercise runs from Collector Runtime.
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
        <CardTitle>Account Exercise Runs Could Not Load</CardTitle>
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
          <CardTitle>No Account Exercise Runs</CardTitle>
          <CardDescription>
            No account exercise runs match the current filters.
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

function getRunStatusTone(status: AccountExerciseRunStatus): StatusBadgeTone {
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

  return "The account exercise run request failed.";
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  return `${seconds}s`;
}
