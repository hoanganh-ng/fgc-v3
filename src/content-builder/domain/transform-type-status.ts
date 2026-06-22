export const TRANSFORM_TYPE_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export type TransformTypeStatus = (typeof TRANSFORM_TYPE_STATUSES)[number];

export function isTransformTypeStatus(
  value: unknown,
): value is TransformTypeStatus {
  return (
    typeof value === "string" &&
    TRANSFORM_TYPE_STATUSES.includes(value as TransformTypeStatus)
  );
}
