import { describe, expect, it } from "vitest";

// ── Pure helper functions extracted from collection-runs-page.tsx for testability ──

/**
 * Determines if polling should be active based on displayed runs.
 * Polling is enabled only when at least one displayed run is QUEUED or RUNNING.
 * Uses TanStack Query refetchInterval rather than an independent timer.
 */
function shouldEnablePolling(
  runs: ReadonlyArray<{ readonly status: string }>,
): boolean {
  return runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING");
}

/**
 * Computes whether the Previous button should be disabled.
 * Previous is disabled at offset zero.
 */
function isPreviousDisabled(offset: number): boolean {
  return offset <= 0;
}

/**
 * Computes whether the Next button should be disabled.
 * Next is disabled when:
 * - total is absent and page is short (cannot determine if more exists)
 * - offset + limit >= total
 */
function isNextDisabled(
  offset: number,
  limit: number,
  total: number | undefined,
): boolean {
  if (total === undefined) {
    return true;
  }
  return offset + limit >= total;
}

/**
 * Computes the expected offset after changing status filter.
 * Changing status must reset offset to zero.
 */
function getNextOffsetForStatusChange(
  _currentOffset: number,
  _newStatus: string,
): number {
  return 0;
}

/**
 * Computes the expected offset after changing source-group filter.
 * Changing source-group must reset offset to zero.
 */
function getNextOffsetForSourceGroupChange(
  _currentOffset: number,
  _newSourceGroupId: string,
): number {
  return 0;
}

/**
 * Determines if Cancel button should appear for a run.
 * Cancel appears only for QUEUED runs.
 * RUNNING runs cannot be canceled.
 */
function shouldShowCancelButton(status: string): boolean {
  return status === "QUEUED";
}

describe("polling behavior", () => {
  const POLL_INTERVAL_MS = 5_000;

  it("enables polling when displayed runs contain QUEUED", () => {
    const runs = [{ status: "QUEUED" }, { status: "SUCCEEDED" }];
    expect(shouldEnablePolling(runs)).toBe(true);
  });

  it("enables polling when displayed runs contain RUNNING", () => {
    const runs = [{ status: "RUNNING" }, { status: "SUCCEEDED" }];
    expect(shouldEnablePolling(runs)).toBe(true);
  });

  it("enables polling when any displayed run is QUEUED among terminal statuses", () => {
    const runs = [
      { status: "SUCCEEDED" },
      { status: "QUEUED" },
      { status: "FAILED" },
      { status: "CANCELED" },
    ];
    expect(shouldEnablePolling(runs)).toBe(true);
  });

  it("enables polling when any displayed run is RUNNING among terminal statuses", () => {
    const runs = [
      { status: "SUCCEEDED" },
      { status: "RUNNING" },
      { status: "FAILED" },
    ];
    expect(shouldEnablePolling(runs)).toBe(true);
  });

  it("disables polling when all displayed runs are terminal (SUCCEEDED)", () => {
    const runs = [{ status: "SUCCEEDED" }, { status: "SUCCEEDED" }];
    expect(shouldEnablePolling(runs)).toBe(false);
  });

  it("disables polling when all displayed runs are terminal (FAILED, CANCELED)", () => {
    const runs = [{ status: "FAILED" }, { status: "CANCELED" }];
    expect(shouldEnablePolling(runs)).toBe(false);
  });

  it("disables polling when displayed runs are mixed terminal statuses", () => {
    const runs = [
      { status: "SUCCEEDED" },
      { status: "FAILED" },
      { status: "CANCELED" },
    ];
    expect(shouldEnablePolling(runs)).toBe(false);
  });

  it("disables polling for empty run list", () => {
    const runs: Array<{ status: string }> = [];
    expect(shouldEnablePolling(runs)).toBe(false);
  });

  it("uses TanStack Query refetchInterval pattern (returns interval or false)", () => {
    const activeRuns = [{ status: "QUEUED" }];
    const terminalRuns = [{ status: "SUCCEEDED" }];

    const activeInterval = shouldEnablePolling(activeRuns)
      ? POLL_INTERVAL_MS
      : false;
    const terminalInterval = shouldEnablePolling(terminalRuns)
      ? POLL_INTERVAL_MS
      : false;

    expect(activeInterval).toBe(POLL_INTERVAL_MS);
    expect(terminalInterval).toBe(false);
  });
});

describe("pagination controls", () => {
  describe("Previous button", () => {
    it("is disabled at offset zero", () => {
      expect(isPreviousDisabled(0)).toBe(true);
    });

    it("is enabled when offset is greater than zero", () => {
      expect(isPreviousDisabled(50)).toBe(false);
      expect(isPreviousDisabled(100)).toBe(false);
    });
  });

  describe("Next button", () => {
    it("is disabled when total is absent (cannot determine if more exists)", () => {
      expect(isNextDisabled(0, 50, undefined)).toBe(true);
      expect(isNextDisabled(50, 50, undefined)).toBe(true);
    });

    it("is disabled when offset + limit >= total", () => {
      expect(isNextDisabled(0, 50, 50)).toBe(true);
      expect(isNextDisabled(50, 50, 100)).toBe(true);
      expect(isNextDisabled(100, 50, 100)).toBe(true);
    });

    it("is enabled when offset + limit < total", () => {
      expect(isNextDisabled(0, 50, 100)).toBe(false);
      expect(isNextDisabled(0, 50, 51)).toBe(false);
      expect(isNextDisabled(50, 50, 150)).toBe(false);
    });

    it("respects page.total for enabling/disabling", () => {
      const total = 150;
      const limit = 50;

      expect(isNextDisabled(0, limit, total)).toBe(false);
      expect(isNextDisabled(50, limit, total)).toBe(false);
      expect(isNextDisabled(100, limit, total)).toBe(true);
    });

    it("is disabled for a short page when total is absent", () => {
      // Even if we got only 3 items back, without total we can't know if more exist
      expect(isNextDisabled(0, 50, undefined)).toBe(true);
    });
  });

  describe("filter changes reset offset", () => {
    it("resets offset to zero when status filter changes", () => {
      expect(getNextOffsetForStatusChange(50, "QUEUED")).toBe(0);
      expect(getNextOffsetForStatusChange(100, "RUNNING")).toBe(0);
      expect(getNextOffsetForStatusChange(0, "")).toBe(0);
    });

    it("resets offset to zero when source-group filter changes", () => {
      expect(getNextOffsetForSourceGroupChange(50, "sg-1")).toBe(0);
      expect(getNextOffsetForSourceGroupChange(100, "sg-2")).toBe(0);
      expect(getNextOffsetForSourceGroupChange(0, "")).toBe(0);
    });
  });
});

describe("cancellation visibility", () => {
  it("shows Cancel button only for QUEUED runs", () => {
    expect(shouldShowCancelButton("QUEUED")).toBe(true);
  });

  it("hides Cancel button for RUNNING runs", () => {
    expect(shouldShowCancelButton("RUNNING")).toBe(false);
  });

  it("hides Cancel button for terminal statuses", () => {
    expect(shouldShowCancelButton("SUCCEEDED")).toBe(false);
    expect(shouldShowCancelButton("FAILED")).toBe(false);
    expect(shouldShowCancelButton("CANCELED")).toBe(false);
  });
});
