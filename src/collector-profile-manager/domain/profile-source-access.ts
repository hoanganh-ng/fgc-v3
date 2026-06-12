import type { infer as zInfer } from "zod";
import {
  ProfileSourceAccessFailureReasonSchema,
  ProfileSourceAccessIdSchema,
  ProfileSourceAccessSchema,
  ProfileSourceAccessSourceGroupIdSchema,
} from "./profile.schemas";
import type { ProfileId } from "./profile-properties";
import type { ProfileSourceAccessState } from "./profile-source-access-state";
import {
  isSuccessfulProfileSourceAccessState,
} from "./profile-source-access-state";
import type { IsoDateTime } from "./profile-properties";

export type ProfileSourceAccessId = zInfer<typeof ProfileSourceAccessIdSchema>;
export type ProfileSourceAccessSourceGroupId = zInfer<
  typeof ProfileSourceAccessSourceGroupIdSchema
>;
export type ProfileSourceAccessFailureReason = zInfer<
  typeof ProfileSourceAccessFailureReasonSchema
>;
export type ProfileSourceAccess = zInfer<typeof ProfileSourceAccessSchema>;

export interface CreateProfileSourceAccessInput {
  readonly id: ProfileSourceAccessId;
  readonly profileId: ProfileId;
  readonly sourceGroupId: ProfileSourceAccessSourceGroupId;
  readonly accessState: ProfileSourceAccessState;
  readonly checkedAt: IsoDateTime;
  readonly lastFailureReason?: ProfileSourceAccessFailureReason | null;
  readonly notes?: string;
}

export interface UpdateProfileSourceAccessInput {
  readonly accessState: ProfileSourceAccessState;
  readonly checkedAt: IsoDateTime;
  readonly lastFailureReason?: ProfileSourceAccessFailureReason | null;
  readonly notes?: string;
}

export function createProfileSourceAccess(
  input: CreateProfileSourceAccessInput,
): ProfileSourceAccess {
  return applyProfileSourceAccessUpdate(
    {
      id: input.id,
      profileId: input.profileId,
      sourceGroupId: input.sourceGroupId,
      accessState: "UNKNOWN",
      lastCheckedAt: null,
      lastSuccessfulAt: null,
      lastFailureReason: null,
      joinRequestedAt: null,
      createdAt: input.checkedAt,
      updatedAt: input.checkedAt,
    },
    input,
  );
}

export function updateProfileSourceAccess(
  existing: ProfileSourceAccess,
  input: UpdateProfileSourceAccessInput,
): ProfileSourceAccess {
  return applyProfileSourceAccessUpdate(existing, input);
}

export function sanitizeProfileSourceAccessFailureReason(
  failureReason: ProfileSourceAccessFailureReason,
): ProfileSourceAccessFailureReason {
  return {
    code: failureReason.code,
    message: failureReason.message,
  };
}

function applyProfileSourceAccessUpdate(
  existing: ProfileSourceAccess,
  input: UpdateProfileSourceAccessInput,
): ProfileSourceAccess {
  const lastFailureReason = hasOwn(input, "lastFailureReason")
    ? input.lastFailureReason === null || input.lastFailureReason === undefined
      ? null
      : sanitizeProfileSourceAccessFailureReason(input.lastFailureReason)
    : existing.lastFailureReason;
  const notes = input.notes ?? existing.notes;
  const nextAccess: ProfileSourceAccess = {
    id: existing.id,
    profileId: existing.profileId,
    sourceGroupId: existing.sourceGroupId,
    accessState: input.accessState,
    lastCheckedAt: input.checkedAt,
    lastSuccessfulAt: isSuccessfulProfileSourceAccessState(input.accessState)
      ? input.checkedAt
      : existing.lastSuccessfulAt,
    lastFailureReason,
    joinRequestedAt:
      input.accessState === "JOIN_REQUESTED"
        ? input.checkedAt
        : existing.joinRequestedAt,
    ...(notes !== undefined ? { notes } : {}),
    createdAt: existing.createdAt,
    updatedAt: input.checkedAt,
  };

  return nextAccess;
}

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
