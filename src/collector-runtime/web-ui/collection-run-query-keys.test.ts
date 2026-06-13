import { describe, expect, it } from "vitest";

// ── Query key structure (matches web collection-run-queries.ts) ──

const collectionRunQueryKeys = {
  all: ["collection-runs"] as const,
  list: (query: ListCollectionRunsQuery) =>
    [...collectionRunQueryKeys.all, "list", query] as const,
};

interface ListCollectionRunsQuery {
  readonly status?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  readonly sourceGroupId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

describe("collectionRunQueryKeys", () => {
  describe("all", () => {
    it("is a stable array with 'collection-runs' as base", () => {
      expect(collectionRunQueryKeys.all).toEqual(["collection-runs"]);
    });

    it("does not change between calls (referential stability)", () => {
      const first = collectionRunQueryKeys.all;
      const second = collectionRunQueryKeys.all;
      expect(first).toBe(first);
      expect(second).toBe(second);
    });
  });

  describe("list", () => {
    it("includes base key and 'list' marker", () => {
      const key = collectionRunQueryKeys.list({});
      expect(key[0]).toBe("collection-runs");
      expect(key[1]).toBe("list");
    });

    it("stores query parameters in the third position of the key array", () => {
      const key = collectionRunQueryKeys.list({ status: "QUEUED", limit: 50 });
      expect(key[2]).toEqual({ status: "QUEUED", limit: 50 });
    });

    it("includes status in query object when provided", () => {
      const key = collectionRunQueryKeys.list({ status: "QUEUED" });
      expect(key[2].status).toBe("QUEUED");
    });

    it("includes sourceGroupId in query object when provided", () => {
      const key = collectionRunQueryKeys.list({ sourceGroupId: "sg-123" });
      expect(key[2].sourceGroupId).toBe("sg-123");
    });

    it("includes limit in query object when provided", () => {
      const key = collectionRunQueryKeys.list({ limit: 50 });
      expect(key[2].limit).toBe(50);
    });

    it("includes offset in query object when provided", () => {
      const key = collectionRunQueryKeys.list({ offset: 100 });
      expect(key[2].offset).toBe(100);
    });

    it("creates distinct keys for different status values", () => {
      const queuedKey = collectionRunQueryKeys.list({ status: "QUEUED" });
      const runningKey = collectionRunQueryKeys.list({ status: "RUNNING" });
      expect(queuedKey).not.toEqual(runningKey);
    });

    it("creates distinct keys for different sourceGroupId values", () => {
      const sg1Key = collectionRunQueryKeys.list({ sourceGroupId: "sg-1" });
      const sg2Key = collectionRunQueryKeys.list({ sourceGroupId: "sg-2" });
      expect(sg1Key).not.toEqual(sg2Key);
    });

    it("creates distinct keys for different limit values", () => {
      const limit50Key = collectionRunQueryKeys.list({ limit: 50 });
      const limit100Key = collectionRunQueryKeys.list({ limit: 100 });
      expect(limit50Key).not.toEqual(limit100Key);
    });

    it("creates distinct keys for different offset values", () => {
      const offset0Key = collectionRunQueryKeys.list({ offset: 0 });
      const offset50Key = collectionRunQueryKeys.list({ offset: 50 });
      expect(offset0Key).not.toEqual(offset50Key);
    });

    it("includes all filters in the same query object", () => {
      const key = collectionRunQueryKeys.list({
        status: "RUNNING",
        sourceGroupId: "sg-test",
        limit: 25,
        offset: 50,
      });

      expect(key[2]).toEqual({
        status: "RUNNING",
        sourceGroupId: "sg-test",
        limit: 25,
        offset: 50,
      });
    });

    it("produces a serializable key structure", () => {
      const key = collectionRunQueryKeys.list({
        status: "QUEUED",
        sourceGroupId: "sg-1",
        limit: 50,
        offset: 0,
      });

      expect(() => JSON.stringify(key)).not.toThrow();
    });

    it("omits undefined query parameters", () => {
      const key = collectionRunQueryKeys.list({});
      expect(key[2]).toEqual({});
    });
  });
});
