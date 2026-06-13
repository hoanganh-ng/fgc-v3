import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  CheckCircle2,
  Clipboard,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Save,
  Tags,
  Trash2,
  X,
  Eye,
} from "lucide-react";
import { z } from "zod";
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
  useCreateSourceGroupEntryRouteMutation,
  useCreateContentCategoryMutation,
  useCreateSourceGroupMutation,
  useRemoveSourceGroupEntryRouteMutation,
  useUpdateSourceGroupEntryRouteMutation,
  useUpdateSourceGroupStatusMutation,
} from "@/features/content-manager/content-manager-mutations";
import {
  useContentCategoriesQuery,
  useSourceGroupsQuery,
} from "@/features/content-manager/content-manager-queries";
import { SourceGroupProfileAccessPanel } from "@/features/content-manager/source-group-profile-access-panel";
import { isApiResultError } from "@/lib/api/http-client";
import {
  ContentPlatformSchema,
  SourceGroupEntryRouteRiskLevelSchema,
  SourceGroupEntryRouteTypeSchema,
  SourceGroupStatusSchema,
  type ContentCategory,
  type SourceGroup,
  type SourceGroupEntryRoute,
  type SourceGroupEntryRouteRiskLevel,
  type SourceGroupStatus,
} from "@/lib/api/content-manager-client";
import { PageShell } from "@/pages/page-shell";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ContentCategoryFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    slug: z
      .string()
      .trim()
      .regex(slugPattern, "Expected lowercase URL-safe slug."),
    description: z.string(),
  })
  .strict();

const SourceGroupFormSchema = z
  .object({
    platform: ContentPlatformSchema,
    externalGroupId: z.string().trim().min(1, "External group ID is required."),
    name: z.string().trim().min(1, "Name is required."),
    url: z.string().trim().min(1, "Source URL is required."),
    categoryId: z.string().trim().min(1, "Category is required."),
    status: SourceGroupStatusSchema,
    collectionPriority: z
      .number()
      .int("Collection priority must be an integer.")
      .min(0, "Collection priority must be at least 0.")
      .max(100, "Collection priority must be at most 100."),
    notes: z.string(),
  })
  .strict();

const SourceGroupEntryRouteFormSchema = z
  .object({
    type: SourceGroupEntryRouteTypeSchema,
    url: z.string().trim().url("Entry URL must be valid."),
    label: z.string(),
    notes: z.string(),
    riskLevel: SourceGroupEntryRouteRiskLevelSchema,
    isDefault: z.boolean(),
  })
  .strict();

type ContentCategoryFormValues = z.infer<typeof ContentCategoryFormSchema>;
type SourceGroupFormValues = z.infer<typeof SourceGroupFormSchema>;
type SourceGroupEntryRouteFormValues = z.infer<
  typeof SourceGroupEntryRouteFormSchema
>;

const sourceGroupStatuses = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
const sourceGroupEntryRouteTypes = [
  "DIRECT_GROUP_URL",
  "CATEGORY_ENTRY_URL",
  "PUBLIC_PAGE_THEN_GROUP",
  "OPERATOR_ASSISTED_SEARCH",
  "SAVED_REFERRAL_URL",
] as const;
const sourceGroupEntryRouteRiskLevels = ["LOW", "MEDIUM", "HIGH"] as const;

export function SourceGroupsPage(): JSX.Element {
  const categoriesQuery = useContentCategoriesQuery();
  const sourceGroupsQuery = useSourceGroupsQuery();

  function refresh(): void {
    void categoriesQuery.refetch();
    void sourceGroupsQuery.refetch();
  }

  const categories = categoriesQuery.data?.items ?? [];

  return (
    <PageShell
      eyebrow="Content Manager"
      title="Source Groups"
      description="Manage Content Manager categories and Facebook source groups for manual collection."
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <SourceGroupCreateCard
            categories={categories}
            categoriesLoading={categoriesQuery.isPending}
          />

          {sourceGroupsQuery.isPending ? <SourceGroupsLoadingState /> : null}
          {sourceGroupsQuery.isError ? (
            <SourceGroupsErrorState
              error={sourceGroupsQuery.error}
              onRetry={() => {
                void sourceGroupsQuery.refetch();
              }}
            />
          ) : null}
          {sourceGroupsQuery.isSuccess &&
          sourceGroupsQuery.data.items.length === 0 ? (
            <SourceGroupsEmptyState />
          ) : null}
          {sourceGroupsQuery.isSuccess &&
          sourceGroupsQuery.data.items.length > 0 ? (
            <SourceGroupsList
              categories={categories}
              page={sourceGroupsQuery.data.page}
              sourceGroups={sourceGroupsQuery.data.items}
            />
          ) : null}
        </div>

        <aside className="grid min-w-0 gap-5 content-start">
          <ContentCategoryCreateCard />

          {categoriesQuery.isPending ? <CategoriesLoadingState /> : null}
          {categoriesQuery.isError ? (
            <CategoriesErrorState
              error={categoriesQuery.error}
              onRetry={() => {
                void categoriesQuery.refetch();
              }}
            />
          ) : null}
          {categoriesQuery.isSuccess && categoriesQuery.data.items.length === 0 ? (
            <CategoriesEmptyState />
          ) : null}
          {categoriesQuery.isSuccess && categoriesQuery.data.items.length > 0 ? (
            <CategoriesList categories={categoriesQuery.data.items} />
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}

function ContentCategoryCreateCard(): JSX.Element {
  const createCategory = useCreateContentCategoryMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [createdCategory, setCreatedCategory] = useState<string>();
  const form = useForm<ContentCategoryFormValues>({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  async function submit(values: ContentCategoryFormValues): Promise<void> {
    setValidationSummary(undefined);
    setCreatedCategory(undefined);
    createCategory.reset();

    const parsed = ContentCategoryFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Content category is invalid.",
      );
      return;
    }

    const description = parsed.data.description.trim();

    try {
      const response = await createCategory.mutateAsync({
        name: parsed.data.name,
        slug: parsed.data.slug,
        ...(description.length > 0 ? { description } : {}),
      });

      form.reset({
        name: "",
        slug: "",
        description: "",
      });
      setCreatedCategory(response.category.name);
    } catch {
      return;
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Create Category</CardTitle>
          <CardDescription>Managed category records accepted by Content Manager.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Tags aria-hidden="true" className="size-5" />
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
            error={createCategory.error}
            fallbackMessage="Content category creation failed."
          />

          {createdCategory !== undefined ? (
            <SuccessPanel message={`${createdCategory} was created.`} />
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.name)}
            htmlFor="category-name"
            label="Name"
          >
            <Input
              id="category-name"
              autoComplete="off"
              {...form.register("name")}
            />
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.slug)}
            htmlFor="category-slug"
            label="Slug"
          >
            <Input
              id="category-slug"
              autoComplete="off"
              {...form.register("slug")}
            />
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.description)}
            htmlFor="category-description"
            label="Description"
          >
            <Textarea
              id="category-description"
              {...form.register("description")}
            />
          </FormField>

          <Button disabled={createCategory.isPending} type="submit">
            <Save aria-hidden="true" className="size-4" />
            {createCategory.isPending ? "Creating" : "Create Category"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SourceGroupCreateCard({
  categories,
  categoriesLoading,
}: {
  readonly categories: readonly ContentCategory[];
  readonly categoriesLoading: boolean;
}): JSX.Element {
  const createSourceGroup = useCreateSourceGroupMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [createdSourceGroupId, setCreatedSourceGroupId] = useState<string>();
  const form = useForm<SourceGroupFormValues>({
    defaultValues: {
      platform: "FACEBOOK",
      externalGroupId: "",
      name: "",
      url: "",
      categoryId: "",
      status: "ACTIVE",
      collectionPriority: 50,
      notes: "",
    },
  });
  const { getValues, reset, setValue } = form;
  const firstCategory = categories[0];
  const canCreateSourceGroup = categories.length > 0 && !categoriesLoading;

  useEffect(() => {
    if (firstCategory === undefined) {
      return;
    }

    if (getValues("categoryId").trim().length === 0) {
      setValue("categoryId", firstCategory.id);
    }
  }, [firstCategory, getValues, setValue]);

  async function submit(values: SourceGroupFormValues): Promise<void> {
    setValidationSummary(undefined);
    setCreatedSourceGroupId(undefined);
    createSourceGroup.reset();

    const parsed = SourceGroupFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Source group is invalid.",
      );
      return;
    }

    const notes = parsed.data.notes.trim();

    try {
      const response = await createSourceGroup.mutateAsync({
        platform: parsed.data.platform,
        externalGroupId: parsed.data.externalGroupId,
        name: parsed.data.name,
        url: parsed.data.url,
        categoryId: parsed.data.categoryId,
        status: parsed.data.status,
        collectionPriority: parsed.data.collectionPriority,
        ...(notes.length > 0 ? { notes } : {}),
      });

      reset({
        platform: "FACEBOOK",
        externalGroupId: "",
        name: "",
        url: "",
        categoryId: firstCategory?.id ?? "",
        status: "ACTIVE",
        collectionPriority: 50,
        notes: "",
      });
      setCreatedSourceGroupId(response.sourceGroup.id);
    } catch {
      return;
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Create Facebook Source Group</CardTitle>
          <CardDescription>Source group records accepted by Content Manager.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <FolderKanban aria-hidden="true" className="size-5" />
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
            error={createSourceGroup.error}
            fallbackMessage="Source group creation failed."
          />

          {createdSourceGroupId !== undefined ? (
            <SuccessPanel
              message={`Source group ${createdSourceGroupId} was created.`}
            />
          ) : null}

          {!canCreateSourceGroup ? (
            <div
              className="rounded border border-[#dfc36e] bg-[#fff7dc] px-4 py-3 text-sm font-medium text-[#76591a]"
              role="status"
            >
              Create a category before creating a source group.
            </div>
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.name)}
            htmlFor="source-group-name"
            label="Name"
          >
            <Input
              id="source-group-name"
              autoComplete="off"
              disabled={!canCreateSourceGroup}
              {...form.register("name")}
            />
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.url)}
            htmlFor="source-group-url"
            label="Source URL"
          >
            <Input
              id="source-group-url"
              autoComplete="off"
              disabled={!canCreateSourceGroup}
              {...form.register("url")}
            />
          </FormField>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(form.formState.errors.externalGroupId)}
              htmlFor="source-group-external-id"
              label="External Group ID"
            >
              <Input
                id="source-group-external-id"
                autoComplete="off"
                disabled={!canCreateSourceGroup}
                {...form.register("externalGroupId")}
              />
            </FormField>

            <FormField
              error={getErrorMessage(form.formState.errors.platform)}
              htmlFor="source-group-platform"
              label="Platform"
            >
              <Select
                id="source-group-platform"
                disabled={!canCreateSourceGroup}
                {...form.register("platform")}
              >
                <option value="FACEBOOK">FACEBOOK</option>
              </Select>
            </FormField>

            <FormField
              error={getErrorMessage(form.formState.errors.categoryId)}
              htmlFor="source-group-category"
              label="Category"
            >
              <Select
                id="source-group-category"
                disabled={!canCreateSourceGroup}
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
              error={getErrorMessage(form.formState.errors.status)}
              htmlFor="source-group-status"
              label="Status"
            >
              <Select
                id="source-group-status"
                disabled={!canCreateSourceGroup}
                {...form.register("status")}
              >
                {sourceGroupStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              error={getErrorMessage(form.formState.errors.collectionPriority)}
              htmlFor="source-group-priority"
              label="Collection Priority"
            >
              <Input
                id="source-group-priority"
                disabled={!canCreateSourceGroup}
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
            error={getErrorMessage(form.formState.errors.notes)}
            htmlFor="source-group-notes"
            label="Notes"
          >
            <Textarea
              id="source-group-notes"
              disabled={!canCreateSourceGroup}
              {...form.register("notes")}
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={!canCreateSourceGroup || createSourceGroup.isPending}
              type="submit"
            >
              <Plus aria-hidden="true" className="size-4" />
              {createSourceGroup.isPending ? "Creating" : "Create Source Group"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SourceGroupsList({
  categories,
  page,
  sourceGroups,
}: {
  readonly categories: readonly ContentCategory[];
  readonly page: { readonly total?: number | undefined };
  readonly sourceGroups: readonly SourceGroup[];
}): JSX.Element {
  const updateStatus = useUpdateSourceGroupStatusMutation();
  const [copyState, setCopyState] = useState<
    | {
        readonly sourceGroupId: string;
        readonly status: "copied" | "failed";
      }
    | null
  >(null);
  const [expandedSourceGroupId, setExpandedSourceGroupId] = useState<string | null>(null);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  async function copySourceGroupId(sourceGroupId: string): Promise<void> {
    if (
      typeof navigator === "undefined" ||
      navigator.clipboard === undefined
    ) {
      setCopyState({ sourceGroupId, status: "failed" });
      return;
    }

    try {
      await navigator.clipboard.writeText(sourceGroupId);
      setCopyState({ sourceGroupId, status: "copied" });
    } catch {
      setCopyState({ sourceGroupId, status: "failed" });
    }
  }

  function changeStatus(
    sourceGroupId: string,
    status: SourceGroupStatus,
  ): void {
    updateStatus.reset();
    void updateStatus
      .mutateAsync({
        sourceGroupId,
        status,
      })
      .catch(() => undefined);
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Source Groups</CardTitle>
          <CardDescription>
            {formatCount(page.total ?? sourceGroups.length, "source group")}
          </CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <FolderKanban aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pt-4">
          <BackendErrorPanel
            error={updateStatus.error}
            fallbackMessage="Source group status update failed."
          />
        </div>
        <div className="divide-y divide-border">
          {sourceGroups.map((sourceGroup) => {
            const category = categoryById.get(sourceGroup.categoryId);
            const isStatusPending =
              updateStatus.isPending &&
              updateStatus.variables?.sourceGroupId === sourceGroup.id;
            const rowCopyState =
              copyState?.sourceGroupId === sourceGroup.id
                ? copyState.status
                : undefined;

            return (
              <article key={sourceGroup.id} className="grid min-w-0 gap-4 px-4 py-5">
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
                  <div className="grid min-w-0 gap-3">
                    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          sourceGroupId
                        </p>
                        <code
                          className="mt-1 block min-w-0 truncate rounded border border-border bg-muted/55 px-2 py-1 font-mono text-xs text-foreground"
                          title={sourceGroup.id}
                        >
                          {sourceGroup.id}
                        </code>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button
                          aria-label={`Copy sourceGroupId ${sourceGroup.id}`}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            void copySourceGroupId(sourceGroup.id);
                          }}
                        >
                          <Clipboard aria-hidden="true" className="size-4" />
                          {rowCopyState === "copied" ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          aria-label={`View profile access for ${sourceGroup.name}`}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setExpandedSourceGroupId(
                              expandedSourceGroupId === sourceGroup.id
                                ? null
                                : sourceGroup.id
                            );
                          }}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                          {expandedSourceGroupId === sourceGroup.id ? "Hide" : "View"} Profile Access
                        </Button>
                        {rowCopyState === "failed" ? (
                          <span className="text-xs font-medium text-[#7f1d1d]">
                            Clipboard unavailable
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h3
                        className="truncate text-base font-semibold text-foreground"
                        title={sourceGroup.name}
                      >
                        {sourceGroup.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Priority {sourceGroup.collectionPriority}
                      </p>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-2 lg:justify-items-end">
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <StatusBadge
                        label={sourceGroup.status}
                        tone={getSourceGroupStatusTone(sourceGroup.status)}
                      />
                      {isStatusPending ? (
                        <span className="text-xs text-muted-foreground">
                          Updating
                        </span>
                      ) : null}
                    </div>
                    <Select
                      aria-label={`Change status for ${sourceGroup.name}`}
                      className="w-full sm:w-44"
                      disabled={updateStatus.isPending}
                      value={sourceGroup.status}
                      onChange={(event) => {
                        changeStatus(
                          sourceGroup.id,
                          SourceGroupStatusSchema.parse(event.target.value),
                        );
                      }}
                    >
                      {sourceGroupStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {expandedSourceGroupId === sourceGroup.id && (
                  <SourceGroupProfileAccessPanel sourceGroupId={sourceGroup.id} />
                )}

                <dl className="grid min-w-0 gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Platform
                    </dt>
                    <dd className="mt-1">
                      <StatusBadge label={sourceGroup.platform} tone="info" />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Category
                    </dt>
                    <dd className="mt-1 min-w-0">
                      <p
                        className="truncate font-medium text-foreground"
                        title={category?.name ?? "Unknown"}
                      >
                        {category?.name ?? "Unknown"}
                      </p>
                      <p
                        className="mt-1 truncate text-xs text-muted-foreground"
                        title={sourceGroup.categoryId}
                      >
                        {sourceGroup.categoryId}
                      </p>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      External Group ID
                    </dt>
                    <dd
                      className="mt-1 truncate font-medium text-foreground"
                      title={sourceGroup.externalGroupId}
                    >
                      {sourceGroup.externalGroupId}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Created
                    </dt>
                    <dd className="mt-1 truncate text-muted-foreground">
                      {formatDateTime(sourceGroup.createdAt)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Updated
                    </dt>
                    <dd className="mt-1 truncate text-muted-foreground">
                      {formatDateTime(sourceGroup.updatedAt)}
                    </dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Source URL
                    </dt>
                    <dd className="mt-1 min-w-0">
                      <a
                        className="block truncate font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                        href={sourceGroup.url}
                        rel="noreferrer"
                        target="_blank"
                        title={sourceGroup.url}
                      >
                        {sourceGroup.url}
                      </a>
                    </dd>
                  </div>
                  {sourceGroup.notes !== undefined ? (
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Notes
                      </dt>
                      <dd
                        className="mt-1 max-h-12 overflow-hidden text-muted-foreground"
                        title={sourceGroup.notes}
                      >
                        {sourceGroup.notes}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <SourceGroupEntryRoutesPanel sourceGroup={sourceGroup} />
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SourceGroupEntryRoutesPanel({
  sourceGroup,
}: {
  readonly sourceGroup: SourceGroup;
}): JSX.Element {
  const createRoute = useCreateSourceGroupEntryRouteMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const form = useForm<SourceGroupEntryRouteFormValues>({
    defaultValues: {
      type: "CATEGORY_ENTRY_URL",
      url: "",
      label: "",
      notes: "",
      riskLevel: "LOW",
      isDefault: false,
    },
  });

  async function submit(values: SourceGroupEntryRouteFormValues): Promise<void> {
    setValidationSummary(undefined);
    createRoute.reset();

    const parsed = SourceGroupEntryRouteFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Entry route is invalid.",
      );
      return;
    }

    const label = parsed.data.label.trim();
    const notes = parsed.data.notes.trim();

    try {
      await createRoute.mutateAsync({
        sourceGroupId: sourceGroup.id,
        request: {
          type: parsed.data.type,
          url: parsed.data.url,
          ...(label.length > 0 ? { label } : {}),
          ...(notes.length > 0 ? { notes } : {}),
          riskLevel: parsed.data.riskLevel,
          ...(parsed.data.isDefault
            ? { isDefault: parsed.data.isDefault }
            : {}),
        },
      });

      form.reset({
        type: "CATEGORY_ENTRY_URL",
        url: "",
        label: "",
        notes: "",
        riskLevel: "LOW",
        isDefault: false,
      });
    } catch {
      return;
    }
  }

  return (
    <div className="grid min-w-0 gap-3 rounded border border-border bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Route aria-hidden="true" className="size-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Entry Routes</h4>
        </div>
        <StatusBadge
          label={formatCount(sourceGroup.entryRoutes.length, "route")}
          tone="neutral"
        />
      </div>

      <div className="grid gap-3">
        {sourceGroup.entryRoutes.map((route) => (
          <SourceGroupEntryRouteRow
            key={route.id}
            route={route}
            sourceGroupId={sourceGroup.id}
          />
        ))}
      </div>

      <form
        className="grid gap-3 border-t border-border pt-3"
        onSubmit={(event) => {
          void form.handleSubmit(submit)(event);
        }}
      >
        {validationSummary !== undefined ? (
          <ValidationSummary message={validationSummary} />
        ) : null}

        <BackendErrorPanel
          error={createRoute.error}
          fallbackMessage="Entry route creation failed."
        />

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <FormField
            error={getErrorMessage(form.formState.errors.type)}
            htmlFor={`${sourceGroup.id}-entry-route-type`}
            label="Type"
          >
            <Select
              id={`${sourceGroup.id}-entry-route-type`}
              {...form.register("type")}
            >
              {sourceGroupEntryRouteTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.riskLevel)}
            htmlFor={`${sourceGroup.id}-entry-route-risk`}
            label="Risk"
          >
            <Select
              id={`${sourceGroup.id}-entry-route-risk`}
              {...form.register("riskLevel")}
            >
              {sourceGroupEntryRouteRiskLevels.map((riskLevel) => (
                <option key={riskLevel} value={riskLevel}>
                  {riskLevel}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          error={getErrorMessage(form.formState.errors.url)}
          htmlFor={`${sourceGroup.id}-entry-route-url`}
          label="URL"
        >
          <Input
            id={`${sourceGroup.id}-entry-route-url`}
            autoComplete="off"
            {...form.register("url")}
          />
        </FormField>

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <FormField
            error={getErrorMessage(form.formState.errors.label)}
            htmlFor={`${sourceGroup.id}-entry-route-label`}
            label="Label"
          >
            <Input
              id={`${sourceGroup.id}-entry-route-label`}
              autoComplete="off"
              {...form.register("label")}
            />
          </FormField>

          <label className="flex min-h-10 items-center gap-2 self-end text-sm font-medium text-foreground">
            <input
              className="size-4 rounded border-border text-primary focus:ring-primary"
              type="checkbox"
              {...form.register("isDefault")}
            />
            Default route
          </label>
        </div>

        <FormField
          error={getErrorMessage(form.formState.errors.notes)}
          htmlFor={`${sourceGroup.id}-entry-route-notes`}
          label="Notes"
        >
          <Textarea
            id={`${sourceGroup.id}-entry-route-notes`}
            {...form.register("notes")}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={createRoute.isPending} size="sm" type="submit">
            <Plus aria-hidden="true" className="size-4" />
            {createRoute.isPending ? "Adding" : "Add Route"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SourceGroupEntryRouteRow({
  route,
  sourceGroupId,
}: {
  readonly route: SourceGroupEntryRoute;
  readonly sourceGroupId: string;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const removeRoute = useRemoveSourceGroupEntryRouteMutation();

  async function remove(): Promise<void> {
    removeRoute.reset();

    try {
      await removeRoute.mutateAsync({
        sourceGroupId,
        entryRouteId: route.id,
      });
    } catch {
      return;
    }
  }

  return (
    <div className="grid min-w-0 gap-3 rounded border border-border bg-white p-3">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={route.type} tone="info" />
            <StatusBadge
              label={route.riskLevel}
              tone={getEntryRouteRiskTone(route.riskLevel)}
            />
            {route.isDefault ? (
              <StatusBadge label="Default" tone="success" />
            ) : null}
          </div>
          <a
            className="min-w-0 truncate text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            href={route.url}
            rel="noreferrer"
            target="_blank"
            title={route.url}
          >
            {route.url}
          </a>
          {route.label !== undefined ? (
            <p
              className="truncate text-sm font-medium text-foreground"
              title={route.label}
            >
              {route.label}
            </p>
          ) : null}
          {route.notes !== undefined ? (
            <p
              className="max-h-12 overflow-hidden text-sm leading-6 text-muted-foreground"
              title={route.notes}
            >
              {route.notes}
            </p>
          ) : null}
          <p className="truncate font-mono text-xs text-muted-foreground">
            {route.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
            aria-label={`Edit entry route ${route.id}`}
            size="sm"
            variant="secondary"
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? (
              <X aria-hidden="true" className="size-4" />
            ) : (
              <Pencil aria-hidden="true" className="size-4" />
            )}
            {editing ? "Cancel" : "Edit"}
          </Button>
          {!route.isDefault ? (
            <Button
              aria-label={`Delete entry route ${route.id}`}
              disabled={removeRoute.isPending}
              size="sm"
              variant="danger"
              onClick={() => {
                void remove();
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {removeRoute.isPending ? "Deleting" : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>

      <BackendErrorPanel
        error={removeRoute.error}
        fallbackMessage="Entry route deletion failed."
      />

      {editing ? (
        <SourceGroupEntryRouteEditForm
          route={route}
          sourceGroupId={sourceGroupId}
          onSaved={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function SourceGroupEntryRouteEditForm({
  onSaved,
  route,
  sourceGroupId,
}: {
  readonly onSaved: () => void;
  readonly route: SourceGroupEntryRoute;
  readonly sourceGroupId: string;
}): JSX.Element {
  const updateRoute = useUpdateSourceGroupEntryRouteMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const form = useForm<SourceGroupEntryRouteFormValues>({
    defaultValues: {
      type: route.type,
      url: route.url,
      label: route.label ?? "",
      notes: route.notes ?? "",
      riskLevel: route.riskLevel,
      isDefault: route.isDefault,
    },
  });

  async function submit(values: SourceGroupEntryRouteFormValues): Promise<void> {
    setValidationSummary(undefined);
    updateRoute.reset();

    const parsed = SourceGroupEntryRouteFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Entry route is invalid.",
      );
      return;
    }

    const label = parsed.data.label.trim();
    const notes = parsed.data.notes.trim();

    try {
      await updateRoute.mutateAsync({
        sourceGroupId,
        entryRouteId: route.id,
        request: {
          type: parsed.data.type,
          url: parsed.data.url,
          label: label.length > 0 ? label : null,
          notes: notes.length > 0 ? notes : null,
          riskLevel: parsed.data.riskLevel,
          isDefault: route.isDefault ? true : parsed.data.isDefault,
        },
      });
      onSaved();
    } catch {
      return;
    }
  }

  return (
    <form
      className="grid gap-3 border-t border-border pt-3"
      onSubmit={(event) => {
        void form.handleSubmit(submit)(event);
      }}
    >
      {validationSummary !== undefined ? (
        <ValidationSummary message={validationSummary} />
      ) : null}

      <BackendErrorPanel
        error={updateRoute.error}
        fallbackMessage="Entry route update failed."
      />

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <FormField
          error={getErrorMessage(form.formState.errors.type)}
          htmlFor={`${sourceGroupId}-${route.id}-edit-type`}
          label="Type"
        >
          <Select
            id={`${sourceGroupId}-${route.id}-edit-type`}
            {...form.register("type")}
          >
            {sourceGroupEntryRouteTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          error={getErrorMessage(form.formState.errors.riskLevel)}
          htmlFor={`${sourceGroupId}-${route.id}-edit-risk`}
          label="Risk"
        >
          <Select
            id={`${sourceGroupId}-${route.id}-edit-risk`}
            {...form.register("riskLevel")}
          >
            {sourceGroupEntryRouteRiskLevels.map((riskLevel) => (
              <option key={riskLevel} value={riskLevel}>
                {riskLevel}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        error={getErrorMessage(form.formState.errors.url)}
        htmlFor={`${sourceGroupId}-${route.id}-edit-url`}
        label="URL"
      >
        <Input
          id={`${sourceGroupId}-${route.id}-edit-url`}
          autoComplete="off"
          {...form.register("url")}
        />
      </FormField>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <FormField
          error={getErrorMessage(form.formState.errors.label)}
          htmlFor={`${sourceGroupId}-${route.id}-edit-label`}
          label="Label"
        >
          <Input
            id={`${sourceGroupId}-${route.id}-edit-label`}
            autoComplete="off"
            {...form.register("label")}
          />
        </FormField>

        <label className="flex min-h-10 items-center gap-2 self-end text-sm font-medium text-foreground">
          <input
            className="size-4 rounded border-border text-primary focus:ring-primary"
            disabled={route.isDefault}
            type="checkbox"
            {...form.register("isDefault")}
          />
          Default route
        </label>
      </div>

      <FormField
        error={getErrorMessage(form.formState.errors.notes)}
        htmlFor={`${sourceGroupId}-${route.id}-edit-notes`}
        label="Notes"
      >
        <Textarea
          id={`${sourceGroupId}-${route.id}-edit-notes`}
          {...form.register("notes")}
        />
      </FormField>

      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={updateRoute.isPending} size="sm" type="submit">
          <Save aria-hidden="true" className="size-4" />
          {updateRoute.isPending ? "Saving" : "Save Route"}
        </Button>
      </div>
    </form>
  );
}

function CategoriesList({
  categories,
}: {
  readonly categories: readonly ContentCategory[];
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Categories</CardTitle>
          <CardDescription>{formatCount(categories.length, "category")}</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <Tags aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {categories.map((category) => (
            <div key={category.id} className="min-w-0 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="truncate font-semibold text-foreground"
                    title={category.name}
                  >
                    {category.name}
                  </p>
                  <p
                    className="mt-1 truncate text-xs text-muted-foreground"
                    title={category.slug}
                  >
                    {category.slug}
                  </p>
                </div>
                <StatusBadge className="shrink-0" label="Category" tone="neutral" />
              </div>
              <p
                className="mt-3 break-all text-xs text-muted-foreground"
                title={category.id}
              >
                {category.id}
              </p>
              {category.description !== undefined ? (
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                  {category.description}
                </p>
              ) : null}
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <dt>Created</dt>
                  <dd>{formatDateTime(category.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Updated</dt>
                  <dd>{formatDateTime(category.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SourceGroupsLoadingState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Loading Source Groups</CardTitle>
        <CardDescription>Reading source groups from Content Manager.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {["one", "two", "three"].map((row) => (
          <div
            key={row}
            className="grid min-w-0 animate-pulse gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0"
          >
            <div className="h-7 max-w-full rounded bg-muted sm:max-w-md" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted sm:col-span-2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SourceGroupsErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Source Groups Could Not Load</CardTitle>
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

function SourceGroupsEmptyState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>No Source Groups</CardTitle>
          <CardDescription>No source groups were returned.</CardDescription>
        </div>
        <StatusBadge label="Empty" tone="neutral" />
      </CardHeader>
    </Card>
  );
}

function CategoriesLoadingState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Loading Categories</CardTitle>
        <CardDescription>Reading categories from Content Manager.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {["one", "two", "three"].map((row) => (
          <div
            key={row}
            className="min-h-14 animate-pulse rounded border border-border bg-muted"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function CategoriesErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Categories Could Not Load</CardTitle>
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

function CategoriesEmptyState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>No Categories</CardTitle>
          <CardDescription>No content categories were returned.</CardDescription>
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

function getSourceGroupStatusTone(
  status: SourceGroupStatus,
): StatusBadgeTone {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "PAUSED") {
    return "warning";
  }

  return "neutral";
}

function getEntryRouteRiskTone(
  riskLevel: SourceGroupEntryRouteRiskLevel,
): StatusBadgeTone {
  if (riskLevel === "LOW") {
    return "success";
  }

  if (riskLevel === "MEDIUM") {
    return "warning";
  }

  return "danger";
}

function formatCount(count: number, singularLabel: string): string {
  return count === 1 ? `1 ${singularLabel}` : `${count} ${singularLabel}s`;
}

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The Content Manager request failed.";
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
