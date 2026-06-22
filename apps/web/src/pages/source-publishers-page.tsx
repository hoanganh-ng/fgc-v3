import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Ban,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import {
  usePromoteSourcePublisherToSourceGroupMutation,
  useUpdateSourcePublisherStatusMutation,
} from "@/features/content-manager/content-manager-mutations";
import {
  useContentCategoriesQuery,
  useSourcePublishersQuery,
} from "@/features/content-manager/content-manager-queries";
import {
  getSourcePublisherDisplayName,
  getSourcePublisherPromotionGate,
  SOURCE_PUBLISHER_KIND_FILTER_OPTIONS,
  SOURCE_PUBLISHER_PLATFORM_FILTER_OPTIONS,
  SOURCE_PUBLISHER_STATUS_FILTER_OPTIONS,
  SourcePublisherFilterSchema,
  SourcePublisherPromotionFormSchema,
  toPromoteSourcePublisherRequest,
  toSourcePublisherPromotionDefaultValues,
  type SourcePublisherFilterValues,
  type SourcePublisherPromotionFormValues,
} from "@/features/content-manager/source-publisher-review-view-model";
import {
  SourcePublisherKindSchema,
  SourcePublisherStatusSchema,
  type ContentCategory,
  type ListSourcePublishersQuery,
  type SourcePublisher,
  type SourcePublisherStatus,
} from "@/lib/api/content-manager-client";
import { PageShell } from "@/pages/page-shell";

const DEFAULT_FILTERS = {
  status: "DISCOVERED",
  kind: "ALL",
  platform: "ALL",
} satisfies SourcePublisherFilterValues;

export function SourcePublishersPage(): JSX.Element {
  const [filters, setFilters] =
    useState<SourcePublisherFilterValues>(DEFAULT_FILTERS);
  const query = useMemo(() => toListQuery(filters), [filters]);
  const sourcePublishersQuery = useSourcePublishersQuery(query);
  const categoriesQuery = useContentCategoriesQuery();

  function refresh(): void {
    void sourcePublishersQuery.refetch();
    void categoriesQuery.refetch();
  }

  function updateFilter<TKey extends keyof SourcePublisherFilterValues>(
    key: TKey,
    value: SourcePublisherFilterValues[TKey],
  ): void {
    const next = SourcePublisherFilterSchema.parse({
      ...filters,
      [key]: value,
    });
    setFilters(next);
  }

  const categories = categoriesQuery.data?.items ?? [];

  return (
    <PageShell
      eyebrow="Content Manager"
      title="Source Publishers"
      description="Review discovered publishing-source identities and promote approved Facebook groups into managed source groups."
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-5">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Review Filters</CardTitle>
            <CardDescription>
              Defaults to discovered publishers from home-feed collection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField htmlFor="source-publisher-status-filter" label="Status">
                <Select
                  id="source-publisher-status-filter"
                  value={filters.status}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateFilter(
                      "status",
                      value === "ALL"
                        ? "ALL"
                        : SourcePublisherStatusSchema.parse(value),
                    );
                  }}
                >
                  <option value="ALL">All statuses</option>
                  {SOURCE_PUBLISHER_STATUS_FILTER_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField htmlFor="source-publisher-kind-filter" label="Kind">
                <Select
                  id="source-publisher-kind-filter"
                  value={filters.kind}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateFilter(
                      "kind",
                      value === "ALL"
                        ? "ALL"
                        : SourcePublisherKindSchema.parse(value),
                    );
                  }}
                >
                  <option value="ALL">All kinds</option>
                  {SOURCE_PUBLISHER_KIND_FILTER_OPTIONS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField htmlFor="source-publisher-platform-filter" label="Platform">
                <Select
                  id="source-publisher-platform-filter"
                  value={filters.platform}
                  onChange={(event) => {
                    updateFilter(
                      "platform",
                      event.target.value === "ALL" ? "ALL" : "FACEBOOK",
                    );
                  }}
                >
                  <option value="ALL">All platforms</option>
                  {SOURCE_PUBLISHER_PLATFORM_FILTER_OPTIONS.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        {sourcePublishersQuery.isPending ? <SourcePublishersLoadingState /> : null}
        {sourcePublishersQuery.isError ? (
          <SourcePublishersErrorState
            error={sourcePublishersQuery.error}
            onRetry={() => {
              void sourcePublishersQuery.refetch();
            }}
          />
        ) : null}
        {sourcePublishersQuery.isSuccess &&
        sourcePublishersQuery.data.items.length === 0 ? (
          <SourcePublishersEmptyState />
        ) : null}
        {sourcePublishersQuery.isSuccess &&
        sourcePublishersQuery.data.items.length > 0 ? (
          <SourcePublishersList
            categories={categories}
            categoriesLoading={categoriesQuery.isPending}
            page={sourcePublishersQuery.data.page}
            sourcePublishers={sourcePublishersQuery.data.items}
          />
        ) : null}
      </div>
    </PageShell>
  );
}

function SourcePublishersList({
  categories,
  categoriesLoading,
  page,
  sourcePublishers,
}: {
  readonly categories: readonly ContentCategory[];
  readonly categoriesLoading: boolean;
  readonly page: { readonly total?: number | undefined };
  readonly sourcePublishers: readonly SourcePublisher[];
}): JSX.Element {
  const updateStatus = useUpdateSourcePublisherStatusMutation();

  function changeStatus(
    sourcePublisherId: string,
    status: SourcePublisherStatus,
  ): void {
    updateStatus.reset();
    void updateStatus
      .mutateAsync({
        sourcePublisherId,
        status,
      })
      .catch(() => undefined);
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Source Publishers</CardTitle>
          <CardDescription>
            {formatCount(page.total ?? sourcePublishers.length, "publisher")}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <CircleDot aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pt-4">
          <BackendErrorPanel
            error={updateStatus.error}
            fallbackMessage="Source publisher status update failed."
          />
        </div>
        <div className="divide-y divide-border">
          {sourcePublishers.map((sourcePublisher) => {
            const displayName = getSourcePublisherDisplayName(sourcePublisher);
            const isStatusPending =
              updateStatus.isPending &&
              updateStatus.variables?.sourcePublisherId === sourcePublisher.id;

            return (
              <article
                key={sourcePublisher.id}
                className="grid min-w-0 gap-4 px-4 py-5"
              >
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="grid min-w-0 gap-2">
                    <h3
                      className="truncate text-base font-semibold text-foreground"
                      title={displayName}
                    >
                      {displayName}
                    </h3>
                    <code
                      className="block min-w-0 truncate rounded border border-border bg-muted/55 px-2 py-1 font-mono text-xs text-foreground"
                      title={sourcePublisher.id}
                    >
                      {sourcePublisher.id}
                    </code>
                  </div>

                  <div className="grid min-w-0 gap-2 lg:justify-items-end">
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <StatusBadge
                        label={sourcePublisher.status}
                        tone={getSourcePublisherStatusTone(
                          sourcePublisher.status,
                        )}
                      />
                      <StatusBadge label={sourcePublisher.kind} tone="info" />
                      <StatusBadge label={sourcePublisher.platform} tone="neutral" />
                      {isStatusPending ? (
                        <span className="text-xs text-muted-foreground">
                          Updating
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        disabled={updateStatus.isPending}
                        size="sm"
                        variant="secondary"
                        onClick={() => changeStatus(sourcePublisher.id, "APPROVED")}
                      >
                        <CheckCircle2 aria-hidden="true" className="size-4" />
                        Approve
                      </Button>
                      <Button
                        disabled={updateStatus.isPending}
                        size="sm"
                        variant="secondary"
                        onClick={() => changeStatus(sourcePublisher.id, "IGNORED")}
                      >
                        <ShieldAlert aria-hidden="true" className="size-4" />
                        Ignore
                      </Button>
                      <Button
                        disabled={updateStatus.isPending}
                        size="sm"
                        variant="danger"
                        onClick={() => changeStatus(sourcePublisher.id, "BLOCKED")}
                      >
                        <Ban aria-hidden="true" className="size-4" />
                        Block
                      </Button>
                      {sourcePublisher.status !== "DISCOVERED" ? (
                        <Button
                          disabled={updateStatus.isPending}
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            changeStatus(sourcePublisher.id, "DISCOVERED")
                          }
                        >
                          Reset to discovered
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <dl className="grid min-w-0 gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="External Publisher ID">
                    {sourcePublisher.externalPublisherId}
                  </Field>
                  <Field label="Observations">
                    {sourcePublisher.observationCount.toLocaleString()}
                  </Field>
                  <Field label="First Observed">
                    {formatDateTime(sourcePublisher.firstObservedAt)}
                  </Field>
                  <Field label="Last Observed">
                    {formatDateTime(sourcePublisher.lastObservedAt)}
                  </Field>
                  <Field label="Updated">
                    {formatDateTime(sourcePublisher.updatedAt)}
                  </Field>
                  {sourcePublisher.canonicalUrl !== undefined ? (
                    <div className="min-w-0 sm:col-span-2 lg:col-span-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Canonical URL
                      </dt>
                      <dd className="mt-1 min-w-0">
                        <a
                          className="inline-flex max-w-full items-center gap-2 truncate font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                          href={sourcePublisher.canonicalUrl}
                          rel="noreferrer"
                          target="_blank"
                          title={sourcePublisher.canonicalUrl}
                        >
                          <span className="truncate">
                            {sourcePublisher.canonicalUrl}
                          </span>
                          <ExternalLink aria-hidden="true" className="size-4" />
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <SourcePublisherPromotionPanel
                  categories={categories}
                  categoriesLoading={categoriesLoading}
                  sourcePublisher={sourcePublisher}
                />
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SourcePublisherPromotionPanel({
  categories,
  categoriesLoading,
  sourcePublisher,
}: {
  readonly categories: readonly ContentCategory[];
  readonly categoriesLoading: boolean;
  readonly sourcePublisher: SourcePublisher;
}): JSX.Element | null {
  const promoteSourcePublisher = usePromoteSourcePublisherToSourceGroupMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [promotionOutcome, setPromotionOutcome] = useState<
    "CREATED" | "ALREADY_EXISTS" | undefined
  >();
  const firstCategory = categories[0];
  const gate = getSourcePublisherPromotionGate(sourcePublisher, categories);
  const form = useForm<SourcePublisherPromotionFormValues>({
    defaultValues: toSourcePublisherPromotionDefaultValues(
      sourcePublisher,
      firstCategory?.id,
    ),
  });
  const { getValues, reset, setValue } = form;

  useEffect(() => {
    reset(
      toSourcePublisherPromotionDefaultValues(sourcePublisher, firstCategory?.id),
    );
  }, [firstCategory?.id, reset, sourcePublisher]);

  useEffect(() => {
    if (firstCategory === undefined) {
      return;
    }

    if (getValues("categoryId").trim().length === 0) {
      setValue("categoryId", firstCategory.id);
    }
  }, [firstCategory, getValues, setValue]);

  if (
    sourcePublisher.platform !== "FACEBOOK" ||
    sourcePublisher.kind !== "GROUP"
  ) {
    return null;
  }

  async function submit(
    values: SourcePublisherPromotionFormValues,
  ): Promise<void> {
    setValidationSummary(undefined);
    setPromotionOutcome(undefined);
    promoteSourcePublisher.reset();

    const parsed = SourcePublisherPromotionFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Promotion request is invalid.",
      );
      return;
    }

    try {
      const response = await promoteSourcePublisher.mutateAsync({
        sourcePublisherId: sourcePublisher.id,
        request: toPromoteSourcePublisherRequest(parsed.data),
      });

      setPromotionOutcome(response.promotion.outcome);
    } catch {
      return;
    }
  }

  return (
    <div className="grid min-w-0 gap-3 rounded border border-border bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            Promote to Source Group
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Creates a paused managed source group when this approved Facebook
            group is not already managed.
          </p>
        </div>
        <StatusBadge label="GROUP promotion" tone="info" />
      </div>

      {!gate.allowed ? (
        <div
          className="rounded border border-[#dfc36e] bg-[#fff7dc] px-4 py-3 text-sm font-medium text-[#76591a]"
          role="status"
        >
          {gate.reason}
        </div>
      ) : null}

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          void form.handleSubmit(submit)(event);
        }}
      >
        {validationSummary !== undefined ? (
          <ValidationSummary message={validationSummary} />
        ) : null}

        <BackendErrorPanel
          error={promoteSourcePublisher.error}
          fallbackMessage="Source publisher promotion failed."
        />

        {promotionOutcome !== undefined ? (
          <SuccessPanel message={`Promotion outcome: ${promotionOutcome}.`} />
        ) : null}

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <FormField
            error={getErrorMessage(form.formState.errors.categoryId)}
            htmlFor={`${sourcePublisher.id}-promotion-category`}
            label="Category"
          >
            <Select
              id={`${sourcePublisher.id}-promotion-category`}
              disabled={!gate.allowed || categoriesLoading}
              {...form.register("categoryId")}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.collectionPriority)}
            htmlFor={`${sourcePublisher.id}-promotion-priority`}
            label="Collection Priority"
          >
            <Input
              id={`${sourcePublisher.id}-promotion-priority`}
              disabled={!gate.allowed}
              inputMode="numeric"
              max={100}
              min={0}
              type="number"
              {...form.register("collectionPriority", {
                valueAsNumber: true,
              })}
            />
          </FormField>
        </div>

        <FormField
          error={getErrorMessage(form.formState.errors.name)}
          htmlFor={`${sourcePublisher.id}-promotion-name`}
          label="Name"
        >
          <Input
            id={`${sourcePublisher.id}-promotion-name`}
            autoComplete="off"
            disabled={!gate.allowed}
            {...form.register("name")}
          />
        </FormField>

        <FormField
          error={getErrorMessage(form.formState.errors.url)}
          htmlFor={`${sourcePublisher.id}-promotion-url`}
          label="URL"
        >
          <Input
            id={`${sourcePublisher.id}-promotion-url`}
            autoComplete="off"
            disabled={!gate.allowed}
            {...form.register("url")}
          />
        </FormField>

        <FormField
          error={getErrorMessage(form.formState.errors.notes)}
          htmlFor={`${sourcePublisher.id}-promotion-notes`}
          label="Notes"
        >
          <Textarea
            id={`${sourcePublisher.id}-promotion-notes`}
            disabled={!gate.allowed}
            {...form.register("notes")}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={!gate.allowed || promoteSourcePublisher.isPending}
            size="sm"
            type="submit"
          >
            <Send aria-hidden="true" className="size-4" />
            {promoteSourcePublisher.isPending ? "Promoting" : "Promote"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  readonly children: string | number;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium text-foreground" title={String(children)}>
        {children}
      </dd>
    </div>
  );
}

function SourcePublishersLoadingState(): JSX.Element {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Loading source publishers.
      </CardContent>
    </Card>
  );
}

function SourcePublishersErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="grid gap-4 py-6">
        <BackendErrorPanel
          error={error}
          fallbackMessage="Source publishers could not be loaded."
        />
        <div>
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SourcePublishersEmptyState(): JSX.Element {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        No source publishers match the current filters.
      </CardContent>
    </Card>
  );
}

function ValidationSummary({ message }: { readonly message: string }): JSX.Element {
  return (
    <div
      className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#7f1d1d]"
      role="alert"
    >
      {message}
    </div>
  );
}

function SuccessPanel({ message }: { readonly message: string }): JSX.Element {
  return (
    <div
      className="rounded border border-[#9dccad] bg-[#edf8ee] px-4 py-3 text-sm font-medium text-[#23633a]"
      role="status"
    >
      {message}
    </div>
  );
}

function toListQuery(
  filters: SourcePublisherFilterValues,
): ListSourcePublishersQuery {
  return {
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.kind !== "ALL" ? { kind: filters.kind } : {}),
    ...(filters.platform !== "ALL" ? { platform: filters.platform } : {}),
    limit: 100,
    offset: 0,
  };
}

function getSourcePublisherStatusTone(
  status: SourcePublisherStatus,
): StatusBadgeTone {
  switch (status) {
    case "APPROVED":
      return "success";
    case "BLOCKED":
      return "danger";
    case "IGNORED":
      return "warning";
    case "DISCOVERED":
      return "info";
  }
}

function formatCount(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
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
