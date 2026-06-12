import type { infer as zInfer } from "zod";
import type { CollectionRunTriggerTypeSchema } from "./collection-run.schemas";

export const COLLECTION_RUN_TRIGGER_TYPES = ["MANUAL_API"] as const;

export type CollectionRunTriggerType = zInfer<
  typeof CollectionRunTriggerTypeSchema
>;

export function isCollectionRunTriggerType(
  value: unknown,
): value is CollectionRunTriggerType {
  return (
    typeof value === "string" &&
    COLLECTION_RUN_TRIGGER_TYPES.some((triggerType) => triggerType === value)
  );
}
