export const COLLECTOR_RUNTIME_ACCOUNT_STAGES = [
  "NEW_ACCOUNT",
  "WARMING",
  "COLLECTION_READY",
  "LIMITED",
  "NEEDS_REVIEW",
  "RETIRED",
] as const;

export type CollectorRuntimeAccountStage =
  (typeof COLLECTOR_RUNTIME_ACCOUNT_STAGES)[number];
