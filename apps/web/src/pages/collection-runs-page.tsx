import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ArrowUpRight,
  Ban,
  ClipboardList,
  Play,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { z } from "zod";
import {
  useCollectionRunsQuery,
  collectionRunQueryKeys,
} from "@/features/collector-runtime/collection-run-queries";
import {
  useRequestCollectionRunMutation,
  useCancelCollectionRunMutation,
} from "@/features/collector-runtime/collection-run-mutations";
import { useSourceGroupsQuery } from "@/features/content-manager/content-manager-queries";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import { isApiResultError } from "@/lib/api/http-client";
import {
  type CollectionRun,
  type CollectionRunStatus,
  DEFAULT_COLLECTION_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import {
  type SourceGroup,
} from "@/lib/api/content-manager-client";
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

const collectionRunStatuses = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

const RequestCollectionRunFormSchema = z
  .object({
    sourceGroupId: z.string().trim().min(1, "Source group is required."),
    maxScrolls: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? undefined : Number(v)))
      .pipe(z.number().int().min(0).optional()),
    maxDurationMs: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? undefined : Number(v)))
      .pipe(z.number().int().min(1).optional()),
  })
  .strict();

type RequestCollectionRunFormValues = z.infer<
  typeof RequestCollectionRunFormSchema
>;

interface ListCollectionRunsFilter {
  status: CollectionRunStatus | "";
  sourceGroupId: string;
}

const POLL_INTERVAL_MS = 5_000;

export function CollectionRunsPage(): JSX.Element {
  const [filter, setFilter] = useState<ListCollectionRunsFilter>({
    status: "",
    sourceGroupId: "",
  });
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [filter.status, filter.sourceGroupId]);

  const query = {
    ...(filter.status !== "" ? { status: filter.status } : {}),
    ...(filter.sourceGroupId !== ""
      ? { sourceGroupId: filter.sourceGroupId }
      : {}),
    limit: DEFAULT_COLLECTION_RUN_LIST_LIMIT,
    offset,
  };

  const runsQuery = useCollectionRunsQuery(query, {
    refetchInterval: false,
  });
  const runs = runsQuery.data?.items ?? [];
  const page = runsQuery.data?.page;
  const total = page?.total;

  const hasActiveRuns = useMemo(
    () => runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING"),
    [runs],
  );

  const pollQuery = useCollectionRunsQuery(query, {
    refetchInterval: hasActiveRuns ? POLL_INTERVAL_MS : false,
  });

  const effectiveQuery = hasActiveRuns ? pollQuery : runsQuery;

  const sourceGroupsQuery = useSourceGroupsQuery();
  const sourceGroups = sourceGroupsQuery.data?.items ?? [];
  const sourceGroupById = useMemo(
    () => new Map(sourceGroups.map((sg) => [sg.id, sg])),
    [sourceGroups],
  );

  const hasPaginationWarning = useMemo(() => {
    const sgData = sourceGroupsQuery.data;
    if (!sgData) {
      return false;
    }
    const sgTotal = sgData.page.total;
    return sgTotal !== undefined && sgTotal > sgData.items.length;
  }, [sourceGroupsQuery.data]);

  function refresh(): void {
    void runsQuery.refetch();
    if (hasActiveRuns) {
      void pollQuery.refetch();
    }
  }

  function resetFilters(): void {
    setFilter({ status: "", sourceGroupId: "" });
    setOffset(0);
  }

  return (
    <PageShell
      eyebrow="Collector Runtime"
      title="Collection Runs"
      description="Request, monitor, and cancel manual collection runs."
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          {effectiveQuery.isPending ? <RunsLoadingState /> : null}
          {effectiveQuery.isError ? (
            <RunsErrorState
              error={effectiveQuery.error}
              onRetry={refresh}
            />
          ) : null}
          {effectiveQuery.isSuccess && effectiveQuery.data.items.length === 0 ? (
            <RunsEmptyState />
          ) : null}
          {effectiveQuery.isSuccess && effectiveQuery.data.items.length > 0 ? (
            <>
              <CollectionRunsList
                runs={effectiveQuery.data.items}
                page={effectiveQuery.data.page}
                sourceGroupById={sourceGroupById}
                onCancel={refresh}
              />
              <PaginationControls
                offset={offset}
                limit={DEFAULT_COLLECTION_RUN_LIST_LIMIT}
                total={total}
                onPrev={() => setOffset((o) => Math.max(0, o - DEFAULT_COLLECTION_RUN_LIST_LIMIT))}
                onNext={() => setOffset((o) => o + DEFAULT_COLLECTION_RUN_LIST_LIMIT)}
              />
            </>
          ) : null}
        </div>

        <aside className="grid min-w-0 gap-5 content-start">
          <RequestCollectionRunCard
            sourceGroups={sourceGroups}
            sourceGroupsLoading={sourceGroupsQuery.isPending}
            hasPaginationWarning={hasPaginationWarning}
          />

          <FilterCard
            filter={filter}
            onFilterChange={setFilter}
            sourceGroups={sourceGroups}
            onReset={resetFilters}
          />
        </aside>
      </div>
    </PageShell>
  );
}

function CollectionRunsList({
  runs,
  page,
  sourceGroupById,
  onCancel,
}: {
  readonly runs: readonly CollectionRun[];
  readonly page: { readonly total?: number | undefined };
  readonly sourceGroupById: ReadonlyMap<string, SourceGroup>;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Collection Runs</CardTitle>
          <CardDescription>
            {formatCount(page.total ?? runs.length, "collection run")}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <ClipboardList aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {runs.map((run) => {
            const sourceGroup = sourceGroupById.get(run.sourceGroupId);

            return (
              <article
                key={run.id}
                className="grid min-w-0 gap-3 px-4 py-4"
              >
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
                    <StatusBadge
                      label={run.status}
                      tone={getRunStatusTone(run.status)}
                    />
                    {run.status === "QUEUED" ? (
                      <CancelRunButton
                        collectionRunId={run.id}
                        onCancel={onCancel}
                      />
                    ) : null}
                  </div>
                </div>

                <dl className="grid min-w-0 gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Source Group
                    </dt>
                    <dd className="mt-1 min-w-0">
                      {sourceGroup ? (
                        <p
                          className="truncate font-medium text-foreground"
                          title={sourceGroup.name}
                        >
                          {sourceGroup.name}
                        </p>
                      ) : null}
                      <p
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={run.sourceGroupId}
                      >
                        {run.sourceGroupId}
                      </p>
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Trigger
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      {run.triggerType}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Requested
                    </dt>
                    <dd className="mt-1 text-muted-foreground">
                      {formatDateTime(run.requestedAt)}
                    </dd>
                  </div>

                  {run.parameters.maxScrolls !== undefined && (
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Max Scrolls
                      </dt>
                      <dd className="mt-1 text-muted-foreground">
                        {run.parameters.maxScrolls}
                      </dd>
                    </div>
                  )}

                  {run.parameters.maxDurationMs !== undefined && (
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Max Duration
                      </dt>
                      <dd className="mt-1 text-muted-foreground">
                        {formatDuration(run.parameters.maxDurationMs)}
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
                </dl>

                {run.summary !== undefined &&
                  (run.summary.capturedPayloads !== undefined ||
                    run.summary.extractorCandidates !== undefined ||
                    run.summary.contentItemsSubmitted !== undefined ||
                    run.summary.failedSubmissions !== undefined ||
                    run.summary.leaseReleased !== undefined) && (
                    <div className="rounded border border-border bg-muted/25 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Summary
                      </p>
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        {run.summary.capturedPayloads !== undefined && (
                          <div>
                            <dt className="sr-only">Captured Payloads</dt>
                            <dd>
                              {run.summary.capturedPayloads} captured
                            </dd>
                          </div>
                        )}
                        {run.summary.extractorCandidates !== undefined && (
                          <div>
                            <dt className="sr-only">Extractor Candidates</dt>
                            <dd>
                              {run.summary.extractorCandidates} extracted
                            </dd>
                          </div>
                        )}
                        {run.summary.contentItemsSubmitted !== undefined && (
                          <div>
                            <dt className="sr-only">Content Items Submitted</dt>
                            <dd>
                              {run.summary.contentItemsSubmitted} submitted
                            </dd>
                          </div>
                        )}
                        {run.summary.failedSubmissions !== undefined &&
                          run.summary.failedSubmissions > 0 && (
                            <div>
                              <dt className="sr-only">Failed Submissions</dt>
                              <dd className="text-[#8f3030]">
                                {run.summary.failedSubmissions} failed
                              </dd>
                            </div>
                          )}
                        {run.summary.leaseReleased !== undefined && (
                          <div>
                            <dt className="sr-only">Lease Released</dt>
                            <dd>
                              {run.summary.leaseReleased ? "Released" : "Not released"}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                {run.failureReason !== undefined && (
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
                )}
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CancelRunButton({
  collectionRunId,
  onCancel,
}: {
  readonly collectionRunId: string;
  readonly onCancel: () => void;
}): JSX.Element {
  const cancelMutation = useCancelCollectionRunMutation();

  async function cancel(): Promise<void> {
    cancelMutation.reset();

    try {
      await cancelMutation.mutateAsync({ collectionRunId });
      onCancel();
    } catch {
      // Error handled by BackendErrorPanel
    }
  }

  return (
    <Button
      aria-label={`Cancel collection run ${collectionRunId}`}
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
  );
}

function RequestCollectionRunCard({
  sourceGroups,
  sourceGroupsLoading,
  hasPaginationWarning,
}: {
  readonly sourceGroups: readonly SourceGroup[];
  readonly sourceGroupsLoading: boolean;
  readonly hasPaginationWarning: boolean;
}): JSX.Element {
  const requestMutation = useRequestCollectionRunMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [createdRunId, setCreatedRunId] = useState<string>();
  const form = useForm<RequestCollectionRunFormValues>({
    defaultValues: {
      sourceGroupId: "",
      maxScrolls: undefined,
      maxDurationMs: undefined,
    },
  });
  const { reset } = form;

  async function submit(values: RequestCollectionRunFormValues): Promise<void> {
    setValidationSummary(undefined);
    setCreatedRunId(undefined);
    requestMutation.reset();

    const parsed = RequestCollectionRunFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Request is invalid.",
      );
      return;
    }

    try {
      const body = {
        sourceGroupId: parsed.data.sourceGroupId,
        ...(parsed.data.maxScrolls !== undefined
          ? { maxScrolls: parsed.data.maxScrolls }
          : {}),
        ...(parsed.data.maxDurationMs !== undefined
          ? { maxDurationMs: parsed.data.maxDurationMs }
          : {}),
      };

      const response = await requestMutation.mutateAsync(body);

      reset({
        sourceGroupId: "",
        maxScrolls: undefined,
        maxDurationMs: undefined,
      });
      setCreatedRunId(response.collectionRun.id);
    } catch {
      return;
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Request Collection Run</CardTitle>
          <CardDescription>
            Queue a manual collection run for a source group.
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Play aria-hidden="true" className="size-5" />
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
            fallbackMessage="Collection run request failed."
          />

          {createdRunId !== undefined ? (
            <SuccessPanel
              message={`Collection run ${createdRunId} was queued.`}
            />
          ) : null}

          {hasPaginationWarning ? (
            <div className="rounded border border-[#dfc36e] bg-[#fff7dc] px-3 py-2 text-xs font-medium text-[#76591a]">
              Some source groups may not appear in the selector because the list is paginated.
            </div>
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.sourceGroupId)}
            htmlFor="run-source-group"
            label="Source Group"
          >
            <Select
              id="run-source-group"
              disabled={sourceGroupsLoading}
              {...form.register("sourceGroupId")}
            >
              <option value="">Select source group</option>
              {sourceGroups.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.name}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(form.formState.errors.maxScrolls)}
              htmlFor="run-max-scrolls"
              label="Max Scrolls"
            >
              <Input
                id="run-max-scrolls"
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
              htmlFor="run-max-duration"
              label="Max Duration (ms)"
            >
              <Input
                id="run-max-duration"
                autoComplete="off"
                inputMode="numeric"
                min={1}
                placeholder="Optional"
                type="number"
                {...form.register("maxDurationMs")}
              />
            </FormField>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={
                sourceGroupsLoading ||
                sourceGroups.length === 0 ||
                requestMutation.isPending
              }
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
  sourceGroups,
  onReset,
}: {
  readonly filter: ListCollectionRunsFilter;
  readonly onFilterChange: (f: ListCollectionRunsFilter) => void;
  readonly sourceGroups: readonly SourceGroup[];
  readonly onReset: () => void;
}): JSX.Element {
  const hasActiveFilters =
    filter.status !== "" || filter.sourceGroupId !== "";

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Narrow the collection run list.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField
          htmlFor="filter-status"
          label="Status"
        >
          <Select
            id="filter-status"
            value={filter.status}
            onChange={(event) => {
              onFilterChange({
                ...filter,
                status: event.target.value as CollectionRunStatus | "",
              });
            }}
          >
            <option value="">All statuses</option>
            {collectionRunStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          htmlFor="filter-source-group"
          label="Source Group"
        >
          <Select
            id="filter-source-group"
            value={filter.sourceGroupId}
            onChange={(event) => {
              onFilterChange({
                ...filter,
                sourceGroupId: event.target.value,
              });
            }}
          >
            <option value="">All source groups</option>
            {sourceGroups.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.name}
              </option>
            ))}
          </Select>
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

function PaginationControls({
  offset,
  limit,
  total,
  onPrev,
  onNext,
}: {
  readonly offset: number;
  readonly limit: number;
  readonly total: number | undefined;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}): JSX.Element | null {
  const hasMore = total !== undefined && offset + limit < total;
  const canGoBack = offset > 0;

  if (!canGoBack && !hasMore) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <Button
        disabled={!canGoBack}
        variant="secondary"
        size="sm"
        onClick={onPrev}
      >
        Previous
      </Button>

      <p className="text-sm text-muted-foreground">
        Showing {offset + 1}–{offset + limit}
        {total !== undefined ? ` of ${total}` : ""}
      </p>

      <Button
        disabled={!hasMore}
        variant="secondary"
        size="sm"
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}

function RunsLoadingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading Collection Runs</CardTitle>
        <CardDescription>Reading collection runs from Collector Runtime.</CardDescription>
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
        <CardTitle>Collection Runs Could Not Load</CardTitle>
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
          <CardTitle>No Collection Runs</CardTitle>
          <CardDescription>
            No collection runs match the current filters.
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

function getRunStatusTone(status: CollectionRunStatus): StatusBadgeTone {
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

  return "The collection run list request failed.";
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
