import type { infer as zInfer } from "zod";
import type { SourcePublisherKindSchema } from "./source-publisher.schemas";

export const SOURCE_PUBLISHER_KINDS = ["GROUP", "PAGE"] as const;

export type SourcePublisherKind = zInfer<typeof SourcePublisherKindSchema>;

export function isSourcePublisherKind(
  value: unknown,
): value is SourcePublisherKind {
  return (
    typeof value === "string" &&
    SOURCE_PUBLISHER_KINDS.some((kind) => kind === value)
  );
}
