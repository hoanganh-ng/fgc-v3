import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import {
  useCollectionScheduleQuery,
  useCollectionSchedulesQuery,
} from "@/features/collector-runtime/collection-schedule-queries";
import { useUpsertCollectionScheduleMutation } from "@/features/collector-runtime/collection-schedule-mutations";
import {
  UpsertCollectionScheduleFormSchema,
  emptyScheduleFormValues,
  filterSchedulableSourceGroups,
  findSourceGroupById,
  formatLocalDateTimeSeconds,
  scheduleToFormValues,
  toUpsertCollectionScheduleRequest,
  type ParsedUpsertCollectionScheduleFormValues,
  type UpsertCollectionScheduleFormValues,
} from "@/features/collector-runtime/collection-schedule-view-model";
import { useSourceGroupsQuery } from "@/features/content-manager/content-manager-queries";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import { isApiResultError } from "@/lib/api/http-client";
import {
  type CollectionSchedule,
  DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
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

interface EditorState {
  readonly mode: "create" | "edit";
  readonly sourceGroupId: string;
}

const EMPTY_EDITOR: EditorState | null = null;

export function CollectionSchedulesPage(): JSX.Element {
  const [editor, setEditor] = useState<EditorState | null>(EMPTY_EDITOR);
  const [offset, setOffset] = useState(0);

  const schedulesQuery = useCollectionSchedulesQuery({
    limit: DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
    offset,
  });
  const sourceGroupsQuery = useSourceGroupsQuery({ limit: 200, offset: 0 });

  const schedules = schedulesQuery.data?.items ?? [];
  const total = schedulesQuery.data?.page.total;
  const sourceGroups: readonly SourceGroup[] =
    sourceGroupsQuery.data?.items ?? [];

  const schedulableSourceGroups = useMemo(
    () => filterSchedulableSourceGroups(sourceGroups),
    [sourceGroups],
  );

  useEffect(() => {
    setOffset(0);
  }, []);

  const canGoBack = offset > 0;
  const canGoNext =
    total !== undefined
      ? offset + schedules.length < total
      : schedules.length >= DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT;

  const startCreate = (): void => {
    setEditor({ mode: "create", sourceGroupId: "" });
  };

  const startEdit = (sourceGroupId: string): void => {
    setEditor({ mode: "edit", sourceGroupId });
  };

  const cancelEditor = (): void => {
    setEditor(EMPTY_EDITOR);
  };

  return (
    <PageShell
      eyebrow="Collector Runtime"
      title="Collection Schedules"
      description="Create, edit, enable, and disable per-source-group collection schedules. Disabling, not deletion, is the lifecycle mechanism."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void schedulesQuery.refetch();
            }}
            disabled={schedulesQuery.isFetching}
          >
            <RefreshCw
              aria-hidden="true"
              className={
                schedulesQuery.isFetching ? "size-4 animate-spin" : "size-4"
              }
            />
            <span>Refresh</span>
          </Button>
          <Button
            type="button"
            onClick={startCreate}
            disabled={editor?.mode === "create"}
          >
            <Plus aria-hidden="true" className="size-4" />
            <span>New schedule</span>
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Schedules</CardTitle>
            <CardDescription>
              One schedule per source group. Enabled schedules require an
              ACTIVE Facebook source group. Disabled schedules may reference
              PAUSED or ARCHIVED Facebook groups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackendErrorPanel
              error={schedulesQuery.error}
              fallbackMessage="Failed to load collection schedules."
            />
            {schedulesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading schedules…</p>
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No collection schedules yet. Create the first schedule for a
                Facebook source group.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Source group</th>
                      <th className="py-2 pr-3 font-medium">State</th>
                      <th className="py-2 pr-3 font-medium">Interval</th>
                      <th className="py-2 pr-3 font-medium">Next run</th>
                      <th className="py-2 pr-3 font-medium">Limits</th>
                      <th className="py-2 pr-3 font-medium">Updated</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <ScheduleRow
                        key={schedule.sourceGroupId}
                        schedule={schedule}
                        sourceGroup={findSourceGroupById(
                          sourceGroups,
                          schedule.sourceGroupId,
                        )}
                        isEditing={
                          editor?.mode === "edit" &&
                          editor.sourceGroupId === schedule.sourceGroupId
                        }
                        onEdit={() => {
                          startEdit(schedule.sourceGroupId);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {schedules.length === 0
                  ? "Showing 0 of 0"
                  : `Showing ${offset + 1}–${offset + schedules.length}${
                      total !== undefined ? ` of ${total}` : ""
                    }`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setOffset(Math.max(0, offset - DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT));
                  }}
                  disabled={!canGoBack || schedulesQuery.isFetching}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setOffset(offset + DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT);
                  }}
                  disabled={!canGoNext || schedulesQuery.isFetching}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {editor === null
                ? "Schedule details"
                : editor.mode === "create"
                  ? "Create schedule"
                  : "Edit schedule"}
            </CardTitle>
            <CardDescription>
              {editor === null
                ? "Choose New schedule to create a record, or Edit on a row to load one here."
                : "Path is the only place sourceGroupId appears. Datetimes are absolute ISO with offset."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editor === null ? (
              <p className="text-sm text-muted-foreground">
                No schedule selected.
              </p>
            ) : (
              <ScheduleEditor
                key={editor.sourceGroupId || "new"}
                state={editor}
                sourceGroups={schedulableSourceGroups}
                onCancel={cancelEditor}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

interface ScheduleRowProps {
  readonly schedule: CollectionSchedule;
  readonly sourceGroup: SourceGroup | undefined;
  readonly isEditing: boolean;
  readonly onEdit: () => void;
}

function ScheduleRow({
  schedule,
  sourceGroup,
  isEditing,
  onEdit,
}: ScheduleRowProps): JSX.Element {
  const sourceGroupName = sourceGroup?.name ?? "(unknown source group)";
  const sourceGroupStatus = sourceGroup?.status;
  const sourceGroupIdLabel = sourceGroup?.id ?? schedule.sourceGroupId;

  return (
    <tr className="border-b border-border align-top">
      <td className="py-3 pr-3">
        <div className="font-medium text-foreground">{sourceGroupName}</div>
        <div className="text-xs text-muted-foreground">
          id: {sourceGroupIdLabel}
        </div>
        {sourceGroupStatus !== undefined ? (
          <div className="mt-1">
            <StatusBadge
              label={sourceGroupStatus}
              tone={sourceGroupStatusTone(sourceGroupStatus)}
            />
          </div>
        ) : null}
      </td>
      <td className="py-3 pr-3">
        <StatusBadge
          label={schedule.enabled ? "Enabled" : "Disabled"}
          tone={schedule.enabled ? "success" : "neutral"}
        />
      </td>
      <td className="py-3 pr-3 text-sm text-foreground">
        {schedule.intervalMinutes} min
      </td>
      <td className="py-3 pr-3 text-sm text-foreground">
        {formatLocalDateTimeSeconds(schedule.nextRunAt)}
      </td>
      <td className="py-3 pr-3 text-xs text-muted-foreground">
        {formatLimits(schedule)}
      </td>
      <td className="py-3 pr-3 text-xs text-muted-foreground">
        {formatLocalDateTimeSeconds(schedule.updatedAt)}
      </td>
      <td className="py-3 pr-3 text-right">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onEdit}
          disabled={isEditing}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          <span>Edit</span>
        </Button>
      </td>
    </tr>
  );
}

function formatLimits(schedule: CollectionSchedule): string {
  const parts: string[] = [];
  if (schedule.parameters.maxScrolls !== undefined) {
    parts.push(`max scrolls: ${schedule.parameters.maxScrolls}`);
  }
  if (schedule.parameters.maxDurationMs !== undefined) {
    parts.push(`max duration: ${schedule.parameters.maxDurationMs} ms`);
  }
  return parts.length === 0 ? "—" : parts.join(" · ");
}

function sourceGroupStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PAUSED":
      return "warning";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

interface ScheduleEditorProps {
  readonly state: EditorState;
  readonly sourceGroups: readonly SourceGroup[];
  readonly onCancel: () => void;
}

function ScheduleEditor({
  state,
  sourceGroups,
  onCancel,
}: ScheduleEditorProps): JSX.Element {
  const isEdit = state.mode === "edit";
  const detailQuery = useCollectionScheduleQuery(
    isEdit ? state.sourceGroupId : "",
  );
  const mutation = useUpsertCollectionScheduleMutation();
  const [validationSummary, setValidationSummary] = useState<string | undefined>(
    undefined,
  );

  const form = useForm<UpsertCollectionScheduleFormValues>({
    defaultValues: emptyScheduleFormValues(state.sourceGroupId),
  });

  useEffect(() => {
    if (isEdit) {
      if (detailQuery.data) {
        form.reset(scheduleToFormValues(detailQuery.data.collectionSchedule));
      }
      return;
    }
    form.reset(emptyScheduleFormValues(state.sourceGroupId));
  }, [detailQuery.data, form, isEdit, state.sourceGroupId]);

  function submit(raw: UpsertCollectionScheduleFormValues): void {
    setValidationSummary(undefined);
    mutation.reset();
    const parsed = UpsertCollectionScheduleFormSchema.safeParse(raw);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Schedule input is invalid.",
      );
      return;
    }
    const values: ParsedUpsertCollectionScheduleFormValues = parsed.data;
    const targetSourceGroupId =
      isEdit ? state.sourceGroupId : values.sourceGroupId.trim();

    if (targetSourceGroupId.length === 0) {
      form.setError("sourceGroupId", {
        type: "manual",
        message: "Source group is required.",
      });
      return;
    }

    mutation.mutate(
      {
        sourceGroupId: targetSourceGroupId,
        request: toUpsertCollectionScheduleRequest(values),
      },
      {
        onSuccess: () => {
          onCancel();
        },
      },
    );
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    void form.handleSubmit(submit)(event);
  };

  const submitError = mutation.error;

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
      <BackendErrorPanel
        error={submitError}
        fallbackMessage="Could not save the schedule."
      />
      {validationSummary !== undefined ? (
        <p
          role="alert"
          className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-3 py-2 text-xs text-[#7f1d1d]"
        >
          {validationSummary}
        </p>
      ) : null}
      {isEdit ? (
        <FormField label="Source group (locked)">
          <Input value={state.sourceGroupId} readOnly disabled />
          <p className="text-xs text-muted-foreground">
            Source group is locked while editing. To move a schedule, disable
            this one and create a new schedule.
          </p>
        </FormField>
      ) : (
        <FormField
          label="Source group"
          htmlFor="schedule-source-group"
          error={form.formState.errors.sourceGroupId?.message}
        >
          <Select
            id="schedule-source-group"
            value={form.watch("sourceGroupId")}
            onChange={(event) => {
              form.setValue("sourceGroupId", event.target.value, {
                shouldDirty: true,
              });
            }}
            disabled={sourceGroups.length === 0}
          >
            <option value="">Select a Facebook source group…</option>
            {sourceGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {group.status} · {group.id}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Enabled"
          htmlFor="schedule-enabled"
          error={form.formState.errors.enabled?.message}
        >
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              id="schedule-enabled"
              type="checkbox"
              checked={form.watch("enabled")}
              onChange={(event) => {
                form.setValue("enabled", event.target.checked, {
                  shouldDirty: true,
                });
              }}
              className="size-4 rounded border border-border"
            />
            <span>Schedule runs dispatch polls.</span>
          </label>
        </FormField>
        <FormField
          label="Interval (minutes)"
          htmlFor="schedule-interval"
          error={form.formState.errors.intervalMinutes?.message}
        >
          <Input
            id="schedule-interval"
            type="number"
            inputMode="numeric"
            min={1}
            max={10080}
            step={1}
            value={form.watch("intervalMinutes") ?? ""}
            onChange={(event) => {
              form.setValue("intervalMinutes", event.target.value, {
                shouldDirty: true,
              });
            }}
          />
        </FormField>
      </div>

      <FormField
        label="Next run (operator local time)"
        htmlFor="schedule-next-run"
        error={form.formState.errors.nextRunAtLocal?.message}
      >
        <Input
          id="schedule-next-run"
          type="datetime-local"
          value={form.watch("nextRunAtLocal")}
          onChange={(event) => {
            form.setValue("nextRunAtLocal", event.target.value, {
              shouldDirty: true,
            });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Sent to the API as an absolute ISO datetime with offset; rendered
          back in your local timezone.
        </p>
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Max scrolls (optional)"
          htmlFor="schedule-max-scrolls"
          error={form.formState.errors.maxScrolls?.message}
        >
          <Input
            id="schedule-max-scrolls"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.watch("maxScrolls") ?? ""}
            onChange={(event) => {
              form.setValue("maxScrolls", event.target.value, {
                shouldDirty: true,
              });
            }}
          />
        </FormField>
        <FormField
          label="Max duration ms (optional)"
          htmlFor="schedule-max-duration"
          error={form.formState.errors.maxDurationMs?.message}
        >
          <Input
            id="schedule-max-duration"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.watch("maxDurationMs") ?? ""}
            onChange={(event) => {
              form.setValue("maxDurationMs", event.target.value, {
                shouldDirty: true,
              });
            }}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          <X aria-hidden="true" className="size-4" />
          <span>Cancel</span>
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          <span>{isEdit ? "Save changes" : "Create schedule"}</span>
        </Button>
      </div>
      {isEdit && detailQuery.error !== null && detailQuery.error !== undefined ? (
        <p className="text-xs text-[#7f1d1d]">
          {isApiResultError(detailQuery.error)
            ? getErrorMessage(detailQuery.error)
            : "Failed to load the existing schedule."}
        </p>
      ) : null}
    </form>
  );
}
