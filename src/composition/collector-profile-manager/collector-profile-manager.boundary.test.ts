import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectTypeScriptFiles } from "../../test-support/collect-typescript-files";

const forbiddenImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:infrastructure|composition)[^"']*["']/;

describe("collector profile manager architecture boundary", () => {
  it("keeps domain and application code independent from infrastructure and composition", () => {
    const files = [
      ...collectTypeScriptFiles(
        new URL("../../collector-profile-manager/domain/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../collector-profile-manager/application/", import.meta.url),
      ),
    ];
    const offendingFiles = files.filter((file) =>
      forbiddenImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });

  it("keeps profile manager core independent from Content Manager internals", () => {
    const files = [
      ...collectTypeScriptFiles(
        new URL("../../collector-profile-manager/domain/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../collector-profile-manager/application/", import.meta.url),
      ),
    ];
    const offendingFiles = files.filter((file) =>
      /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*content-manager[^"']*["']/.test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });

  it("keeps source group reference validation away from Content Manager repositories", () => {
    const files = collectTypeScriptFiles(new URL("./", import.meta.url)).filter(
      (file) => !file.pathname.endsWith(".test.ts"),
    );
    const forbiddenRepositoryPattern =
      /(?:DrizzleSourceGroupRepository|drizzle-source-group\.repository|ports\/source-group-repository\.port)/;
    const offendingFiles = files.filter((file) =>
      forbiddenRepositoryPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });
});
