import type { infer as zInfer } from "zod";
import type { CollectionRunStatusSchema } from "./collection-run.schemas";

export const COLLECTION_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export const TERMINAL_COLLECTION_RUN_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export type CollectionRunStatus = zInfer<typeof CollectionRunStatusSchema>;

export function isCollectionRunStatus(
  value: unknown,
): value is CollectionRunStatus {
  return (
    typeof value === "string" &&
    COLLECTION_RUN_STATUSES.some((status) => status === value)
  );
}

export function isTerminalCollectionRunStatus(
  status: CollectionRunStatus,
): boolean {
  return TERMINAL_COLLECTION_RUN_STATUSES.some(
    (terminalStatus) => terminalStatus === status,
  );
}
