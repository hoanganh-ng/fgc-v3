import type { infer as zInfer } from "zod";
import type {
  SourceGroupEntryRouteRiskLevelSchema,
  SourceGroupEntryRouteTypeSchema,
} from "./content.schemas";

export const SOURCE_GROUP_ENTRY_ROUTE_TYPES = [
  "DIRECT_GROUP_URL",
  "CATEGORY_ENTRY_URL",
  "PUBLIC_PAGE_THEN_GROUP",
  "OPERATOR_ASSISTED_SEARCH",
  "SAVED_REFERRAL_URL",
] as const;

export const SOURCE_GROUP_ENTRY_ROUTE_RISK_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

export const SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_ID = "direct-group-url";
export const SOURCE_GROUP_DEFAULT_ENTRY_ROUTE_RISK_LEVEL = "MEDIUM";

export type SourceGroupEntryRouteType = zInfer<
  typeof SourceGroupEntryRouteTypeSchema
>;
export type SourceGroupEntryRouteRiskLevel = zInfer<
  typeof SourceGroupEntryRouteRiskLevelSchema
>;

export function isSourceGroupEntryRouteType(
  value: unknown,
): value is SourceGroupEntryRouteType {
  return (
    typeof value === "string" &&
    SOURCE_GROUP_ENTRY_ROUTE_TYPES.some((type) => type === value)
  );
}

export function isSourceGroupEntryRouteRiskLevel(
  value: unknown,
): value is SourceGroupEntryRouteRiskLevel {
  return (
    typeof value === "string" &&
    SOURCE_GROUP_ENTRY_ROUTE_RISK_LEVELS.some(
      (riskLevel) => riskLevel === value,
    )
  );
}
