import {
  KnownProfileAuthenticationHealthSchema,
  KnownProfileStatusSchema,
  type KnownProfileAuthenticationHealth,
  type KnownProfileStatus,
} from "@/lib/api/profile-manager-client";

export const PROFILE_INVENTORY_PAGE_SIZE = 25;

export const PROFILE_INVENTORY_STATUS_OPTIONS =
  KnownProfileStatusSchema.options;

export const PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS =
  KnownProfileAuthenticationHealthSchema.options;

const PROFILE_INVENTORY_STATUS_LABELS: Readonly<
  Record<KnownProfileStatus, string>
> = {
  PENDING_CONFIG: "Pending configuration",
  PENDING_LOGIN: "Pending login",
  READY: "Ready",
  BUSY: "Busy",
};

const PROFILE_INVENTORY_AUTHENTICATION_HEALTH_LABELS: Readonly<
  Record<KnownProfileAuthenticationHealth, string>
> = {
  NOT_PROVISIONED: "Not provisioned",
  HEALTHY: "Healthy",
  REAUTH_REQUIRED: "Reauthentication required",
  CHECKPOINT_REVIEW_REQUIRED: "Checkpoint review required",
};

export function getProfileStatusLabel(
  status: KnownProfileStatus,
): string {
  return PROFILE_INVENTORY_STATUS_LABELS[status];
}

export function getProfileAuthenticationHealthLabel(
  health: KnownProfileAuthenticationHealth,
): string {
  return PROFILE_INVENTORY_AUTHENTICATION_HEALTH_LABELS[health];
}

const MAX_SAFE_OFFSET_STRING = String(Number.MAX_SAFE_INTEGER);

export function parseProfileInventoryOffset(
  rawOffset: string | null,
): number {
  if (rawOffset === null) {
    return 0;
  }

  if (rawOffset.length === 0) {
    return 0;
  }

  if (!/^\d+$/.test(rawOffset)) {
    return 0;
  }

  if (rawOffset.length > MAX_SAFE_OFFSET_STRING.length) {
    return 0;
  }

  if (rawOffset.length === MAX_SAFE_OFFSET_STRING.length &&
      rawOffset > MAX_SAFE_OFFSET_STRING) {
    return 0;
  }

  const parsed = Number(rawOffset);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export function pickKnownValue<T extends string>(
  value: string | null,
  options: readonly T[],
): T | undefined {
  if (value === null) {
    return undefined;
  }

  return options.includes(value as T) ? (value as T) : undefined;
}

export interface ProfileInventoryFilters {
  readonly status: KnownProfileStatus | undefined;
  readonly authenticationHealth: KnownProfileAuthenticationHealth | undefined;
  readonly limit: number;
  readonly offset: number;
}

export function hasActiveProfileInventoryFilters(
  filters: ProfileInventoryFilters,
): boolean {
  return (
    filters.status !== undefined ||
    filters.authenticationHealth !== undefined
  );
}

export interface ProfileInventoryVisibleRange {
  readonly start: number;
  readonly end: number;
}

export function getProfileInventoryVisibleRange({
  offset,
  itemCount,
}: {
  readonly offset: number;
  readonly itemCount: number;
}): ProfileInventoryVisibleRange | undefined {
  if (itemCount === 0) {
    return undefined;
  }

  return {
    start: offset + 1,
    end: offset + itemCount,
  };
}

export interface ProfileInventoryPaginationModel {
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  readonly visibleRange: ProfileInventoryVisibleRange | undefined;
}

export function getProfileInventoryPaginationModel({
  offset,
  limit,
  itemCount,
  total,
}: {
  readonly offset: number;
  readonly limit: number;
  readonly itemCount: number;
  readonly total: number | undefined;
}): ProfileInventoryPaginationModel {
  const visibleRange = getProfileInventoryVisibleRange({ offset, itemCount });
  const canGoNext =
    total !== undefined
      ? offset + itemCount < total
      : itemCount >= limit;

  return {
    canGoBack: offset > 0,
    canGoNext,
    visibleRange,
  };
}

export type ProfileInventoryEmptyState =
  | "NONE"
  | "GLOBAL_NO_PROFILES"
  | "FILTERED_NO_MATCH"
  | "OUT_OF_RANGE";

export interface ProfileInventoryEmptyStateInput {
  readonly itemCount: number;
  readonly total: number | undefined;
  readonly offset: number;
  readonly hasActiveFilters: boolean;
}

export function resolveProfileInventoryEmptyState({
  itemCount,
  total,
  offset,
  hasActiveFilters,
}: ProfileInventoryEmptyStateInput): ProfileInventoryEmptyState {
  if (itemCount > 0) {
    return "NONE";
  }

  if (total !== undefined && total > 0) {
    return "OUT_OF_RANGE";
  }

  if (offset > 0) {
    return "OUT_OF_RANGE";
  }

  if (hasActiveFilters) {
    return "FILTERED_NO_MATCH";
  }

  return "GLOBAL_NO_PROFILES";
}

export interface ProfileInventoryRangeText {
  readonly rangeText: string;
  readonly totalText: string;
}

export function formatProfileInventoryRangeText({
  limit,
  offset,
  itemCount,
  total,
}: {
  readonly limit: number;
  readonly offset: number;
  readonly itemCount: number;
  readonly total: number | undefined;
}): ProfileInventoryRangeText {
  if (itemCount === 0) {
    if (total !== undefined && total > 0) {
      return {
        rangeText: "No items on this page",
        totalText: `${total} ${total === 1 ? "profile" : "profiles"}`,
      };
    }

    return {
      rangeText: "Showing 0",
      totalText: "0 profiles",
    };
  }

  const start = offset + 1;
  const end = offset + itemCount;

  if (total !== undefined) {
    return {
      rangeText: `Showing ${start}-${end}`,
      totalText: `${total} ${total === 1 ? "profile" : "profiles"}`,
    };
  }

  return {
    rangeText: `Showing ${start}-${end}`,
    totalText: "of unknown total",
  };
}

export function buildProfileInventorySearchParams({
  status,
  authenticationHealth,
  offset,
}: {
  readonly status: KnownProfileStatus | undefined;
  readonly authenticationHealth:
    | KnownProfileAuthenticationHealth
    | undefined;
  readonly offset: number;
}): URLSearchParams {
  const next = new URLSearchParams();
  if (status !== undefined) {
    next.set("status", status);
  }
  if (authenticationHealth !== undefined) {
    next.set("authenticationHealth", authenticationHealth);
  }
  if (offset > 0) {
    next.set("offset", String(offset));
  }
  return next;
}

export function applyProfileInventoryFilterChange({
  searchParams,
  key,
  value,
}: {
  readonly searchParams: URLSearchParams;
  readonly key: "status" | "authenticationHealth";
  readonly value: string;
}): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  // Changing a filter resets offset to zero.
  next.delete("offset");
  return next;
}

export function applyProfileInventoryResetFilters(
  searchParams: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete("status");
  next.delete("authenticationHealth");
  next.delete("offset");
  return next;
}

export function applyProfileInventoryOffsetChange({
  searchParams,
  filters,
  nextOffset,
}: {
  readonly searchParams: URLSearchParams;
  readonly filters: ProfileInventoryFilters;
  readonly nextOffset: number;
}): URLSearchParams {
  if (nextOffset < 0) {
    return new URLSearchParams(searchParams);
  }

  const next = new URLSearchParams();
  if (nextOffset > 0) {
    next.set("offset", String(nextOffset));
  }
  if (filters.status !== undefined) {
    next.set("status", filters.status);
  }
  if (filters.authenticationHealth !== undefined) {
    next.set("authenticationHealth", filters.authenticationHealth);
  }
  return next;
}
