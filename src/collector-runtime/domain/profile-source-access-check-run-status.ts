export const PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export type ProfileSourceAccessCheckRunStatus =
  (typeof PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES)[number];
