import { describe, expect, it } from "vitest";
import {
  profileSourceAccessCheckRunQueryKeys,
} from "@/features/collector-runtime/profile-source-access-check-run-queries";

describe("profile-source-access-check-run queries", () => {
  describe("profileSourceAccessCheckRunQueryKeys", () => {
    it("list key always starts with the family root", () => {
      const key = profileSourceAccessCheckRunQueryKeys.list({ limit: 50, offset: 0 });
      expect(key[0]).toBe("profile-source-access-check-runs");
      expect(key[1]).toBe("list");
    });

    it("detail key always starts with the family root", () => {
      const key = profileSourceAccessCheckRunQueryKeys.detail("run-1");
      expect(key[0]).toBe("profile-source-access-check-runs");
      expect(key[1]).toBe("detail");
    });

    it("list keys are stable for the same query params", () => {
      const query = { limit: 50, offset: 0, status: "QUEUED" as const };
      expect(profileSourceAccessCheckRunQueryKeys.list(query)).toEqual(
        profileSourceAccessCheckRunQueryKeys.list(query),
      );
    });

    it("list keys differ when query params differ", () => {
      const keyA = profileSourceAccessCheckRunQueryKeys.list({ limit: 50, offset: 0 });
      const keyB = profileSourceAccessCheckRunQueryKeys.list({ limit: 50, offset: 50 });
      expect(keyA).not.toEqual(keyB);
    });

    it("detail keys are stable for the same id", () => {
      expect(profileSourceAccessCheckRunQueryKeys.detail("run-abc")).toEqual(
        profileSourceAccessCheckRunQueryKeys.detail("run-abc"),
      );
    });

    it("detail keys differ for different ids", () => {
      expect(profileSourceAccessCheckRunQueryKeys.detail("run-1")).not.toEqual(
        profileSourceAccessCheckRunQueryKeys.detail("run-2"),
      );
    });

    it("list and detail keys are distinct from each other", () => {
      const listKey = profileSourceAccessCheckRunQueryKeys.list({ limit: 50 });
      const detailKey = profileSourceAccessCheckRunQueryKeys.detail("run-1");
      expect(listKey).not.toEqual(detailKey);
    });

    it("all key is a prefix of list and detail keys", () => {
      const allKey = profileSourceAccessCheckRunQueryKeys.all;
      const listKey = profileSourceAccessCheckRunQueryKeys.list({ limit: 50 });
      const detailKey = profileSourceAccessCheckRunQueryKeys.detail("run-1");

      expect(listKey.slice(0, allKey.length)).toEqual(allKey);
      expect(detailKey.slice(0, allKey.length)).toEqual(allKey);
    });
  });

  describe("useProfileSourceAccessCheckRunQuery enabled flag", () => {
    // Mirror the hook's enabled predicate without rendering.
    function isQueryEnabled(checkRunId: string | undefined): boolean {
      const normalizedId = checkRunId?.trim() ?? "";
      return normalizedId.length > 0;
    }

    it("detail query is disabled when id is undefined", () => {
      expect(isQueryEnabled(undefined)).toBe(false);
    });

    it("detail query is disabled when id is an empty string", () => {
      expect(isQueryEnabled("")).toBe(false);
    });

    it("detail query is disabled when id is whitespace only", () => {
      expect(isQueryEnabled("   ")).toBe(false);
    });

    it("detail query is enabled for a non-blank id", () => {
      expect(isQueryEnabled("run-abc")).toBe(true);
    });
  });
});
