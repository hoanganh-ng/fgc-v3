import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Archive, FileText, Pencil, Plus, RefreshCw } from "lucide-react";
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
} from "@/features/profiles/profile-form-support";
import {
  useArchiveTransformTypeMutation,
  useCreateTransformTypeMutation,
  useUpdateTransformTypeMutation,
} from "@/features/content-builder/content-builder-mutations";
import { useTransformTypesQuery } from "@/features/content-builder/content-builder-queries";
import {
  TransformTypeStatusSchema,
  type TransformType,
  type TransformTypeStatus,
} from "@/lib/api/content-builder-client";
import { PageShell } from "@/pages/page-shell";

const FILTER_OPTIONS = ["ACTIVE", "ARCHIVED", "ALL"] as const;
type TransformTypeFilter = (typeof FILTER_OPTIONS)[number];

const TransformTypeFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    description: z.string().trim(),
    initialPrompt: z.string().trim().min(1, "Initial prompt is required."),
  })
  .strict();

type TransformTypeFormValues = z.infer<typeof TransformTypeFormSchema>;

const emptyFormValues = {
  name: "",
  description: "",
  initialPrompt: "",
} satisfies TransformTypeFormValues;

export function TransformTypesPage(): JSX.Element {
  const [statusFilter, setStatusFilter] =
    useState<TransformTypeFilter>("ACTIVE");
  const [editingTransformTypeId, setEditingTransformTypeId] = useState<
    string | null
  >(null);
  const query = useMemo(
    () => ({
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      limit: 100,
      offset: 0,
    }),
    [statusFilter],
  );
  const transformTypesQuery = useTransformTypesQuery(query);
  const createTransformType = useCreateTransformTypeMutation();
  const updateTransformType = useUpdateTransformTypeMutation();
  const archiveTransformType = useArchiveTransformTypeMutation();
  const editingTransformType =
    transformTypesQuery.data?.items.find(
      (transformType) =>
        transformType.transformTypeId === editingTransformTypeId,
    ) ?? null;
  const form = useForm<TransformTypeFormValues>({
    defaultValues: emptyFormValues,
  });
  const isEditing = editingTransformType !== null;
  const activeMutationError =
    createTransformType.error ??
    updateTransformType.error ??
    archiveTransformType.error;

  useEffect(() => {
    form.reset(
      editingTransformType === null
        ? emptyFormValues
        : {
            name: editingTransformType.name,
            description: editingTransformType.description ?? "",
            initialPrompt: editingTransformType.initialPrompt,
          },
    );
  }, [editingTransformType, form]);

  function refresh(): void {
    void transformTypesQuery.refetch();
  }

  function resetForm(): void {
    setEditingTransformTypeId(null);
    createTransformType.reset();
    updateTransformType.reset();
    archiveTransformType.reset();
    form.reset(emptyFormValues);
  }

  function submit(values: TransformTypeFormValues): void {
    const result = TransformTypeFormSchema.safeParse(values);

    createTransformType.reset();
    updateTransformType.reset();

    if (!result.success) {
      applyZodFieldErrors(result.error, form.setError);
      return;
    }

    const request = toTransformTypeRequest(result.data);

    if (editingTransformType === null) {
      void createTransformType
        .mutateAsync(request)
        .then(() => {
          resetForm();
        })
        .catch(() => undefined);
      return;
    }

    void updateTransformType
      .mutateAsync({
        transformTypeId: editingTransformType.transformTypeId,
        request: {
          ...request,
          ...(request.description === undefined
            ? { description: null }
            : {}),
        },
      })
      .catch(() => undefined);
  }

  function archiveSelected(transformType: TransformType): void {
    archiveTransformType.reset();
    void archiveTransformType
      .mutateAsync({ transformTypeId: transformType.transformTypeId })
      .then(() => {
        setEditingTransformTypeId(null);
      })
      .catch(() => undefined);
  }

  const items = transformTypesQuery.data?.items ?? [];

  return (
    <PageShell
      eyebrow="Content Builder"
      title="Transform Types"
      description="Create and manage reusable initial transform prompts for future brief and producer workflows."
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid min-w-0 gap-5">
          <Card className="min-w-0">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle>Catalog</CardTitle>
                <CardDescription>
                  {formatCount(
                    transformTypesQuery.data?.page.total ?? items.length,
                    "transform type",
                  )}
                </CardDescription>
              </div>
              <div className="w-full sm:w-48">
                <Select
                  aria-label="Status filter"
                  value={statusFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStatusFilter(
                      value === "ALL"
                        ? "ALL"
                        : TransformTypeStatusSchema.parse(value),
                    );
                    setEditingTransformTypeId(null);
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="ALL">All statuses</option>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {transformTypesQuery.isPending ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  Loading transform types...
                </div>
              ) : null}
              {transformTypesQuery.isError ? (
                <div className="px-4 pb-4">
                  <BackendErrorPanel
                    error={transformTypesQuery.error}
                    fallbackMessage="Transform types could not be loaded."
                  />
                </div>
              ) : null}
              {transformTypesQuery.isSuccess && items.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  No transform types match the current filter.
                </div>
              ) : null}
              {items.length > 0 ? (
                <div className="divide-y divide-border">
                  {items.map((transformType) => (
                    <TransformTypeRow
                      key={transformType.transformTypeId}
                      isSelected={
                        transformType.transformTypeId === editingTransformTypeId
                      }
                      onEdit={() => {
                        setEditingTransformTypeId(
                          transformType.transformTypeId,
                        );
                      }}
                      transformType={transformType}
                    />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>
                  {isEditing ? "Edit Transform Type" : "Create Transform Type"}
                </CardTitle>
                <CardDescription>
                  {isEditing
                    ? "Update catalog metadata and the reusable initial prompt."
                    : "Define a reusable initial prompt. It is stored only; it is not executed."}
                </CardDescription>
              </div>
              <div className="grid size-10 place-items-center rounded border border-border bg-muted text-primary">
                {isEditing ? (
                  <Pencil aria-hidden="true" className="size-4" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(submit)}
            >
              <BackendErrorPanel
                error={activeMutationError}
                fallbackMessage="Transform type save failed."
              />
              <FormField
                htmlFor="transform-type-name"
                label="Name"
                error={form.formState.errors.name?.message}
              >
                <Input
                  id="transform-type-name"
                  autoComplete="off"
                  {...form.register("name")}
                />
              </FormField>
              <FormField
                htmlFor="transform-type-description"
                label="Description"
                error={form.formState.errors.description?.message}
              >
                <Input
                  id="transform-type-description"
                  autoComplete="off"
                  {...form.register("description")}
                />
              </FormField>
              <FormField
                htmlFor="transform-type-prompt"
                label="Initial Prompt"
                error={form.formState.errors.initialPrompt?.message}
              >
                <Textarea
                  id="transform-type-prompt"
                  className="min-h-56 font-mono"
                  {...form.register("initialPrompt")}
                />
              </FormField>
              {editingTransformType !== null ? (
                <div className="rounded border border-border bg-muted/45 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Prompt Preview
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {editingTransformType.initialPrompt}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={
                    createTransformType.isPending ||
                    updateTransformType.isPending
                  }
                >
                  {isEditing ? "Save Changes" : "Create"}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Clear
                </Button>
                {editingTransformType !== null &&
                editingTransformType.status === "ACTIVE" ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={archiveTransformType.isPending}
                    onClick={() => archiveSelected(editingTransformType)}
                  >
                    <Archive aria-hidden="true" className="size-4" />
                    Archive
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function TransformTypeRow({
  transformType,
  isSelected,
  onEdit,
}: {
  readonly transformType: TransformType;
  readonly isSelected: boolean;
  readonly onEdit: () => void;
}): JSX.Element {
  return (
    <article
      className={
        isSelected
          ? "grid min-w-0 gap-3 bg-[#fffaf0] px-4 py-5"
          : "grid min-w-0 gap-3 px-4 py-5"
      }
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {transformType.name}
            </h3>
            <StatusBadge
              label={transformType.status}
              tone={getStatusTone(transformType.status)}
            />
          </div>
          {transformType.description !== undefined ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {transformType.description}
            </p>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Pencil aria-hidden="true" className="size-4" />
          {isSelected ? "Editing" : "Edit"}
        </Button>
      </div>
      <div className="rounded border border-border bg-muted/45 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <FileText aria-hidden="true" className="size-3.5" />
          Prompt Preview
        </div>
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
          {transformType.initialPrompt}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Created {formatDateTime(transformType.createdAt)}</span>
        <span>Updated {formatDateTime(transformType.updatedAt)}</span>
      </div>
    </article>
  );
}

function toTransformTypeRequest(values: TransformTypeFormValues): {
  readonly name: string;
  readonly description?: string;
  readonly initialPrompt: string;
} {
  const description = values.description.trim();

  return {
    name: values.name.trim(),
    ...(description.length > 0 ? { description } : {}),
    initialPrompt: values.initialPrompt.trim(),
  };
}

function getStatusTone(status: TransformTypeStatus): StatusBadgeTone {
  return status === "ACTIVE" ? "success" : "neutral";
}

function formatCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
