import { z } from "zod";
import type {
  CollectionRun,
  CollectionRunStatus,
  RequestCollectionRunRequest,
} from "@/lib/api/collector-runtime-client";

export const RequestCollectionRunFormSchema = z
  .object({
    sourceGroupId: z.string().trim().min(1, "Source group is required."),
    maxScrolls: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : Number(value)))
      .pipe(z.number().int().min(0).optional()),
    maxDurationMs: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : Number(value)))
      .pipe(z.number().int().min(1).optional()),
  })
  .strict();

export type RequestCollectionRunFormValues = z.input<
  typeof RequestCollectionRunFormSchema
>;
export type ParsedRequestCollectionRunFormValues = z.output<
  typeof RequestCollectionRunFormSchema
>;

export interface PaginationInput {
  readonly offset: number;
  readonly limit: number;
  readonly itemCount: number;
  readonly total?: number | undefined;
}

export interface VisibleRange {
  readonly start: number;
  readonly end: number;
}

export interface PaginationModel {
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  readonly visibleRange: VisibleRange | undefined;
}

export function hasActiveCollectionRuns(
  runs: readonly Pick<CollectionRun, "status">[],
): boolean {
  return runs.some((run) => run.status === "QUEUED" || run.status === "RUNNING");
}

export function canCancelCollectionRun(status: CollectionRunStatus): boolean {
  return status === "QUEUED";
}

export function getVisibleRange({
  offset,
  itemCount,
}: Pick<PaginationInput, "offset" | "itemCount">): VisibleRange | undefined {
  if (itemCount === 0) {
    return undefined;
  }

  return {
    start: offset + 1,
    end: offset + itemCount,
  };
}

export function getPaginationModel(input: PaginationInput): PaginationModel {
  const visibleRange = getVisibleRange(input);
  const canGoNext =
    input.total !== undefined
      ? input.offset + input.itemCount < input.total
      : input.itemCount >= input.limit;

  return {
    canGoBack: input.offset > 0,
    canGoNext,
    visibleRange,
  };
}

export function toRequestCollectionRunRequest(
  values: ParsedRequestCollectionRunFormValues,
): RequestCollectionRunRequest {
  return {
    sourceGroupId: values.sourceGroupId,
    ...(values.maxScrolls !== undefined ? { maxScrolls: values.maxScrolls } : {}),
    ...(values.maxDurationMs !== undefined
      ? { maxDurationMs: values.maxDurationMs }
      : {}),
  };
}

export function filterRequestableSourceGroups<
  TSourceGroup extends { readonly platform: string; readonly status: string },
>(sourceGroups: readonly TSourceGroup[]): TSourceGroup[] {
  return sourceGroups.filter(
    (sourceGroup) =>
      sourceGroup.platform === "FACEBOOK" && sourceGroup.status === "ACTIVE",
  );
}
