import { z } from "zod";

export const COLLECTOR_RUNTIME_ACCOUNT_STAGES = [
  "NEW_ACCOUNT",
  "WARMING",
  "COLLECTION_READY",
  "LIMITED",
  "NEEDS_REVIEW",
  "RETIRED",
] as const;

export const CollectorRuntimeAccountStageSchema = z.enum(
  COLLECTOR_RUNTIME_ACCOUNT_STAGES,
);

export type CollectorRuntimeAccountStage = z.infer<
  typeof CollectorRuntimeAccountStageSchema
>;
