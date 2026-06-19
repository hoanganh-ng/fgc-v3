import type { infer as zInfer } from "zod";
import type { ProfileHomeFeedCollectionRunTriggerTypeSchema } from "./profile-home-feed-collection-run.schemas";

export const PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES = [
  "MANUAL_API",
] as const;

export type ProfileHomeFeedCollectionRunTriggerType = zInfer<
  typeof ProfileHomeFeedCollectionRunTriggerTypeSchema
>;

export function isProfileHomeFeedCollectionRunTriggerType(
  value: unknown,
): value is ProfileHomeFeedCollectionRunTriggerType {
  return (
    typeof value === "string" &&
    PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES.some(
      (triggerType) => triggerType === value,
    )
  );
}
