import type { infer as zInfer } from "zod";
import type {
  ActiveTimeWindowSchema,
  AuthenticationStateSchema,
  BehavioralPersonaSchema,
  BrowserCookieSchema,
  ChronotypeSchema,
  CollectorProfilePropertyGroupsSchema,
  ContentAffinitiesSchema,
  CookieSameSiteSchema,
  DailySafetyUsageSchema,
  DayOfWeekSchema,
  HardwareFingerprintSchema,
  IanaTimezoneSchema,
  IdentityMetadataSchema,
  InteractionWeightsSchema,
  IsoDateTimeSchema,
  LocalDateSchema,
  LocalStorageEntrySchema,
  LocalTimeSchema,
  NetworkContextSchema,
  NetworkKillswitchSchema,
  NumericRangeSchema,
  ProfileIdSchema,
  ProvisioningTokenStateSchema,
  ProvisioningTokenStatusSchema,
  ProxyCredentialsSchema,
  ProxyProtocolSchema,
  ProxyRoutingSchema,
  SafetyThresholdsSchema,
  ScrollStyleSchema,
  TemporalRoutineSchema,
  ViewportSizeSchema,
  WeightedTopicSchema,
} from "./profile.schemas";

export type ProfileId = zInfer<typeof ProfileIdSchema>;
export type IsoDateTime = zInfer<typeof IsoDateTimeSchema>;
export type LocalDate = zInfer<typeof LocalDateSchema>;
export type IanaTimezone = zInfer<typeof IanaTimezoneSchema>;
export type LocalTime = zInfer<typeof LocalTimeSchema>;
export type DayOfWeek = zInfer<typeof DayOfWeekSchema>;
export type DailySafetyUsage = zInfer<typeof DailySafetyUsageSchema>;
export type IdentityMetadata = zInfer<typeof IdentityMetadataSchema>;

export const PROXY_PROTOCOLS = ["HTTP", "HTTPS", "SOCKS5"] as const;

export type ProxyProtocol = zInfer<typeof ProxyProtocolSchema>;

export function isProxyProtocol(value: unknown): value is ProxyProtocol {
  return (
    typeof value === "string" &&
    PROXY_PROTOCOLS.some((protocol) => protocol === value)
  );
}

export type ProxyCredentials = zInfer<typeof ProxyCredentialsSchema>;
export type ProxyRouting = zInfer<typeof ProxyRoutingSchema>;
export type NetworkKillswitch = zInfer<typeof NetworkKillswitchSchema>;
export type NetworkContext = zInfer<typeof NetworkContextSchema>;
export type ViewportSize = zInfer<typeof ViewportSizeSchema>;
export type HardwareFingerprint = zInfer<typeof HardwareFingerprintSchema>;

export const COOKIE_SAME_SITE_VALUES = ["STRICT", "LAX", "NONE"] as const;

export type CookieSameSite = zInfer<typeof CookieSameSiteSchema>;

export function isCookieSameSite(value: unknown): value is CookieSameSite {
  return (
    typeof value === "string" &&
    COOKIE_SAME_SITE_VALUES.some((sameSite) => sameSite === value)
  );
}

export type BrowserCookie = zInfer<typeof BrowserCookieSchema>;
export type LocalStorageEntry = zInfer<typeof LocalStorageEntrySchema>;
export type AuthenticationState = zInfer<typeof AuthenticationStateSchema>;

export const SCROLL_STYLES = ["STEADY", "SKIMMING", "DEEP_READ"] as const;

export type ScrollStyle = zInfer<typeof ScrollStyleSchema>;

export function isScrollStyle(value: unknown): value is ScrollStyle {
  return (
    typeof value === "string" &&
    SCROLL_STYLES.some((scrollStyle) => scrollStyle === value)
  );
}

export type NumericRange = zInfer<typeof NumericRangeSchema>;
export type BehavioralPersona = zInfer<typeof BehavioralPersonaSchema>;

export const CHRONOTYPES = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;

export type Chronotype = zInfer<typeof ChronotypeSchema>;

export function isChronotype(value: unknown): value is Chronotype {
  return (
    typeof value === "string" &&
    CHRONOTYPES.some((chronotype) => chronotype === value)
  );
}

export type ActiveTimeWindow = zInfer<typeof ActiveTimeWindowSchema>;
export type TemporalRoutine = zInfer<typeof TemporalRoutineSchema>;
export type SafetyThresholds = zInfer<typeof SafetyThresholdsSchema>;
export type WeightedTopic = zInfer<typeof WeightedTopicSchema>;
export type InteractionWeights = zInfer<typeof InteractionWeightsSchema>;
export type ContentAffinities = zInfer<typeof ContentAffinitiesSchema>;

export const PROVISIONING_TOKEN_STATUSES = [
  "NOT_ISSUED",
  "ISSUED",
  "CONSUMED",
  "EXPIRED",
] as const;

export type ProvisioningTokenStatus = zInfer<
  typeof ProvisioningTokenStatusSchema
>;

export function isProvisioningTokenStatus(
  value: unknown,
): value is ProvisioningTokenStatus {
  return (
    typeof value === "string" &&
    PROVISIONING_TOKEN_STATUSES.some((status) => status === value)
  );
}

export type ProvisioningTokenState = zInfer<
  typeof ProvisioningTokenStateSchema
>;

export type CollectorProfilePropertyGroups = zInfer<
  typeof CollectorProfilePropertyGroupsSchema
>;
