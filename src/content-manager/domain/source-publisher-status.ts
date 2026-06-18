import type { infer as zInfer } from "zod";
import type { SourcePublisherStatusSchema } from "./source-publisher.schemas";

export const SOURCE_PUBLISHER_STATUSES = [
  "DISCOVERED",
  "APPROVED",
  "IGNORED",
  "BLOCKED",
] as const;

export type SourcePublisherStatus = zInfer<typeof SourcePublisherStatusSchema>;

export function isSourcePublisherStatus(
  value: unknown,
): value is SourcePublisherStatus {
  return (
    typeof value === "string" &&
    SOURCE_PUBLISHER_STATUSES.some((status) => status === value)
  );
}
