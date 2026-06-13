import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
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
import { useSourceGroupsQuery } from "@/features/content-manager/content-manager-queries";
import { useUpsertProfileSourceAccessMutation } from "@/features/profiles/profile-mutations";
import { useProfileSourceAccessQuery } from "@/features/profiles/profile-queries";
import {
  getProfileSourceAccessStateLabel,
  ProfileSourceAccessStateBadge,
} from "@/features/profiles/profile-source-access-state-badge";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import { isApiResultError } from "@/lib/api/http-client";
import {
  ProfileSourceAccessStateSchema,
  type ProfileSourceAccess,
  type ProfileSourceAccessState,
  type UpsertProfileSourceAccessRequest,
} from "@/lib/api/profile-manager-client";
import type {
  SourceGroup,
  SourceGroupStatus,
} from "@/lib/api/content-manager-client";

const failureCodePattern = /^[A-Z0-9_:-]+$/;
const successfulAccessStates = [
  "PUBLIC_ACCESSIBLE",
  "JOINED_ACCESSIBLE",
] as const satisfies readonly ProfileSourceAccessState[];
const profileSourceAccessStates = ProfileSourceAccessStateSchema.options;

const ProfileSourceAccessEditorSchema = z
  .object({
    sourceGroupId: z.string().trim().min(1, "Source group is required."),
    accessState: ProfileSourceAccessStateSchema,
    failureReasonCode: z.string(),
    failureReasonMessage: z.string(),
    notes: z.string().max(2000, "Notes must be at most 2000 characters."),
  })
  .strict()
  .superRefine((value, context) => {
    if (isSuccessfulAccessState(value.accessState)) {
      return;
    }

    const code = value.failureReasonCode.trim();
    const message = value.failureReasonMessage.trim();

    if (code.length > 64) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failureReasonCode"],
        message: "Failure reason code must be at most 64 characters.",
      });
    }

    if (code.length > 0 && !failureCodePattern.test(code)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failureReasonCode"],
        message: "Use uppercase letters, numbers, underscores, colons, or hyphens.",
      });
    }

    if (message.length > 500) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failureReasonMessage"],
        message: "Failure reason message must be at most 500 characters.",
      });
    }

    if ((code.length === 0) !== (message.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failureReasonCode"],
        message: "Failure reason code and message must be provided together.",
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failureReasonMessage"],
        message: "Failure reason code and message must be provided together.",
      });
    }
  });

type ProfileSourceAccessEditorValues = z.infer<
  typeof ProfileSourceAccessEditorSchema
>;

export function ProfileSourceAccessCard({
  profileId,
}: {
  readonly profileId: string;
}): JSX.Element {
  const accessQuery = useProfileSourceAccessQuery(profileId);
  const sourceGroupsQuery = useSourceGroupsQuery();
  const upsertAccess = useUpsertProfileSourceAccessMutation();
  const [validationSummary, setValidationSummary] = useState<string>();
  const [savedSourceGroupId, setSavedSourceGroupId] = useState<string>();
  const sourceGroups = sourceGroupsQuery.isSuccess
    ? sourceGroupsQuery.data.items
    : [];
  const accessRecords = accessQuery.data?.items ?? [];
  const sourceGroupById = useMemo(
    () => new Map(sourceGroups.map((sourceGroup) => [sourceGroup.id, sourceGroup])),
    [sourceGroups],
  );
  const accessBySourceGroupId = useMemo(
    () =>
      new Map(
        accessRecords.map((accessRecord) => [
          accessRecord.sourceGroupId,
          accessRecord,
        ]),
      ),
    [accessRecords],
  );
  const sortedSourceGroups = useMemo(
    () =>
      [...sourceGroups].sort((first, second) =>
        compareSourceGroupLabels(first, second),
      ),
    [sourceGroups],
  );
  const sortedRows = useMemo(
    () =>
      accessRecords
        .map((accessRecord) => ({
          accessRecord,
          sourceGroup: sourceGroupById.get(accessRecord.sourceGroupId),
        }))
        .sort((first, second) => {
          const firstName =
            first.sourceGroup?.name ?? first.accessRecord.sourceGroupId;
          const secondName =
            second.sourceGroup?.name ?? second.accessRecord.sourceGroupId;
          const nameComparison = firstName.localeCompare(secondName);

          if (nameComparison !== 0) {
            return nameComparison;
          }

          return first.accessRecord.sourceGroupId.localeCompare(
            second.accessRecord.sourceGroupId,
          );
        }),
    [accessRecords, sourceGroupById],
  );
  const form = useForm<ProfileSourceAccessEditorValues>({
    defaultValues: createDefaultEditorValues(),
  });
  const selectedSourceGroupId =
    useWatch({ control: form.control, name: "sourceGroupId" }) ?? "";
  const selectedAccessState =
    useWatch({ control: form.control, name: "accessState" }) ?? "UNKNOWN";
  const selectedAccessRecord = accessBySourceGroupId.get(selectedSourceGroupId);
  const editorDisabled =
    sourceGroupsQuery.isPending ||
    sourceGroupsQuery.isError ||
    sortedSourceGroups.length === 0;
  const canSubmit = !editorDisabled && !upsertAccess.isPending;

  useEffect(() => {
    if (editorDisabled) {
      return;
    }

    const currentSourceGroupId = form.getValues("sourceGroupId");
    const sourceGroupId = sourceGroupById.has(currentSourceGroupId)
      ? currentSourceGroupId
      : sortedSourceGroups[0]?.id;

    if (sourceGroupId === undefined) {
      return;
    }

    form.reset(
      toEditorValues(
        sourceGroupId,
        accessBySourceGroupId.get(sourceGroupId),
      ),
    );
  }, [
    accessBySourceGroupId,
    editorDisabled,
    form,
    sortedSourceGroups,
    sourceGroupById,
  ]);

  async function submit(values: ProfileSourceAccessEditorValues): Promise<void> {
    setValidationSummary(undefined);
    setSavedSourceGroupId(undefined);
    upsertAccess.reset();

    const parsed = ProfileSourceAccessEditorSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Profile-source access is invalid.",
      );
      return;
    }

    const sourceGroup = sourceGroupById.get(parsed.data.sourceGroupId);

    if (sourceGroup === undefined) {
      setValidationSummary("Select an available source group before saving.");
      return;
    }

    const existingRecord = accessBySourceGroupId.get(sourceGroup.id);
    const notes = parsed.data.notes.trim();

    if (
      existingRecord?.notes !== undefined &&
      existingRecord.notes.trim().length > 0 &&
      notes.length === 0
    ) {
      setValidationSummary(
        "Clearing existing notes is not supported by the current API.",
      );
      return;
    }

    try {
      const response = await upsertAccess.mutateAsync({
        profileId,
        sourceGroupId: sourceGroup.id,
        request: toUpsertRequest(parsed.data, existingRecord),
      });

      setSavedSourceGroupId(response.profileSourceAccess.sourceGroupId);
      form.reset(
        toEditorValues(
          response.profileSourceAccess.sourceGroupId,
          response.profileSourceAccess,
        ),
      );
    } catch {
      return;
    }
  }

  function selectSourceGroup(sourceGroupId: string): void {
    setValidationSummary(undefined);
    setSavedSourceGroupId(undefined);
    upsertAccess.reset();
    form.reset(
      toEditorValues(sourceGroupId, accessBySourceGroupId.get(sourceGroupId)),
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Source Group Access</CardTitle>
          <CardDescription>
            Operator-managed source-group access facts for this profile.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void Promise.all([accessQuery.refetch(), sourceGroupsQuery.refetch()]);
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {accessQuery.isPending ? <ProfileSourceAccessLoadingState /> : null}

        {accessQuery.isError ? (
          <ProfileSourceAccessErrorState
            error={accessQuery.error}
            onRetry={() => {
              void accessQuery.refetch();
            }}
          />
        ) : null}

        {sourceGroupsQuery.isError ? (
          <WarningPanel
            actionLabel="Retry Source Groups"
            message="Source groups could not load. Access records remain visible by ID, and editing is disabled."
            onAction={() => {
              void sourceGroupsQuery.refetch();
            }}
          />
        ) : null}

        {sourceGroupsQuery.isSuccess && sourceGroups.length === 0 ? (
          <WarningPanel message="No source groups are available for editing." />
        ) : null}

        {accessQuery.isSuccess && sortedRows.length === 0 ? (
          <ProfileSourceAccessEmptyState />
        ) : null}

        {sortedRows.length > 0 ? (
          <div className="grid gap-3">
            {sortedRows.map(({ accessRecord, sourceGroup }) => (
              <ProfileSourceAccessRow
                key={accessRecord.id}
                accessRecord={accessRecord}
                sourceGroup={sourceGroup}
                sourceGroupLookupFailed={sourceGroupsQuery.isError}
                onEdit={
                  sourceGroup === undefined || sourceGroupsQuery.isError
                    ? undefined
                    : () => selectSourceGroup(sourceGroup.id)
                }
              />
            ))}
          </div>
        ) : null}

        <form
          className="grid gap-4 rounded border border-border bg-muted/25 p-4"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                {selectedAccessRecord === undefined
                  ? "Create Access"
                  : "Update Access"}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {selectedSourceGroupId || "Select a source group"}
              </p>
            </div>
            <StatusBadge
              label={selectedAccessRecord === undefined ? "New" : "Existing"}
              tone={selectedAccessRecord === undefined ? "info" : "neutral"}
            />
          </div>

          {validationSummary !== undefined ? (
            <ValidationSummary message={validationSummary} />
          ) : null}

          <BackendErrorPanel
            error={upsertAccess.error}
            fallbackMessage="Profile-source access save failed."
          />

          {savedSourceGroupId !== undefined ? (
            <SuccessPanel message={`Access saved for ${savedSourceGroupId}.`} />
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.sourceGroupId)}
            htmlFor="profile-source-access-source-group"
            label="Source Group"
          >
            <Select
              id="profile-source-access-source-group"
              disabled={editorDisabled || upsertAccess.isPending}
              value={selectedSourceGroupId}
              onChange={(event) => selectSourceGroup(event.currentTarget.value)}
            >
              <option value="">Select source group</option>
              {sortedSourceGroups.map((sourceGroup) => (
                <option key={sourceGroup.id} value={sourceGroup.id}>
                  {sourceGroup.name} - {sourceGroup.status}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            error={getErrorMessage(form.formState.errors.accessState)}
            htmlFor="profile-source-access-state"
            label="Access State"
          >
            <Select
              id="profile-source-access-state"
              disabled={editorDisabled || upsertAccess.isPending}
              value={selectedAccessState}
              onChange={(event) => {
                const accessState = ProfileSourceAccessStateSchema.parse(
                  event.currentTarget.value,
                );
                form.setValue("accessState", accessState, {
                  shouldDirty: true,
                  shouldValidate: false,
                });

                if (isSuccessfulAccessState(accessState)) {
                  form.setValue("failureReasonCode", "");
                  form.setValue("failureReasonMessage", "");
                }
              }}
            >
              {profileSourceAccessStates.map((accessState) => (
                <option key={accessState} value={accessState}>
                  {getProfileSourceAccessStateLabel(accessState)}
                </option>
              ))}
            </Select>
          </FormField>

          {!isSuccessfulAccessState(selectedAccessState) ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                error={getErrorMessage(form.formState.errors.failureReasonCode)}
                htmlFor="profile-source-access-failure-code"
                label="Failure Reason Code"
              >
                <Input
                  id="profile-source-access-failure-code"
                  autoComplete="off"
                  disabled={editorDisabled || upsertAccess.isPending}
                  maxLength={64}
                  {...form.register("failureReasonCode")}
                />
              </FormField>

              <FormField
                error={getErrorMessage(
                  form.formState.errors.failureReasonMessage,
                )}
                htmlFor="profile-source-access-failure-message"
                label="Failure Reason Message"
              >
                <Input
                  id="profile-source-access-failure-message"
                  autoComplete="off"
                  disabled={editorDisabled || upsertAccess.isPending}
                  maxLength={500}
                  {...form.register("failureReasonMessage")}
                />
              </FormField>
            </div>
          ) : null}

          <FormField
            error={getErrorMessage(form.formState.errors.notes)}
            htmlFor="profile-source-access-notes"
            label="Notes"
          >
            <Textarea
              id="profile-source-access-notes"
              disabled={editorDisabled || upsertAccess.isPending}
              maxLength={2000}
              {...form.register("notes")}
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={editorDisabled || upsertAccess.isPending}
              type="button"
              variant="secondary"
              onClick={() => {
                const sourceGroupId =
                  selectedSourceGroupId || sortedSourceGroups[0]?.id || "";
                selectSourceGroup(sourceGroupId);
              }}
            >
              <X aria-hidden="true" className="size-4" />
              Cancel
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {selectedAccessRecord === undefined ? (
                <Plus aria-hidden="true" className="size-4" />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              {upsertAccess.isPending
                ? "Saving"
                : selectedAccessRecord === undefined
                  ? "Create Access"
                  : "Update Access"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileSourceAccessRow({
  accessRecord,
  sourceGroup,
  sourceGroupLookupFailed,
  onEdit,
}: {
  readonly accessRecord: ProfileSourceAccess;
  readonly sourceGroup: SourceGroup | undefined;
  readonly sourceGroupLookupFailed: boolean;
  readonly onEdit: (() => void) | undefined;
}): JSX.Element {
  const sourceGroupName = sourceGroup?.name ?? accessRecord.sourceGroupId;
  const unavailableLabel = sourceGroupLookupFailed
    ? "Lookup failed"
    : "Unavailable or removed";

  return (
    <div className="grid min-w-0 gap-4 rounded border border-border bg-white p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-words font-semibold text-foreground">
              {sourceGroupName}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {accessRecord.sourceGroupId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceGroup === undefined ? (
              <StatusBadge label={unavailableLabel} tone="warning" />
            ) : (
              <StatusBadge
                label={sourceGroup.status}
                tone={getSourceGroupStatusTone(sourceGroup.status)}
              />
            )}
            <ProfileSourceAccessStateBadge
              accessState={accessRecord.accessState}
            />
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AccessField
            label="Last Checked"
            value={formatNullableDateTime(accessRecord.lastCheckedAt)}
          />
          <AccessField
            label="Last Successful"
            value={formatNullableDateTime(accessRecord.lastSuccessfulAt)}
          />
          <AccessField
            label="Join Requested"
            value={formatNullableDateTime(accessRecord.joinRequestedAt)}
          />
          <AccessField
            label="Failure Reason"
            value={formatFailureReason(accessRecord)}
          />
          <AccessField label="Updated" value={formatDateTime(accessRecord.updatedAt)} />
          <AccessField label="Created" value={formatDateTime(accessRecord.createdAt)} />
        </dl>

        {accessRecord.notes !== undefined ? (
          <div className="rounded border border-border bg-muted/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
              {accessRecord.notes}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-start justify-end">
        <Button
          disabled={onEdit === undefined}
          type="button"
          variant="secondary"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
      </div>
    </div>
  );
}

function AccessField({
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

function ProfileSourceAccessLoadingState(): JSX.Element {
  return (
    <div className="space-y-3">
      {["one", "two"].map((row) => (
        <div
          key={row}
          className="min-h-32 animate-pulse rounded border border-border bg-muted"
        />
      ))}
    </div>
  );
}

function ProfileSourceAccessErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <div
      className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm text-[#7f1d1d]"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">Source access could not load.</p>
          <p className="mt-1 break-words">{formatApiError(error)}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileSourceAccessEmptyState(): JSX.Element {
  return (
    <div
      className="rounded border border-border bg-muted/35 px-4 py-5 text-sm text-muted-foreground"
      role="status"
    >
      No profile-source access records were returned.
    </div>
  );
}

function WarningPanel({
  message,
  actionLabel,
  onAction,
}: {
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}): JSX.Element {
  return (
    <div
      className="rounded border border-[#dfc36e] bg-[#fff7dc] px-4 py-3 text-sm text-[#76591a]"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{message}</p>
          {actionLabel !== undefined && onAction !== undefined ? (
            <Button
              className="mt-3"
              size="sm"
              type="button"
              variant="secondary"
              onClick={onAction}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
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

function toUpsertRequest(
  values: ProfileSourceAccessEditorValues,
  existingRecord: ProfileSourceAccess | undefined,
): UpsertProfileSourceAccessRequest {
  const notes = values.notes.trim();
  const request: UpsertProfileSourceAccessRequest = {
    accessState: values.accessState,
  };

  if (isSuccessfulAccessState(values.accessState)) {
    request.lastFailureReason = null;
  } else {
    const code = values.failureReasonCode.trim();
    const message = values.failureReasonMessage.trim();

    if (code.length > 0 && message.length > 0) {
      request.lastFailureReason = { code, message };
    } else if (
      existingRecord !== undefined &&
      existingRecord.lastFailureReason !== null
    ) {
      request.lastFailureReason = null;
    }
  }

  if (notes.length > 0) {
    request.notes = notes;
  }

  return request;
}

function toEditorValues(
  sourceGroupId: string,
  accessRecord: ProfileSourceAccess | undefined,
): ProfileSourceAccessEditorValues {
  if (accessRecord === undefined) {
    return {
      sourceGroupId,
      accessState: "UNKNOWN",
      failureReasonCode: "",
      failureReasonMessage: "",
      notes: "",
    };
  }

  return {
    sourceGroupId,
    accessState: accessRecord.accessState,
    failureReasonCode: accessRecord.lastFailureReason?.code ?? "",
    failureReasonMessage: accessRecord.lastFailureReason?.message ?? "",
    notes: accessRecord.notes ?? "",
  };
}

function createDefaultEditorValues(): ProfileSourceAccessEditorValues {
  return {
    sourceGroupId: "",
    accessState: "UNKNOWN",
    failureReasonCode: "",
    failureReasonMessage: "",
    notes: "",
  };
}

function isSuccessfulAccessState(
  accessState: ProfileSourceAccessState,
): boolean {
  return successfulAccessStates.some((state) => state === accessState);
}

function compareSourceGroupLabels(
  first: SourceGroup,
  second: SourceGroup,
): number {
  const nameComparison = first.name.localeCompare(second.name);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return first.id.localeCompare(second.id);
}

function getSourceGroupStatusTone(status: SourceGroupStatus): StatusBadgeTone {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "PAUSED") {
    return "warning";
  }

  return "neutral";
}

function formatFailureReason(accessRecord: ProfileSourceAccess): string {
  if (accessRecord.lastFailureReason === null) {
    return "None";
  }

  return `${accessRecord.lastFailureReason.code}: ${accessRecord.lastFailureReason.message}`;
}

function formatNullableDateTime(value: string | null): string {
  return value === null ? "Never" : formatDateTime(value);
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

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The Profile Manager request failed.";
}
