import type { infer as zInfer } from "zod";
import type { ContentPlatformSchema } from "./content.schemas";

export const CONTENT_PLATFORMS = ["FACEBOOK"] as const;

export type ContentPlatform = zInfer<typeof ContentPlatformSchema>;

export function isContentPlatform(value: unknown): value is ContentPlatform {
  return (
    typeof value === "string" &&
    CONTENT_PLATFORMS.some((platform) => platform === value)
  );
}
