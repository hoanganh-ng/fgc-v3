import { describe, expect, it } from "vitest";
import {
  CollectionScheduleCadencePolicyError,
  nextDispatchBoundary,
} from "./collection-schedule-cadence";

const T0 = "2026-06-17T10:00:00.000Z";

describe("collection schedule cadence policy", () => {
  it("returns the next boundary when dispatch happens exactly at the previous boundary", () => {
    expect(nextDispatchBoundary(T0, 30, T0)).toBe("2026-06-17T10:30:00.000Z");
  });

  it("returns the next boundary when dispatch is one millisecond past the previous boundary", () => {
    expect(nextDispatchBoundary(T0, 30, "2026-06-17T10:00:00.001Z")).toBe(
      "2026-06-17T10:30:00.000Z",
    );
  });

  it("returns the next boundary when dispatch is just before the next boundary", () => {
    expect(
      nextDispatchBoundary(T0, 30, "2026-06-17T10:29:59.999Z"),
    ).toBe("2026-06-17T10:30:00.000Z");
  });

  it("skips one missed interval when dispatch is 35 minutes late", () => {
    expect(nextDispatchBoundary(T0, 30, "2026-06-17T10:35:00.000Z")).toBe(
      "2026-06-17T11:00:00.000Z",
    );
  });

  it("skips multiple missed intervals when dispatch is 90 minutes late", () => {
    expect(nextDispatchBoundary(T0, 30, "2026-06-17T11:30:00.000Z")).toBe(
      "2026-06-17T12:00:00.000Z",
    );
  });

  it("handles one-minute intervals with sub-minute dispatch latency", () => {
    expect(nextDispatchBoundary(T0, 1, "2026-06-17T10:00:00.999Z")).toBe(
      "2026-06-17T10:01:00.000Z",
    );
  });

  it("advances one boundary when dispatch is exactly at the next one-minute boundary", () => {
    expect(nextDispatchBoundary(T0, 1, "2026-06-17T10:01:00.000Z")).toBe(
      "2026-06-17T10:02:00.000Z",
    );
  });

  it("supports the maximum interval of 10080 minutes (one week)", () => {
    expect(
      nextDispatchBoundary(T0, 10080, "2026-06-17T10:00:00.001Z"),
    ).toBe("2026-06-24T10:00:00.000Z");
  });

  it("throws when intervalMinutes is zero", () => {
    expect(() => nextDispatchBoundary(T0, 0, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("throws when intervalMinutes is negative", () => {
    expect(() => nextDispatchBoundary(T0, -1, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("throws when intervalMinutes exceeds 10080", () => {
    expect(() => nextDispatchBoundary(T0, 10081, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("throws when intervalMinutes is not an integer", () => {
    expect(() => nextDispatchBoundary(T0, 1.5, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("throws when intervalMinutes is NaN", () => {
    expect(() => nextDispatchBoundary(T0, Number.NaN, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("throws when previousNextRunAt is not a valid ISO datetime", () => {
    expect(() => nextDispatchBoundary("not-a-date", 30, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("rejects a date-only previousNextRunAt without a time component", () => {
    expect(() => nextDispatchBoundary("2026-06-17", 30, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("rejects an offsetless ISO previousNextRunAt without a zone designator", () => {
    expect(() => nextDispatchBoundary("2026-06-17T10:00:00", 30, T0)).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("rejects an offsetless ISO dispatchTime without a zone designator", () => {
    expect(() => nextDispatchBoundary(T0, 30, "2026-06-17T10:00:00")).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("accepts a dispatchTime with a numeric UTC offset", () => {
    expect(
      nextDispatchBoundary(T0, 30, "2026-06-17T10:00:01.000+00:00"),
    ).toBe("2026-06-17T10:30:00.000Z");
  });

  it("accepts a previousNextRunAt with a numeric non-UTC offset", () => {
    expect(
      nextDispatchBoundary("2026-06-17T12:00:00.000+02:00", 30, T0),
    ).toBe("2026-06-17T10:30:00.000Z");
  });

  it("throws when dispatchTime is not a valid ISO datetime", () => {
    expect(() => nextDispatchBoundary(T0, 30, "not-a-date")).toThrow(
      CollectionScheduleCadencePolicyError,
    );
  });

  it("throws when dispatchTime is earlier than previousNextRunAt", () => {
    expect(() =>
      nextDispatchBoundary(
        "2026-06-17T11:00:00.000Z",
        30,
        "2026-06-17T10:30:00.000Z",
      ),
    ).toThrow(CollectionScheduleCadencePolicyError);
  });

  it("throws when dispatchTime is earlier by a millisecond", () => {
    expect(() =>
      nextDispatchBoundary(
        "2026-06-17T10:00:00.001Z",
        30,
        "2026-06-17T10:00:00.000Z",
      ),
    ).toThrow(CollectionScheduleCadencePolicyError);
  });

  it("accepts dispatchTime exactly equal to previousNextRunAt", () => {
    expect(nextDispatchBoundary(T0, 30, T0)).toBe("2026-06-17T10:30:00.000Z");
  });

  it("does not mutate the input ISO datetime strings", () => {
    const previous = T0;
    const dispatch = "2026-06-17T10:35:00.000Z";

    nextDispatchBoundary(previous, 30, dispatch);

    expect(previous).toBe(T0);
    expect(dispatch).toBe("2026-06-17T10:35:00.000Z");
  });
});