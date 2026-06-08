import { describe, expect, it } from "vitest";
import {
  CryptoIdGenerator,
  CryptoLeaseIdGenerator,
  CryptoTokenGenerator,
  SystemClock,
} from "./index";

describe("system infrastructure adapters", () => {
  it("returns the current time as a valid Date", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(Number.isNaN(now.getTime())).toBe(false);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it("generates non-empty unique provisioning tokens", async () => {
    const generator = new CryptoTokenGenerator();
    const tokens = await Promise.all(
      Array.from({ length: 10 }, () => generator.generateToken()),
    );

    expect(tokens.every((token) => token.length > 0)).toBe(true);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("generates non-empty unique lease ids", async () => {
    const generator = new CryptoLeaseIdGenerator();
    const leaseIds = await Promise.all(
      Array.from({ length: 10 }, () => generator.generateLeaseId()),
    );

    expect(leaseIds.every((leaseId) => leaseId.startsWith("lease-"))).toBe(
      true,
    );
    expect(new Set(leaseIds).size).toBe(leaseIds.length);
  });

  it("generates non-empty unique ids", async () => {
    const generator = new CryptoIdGenerator("content");
    const ids = await Promise.all(
      Array.from({ length: 10 }, () => generator.generateId()),
    );

    expect(ids.every((id) => id.startsWith("content-"))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
