export const PROFILE_SOURCE_ACCESS_CHECK_RUN_TRIGGER_TYPES = [
  "MANUAL",
] as const;

export type ProfileSourceAccessCheckRunTriggerType =
  (typeof PROFILE_SOURCE_ACCESS_CHECK_RUN_TRIGGER_TYPES)[number];
