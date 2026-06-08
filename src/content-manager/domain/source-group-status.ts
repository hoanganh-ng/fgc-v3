import type { infer as zInfer } from "zod";
import type { SourceGroupStatusSchema } from "./content.schemas";

export const SOURCE_GROUP_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

export type SourceGroupStatus = zInfer<typeof SourceGroupStatusSchema>;

export function isSourceGroupStatus(value: unknown): value is SourceGroupStatus {
  return (
    typeof value === "string" &&
    SOURCE_GROUP_STATUSES.some((status) => status === value)
  );
}
