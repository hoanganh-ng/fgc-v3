import type { infer as zInfer } from "zod";
import type { ProfileStatusSchema } from "./profile.schemas";

export const PROFILE_STATUSES = [
  "PENDING_CONFIG",
  "PENDING_LOGIN",
  "READY",
  "BUSY",
] as const;

export type ProfileStatus = zInfer<typeof ProfileStatusSchema>;

export function isProfileStatus(value: unknown): value is ProfileStatus {
  return (
    typeof value === "string" &&
    PROFILE_STATUSES.some((status) => status === value)
  );
}
