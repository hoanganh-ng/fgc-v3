import { describe, expect, it } from "vitest";
import { profileQueryKeys } from "@/features/profiles/profile-queries";
import {
  PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS,
  PROFILE_INVENTORY_PAGE_SIZE,
  PROFILE_INVENTORY_STATUS_OPTIONS,
  applyProfileInventoryFilterChange,
  applyProfileInventoryOffsetChange,
  applyProfileInventoryResetFilters,
  buildProfileInventorySearchParams,
  formatProfileInventoryRangeText,
  getProfileAuthenticationHealthLabel,
  getProfileInventoryPaginationModel,
  getProfileInventoryVisibleRange,
  getProfileStatusLabel,
  hasActiveProfileInventoryFilters,
  parseProfileInventoryOffset,
  pickKnownValue,
  resolveProfileInventoryEmptyState,
} from "@/features/profiles/profile-inventory-view-model";

// ---------------------------------------------------------------------------
// Readable filter labels
// ---------------------------------------------------------------------------

describe("profile inventory view model - status and authentication health labels", () => {
  it("maps status values to operator-readable labels", () => {
    expect(getProfileStatusLabel("PENDING_CONFIG")).toBe("Pending configuration");
    expect(getProfileStatusLabel("PENDING_LOGIN")).toBe("Pending login");
    expect(getProfileStatusLabel("READY")).toBe("Ready");
    expect(getProfileStatusLabel("BUSY")).toBe("Busy");
  });

  it("maps authentication health values to operator-readable labels", () => {
    expect(getProfileAuthenticationHealthLabel("NOT_PROVISIONED")).toBe(
      "Not provisioned",
    );
    expect(getProfileAuthenticationHealthLabel("HEALTHY")).toBe("Healthy");
    expect(getProfileAuthenticationHealthLabel("REAUTH_REQUIRED")).toBe(
      "Reauthentication required",
    );
    expect(getProfileAuthenticationHealthLabel("CHECKPOINT_REVIEW_REQUIRED")).toBe(
      "Checkpoint review required",
    );
  });

  it("exposes enum options for the URL state and API requests", () => {
    expect(PROFILE_INVENTORY_STATUS_OPTIONS).toEqual([
      "PENDING_CONFIG",
      "PENDING_LOGIN",
      "READY",
      "BUSY",
    ]);
    expect(PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS).toEqual([
      "NOT_PROVISIONED",
      "HEALTHY",
      "REAUTH_REQUIRED",
      "CHECKPOINT_REVIEW_REQUIRED",
    ]);
  });
});

// ---------------------------------------------------------------------------
// pickKnownValue — valid and invalid status / authentication-health parsing
// ---------------------------------------------------------------------------

describe("pickKnownValue — status and authentication-health parsing", () => {
  it("returns undefined for null", () => {
    expect(pickKnownValue(null, PROFILE_INVENTORY_STATUS_OPTIONS)).toBeUndefined();
  });

  it("returns the value for a known status", () => {
    expect(pickKnownValue("READY", PROFILE_INVENTORY_STATUS_OPTIONS)).toBe("READY");
    expect(pickKnownValue("PENDING_LOGIN", PROFILE_INVENTORY_STATUS_OPTIONS)).toBe(
      "PENDING_LOGIN",
    );
  });

  it("returns undefined for an unknown status", () => {
    expect(pickKnownValue("UNKNOWN", PROFILE_INVENTORY_STATUS_OPTIONS)).toBeUndefined();
    expect(pickKnownValue("ready", PROFILE_INVENTORY_STATUS_OPTIONS)).toBeUndefined();
    expect(pickKnownValue("", PROFILE_INVENTORY_STATUS_OPTIONS)).toBeUndefined();
  });

  it("returns the value for a known authentication health", () => {
    expect(
      pickKnownValue("HEALTHY", PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS),
    ).toBe("HEALTHY");
    expect(
      pickKnownValue(
        "CHECKPOINT_REVIEW_REQUIRED",
        PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS,
      ),
    ).toBe("CHECKPOINT_REVIEW_REQUIRED");
  });

  it("returns undefined for an unknown authentication health", () => {
    expect(
      pickKnownValue("healthy", PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS),
    ).toBeUndefined();
    expect(
      pickKnownValue("UNKNOWN", PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS),
    ).toBeUndefined();
    expect(
      pickKnownValue("", PROFILE_INVENTORY_AUTHENTICATION_HEALTH_OPTIONS),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseProfileInventoryOffset — strict non-negative integer parsing
// ---------------------------------------------------------------------------

describe("parseProfileInventoryOffset — strict integer parsing", () => {
  it("returns 0 for null or empty", () => {
    expect(parseProfileInventoryOffset(null)).toBe(0);
    expect(parseProfileInventoryOffset("")).toBe(0);
  });

  it("accepts a complete non-negative integer string", () => {
    expect(parseProfileInventoryOffset("0")).toBe(0);
    expect(parseProfileInventoryOffset("25")).toBe(25);
    expect(parseProfileInventoryOffset("50")).toBe(50);
    expect(parseProfileInventoryOffset("1000000")).toBe(1_000_000);
  });

  it("rejects malformed values", () => {
    expect(parseProfileInventoryOffset("25abc")).toBe(0);
    expect(parseProfileInventoryOffset("1.5")).toBe(0);
    expect(parseProfileInventoryOffset("-1")).toBe(0);
    expect(parseProfileInventoryOffset("abc")).toBe(0);
    expect(parseProfileInventoryOffset(" 25")).toBe(0);
    expect(parseProfileInventoryOffset("25 ")).toBe(0);
    expect(parseProfileInventoryOffset("+25")).toBe(0);
  });

  it("rejects unsafe integers", () => {
    expect(parseProfileInventoryOffset(String(Number.MAX_SAFE_INTEGER) + "0")).toBe(0);
    expect(parseProfileInventoryOffset("99999999999999999999")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Filter change resets offset
// ---------------------------------------------------------------------------

describe("filter changes reset offset", () => {
  it("deletes offset when a status filter is set", () => {
    const next = applyProfileInventoryFilterChange({
      searchParams: new URLSearchParams("offset=50&status=READY"),
      key: "status",
      value: "PENDING_LOGIN",
    });
    expect(next.get("status")).toBe("PENDING_LOGIN");
    expect(next.get("offset")).toBeNull();
  });

  it("deletes offset when the status filter is cleared", () => {
    const next = applyProfileInventoryFilterChange({
      searchParams: new URLSearchParams("offset=50&status=READY"),
      key: "status",
      value: "",
    });
    expect(next.get("status")).toBeNull();
    expect(next.get("offset")).toBeNull();
  });

  it("deletes offset when an authentication-health filter is set", () => {
    const next = applyProfileInventoryFilterChange({
      searchParams: new URLSearchParams("offset=25"),
      key: "authenticationHealth",
      value: "HEALTHY",
    });
    expect(next.get("authenticationHealth")).toBe("HEALTHY");
    expect(next.get("offset")).toBeNull();
  });

  it("preserves other filter params when one filter changes", () => {
    const next = applyProfileInventoryFilterChange({
      searchParams: new URLSearchParams(
        "offset=25&status=READY&authenticationHealth=HEALTHY",
      ),
      key: "status",
      value: "BUSY",
    });
    expect(next.get("status")).toBe("BUSY");
    expect(next.get("authenticationHealth")).toBe("HEALTHY");
    expect(next.get("offset")).toBeNull();
  });

  it("hasActiveProfileInventoryFilters detects active filters", () => {
    expect(
      hasActiveProfileInventoryFilters({
        status: undefined,
        authenticationHealth: undefined,
        limit: 25,
        offset: 0,
      }),
    ).toBe(false);
    expect(
      hasActiveProfileInventoryFilters({
        status: "READY",
        authenticationHealth: undefined,
        limit: 25,
        offset: 0,
      }),
    ).toBe(true);
    expect(
      hasActiveProfileInventoryFilters({
        status: undefined,
        authenticationHealth: "HEALTHY",
        limit: 25,
        offset: 0,
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Query keys differ by status, health, limit, offset
// ---------------------------------------------------------------------------

describe("profile query keys differ by status, health, limit, and offset", () => {
  it("produces distinct keys for distinct status values", () => {
    const a = profileQueryKeys.list({
      status: "READY",
      limit: 25,
      offset: 0,
    });
    const b = profileQueryKeys.list({
      status: "PENDING_LOGIN",
      limit: 25,
      offset: 0,
    });
    expect(a).not.toEqual(b);
  });

  it("produces distinct keys for distinct authentication-health values", () => {
    const a = profileQueryKeys.list({
      authenticationHealth: "HEALTHY",
      limit: 25,
      offset: 0,
    });
    const b = profileQueryKeys.list({
      authenticationHealth: "REAUTH_REQUIRED",
      limit: 25,
      offset: 0,
    });
    expect(a).not.toEqual(b);
  });

  it("produces distinct keys for distinct limit values", () => {
    const a = profileQueryKeys.list({ limit: 25, offset: 0 });
    const b = profileQueryKeys.list({ limit: 50, offset: 0 });
    expect(a).not.toEqual(b);
  });

  it("produces distinct keys for distinct offset values", () => {
    const a = profileQueryKeys.list({ limit: 25, offset: 0 });
    const b = profileQueryKeys.list({ limit: 25, offset: 25 });
    expect(a).not.toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Previous and Next boundaries with total
// ---------------------------------------------------------------------------

describe("Previous and Next boundaries with total", () => {
  it("disables Next when offset + items reach the total", () => {
    const model = getProfileInventoryPaginationModel({
      offset: 100,
      limit: 25,
      itemCount: 20,
      total: 120,
    });
    expect(model.canGoNext).toBe(false);
    expect(model.canGoBack).toBe(true);
  });

  it("enables Next when more items remain", () => {
    const model = getProfileInventoryPaginationModel({
      offset: 0,
      limit: 25,
      itemCount: 25,
      total: 120,
    });
    expect(model.canGoNext).toBe(true);
    expect(model.canGoBack).toBe(false);
  });

  it("disables Previous at offset 0", () => {
    const model = getProfileInventoryPaginationModel({
      offset: 0,
      limit: 25,
      itemCount: 25,
      total: 120,
    });
    expect(model.canGoBack).toBe(false);
  });

  it("enables Previous whenever offset > 0", () => {
    const model = getProfileInventoryPaginationModel({
      offset: 25,
      limit: 25,
      itemCount: 0,
      total: 100,
    });
    expect(model.canGoBack).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pagination behavior when total is omitted
// ---------------------------------------------------------------------------

describe("pagination behavior when total is omitted", () => {
  it("enables Next only when itemCount >= limit", () => {
    expect(
      getProfileInventoryPaginationModel({
        offset: 0,
        limit: 25,
        itemCount: 25,
        total: undefined,
      }).canGoNext,
    ).toBe(true);
    expect(
      getProfileInventoryPaginationModel({
        offset: 0,
        limit: 25,
        itemCount: 24,
        total: undefined,
      }).canGoNext,
    ).toBe(false);
  });

  it("does not invent a total when total is omitted", () => {
    const model = getProfileInventoryPaginationModel({
      offset: 0,
      limit: 25,
      itemCount: 10,
      total: undefined,
    });
    expect(model.canGoBack).toBe(false);
    expect(model.canGoNext).toBe(false);
    expect(model.visibleRange).toEqual({ start: 1, end: 10 });
  });

  it("formats range text without total when total is omitted", () => {
    const text = formatProfileInventoryRangeText({
      limit: 25,
      offset: 0,
      itemCount: 10,
      total: undefined,
    });
    expect(text.rangeText).toBe("Showing 1-10");
    expect(text.totalText).toBe("of unknown total");
  });
});

// ---------------------------------------------------------------------------
// Visible range
// ---------------------------------------------------------------------------

describe("getProfileInventoryVisibleRange", () => {
  it("returns a 1-based range for non-empty items", () => {
    expect(getProfileInventoryVisibleRange({ offset: 50, itemCount: 25 })).toEqual({
      start: 51,
      end: 75,
    });
  });

  it("returns undefined when no items are visible", () => {
    expect(getProfileInventoryVisibleRange({ offset: 0, itemCount: 0 })).toBeUndefined();
    expect(getProfileInventoryVisibleRange({ offset: 25, itemCount: 0 })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Empty state resolution
// ---------------------------------------------------------------------------

describe("resolveProfileInventoryEmptyState", () => {
  it("returns NONE when items are present", () => {
    expect(
      resolveProfileInventoryEmptyState({
        itemCount: 5,
        total: 5,
        offset: 0,
        hasActiveFilters: false,
      }),
    ).toBe("NONE");
  });

  it("returns GLOBAL_NO_PROFILES when unfiltered and no profiles", () => {
    expect(
      resolveProfileInventoryEmptyState({
        itemCount: 0,
        total: 0,
        offset: 0,
        hasActiveFilters: false,
      }),
    ).toBe("GLOBAL_NO_PROFILES");
  });

  it("returns GLOBAL_NO_PROFILES when total is undefined and no items", () => {
    expect(
      resolveProfileInventoryEmptyState({
        itemCount: 0,
        total: undefined,
        offset: 0,
        hasActiveFilters: false,
      }),
    ).toBe("GLOBAL_NO_PROFILES");
  });

  it("returns FILTERED_NO_MATCH when filtered and no profiles", () => {
    expect(
      resolveProfileInventoryEmptyState({
        itemCount: 0,
        total: 0,
        offset: 0,
        hasActiveFilters: true,
      }),
    ).toBe("FILTERED_NO_MATCH");
  });

  it("returns OUT_OF_RANGE when total > 0 but no items on this page", () => {
    expect(
      resolveProfileInventoryEmptyState({
        itemCount: 0,
        total: 120,
        offset: 1000,
        hasActiveFilters: false,
      }),
    ).toBe("OUT_OF_RANGE");
  });

  it("returns OUT_OF_RANGE when offset > 0 and total is omitted", () => {
    expect(
      resolveProfileInventoryEmptyState({
        itemCount: 0,
        total: undefined,
        offset: 25,
        hasActiveFilters: true,
      }),
    ).toBe("OUT_OF_RANGE");
  });
});

// ---------------------------------------------------------------------------
// Range text formatting
// ---------------------------------------------------------------------------

describe("formatProfileInventoryRangeText", () => {
  it("uses total for the range when present", () => {
    const text = formatProfileInventoryRangeText({
      limit: 25,
      offset: 0,
      itemCount: 25,
      total: 120,
    });
    expect(text.rangeText).toBe("Showing 1-25");
    expect(text.totalText).toBe("120 profiles");
  });

  it("uses singular profile text for total of 1", () => {
    const text = formatProfileInventoryRangeText({
      limit: 25,
      offset: 0,
      itemCount: 1,
      total: 1,
    });
    expect(text.totalText).toBe("1 profile");
  });

  it("handles out-of-range page text", () => {
    const text = formatProfileInventoryRangeText({
      limit: 25,
      offset: 1000,
      itemCount: 0,
      total: 120,
    });
    expect(text.rangeText).toBe("No items on this page");
    expect(text.totalText).toBe("120 profiles");
  });

  it("uses Showing 0 when no items and no total", () => {
    const text = formatProfileInventoryRangeText({
      limit: 25,
      offset: 0,
      itemCount: 0,
      total: 0,
    });
    expect(text.rangeText).toBe("Showing 0");
    expect(text.totalText).toBe("0 profiles");
  });
});

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

describe("buildProfileInventorySearchParams", () => {
  it("emits status, health, and offset when present", () => {
    const params = buildProfileInventorySearchParams({
      status: "READY",
      authenticationHealth: "HEALTHY",
      offset: 50,
    });
    expect(params.toString()).toBe("status=READY&authenticationHealth=HEALTHY&offset=50");
  });

  it("omits offset when zero and omits undefined filters", () => {
    const params = buildProfileInventorySearchParams({
      status: undefined,
      authenticationHealth: "HEALTHY",
      offset: 0,
    });
    expect(params.toString()).toBe("authenticationHealth=HEALTHY");
  });

  it("omits all params when none are set", () => {
    const params = buildProfileInventorySearchParams({
      status: undefined,
      authenticationHealth: undefined,
      offset: 0,
    });
    expect(params.toString()).toBe("");
  });
});

describe("applyProfileInventoryOffsetChange preserves filters", () => {
  it("writes the next offset and keeps active filters", () => {
    const next = applyProfileInventoryOffsetChange({
      searchParams: new URLSearchParams("offset=25&status=READY"),
      filters: {
        status: "READY",
        authenticationHealth: "HEALTHY",
        limit: PROFILE_INVENTORY_PAGE_SIZE,
        offset: 25,
      },
      nextOffset: 50,
    });
    expect(next.get("status")).toBe("READY");
    expect(next.get("authenticationHealth")).toBe("HEALTHY");
    expect(next.get("offset")).toBe("50");
  });

  it("omits offset when next offset is zero", () => {
    const next = applyProfileInventoryOffsetChange({
      searchParams: new URLSearchParams("offset=25&status=READY"),
      filters: {
        status: "READY",
        authenticationHealth: undefined,
        limit: PROFILE_INVENTORY_PAGE_SIZE,
        offset: 25,
      },
      nextOffset: 0,
    });
    expect(next.get("offset")).toBeNull();
    expect(next.get("status")).toBe("READY");
  });

  it("ignores negative offsets", () => {
    const next = applyProfileInventoryOffsetChange({
      searchParams: new URLSearchParams("offset=25&status=READY"),
      filters: {
        status: "READY",
        authenticationHealth: undefined,
        limit: PROFILE_INVENTORY_PAGE_SIZE,
        offset: 25,
      },
      nextOffset: -1,
    });
    expect(next.get("offset")).toBe("25");
    expect(next.get("status")).toBe("READY");
  });
});

describe("applyProfileInventoryResetFilters", () => {
  it("removes status, authenticationHealth, and offset", () => {
    const next = applyProfileInventoryResetFilters(
      new URLSearchParams(
        "status=READY&authenticationHealth=HEALTHY&offset=50",
      ),
    );
    expect(next.toString()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Filtered no-match model does not offer New Profile
// ---------------------------------------------------------------------------

describe("filtered no-match model does not offer New Profile", () => {
  it("the filtered empty state is a distinct marker that does not carry global flags", () => {
    const state = resolveProfileInventoryEmptyState({
      itemCount: 0,
      total: 0,
      offset: 0,
      hasActiveFilters: true,
    });
    expect(state).toBe("FILTERED_NO_MATCH");
    expect(state).not.toBe("GLOBAL_NO_PROFILES");
  });
});
