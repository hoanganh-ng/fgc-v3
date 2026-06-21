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
  useProfileHomeFeedCollectionScheduleQuery,
  useProfileHomeFeedCollectionSchedulesQuery,
} from "@/features/collector-runtime/profile-home-feed-collection-schedule-queries";
import { useUpsertProfileHomeFeedCollectionScheduleMutation } from "@/features/collector-runtime/profile-home-feed-collection-schedule-mutations";
import {
  UpsertProfileHomeFeedCollectionScheduleFormSchema,
  emptyProfileHomeFeedScheduleFormValues,
  formatLocalDateTimeSeconds,
  profileHomeFeedScheduleToFormValues,
  resolveProfileHomeFeedScheduleSubmit,
  toUpsertProfileHomeFeedCollectionScheduleRequest,
  type ParsedUpsertProfileHomeFeedCollectionScheduleFormValues,
  type UpsertProfileHomeFeedCollectionScheduleFormValues,
} from "@/features/collector-runtime/profile-home-feed-collection-schedule-view-model";
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
import { isApiResultError } from "@/lib/api/http-client";
import { collectorRuntimeClient } from "@/lib/api/collector-runtime-client";
import {
  type ProfileHomeFeedCollectionSchedule,
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
  type ProfileHomeFeedCollectionScheduleDispatchStatus,
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

interface EditorState {
  readonly mode: "create" | "edit";
  readonly profileId: string;
}

const EMPTY_EDITOR: EditorState | null = null;

export const PROFILES_QUERY = {
  limit: 100,
  offset: 0,
} as const;

export function ProfileHomeFeedCollectionSchedulesPage(): JSX.Element {
  const [editor, setEditor] = useState<EditorState | null>(EMPTY_EDITOR);
  const [offset, setOffset] = useState(0);

  const schedulesQuery = useProfileHomeFeedCollectionSchedulesQuery({
    limit: DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
    offset,
  });
  const profilesQuery = useProfilesQuery(PROFILES_QUERY);

  const schedules = schedulesQuery.data?.items ?? [];
  const total = schedulesQuery.data?.page.total;
  const profiles: readonly ProfileSummary[] = profilesQuery.data?.items ?? [];

  const hasPartialProfileInventory = useMemo(() => {
    if (!profilesQuery.data) {
      return false;
    }
    const total = profilesQuery.data.page.total;
    return total !== undefined && total > profilesQuery.data.items.length;
  }, [profilesQuery.data]);

  useEffect(() => {
    setOffset(0);
  }, []);

  const canGoBack = offset > 0;
  const canGoNext =
    total !== undefined
      ? offset + schedules.length < total
      : schedules.length >=
        DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT;

  const startCreate = (): void => {
    setEditor({ mode: "create", profileId: "" });
  };

  const startEdit = (profileId: string): void => {
    setEditor({ mode: "edit", profileId });
  };

  const cancelEditor = (): void => {
    setEditor(EMPTY_EDITOR);
  };

  return (
    <PageShell
      eyebrow="Collector Runtime"
      title="Home Feed Schedules"
      description="Create, edit, enable, and disable profile-bound Facebook home-feed collection schedules. Disabling, not deletion, is the lifecycle mechanism."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void schedulesQuery.refetch();
              void profilesQuery.refetch();
            }}
            disabled={schedulesQuery.isFetching || profilesQuery.isFetching}
          >
            <RefreshCw
              aria-hidden="true"
              className={
                schedulesQuery.isFetching || profilesQuery.isFetching
                  ? "size-4 animate-spin"
                  : "size-4"
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
              One schedule per profile. Profile metadata is loaded from the safe
              Profile Manager summary endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackendErrorPanel
              error={schedulesQuery.error}
              fallbackMessage="Failed to load profile home-feed collection schedules."
            />
            {schedulesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading schedules…</p>
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No profile home-feed collection schedules yet. Create the first
                schedule for a profile.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Profile</th>
                      <th className="py-2 pr-3 font-medium">State</th>
                      <th className="py-2 pr-3 font-medium">Interval</th>
                      <th className="py-2 pr-3 font-medium">Next run</th>
                      <th className="py-2 pr-3 font-medium">Limits</th>
                      <th className="py-2 pr-3 font-medium">Dispatch</th>
                      <th className="py-2 pr-3 font-medium">Updated</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <ScheduleRow
                        key={schedule.profileId}
                        schedule={schedule}
                        profile={profiles.find(
                          (profile) => profile.id === schedule.profileId,
                        )}
                        isEditing={
                          editor?.mode === "edit" &&
                          editor.profileId === schedule.profileId
                        }
                        onEdit={() => {
                          startEdit(schedule.profileId);
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
                    setOffset(
                      Math.max(
                        0,
                        offset -
                          DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
                      ),
                    );
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
                    setOffset(
                      offset +
                        DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
                    );
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
                : "Path is the only place profileId appears. Datetimes are absolute ISO with offset."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPartialProfileInventory ? (
              <div
                role="status"
                className="mb-4 rounded border border-[#dfc36e] bg-[#fff7dc] px-4 py-3 text-sm font-medium text-[#76591a]"
                data-testid="profile-partial-warning"
              >
                The selector contains only a partial profile inventory. Some
                profiles may be missing.
              </div>
            ) : null}
            {editor === null ? (
              <p className="text-sm text-muted-foreground">
                No schedule selected.
              </p>
            ) : (
              <ScheduleEditor
                key={editor.profileId || "new"}
                state={editor}
                profiles={profiles}
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
  readonly schedule: ProfileHomeFeedCollectionSchedule;
  readonly profile: ProfileSummary | undefined;
  readonly isEditing: boolean;
  readonly onEdit: () => void;
}

function ScheduleRow({
  schedule,
  profile,
  isEditing,
  onEdit,
}: ScheduleRowProps): JSX.Element {
  const profileName = profile?.displayName ?? "(unknown profile)";
  const profileStatus = profile?.status;
  const accountStage = profile?.accountStage;
  const authHealth = profile?.authenticationHealth;

  return (
    <tr className="border-b border-border align-top">
      <td className="py-3 pr-3">
        <div className="font-medium text-foreground">{profileName}</div>
        <div className="text-xs text-muted-foreground">
          id: {schedule.profileId}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {profileStatus !== undefined ? (
            <ProfileStatusBadge status={profileStatus} />
          ) : null}
          {accountStage !== undefined ? (
            <ProfileAccountStageBadge accountStage={accountStage} />
          ) : null}
          {authHealth !== undefined ? (
            <ProfileAuthenticationHealthBadge health={authHealth} />
          ) : null}
        </div>
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
        {schedule.lastDispatchStatus === undefined ? (
          "—"
        ) : (
          <StatusBadge
            label={schedule.lastDispatchStatus}
            tone={dispatchStatusTone(schedule.lastDispatchStatus)}
          />
        )}
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

function formatLimits(schedule: ProfileHomeFeedCollectionSchedule): string {
  const parts: string[] = [];
  if (schedule.parameters.maxScrolls !== undefined) {
    parts.push(`max scrolls: ${schedule.parameters.maxScrolls}`);
  }
  if (schedule.parameters.maxDurationMs !== undefined) {
    parts.push(`max duration: ${schedule.parameters.maxDurationMs} ms`);
  }
  if (schedule.parameters.maxPosts !== undefined) {
    parts.push(`max posts: ${schedule.parameters.maxPosts}`);
  }
  return parts.length === 0 ? "—" : parts.join(" · ");
}

function dispatchStatusTone(
  status: ProfileHomeFeedCollectionScheduleDispatchStatus,
): StatusBadgeTone {
  switch (status) {
    case "DISPATCHED":
      return "success";
    case "SKIPPED_ACTIVE_RUN":
      return "neutral";
    case "PROFILE_NOT_FOUND":
    case "PROFILE_LOOKUP_FAILED":
      return "warning";
    default:
      return "neutral";
  }
}

interface ScheduleEditorProps {
  readonly state: EditorState;
  readonly profiles: readonly ProfileSummary[];
  readonly onCancel: () => void;
}

export function ScheduleEditor({
  state,
  profiles,
  onCancel,
}: ScheduleEditorProps): JSX.Element {
  const isEdit = state.mode === "edit";
  const profilesQuery = useProfilesQuery(PROFILES_QUERY);
  const detailQuery = useProfileHomeFeedCollectionScheduleQuery(
    isEdit ? state.profileId : "",
  );
  const mutation = useUpsertProfileHomeFeedCollectionScheduleMutation();
  const [validationSummary, setValidationSummary] = useState<string | undefined>(
    undefined,
  );
  const [conflictMessage, setConflictMessage] = useState<string | undefined>(
    undefined,
  );
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  const form = useForm<UpsertProfileHomeFeedCollectionScheduleFormValues>({
    defaultValues: emptyProfileHomeFeedScheduleFormValues(state.profileId),
  });

  useEffect(() => {
    setConflictMessage(undefined);
    if (isEdit) {
      if (detailQuery.data) {
        form.reset(
          profileHomeFeedScheduleToFormValues(
            detailQuery.data.schedule,
          ),
        );
      }
      return;
    }
    form.reset(emptyProfileHomeFeedScheduleFormValues(state.profileId));
  }, [detailQuery.data, form, isEdit, state.profileId]);

  if (isEdit && detailQuery.isPending) {
    return (
      <div
        className="flex flex-col gap-3"
        role="status"
        aria-live="polite"
        data-testid="profile-home-feed-schedule-detail-loading"
      >
        <p className="text-sm font-medium text-foreground">
          Loading existing schedule…
        </p>
        <div className="h-16 animate-pulse rounded border border-border bg-muted" />
        <div className="h-16 animate-pulse rounded border border-border bg-muted" />
        <div className="h-16 animate-pulse rounded border border-border bg-muted" />
      </div>
    );
  }

  if (isEdit && detailQuery.isError) {
    const detailMessage =
      getErrorMessage(detailQuery.error) ||
      (isApiResultError(detailQuery.error)
        ? detailQuery.error.message
        : "Failed to load the existing schedule.");
    return (
      <div
        className="flex flex-col gap-3"
        data-testid="profile-home-feed-schedule-detail-error"
      >
        <div className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm text-[#7f1d1d]">
          <p className="font-semibold">{detailMessage}</p>
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void detailQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            <span>Retry</span>
          </Button>
        </div>
      </div>
    );
  }

  async function submit(
    raw: UpsertProfileHomeFeedCollectionScheduleFormValues,
  ): Promise<void> {
    setValidationSummary(undefined);
    setConflictMessage(undefined);
    mutation.reset();
    const parsed =
      UpsertProfileHomeFeedCollectionScheduleFormSchema.safeParse(raw);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Schedule input is invalid.",
      );
      return;
    }
    const values: ParsedUpsertProfileHomeFeedCollectionScheduleFormValues =
      parsed.data;
    const targetProfileId = isEdit
      ? state.profileId
      : values.profileId.trim();

    if (targetProfileId.length === 0) {
      form.setError("profileId", {
        type: "manual",
        message: "Profile is required.",
      });
      return;
    }

    if (!isEdit) {
      setIsCheckingConflict(true);
      const outcome = await resolveProfileHomeFeedScheduleSubmit({
        mode: "create",
        profileId: targetProfileId,
        fetchSchedule: () =>
          collectorRuntimeClient.getProfileHomeFeedCollectionSchedule(
            targetProfileId,
          ),
      });
      setIsCheckingConflict(false);
      if (outcome.status === "exists") {
        setConflictMessage(outcome.message);
        return;
      }
      if (outcome.status === "error") {
        setConflictMessage(outcome.message);
        return;
      }
    }

    mutation.mutate(
      {
        profileId: targetProfileId,
        request: toUpsertProfileHomeFeedCollectionScheduleRequest(values),
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

  const isSubmitting = mutation.isPending || isCheckingConflict;

  const submitError = mutation.error;
  const profilesQueryUnavailable =
    profilesQuery.isError || profilesQuery.isPending;

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
      {conflictMessage !== undefined ? (
        <p
          role="alert"
          data-testid="profile-home-feed-schedule-create-conflict"
          className="rounded border border-[#dfc36e] bg-[#fff7dc] px-3 py-2 text-xs text-[#76591a]"
        >
          {conflictMessage}
        </p>
      ) : null}
      {isEdit ? (
        <FormField label="Profile (locked)">
          <Input value={state.profileId} readOnly disabled />
          <p className="text-xs text-muted-foreground">
            Profile is locked while editing. To move a schedule, disable this
            one and create a new schedule.
          </p>
        </FormField>
      ) : (
        <FormField
          label="Profile"
          htmlFor="profile-home-feed-schedule-profile"
          error={form.formState.errors.profileId?.message}
        >
          {profilesQuery.isPending ? (
            <div
              className="space-y-2"
              role="status"
              aria-live="polite"
              data-testid="profile-loading"
            >
              <div className="h-9 animate-pulse rounded border border-border bg-muted" />
              <p className="text-xs text-muted-foreground">
                Loading profiles…
              </p>
            </div>
          ) : profilesQuery.isError ? (
            <div className="space-y-2" data-testid="profile-error">
              <div className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm text-[#7f1d1d]">
                <p className="font-semibold">
                  {getErrorMessage(profilesQuery.error) ||
                    "Failed to load profiles."}
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void profilesQuery.refetch();
                  }}
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : profiles.length === 0 ? (
            <div
              className="rounded border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
              data-testid="profile-empty"
            >
              No profiles are available. Create one from the Profile Manager
              before adding a schedule.
            </div>
          ) : (
            <Select
              id="profile-home-feed-schedule-profile"
              value={form.watch("profileId")}
              onChange={(event) => {
                form.setValue("profileId", event.target.value, {
                  shouldDirty: true,
                });
              }}
              disabled={profilesQueryUnavailable}
            >
              <option value="">Select a profile…</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} · {profile.accountStage} ·{" "}
                  {profile.id}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Enabled"
          htmlFor="profile-home-feed-schedule-enabled"
          error={form.formState.errors.enabled?.message}
        >
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              id="profile-home-feed-schedule-enabled"
              type="checkbox"
              checked={form.watch("enabled")}
              onChange={(event) => {
                form.setValue("enabled", event.target.checked, {
                  shouldDirty: true,
                });
              }}
              className="size-4 rounded border border-border"
            />
            <span>Schedule drives dispatched home-feed runs.</span>
          </label>
        </FormField>
        <FormField
          label="Interval (minutes)"
          htmlFor="profile-home-feed-schedule-interval"
          error={form.formState.errors.intervalMinutes?.message}
        >
          <Input
            id="profile-home-feed-schedule-interval"
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
        htmlFor="profile-home-feed-schedule-next-run"
        error={form.formState.errors.nextRunAtLocal?.message}
      >
        <Input
          id="profile-home-feed-schedule-next-run"
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

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          label="Max scrolls (optional)"
          htmlFor="profile-home-feed-schedule-max-scrolls"
          error={form.formState.errors.maxScrolls?.message}
        >
          <Input
            id="profile-home-feed-schedule-max-scrolls"
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
          htmlFor="profile-home-feed-schedule-max-duration"
          error={form.formState.errors.maxDurationMs?.message}
        >
          <Input
            id="profile-home-feed-schedule-max-duration"
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
        <FormField
          label="Max posts (optional)"
          htmlFor="profile-home-feed-schedule-max-posts"
          error={form.formState.errors.maxPosts?.message}
        >
          <Input
            id="profile-home-feed-schedule-max-posts"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.watch("maxPosts") ?? ""}
            onChange={(event) => {
              form.setValue("maxPosts", event.target.value, {
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
          disabled={isSubmitting}
        >
          <X aria-hidden="true" className="size-4" />
          <span>Cancel</span>
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            (isEdit &&
              (detailQuery.isPending || detailQuery.isError))
          }
        >
          {isSubmitting ? (
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          <span>{isEdit ? "Save changes" : "Create schedule"}</span>
        </Button>
      </div>
    </form>
  );
}
