import type { infer as zInfer } from "zod";
import type {
  ProfileLeaseIdSchema,
  ProfileLeasePurposeSchema,
  ProfileLeaseSchema,
  ProfileLeaseStatusSchema,
} from "./profile.schemas";
import type { IsoDateTime, ProfileId } from "./profile-properties";

export const PROFILE_LEASE_STATUSES = [
  "ACTIVE",
  "RELEASED",
  "EXPIRED",
] as const;

export const PROFILE_LEASE_PURPOSES = [
  "COLLECTION",
  "AMBIENT_EXERCISE",
] as const;

export type ProfileLeaseStatus = zInfer<typeof ProfileLeaseStatusSchema>;
export type ProfileLeasePurpose = zInfer<typeof ProfileLeasePurposeSchema>;
export type ProfileLeaseId = zInfer<typeof ProfileLeaseIdSchema>;
export type ProfileLease = zInfer<typeof ProfileLeaseSchema>;

export interface CreateActiveProfileLeaseInput {
  readonly id: ProfileLeaseId;
  readonly profileId: ProfileId;
  readonly purpose?: ProfileLeasePurpose;
  readonly leasedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

export function createActiveProfileLease(
  input: CreateActiveProfileLeaseInput,
): ProfileLease {
  return {
    id: input.id,
    profileId: input.profileId,
    purpose: input.purpose ?? "COLLECTION",
    leasedAt: input.leasedAt,
    expiresAt: input.expiresAt,
    releasedAt: null,
    status: "ACTIVE",
  };
}

export function releaseProfileLease(
  lease: ProfileLease,
  releasedAt: IsoDateTime,
): ProfileLease {
  return {
    ...lease,
    releasedAt,
    status: "RELEASED",
  };
}

export function expireProfileLease(lease: ProfileLease): ProfileLease {
  return {
    ...lease,
    releasedAt: null,
    status: "EXPIRED",
  };
}

export function isActiveProfileLease(lease: ProfileLease): boolean {
  return lease.status === "ACTIVE";
}
