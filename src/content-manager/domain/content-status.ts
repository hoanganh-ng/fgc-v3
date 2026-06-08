import type { infer as zInfer } from "zod";
import type { ContentStatusSchema } from "./content.schemas";

export const CONTENT_STATUSES = [
  "COLLECTED",
  "SELECTED",
  "REJECTED",
  "USED",
] as const;

export type ContentStatus = zInfer<typeof ContentStatusSchema>;

export function isContentStatus(value: unknown): value is ContentStatus {
  return (
    typeof value === "string" &&
    CONTENT_STATUSES.some((status) => status === value)
  );
}
